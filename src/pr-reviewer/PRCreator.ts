/**
 * PR Creator module
 *
 * Handles PR creation from Worker Agent implementation results.
 * Implements UC-014: PR Creation from Completed Work.
 *
 * Features:
 * - Branch naming convention validation
 * - Automatic label inference from change types
 * - Draft PR support for additional review
 * - Comprehensive PR description generation
 * - Issue linking and traceability
 *
 * @module pr-reviewer/PRCreator
 */

import type {
  PRCreateOptions,
  PullRequest,
  PRCreatorConfig,
  PRCreateResult,
  BranchValidationResult,
  LabelInferenceResult,
} from './types.js';
import type { ImplementationResult, FileChange } from '../worker/types.js';
import { PRCreationError, BranchNamingError } from './errors.js';
import { getCommandSanitizer } from '../security/index.js';
import { safeJsonParse, tryJsonParse } from '../utils/SafeJsonParser.js';
import { GitHubPRDataSchema, GitHubPRDataArraySchema } from '../schemas/github.js';

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}


/**
 * Default PR creator configuration
 */
export const DEFAULT_PR_CREATOR_CONFIG: Required<PRCreatorConfig> = {
  projectRoot: process.cwd(),
  baseBranch: 'main',
  enableDraftPR: true,
  draftThreshold: 70,
  autoAssignLabels: true,
  labelMapping: {
    feature: ['enhancement'],
    fix: ['bug'],
    docs: ['documentation'],
    test: ['testing'],
    refactor: ['refactoring'],
  },
  prTemplate: null,
} as const;

/**
 * Branch prefix patterns for validation
 */
const VALID_BRANCH_PREFIXES = [
  'feature',
  'fix',
  'docs',
  'test',
  'refactor',
  'chore',
  'hotfix',
] as const;

/**
 * PR Creator
 *
 * Creates pull requests from Worker Agent implementation results.
 * Handles branch validation, label inference, and PR description generation.
 */
export class PRCreator {
  private readonly config: Required<PRCreatorConfig>;

  constructor(config: PRCreatorConfig = {}) {
    this.config = {
      projectRoot: config.projectRoot ?? DEFAULT_PR_CREATOR_CONFIG.projectRoot,
      baseBranch: config.baseBranch ?? DEFAULT_PR_CREATOR_CONFIG.baseBranch,
      enableDraftPR: config.enableDraftPR ?? DEFAULT_PR_CREATOR_CONFIG.enableDraftPR,
      draftThreshold: config.draftThreshold ?? DEFAULT_PR_CREATOR_CONFIG.draftThreshold,
      autoAssignLabels: config.autoAssignLabels ?? DEFAULT_PR_CREATOR_CONFIG.autoAssignLabels,
      labelMapping: config.labelMapping ?? DEFAULT_PR_CREATOR_CONFIG.labelMapping,
      prTemplate: config.prTemplate ?? DEFAULT_PR_CREATOR_CONFIG.prTemplate,
    };
  }

  /**
   * Create a pull request from implementation result
   *
   * Main entry point for UC-014 flow:
   * 1. Validate branch naming convention
   * 2. Check if PR already exists
   * 3. Generate PR content (title, body, labels)
   * 4. Create PR via GitHub CLI
   * 5. Return PR information
   */
  public async createFromImplementationResult(
    implResult: ImplementationResult
  ): Promise<PRCreateResult> {
    // 1. Validate branch naming
    const branchValidation = this.validateBranchNaming(implResult.branch.name);
    if (!branchValidation.valid) {
      throw new BranchNamingError(
        implResult.branch.name,
        branchValidation.reason ?? 'Invalid branch name'
      );
    }

    // 2. Check if PR already exists
    const existingPR = await this.findExistingPR(implResult.branch.name);
    if (existingPR) {
      return {
        pullRequest: existingPR,
        created: false,
        labels: [],
        isDraft: existingPR.state === 'open' && false, // Can't determine draft status from existing
      };
    }

    // 3. Infer labels from changes
    const labelResult = this.inferLabels(implResult.changes, implResult.branch.name);

    // 4. Determine if draft PR
    const isDraft = this.shouldBeDraft(implResult);

    // 5. Generate PR content
    const prOptions = this.generatePRContent(implResult, labelResult.labels, isDraft);

    // 6. Create PR
    const pullRequest = await this.createPR(prOptions);

    // 7. Add labels if auto-assign enabled
    if (this.config.autoAssignLabels && labelResult.labels.length > 0) {
      await this.addLabels(pullRequest.number, labelResult.labels);
    }

    return {
      pullRequest,
      created: true,
      labels: labelResult.labels,
      isDraft,
    };
  }

  /**
   * Validate branch naming convention
   *
   * Expected patterns:
   * - feature/{issue-number}-{description}
   * - fix/{issue-number}-{description}
   * - refactor/{issue-number}-{description}
   * - docs/{issue-number}-{description}
   * - test/{issue-number}-{description}
   */
  public validateBranchNaming(branchName: string): BranchValidationResult {
    // Check if branch has a valid prefix
    const prefixMatch = branchName.match(/^([a-z]+)\//);
    if (!prefixMatch) {
      return {
        valid: false,
        prefix: undefined,
        issueNumber: undefined,
        description: undefined,
        reason: `Branch name must start with a valid prefix (${VALID_BRANCH_PREFIXES.join(', ')})`,
      };
    }

    const prefix = prefixMatch[1];
    if (
      prefix === undefined ||
      !VALID_BRANCH_PREFIXES.includes(prefix as (typeof VALID_BRANCH_PREFIXES)[number])
    ) {
      return {
        valid: false,
        prefix,
        issueNumber: undefined,
        description: undefined,
        reason: `Invalid prefix '${prefix ?? ''}'.Must be one of: ${VALID_BRANCH_PREFIXES.join(', ')}`,
      };
    }

    // Extract issue number and description
    const fullPattern = /^([a-z]+)\/([A-Za-z]+-\d+|[A-Za-z]+\d+|\d+)-(.+)$/;
    const match = branchName.match(fullPattern);

    if (match) {
      return {
        valid: true,
        prefix: match[1],
        issueNumber: match[2],
        description: match[3],
      };
    }

    // Alternative pattern: prefix/description (no issue number)
    const simplePattern = /^([a-z]+)\/(.+)$/;
    const simpleMatch = branchName.match(simplePattern);

    if (simpleMatch) {
      return {
        valid: true,
        prefix: simpleMatch[1],
        issueNumber: undefined,
        description: simpleMatch[2],
      };
    }

    return {
      valid: false,
      prefix,
      issueNumber: undefined,
      description: undefined,
      reason: 'Branch name must follow pattern: prefix/[issue-number-]description',
    };
  }

  /**
   * Infer labels from file changes and branch name
   */
  public inferLabels(changes: readonly FileChange[], branchName: string): LabelInferenceResult {
    const labels = new Set<string>();
    const reasons: string[] = [];

    // 1. Infer from branch prefix
    const branchValidation = this.validateBranchNaming(branchName);
    if (
      branchValidation.valid &&
      branchValidation.prefix !== undefined &&
      branchValidation.prefix.length > 0
    ) {
      const prefixLabels = this.config.labelMapping[branchValidation.prefix];
      if (prefixLabels) {
        for (const label of prefixLabels) {
          labels.add(label);
          reasons.push(`Label '${label}' inferred from branch prefix '${branchValidation.prefix}'`);
        }
      }
    }

    // 2. Infer from file paths
    for (const change of changes) {
      const pathLabels = this.inferLabelsFromPath(change.filePath);
      for (const label of pathLabels) {
        labels.add(label);
        reasons.push(`Label '${label}' inferred from file path '${change.filePath}'`);
      }
    }

    // 3. Infer from change types
    const hasCreates = changes.some((c) => c.changeType === 'create');
    const hasDeletes = changes.some((c) => c.changeType === 'delete');

    if (hasCreates && !hasDeletes) {
      labels.add('new-feature');
      reasons.push("Label 'new-feature' inferred from file creations");
    }

    if (hasDeletes && changes.length === changes.filter((c) => c.changeType === 'delete').length) {
      labels.add('cleanup');
      reasons.push("Label 'cleanup' inferred from deletion-only changes");
    }

    return {
      labels: [...labels],
      reasons,
    };
  }

  /**
   * Infer labels from file path
   */
  private inferLabelsFromPath(filePath: string): string[] {
    const labels: string[] = [];

    if (
      filePath.includes('test') ||
      filePath.endsWith('.test.ts') ||
      filePath.endsWith('.spec.ts')
    ) {
      labels.push('testing');
    }

    if (filePath.startsWith('docs/') || filePath.endsWith('.md')) {
      labels.push('documentation');
    }

    if (filePath.includes('security') || filePath.includes('auth')) {
      labels.push('security');
    }

    if (
      filePath.includes('config') ||
      filePath.endsWith('.config.ts') ||
      filePath.endsWith('.config.js')
    ) {
      labels.push('configuration');
    }

    if (
      filePath.includes('ci/') ||
      filePath.includes('.github/') ||
      filePath.includes('workflow')
    ) {
      labels.push('ci');
    }

    return labels;
  }

  /**
   * Determine if PR should be created as draft
   */
  public shouldBeDraft(implResult: ImplementationResult): boolean {
    if (!this.config.enableDraftPR) {
      return false;
    }

    // Draft if coverage is below threshold
    if (implResult.tests.coveragePercentage < this.config.draftThreshold) {
      return true;
    }

    // Draft if any verification failed
    if (
      !implResult.verification.testsPassed ||
      !implResult.verification.lintPassed ||
      !implResult.verification.buildPassed
    ) {
      return true;
    }

    // Draft if marked as blocked
    if (implResult.status === 'blocked') {
      return true;
    }

    return false;
  }

  /**
   * Generate PR content (title and body)
   */
  public generatePRContent(
    implResult: ImplementationResult,
    labels: readonly string[],
    isDraft: boolean
  ): PRCreateOptions {
    const branchValidation = this.validateBranchNaming(implResult.branch.name);
    const scope = this.extractScope(implResult.issueId, branchValidation.description);
    const commitType = this.inferCommitType(branchValidation.prefix ?? 'feature');

    // Generate title
    const issueRef =
      implResult.githubIssue !== undefined
        ? `#${String(implResult.githubIssue)}`
        : implResult.issueId;
    const title = `${commitType}(${scope}): ${this.generateTitleDescription(implResult)}`;

    // Generate body
    const body = this.generatePRBody(implResult, issueRef, labels, isDraft);

    return {
      title,
      body,
      base: this.config.baseBranch,
      head: implResult.branch.name,
      draft: isDraft,
      labels: [...labels],
    };
  }

  /**
   * Generate title description from implementation result
   */
  private generateTitleDescription(implResult: ImplementationResult): string {
    // Try to extract from first commit message
    const firstCommit = implResult.branch.commits[0];
    if (firstCommit) {
      // Remove conventional commit prefix if present
      const message = firstCommit.message.replace(
        /^(feat|fix|docs|test|refactor|chore|perf)(\([^)]+\))?:\s*/i,
        ''
      );
      // Capitalize first letter
      return message.charAt(0).toUpperCase() + message.slice(1);
    }

    // Fallback to issue ID based description
    return `Implement ${implResult.issueId}`;
  }

  /**
   * Generate PR body content
   */
  private generatePRBody(
    implResult: ImplementationResult,
    issueRef: string,
    labels: readonly string[],
    isDraft: boolean
  ): string {
    const changesDescription = implResult.changes
      .map((c) => `- **${c.changeType}**: \`${c.filePath}\` - ${c.description}`)
      .join('\n');

    const totalLinesAdded = implResult.changes.reduce((sum, c) => sum + c.linesAdded, 0);
    const totalLinesRemoved = implResult.changes.reduce((sum, c) => sum + c.linesRemoved, 0);

    const testStatus = implResult.verification.testsPassed ? '✅ Passed' : '❌ Failed';
    const lintStatus = implResult.verification.lintPassed ? '✅ Passed' : '❌ Failed';
    const buildStatus = implResult.verification.buildPassed ? '✅ Passed' : '❌ Failed';

    const draftWarning = isDraft
      ? `> ⚠️ **Draft PR**: This PR was created as a draft because ${this.getDraftReason(implResult)}.\n\n`
      : '';

    const traceabilitySection = this.generateTraceabilitySection(implResult);

    return `${draftWarning}## Summary
Implements ${issueRef}

## Changes Made
${changesDescription}

**Statistics**: +${String(totalLinesAdded)} / -${String(totalLinesRemoved)} lines across ${String(implResult.changes.length)} files

## Testing
| Metric | Value |
|--------|-------|
| Test Files Created | ${String(implResult.tests.filesCreated.length)} |
| Total Tests | ${String(implResult.tests.totalTests)} |
| Coverage | ${String(implResult.tests.coveragePercentage)}% |

## Verification
| Check | Status |
|-------|--------|
| Tests | ${testStatus} |
| Lint | ${lintStatus} |
| Build | ${buildStatus} |

${traceabilitySection}

## Checklist
- [x] Code follows project style guidelines
- [x] Tests added/updated
- [x] Self-review completed
${implResult.verification.testsPassed ? '- [x] All tests passing' : '- [ ] All tests passing'}
${implResult.verification.lintPassed ? '- [x] No lint errors' : '- [ ] No lint errors'}
${implResult.verification.buildPassed ? '- [x] Build successful' : '- [ ] Build successful'}

${labels.length > 0 ? `## Labels\n${labels.map((l) => `\`${l}\``).join(' ')}\n` : ''}
${implResult.notes !== undefined && implResult.notes.length > 0 ? `## Notes\n${implResult.notes}\n` : ''}
---
_Auto-generated by AD-SDLC PR Review Agent_`;
  }

  /**
   * Generate traceability section
   */
  private generateTraceabilitySection(implResult: ImplementationResult): string {
    const lines = ['## Traceability'];

    lines.push(`- Issue: ${implResult.issueId}`);

    if (implResult.githubIssue !== undefined) {
      lines.push(`- GitHub Issue: #${String(implResult.githubIssue)}`);
    }

    lines.push(`- Work Order: ${implResult.workOrderId}`);
    lines.push(`- Branch: \`${implResult.branch.name}\``);

    if (implResult.branch.commits.length > 0) {
      lines.push(`- Commits: ${String(implResult.branch.commits.length)}`);
      for (const commit of implResult.branch.commits.slice(0, 5)) {
        lines.push(`  - \`${commit.hash.slice(0, 7)}\`: ${commit.message}`);
      }
      if (implResult.branch.commits.length > 5) {
        lines.push(`  - ... and ${String(implResult.branch.commits.length - 5)} more`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get reason for creating draft PR
   */
  private getDraftReason(implResult: ImplementationResult): string {
    const reasons: string[] = [];

    if (implResult.tests.coveragePercentage < this.config.draftThreshold) {
      reasons.push(
        `coverage (${String(implResult.tests.coveragePercentage)}%) is below threshold (${String(this.config.draftThreshold)}%)`
      );
    }

    if (!implResult.verification.testsPassed) {
      reasons.push('some tests are failing');
    }

    if (!implResult.verification.lintPassed) {
      reasons.push('lint errors exist');
    }

    if (!implResult.verification.buildPassed) {
      reasons.push('build is failing');
    }

    if (implResult.status === 'blocked') {
      reasons.push('implementation is blocked');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'additional review is needed';
  }

  /**
   * Extract scope from issue ID or description
   */
  private extractScope(issueId: string, description?: string): string {
    // Try to extract from issue ID (e.g., ISS-001-feature-name -> feature)
    const parts = issueId.split('-');
    const scopePart = parts[2];
    if (parts.length >= 3 && scopePart !== undefined) {
      return scopePart;
    }

    // Try to extract from description
    if (description !== undefined) {
      const words = description.split('-');
      const firstWord = words[0];
      if (words.length > 0 && firstWord !== undefined) {
        return firstWord;
      }
    }

    return 'feature';
  }

  /**
   * Infer commit type from branch prefix
   */
  private inferCommitType(prefix: string): string {
    const mapping: Record<string, string> = {
      feature: 'feat',
      fix: 'fix',
      docs: 'docs',
      test: 'test',
      refactor: 'refactor',
      chore: 'chore',
      hotfix: 'fix',
    };

    return mapping[prefix] ?? 'feat';
  }

  /**
   * Find existing PR for branch
   */
  private async findExistingPR(branchName: string): Promise<PullRequest | null> {
    try {
      const result = await this.executeCommand(
        `gh pr list --head "${branchName}" --json number,url,title,headRefName,baseRefName,createdAt,state --limit 1`
      );

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return null;
      }

      const prs = tryJsonParse(result.stdout, GitHubPRDataArraySchema, {
        context: 'gh pr list output',
      });
      const pr = prs?.[0];
      if (pr === undefined) {
        return null;
      }

      return {
        number: pr.number,
        url: pr.url,
        title: pr.title,
        branch: pr.headRefName,
        base: pr.baseRefName,
        createdAt: pr.createdAt,
        state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
      };
    } catch {
      return null;
    }
  }

  /**
   * Create PR using GitHub CLI
   */
  private async createPR(options: PRCreateOptions): Promise<PullRequest> {
    try {
      const draftFlag = options.draft === true ? '--draft' : '';

      const result = await this.executeCommand(
        `gh pr create ` +
          `--title "${this.escapeForParser(options.title)}" ` +
          `--body "${this.escapeForParser(options.body)}" ` +
          `--base "${options.base ?? 'main'}" ` +
          `--head "${options.head}" ` +
          `${draftFlag} ` +
          `--json number,url,title,headRefName,baseRefName,createdAt,state`
      );

      if (result.exitCode !== 0) {
        throw new PRCreationError(options.head, new Error(result.stderr));
      }

      const prData = safeJsonParse(result.stdout, GitHubPRDataSchema, {
        context: 'gh pr create output',
      });
      return {
        number: prData.number,
        url: prData.url,
        title: prData.title,
        branch: prData.headRefName,
        base: prData.baseRefName,
        createdAt: prData.createdAt,
        state: prData.state.toLowerCase() as 'open' | 'closed' | 'merged',
      };
    } catch (error) {
      if (error instanceof PRCreationError) throw error;
      throw new PRCreationError(options.head, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Add labels to PR
   */
  private async addLabels(prNumber: number, labels: readonly string[]): Promise<void> {
    if (labels.length === 0) return;

    try {
      const labelsArg = labels.map((l) => `--add-label "${l}"`).join(' ');
      await this.executeCommand(`gh pr edit ${String(prNumber)} ${labelsArg}`);
    } catch {
      // Ignore label failures - non-critical
    }
  }

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
        const execError = error as { stdout?: string; stderr?: string; exitCode?: number };
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
  public getConfig(): Required<PRCreatorConfig> {
    return { ...this.config };
  }
}
