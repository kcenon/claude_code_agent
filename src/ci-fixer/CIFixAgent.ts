/**
 * CI Fix Agent module
 *
 * Implements automated CI/CD failure diagnosis and fix.
 * Receives handoff from PR Reviewer Agent when CI fails repeatedly.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 *
 * @module ci-fixer/CIFixAgent
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

import type { IAgent } from '../agents/types.js';
import type {
  CIFixerAgentConfig,
  CIFixHandoff,
  CIFixResult,
  CIFixAttempt,
  CIAnalysisResult,
  CICheck,
  AppliedFix,
  VerificationResult,
  NextAction,
  FixOutcome,
} from './types.js';
import { DEFAULT_CI_FIXER_CONFIG } from './types.js';
import { CILogAnalyzer } from './CILogAnalyzer.js';
import { FixStrategies } from './FixStrategies.js';
import {
  HandoffNotFoundError,
  HandoffParseError,
  CILogFetchError,
  GitOperationError,
  CommitError,
  PushError,
  EscalationRequiredError,
  ResultPersistenceError,
} from './errors.js';
import { getCommandSanitizer } from '../security/index.js';

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Singleton instance
 */
let instance: CIFixAgent | null = null;

/**
 * Agent ID for CIFixAgent used in AgentFactory
 */
export const CI_FIX_AGENT_ID = 'ci-fix-agent';

/**
 * CI Fix Agent
 *
 * Automatically diagnoses and fixes CI/CD failures.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class CIFixAgent implements IAgent {
  public readonly agentId = CI_FIX_AGENT_ID;
  public readonly name = 'CI Fix Agent';

  private readonly config: Required<CIFixerAgentConfig>;
  private readonly logAnalyzer: CILogAnalyzer;
  private readonly fixStrategies: FixStrategies;
  private initialized = false;

  constructor(config: CIFixerAgentConfig = {}) {
    this.config = {
      projectRoot: config.projectRoot ?? DEFAULT_CI_FIXER_CONFIG.projectRoot,
      resultsPath: config.resultsPath ?? DEFAULT_CI_FIXER_CONFIG.resultsPath,
      maxFixAttempts: config.maxFixAttempts ?? DEFAULT_CI_FIXER_CONFIG.maxFixAttempts,
      maxDelegations: config.maxDelegations ?? DEFAULT_CI_FIXER_CONFIG.maxDelegations,
      fixTimeout: config.fixTimeout ?? DEFAULT_CI_FIXER_CONFIG.fixTimeout,
      ciPollInterval: config.ciPollInterval ?? DEFAULT_CI_FIXER_CONFIG.ciPollInterval,
      ciWaitTimeout: config.ciWaitTimeout ?? DEFAULT_CI_FIXER_CONFIG.ciWaitTimeout,
      enableLintFix: config.enableLintFix ?? DEFAULT_CI_FIXER_CONFIG.enableLintFix,
      enableTypeFix: config.enableTypeFix ?? DEFAULT_CI_FIXER_CONFIG.enableTypeFix,
      enableTestFix: config.enableTestFix ?? DEFAULT_CI_FIXER_CONFIG.enableTestFix,
      enableBuildFix: config.enableBuildFix ?? DEFAULT_CI_FIXER_CONFIG.enableBuildFix,
    };

    this.logAnalyzer = new CILogAnalyzer();
    this.fixStrategies = new FixStrategies({
      projectRoot: this.config.projectRoot,
      timeout: this.config.fixTimeout,
    });
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.resolve();
    this.initialized = true;
  }

  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.initialized = false;
  }

  /**
   * Main entry point: Fix CI failures from handoff document
   *
   * @param handoffPath - Path to the handoff YAML file
   * @returns CI fix result
   */
  public async fixFromHandoff(handoffPath: string): Promise<CIFixResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // 1. Read handoff document
    const handoff = await this.readHandoff(handoffPath);

    // 2. Check if we should escalate immediately
    if (handoff.currentAttempt >= handoff.maxFixAttempts) {
      throw new EscalationRequiredError(
        handoff.prNumber,
        'max_attempts_reached',
        `Maximum fix attempts (${String(handoff.maxFixAttempts)}) reached`
      );
    }

    // 3. Fetch and analyze CI logs
    const analysis = await this.fetchAndAnalyzeLogs(handoff);

    // 4. Check for security vulnerabilities (immediate escalation)
    const securityFailures = analysis.identifiedCauses.filter((f) => f.category === 'security');
    if (securityFailures.length > 0) {
      throw new EscalationRequiredError(
        handoff.prNumber,
        'security_vulnerability',
        `Security vulnerabilities detected: ${securityFailures.map((f) => f.message).join(', ')}`
      );
    }

    // 5. Apply fixes
    const fixesApplied = await this.applyFixes(analysis, handoff);

    // 6. Verify locally
    const verification = await this.fixStrategies.runVerification();

    // 7. Commit and push if fixes were applied
    let commitHash: string | undefined;
    let commitMessage: string | undefined;

    const successfulFixes = fixesApplied.filter((f) => f.success);
    if (successfulFixes.length > 0) {
      const commitResult = await this.commitAndPush(handoff, successfulFixes);
      commitHash = commitResult.hash;
      commitMessage = commitResult.message;
    }

    // 8. Determine outcome and next action
    const outcome = this.determineOutcome(verification, analysis);
    const nextAction = this.determineNextAction(handoff, outcome, analysis, verification);

    // 9. Build result
    const completedAt = new Date().toISOString();
    const result: CIFixResult = {
      prNumber: handoff.prNumber,
      attempt: handoff.currentAttempt,
      analysis,
      fixesApplied,
      verification,
      outcome,
      nextAction,
      startedAt,
      completedAt,
      duration: Date.now() - startTime,
      commitHash,
      commitMessage,
    };

    // 10. Persist result
    await this.persistResult(result);

    // 11. Create handoff for next agent if delegating
    if (nextAction.type === 'delegate') {
      await this.createDelegationHandoff(handoff, result);
    }

    // 12. Escalate if needed
    if (nextAction.type === 'escalate') {
      await this.escalate(handoff, result);
    }

    return result;
  }

  /**
   * Fix CI failures directly for a PR (creates initial handoff)
   *
   * @param prNumber - PR number to fix
   * @param options - Additional options
   * @returns CI fix result
   */
  public async fixPR(
    prNumber: number,
    options?: {
      branch?: string;
      originalIssue?: string;
      implementationSummary?: string;
    }
  ): Promise<CIFixResult> {
    // Create initial handoff
    const handoff = await this.createInitialHandoff(prNumber, options);
    const handoffPath = await this.persistHandoff(handoff);

    return this.fixFromHandoff(handoffPath);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Read handoff document
   */
  private async readHandoff(handoffPath: string): Promise<CIFixHandoff> {
    if (!existsSync(handoffPath)) {
      throw new HandoffNotFoundError(handoffPath);
    }

    try {
      const content = await readFile(handoffPath, 'utf-8');
      return yaml.load(content) as CIFixHandoff;
    } catch (error) {
      throw new HandoffParseError(handoffPath, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Create initial handoff for a PR
   */
  private async createInitialHandoff(
    prNumber: number,
    options?: {
      branch?: string;
      originalIssue?: string;
      implementationSummary?: string;
    }
  ): Promise<CIFixHandoff> {
    // Get PR info
    const prInfo = await this.getPRInfo(prNumber);

    // Get failed checks
    const failedChecks = await this.getFailedChecks(prNumber);

    // Get changed files
    const changedFiles = await this.getChangedFiles(prNumber);

    return {
      prNumber,
      prUrl: `https://github.com/${await this.getRepoName()}/pull/${String(prNumber)}`,
      branch: options?.branch ?? prInfo.branch,
      originalIssue: options?.originalIssue ?? `PR #${String(prNumber)}`,
      failedChecks,
      failureLogs: [],
      attemptHistory: [],
      implementationSummary: options?.implementationSummary ?? 'Unknown implementation',
      changedFiles,
      testFiles: changedFiles.filter((f) => f.includes('.test.') || f.includes('.spec.')),
      maxFixAttempts: this.config.maxFixAttempts,
      currentAttempt: 1,
      escalationThreshold: this.config.maxDelegations,
    };
  }

  /**
   * Persist handoff document
   */
  private async persistHandoff(handoff: CIFixHandoff): Promise<string> {
    const handoffDir = join(this.config.projectRoot, this.config.resultsPath);

    if (!existsSync(handoffDir)) {
      await mkdir(handoffDir, { recursive: true });
    }

    const handoffPath = join(handoffDir, `handoff-PR-${String(handoff.prNumber)}.yaml`);
    const yamlContent = yaml.dump(handoff, { indent: 2 });
    await writeFile(handoffPath, yamlContent, 'utf-8');

    return handoffPath;
  }

  /**
   * Fetch and analyze CI logs
   */
  private async fetchAndAnalyzeLogs(handoff: CIFixHandoff): Promise<CIAnalysisResult> {
    let allLogs = '';

    // Fetch logs for each failed check
    for (const check of handoff.failedChecks) {
      if (check.runId !== undefined) {
        try {
          const logs = await this.fetchCILogs(check.runId);
          allLogs += `\n=== ${check.name} ===\n${logs}\n`;
        } catch {
          // Log fetch failure is not critical
          allLogs += `\n=== ${check.name} === (logs unavailable)\n`;
        }
      }
    }

    // Also try to get workflow logs
    try {
      const workflowLogs = await this.fetchWorkflowLogs(handoff.prNumber);
      allLogs += `\n=== Workflow Logs ===\n${workflowLogs}\n`;
    } catch {
      // Workflow logs unavailable
    }

    // Analyze the logs
    return this.logAnalyzer.analyze(allLogs);
  }

  /**
   * Fetch CI logs for a run
   */
  private async fetchCILogs(runId: number): Promise<string> {
    try {
      const result = await this.executeCommand(`gh run view ${String(runId)} --log-failed`);
      return result.stdout;
    } catch (error) {
      throw new CILogFetchError(runId, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Fetch workflow logs for a PR
   */
  private async fetchWorkflowLogs(prNumber: number): Promise<string> {
    const result = await this.executeCommand(
      `gh pr checks ${String(prNumber)} --json name,status,conclusion`
    );
    return result.stdout;
  }

  /**
   * Apply fixes based on analysis
   */
  private async applyFixes(
    analysis: CIAnalysisResult,
    _handoff: CIFixHandoff
  ): Promise<AppliedFix[]> {
    const categories: Array<'lint' | 'type' | 'test' | 'build' | 'dependency'> = [];

    if (this.config.enableLintFix) categories.push('lint');
    if (this.config.enableTypeFix) categories.push('type');
    if (this.config.enableTestFix) categories.push('test');
    if (this.config.enableBuildFix) categories.push('build');
    categories.push('dependency');

    return this.fixStrategies.applyAllFixes(analysis.identifiedCauses, categories);
  }

  /**
   * Commit and push fixes
   */
  private async commitAndPush(
    handoff: CIFixHandoff,
    fixes: readonly AppliedFix[]
  ): Promise<{ hash: string; message: string }> {
    // Checkout the PR branch
    try {
      await this.executeCommand(`git checkout ${handoff.branch}`);
    } catch (error) {
      throw new GitOperationError(
        `checkout ${handoff.branch}`,
        error instanceof Error ? error : undefined
      );
    }

    // Stage all changes
    try {
      await this.executeCommand('git add -A');
    } catch (error) {
      throw new GitOperationError('add', error instanceof Error ? error : undefined);
    }

    // Check if there are changes to commit
    const statusResult = await this.executeCommand('git status --porcelain');
    if (statusResult.stdout.trim() === '') {
      return { hash: '', message: '' };
    }

    // Generate commit message
    const fixDescriptions = fixes.map((f) => `- ${f.type}: ${f.description}`).join('\n');
    const commitMessage = `fix(ci): auto-fix CI failures (attempt ${String(handoff.currentAttempt)})

${fixDescriptions}

Fixes applied by CI Fix Agent for PR #${String(handoff.prNumber)}`;

    // Commit
    try {
      await this.executeCommand(`git commit -m "${this.escapeForParser(commitMessage)}"`);
    } catch (error) {
      throw new CommitError(handoff.branch, error instanceof Error ? error : undefined);
    }

    // Get commit hash
    const hashResult = await this.executeCommand('git rev-parse HEAD');
    const hash = hashResult.stdout.trim();

    // Push
    try {
      await this.executeCommand(`git push origin ${handoff.branch}`);
    } catch (error) {
      throw new PushError(handoff.branch, error instanceof Error ? error : undefined);
    }

    return { hash, message: commitMessage };
  }

  /**
   * Determine fix outcome
   */
  private determineOutcome(
    verification: VerificationResult,
    analysis: CIAnalysisResult
  ): FixOutcome {
    // All checks pass
    if (
      verification.lintPassed &&
      verification.typecheckPassed &&
      verification.testsPassed &&
      verification.buildPassed
    ) {
      return 'success';
    }

    // Some checks now pass
    const failedBefore = analysis.totalFailures;
    const failedAfter = [
      !verification.lintPassed,
      !verification.typecheckPassed,
      !verification.testsPassed,
      !verification.buildPassed,
    ].filter(Boolean).length;

    if (failedAfter < failedBefore) {
      return 'partial';
    }

    return 'failed';
  }

  /**
   * Determine next action
   */
  private determineNextAction(
    handoff: CIFixHandoff,
    outcome: FixOutcome,
    _analysis: CIAnalysisResult,
    verification: VerificationResult
  ): NextAction {
    if (outcome === 'success') {
      return {
        type: 'none',
        reason: 'All CI checks now pass',
      };
    }

    // Check if we've made progress
    const previousAttempts = handoff.attemptHistory;
    if (previousAttempts.length > 0 && !this.hasProgress(previousAttempts, verification)) {
      return {
        type: 'escalate',
        reason: 'No progress made after fix attempts',
      };
    }

    // Check if we can delegate
    if (handoff.currentAttempt < handoff.escalationThreshold) {
      const handoffPath = join(
        this.config.projectRoot,
        this.config.resultsPath,
        `handoff-PR-${String(handoff.prNumber)}-attempt-${String(handoff.currentAttempt + 1)}.yaml`
      );

      return {
        type: 'delegate',
        reason: `Delegating to CI Fix Agent attempt ${String(handoff.currentAttempt + 1)}`,
        handoffPath,
      };
    }

    return {
      type: 'escalate',
      reason: 'Maximum delegation count reached',
    };
  }

  /**
   * Check if progress was made compared to previous attempts
   */
  private hasProgress(
    previousAttempts: readonly CIFixAttempt[],
    currentVerification: VerificationResult
  ): boolean {
    if (previousAttempts.length === 0) {
      return true; // First attempt, assume progress
    }

    const lastAttempt = previousAttempts[previousAttempts.length - 1];
    if (lastAttempt === undefined) {
      return true;
    }

    // Count current passing checks
    const currentPassing = [
      currentVerification.lintPassed,
      currentVerification.typecheckPassed,
      currentVerification.testsPassed,
      currentVerification.buildPassed,
    ].filter(Boolean).length;

    // Compare with last attempt's succeeded fixes
    const previousPassing = lastAttempt.fixesSucceeded.length;

    return currentPassing > previousPassing;
  }

  /**
   * Create delegation handoff for next CI Fix Agent
   */
  private async createDelegationHandoff(
    originalHandoff: CIFixHandoff,
    result: CIFixResult
  ): Promise<void> {
    const newAttempt: CIFixAttempt = {
      attempt: result.attempt,
      agentId: `ci-fixer-${String(result.attempt)}`,
      fixesAttempted: result.fixesApplied.map((f) => f.description),
      fixesSucceeded: result.fixesApplied.filter((f) => f.success).map((f) => f.description),
      remainingIssues: result.analysis.identifiedCauses
        .filter((c) => !result.fixesApplied.some((f) => f.success && f.file === c.file))
        .map((c) => c.message),
      timestamp: result.completedAt,
      duration: result.duration,
    };

    const newHandoff: CIFixHandoff = {
      ...originalHandoff,
      currentAttempt: originalHandoff.currentAttempt + 1,
      attemptHistory: [...originalHandoff.attemptHistory, newAttempt],
      failureLogs: [...originalHandoff.failureLogs, result.analysis.rawLogs],
    };

    await this.persistHandoff(newHandoff);
  }

  /**
   * Escalate to human review
   */
  private async escalate(handoff: CIFixHandoff, result: CIFixResult): Promise<void> {
    // Add label to PR
    await this.executeCommand(
      `gh pr edit ${String(handoff.prNumber)} --add-label "needs-human-review"`
    );

    // Add comment to PR
    const escalationInfo = this.generateEscalationComment(handoff, result);
    await this.executeCommand(
      `gh pr comment ${String(handoff.prNumber)} --body "${this.escapeForParser(escalationInfo)}"`
    );
  }

  /**
   * Generate escalation comment for PR
   */
  private generateEscalationComment(handoff: CIFixHandoff, result: CIFixResult): string {
    const unresolvedIssues = result.analysis.identifiedCauses
      .map((c) => `- **${c.category}**: ${c.message}${c.file !== undefined ? ` (${c.file})` : ''}`)
      .join('\n');

    return `## CI Fix Agent Escalation

The CI Fix Agent was unable to automatically resolve all CI failures after ${String(result.attempt)} attempts.

### Unresolved Issues
${unresolvedIssues}

### Attempt History
${handoff.attemptHistory.map((a) => `- Attempt ${String(a.attempt)}: ${String(a.fixesSucceeded.length)}/${String(a.fixesAttempted.length)} fixes succeeded`).join('\n')}

### Suggested Actions
${
  result.analysis.identifiedCauses
    .filter((c) => !c.autoFixable)
    .map((c) => `- Manual fix required for: ${c.message}`)
    .join('\n') || '- Review CI logs for additional context'
}

---
_This escalation was generated automatically by the CI Fix Agent._`;
  }

  /**
   * Persist fix result
   */
  private async persistResult(result: CIFixResult): Promise<void> {
    const resultsDir = join(this.config.projectRoot, this.config.resultsPath);

    try {
      if (!existsSync(resultsDir)) {
        await mkdir(resultsDir, { recursive: true });
      }

      const resultPath = join(
        resultsDir,
        `result-PR-${String(result.prNumber)}-attempt-${String(result.attempt)}.yaml`
      );
      const yamlContent = yaml.dump(result, { indent: 2 });
      await writeFile(resultPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new ResultPersistenceError(resultsDir, error instanceof Error ? error : undefined);
    }
  }

  // ==========================================================================
  // GitHub Helpers
  // ==========================================================================

  /**
   * Get PR info from GitHub
   */
  private async getPRInfo(prNumber: number): Promise<{ branch: string; state: string }> {
    const result = await this.executeCommand(
      `gh pr view ${String(prNumber)} --json headRefName,state`
    );
    const data = JSON.parse(result.stdout) as {
      headRefName: string;
      state: string;
    };
    return { branch: data.headRefName, state: data.state };
  }

  /**
   * Get failed checks for a PR
   */
  private async getFailedChecks(prNumber: number): Promise<CICheck[]> {
    const result = await this.executeCommand(
      `gh pr checks ${String(prNumber)} --json name,status,conclusion,detailsUrl --required`
    );

    try {
      const checks = JSON.parse(result.stdout) as Array<{
        name: string;
        status: string;
        conclusion?: string;
        detailsUrl?: string;
      }>;

      return checks
        .filter((c) => c.conclusion === 'failure' || c.conclusion === 'error')
        .map((c) => ({
          name: c.name,
          status: 'failed' as const,
          conclusion: c.conclusion as 'failure' | 'neutral',
          logsUrl: c.detailsUrl,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Get changed files for a PR
   */
  private async getChangedFiles(prNumber: number): Promise<string[]> {
    const result = await this.executeCommand(
      `gh pr view ${String(prNumber)} --json files --jq '.files[].path'`
    );
    return result.stdout.trim().split('\n').filter(Boolean);
  }

  /**
   * Get repository name
   */
  private async getRepoName(): Promise<string> {
    const result = await this.executeCommand(
      'gh repo view --json nameWithOwner --jq .nameWithOwner'
    );
    return result.stdout.trim();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Execute a shell command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.config.projectRoot,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.success ? 0 : (result.exitCode ?? 1),
      };
    } catch (error: unknown) {
      if (error !== null && typeof error === 'object' && 'exitCode' in error) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          exitCode?: number;
        };
        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.exitCode ?? 1,
        };
      }
      throw error;
    }
  }

  /**
   * Escape content for use within double quotes in command strings
   * Uses the centralized sanitizer method
   */
  private escapeForParser(str: string): string {
    const sanitizer = getCommandSanitizer();
    return sanitizer.escapeForParser(str);
  }

  /**
   * Get configuration
   */
  public getConfig(): Required<CIFixerAgentConfig> {
    return { ...this.config };
  }
}

/**
 * Get singleton instance of CIFixAgent
 */
export function getCIFixAgent(config?: CIFixerAgentConfig): CIFixAgent {
  if (instance === null) {
    instance = new CIFixAgent(config);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetCIFixAgent(): void {
  instance = null;
}
