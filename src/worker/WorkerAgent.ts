/**
 * Worker Agent module
 *
 * Implements code generation, test writing, and self-verification
 * based on Work Orders from the Controller Agent.
 *
 * Checkpoint/resume capability:
 * - Automatically saves checkpoint after each step
 * - Can resume from last checkpoint if worker crashes
 * - Use resumeFromCheckpoint option to resume interrupted work
 * - Checkpoints expire after 24 hours by default
 *
 * NOTE: Parallel test execution is planned. See Issue #258.
 *
 * Error classification system implemented:
 * - Transient errors (network, timeout): Retry with exponential backoff
 * - Recoverable errors (test failures, lint errors): Attempt self-fix then retry
 * - Fatal errors (missing dependencies, blocked): No retry, immediate escalation
 *
 * NOTE: Uses string concatenation for commit messages (simple and effective).
 *
 * @module worker/WorkerAgent
 */

import { join } from 'node:path';

import type {
  WorkerAgentConfig,
  ImplementationResult,
  ImplementationStatus,
  CodeContext,
  FileContext,
  CodePatterns,
  FileChange,
  VerificationResult,
  CommitInfo,
  WorkerExecutionOptions,
  ExecutionContext,
  RetryPolicy,
  BranchPrefix,
  CommitType,
  WorkOrder,
  TestGeneratorConfig,
  TestGenerationResult,
  WorkerStep,
} from './types.js';
import { DEFAULT_WORKER_AGENT_CONFIG, DEFAULT_RETRY_POLICY } from './types.js';
import { TestGenerator } from './TestGenerator.js';
import {
  CheckpointManager,
  type CheckpointManagerConfig,
  type CheckpointState,
} from './CheckpointManager.js';
import {
  ContextAnalysisError,
  BranchCreationError,
  CommitError,
  VerificationError,
  MaxRetriesExceededError,
  ImplementationBlockedError,
  ResultPersistenceError,
  GitOperationError,
  categorizeError,
} from './errors.js';
import type { ErrorCategory } from '../errors/index.js';
import { getCommandSanitizer, createSecureFileOps, type SecureFileOps } from '../security/index.js';
import { tryGetProjectRoot } from '../utils/index.js';

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Checkpoint resume state
 * Internal type for restoring worker state from checkpoint
 */
interface CheckpointResumeState {
  readonly fileChanges: readonly FileChange[];
  readonly testsCreated: ReadonlyMap<string, number> | Record<string, number>;
  readonly commits: readonly CommitInfo[];
  readonly testGenerationResult: TestGenerationResult | null;
  readonly branchName: string | null;
  readonly attemptNumber: number;
}

/**
 * Worker Agent
 *
 * Processes Work Orders to implement code changes, generate tests,
 * and verify the implementation through automated checks.
 */
export class WorkerAgent {
  private readonly config: Required<WorkerAgentConfig>;
  private readonly fileChanges: Map<string, FileChange>;
  private readonly testsCreated: Map<string, number>;
  private readonly commits: CommitInfo[];
  private readonly testGenerator: TestGenerator;
  private readonly fileOps: SecureFileOps;
  private readonly checkpointManager: CheckpointManager;
  private lastTestGenerationResult: TestGenerationResult | null;
  private currentBranchName: string | null;

  constructor(
    config: WorkerAgentConfig = {},
    testGeneratorConfig?: TestGeneratorConfig,
    checkpointConfig?: CheckpointManagerConfig
  ) {
    this.config = {
      projectRoot:
        config.projectRoot ?? tryGetProjectRoot() ?? DEFAULT_WORKER_AGENT_CONFIG.projectRoot,
      resultsPath: config.resultsPath ?? DEFAULT_WORKER_AGENT_CONFIG.resultsPath,
      maxRetries: config.maxRetries ?? DEFAULT_WORKER_AGENT_CONFIG.maxRetries,
      testCommand: config.testCommand ?? DEFAULT_WORKER_AGENT_CONFIG.testCommand,
      lintCommand: config.lintCommand ?? DEFAULT_WORKER_AGENT_CONFIG.lintCommand,
      buildCommand: config.buildCommand ?? DEFAULT_WORKER_AGENT_CONFIG.buildCommand,
      autoFixLint: config.autoFixLint ?? DEFAULT_WORKER_AGENT_CONFIG.autoFixLint,
      coverageThreshold: config.coverageThreshold ?? DEFAULT_WORKER_AGENT_CONFIG.coverageThreshold,
    };

    this.fileChanges = new Map();
    this.testsCreated = new Map();
    this.commits = [];
    this.testGenerator = new TestGenerator(testGeneratorConfig);
    this.lastTestGenerationResult = null;
    this.currentBranchName = null;
    // Initialize secure file operations with project root validation
    this.fileOps = createSecureFileOps({ projectRoot: this.config.projectRoot });
    // Initialize checkpoint manager for resume capability
    this.checkpointManager = new CheckpointManager({
      projectRoot: this.config.projectRoot,
      ...checkpointConfig,
    });
  }

  /**
   * Main implementation entry point
   * Processes a Work Order and returns the implementation result
   *
   * @param workOrder - Work order to process
   * @param options - Execution options including resume capability
   */
  public async implement(
    workOrder: WorkOrder,
    options: WorkerExecutionOptions = {}
  ): Promise<ImplementationResult> {
    const startedAt = new Date().toISOString();
    const retryPolicy = this.buildRetryPolicy(options.retryPolicy);

    let lastError: Error | undefined;
    let attempt = 0;

    // Check for existing checkpoint and determine resume state
    const { resumeStep, resumeState } = await this.checkForResume(workOrder.orderId);

    // Reset or restore state based on resume
    if (resumeState !== null) {
      this.restoreState(resumeState);
      attempt = resumeState.attemptNumber;
    } else {
      this.resetState();
    }

    while (attempt < retryPolicy.maxAttempts) {
      attempt++;

      try {
        // Determine starting step based on resume
        const startStep = resumeStep ?? 'context_analysis';
        let codeContext: CodeContext;
        let branchName: string;

        // 1. Analyze context (skip if resuming past this step)
        if (this.shouldExecuteStep('context_analysis', startStep)) {
          codeContext = await this.analyzeContext(workOrder);
          await this.saveCheckpoint(workOrder, 'context_analysis', attempt);
        } else {
          // Restore context from checkpoint
          codeContext = await this.analyzeContext(workOrder);
        }

        const executionContext: ExecutionContext = {
          workOrder,
          codeContext,
          config: this.config,
          options,
          attemptNumber: attempt,
        };

        // 2. Create feature branch (skip if resuming past this step)
        if (this.shouldExecuteStep('branch_creation', startStep)) {
          branchName = await this.createBranch(workOrder);
          this.currentBranchName = branchName;
          await this.saveCheckpoint(workOrder, 'branch_creation', attempt);
        } else {
          branchName = this.currentBranchName ?? (await this.getCurrentBranch());
        }

        // 3. Generate code (skip if resuming past this step)
        if (this.shouldExecuteStep('code_generation', startStep)) {
          await this.generateCode(executionContext);
          await this.saveCheckpoint(workOrder, 'code_generation', attempt);
        }

        // 4. Generate tests (if not skipped)
        if (options.skipTests !== true && this.shouldExecuteStep('test_generation', startStep)) {
          await this.generateTests(executionContext);
          await this.saveCheckpoint(workOrder, 'test_generation', attempt);
        }

        // 5. Run verification (if not skipped)
        let verification: VerificationResult;
        if (
          options.skipVerification !== true &&
          this.shouldExecuteStep('verification', startStep)
        ) {
          verification = await this.runVerification();

          if (!verification.testsPassed || !verification.lintPassed || !verification.buildPassed) {
            throw new VerificationError(
              !verification.testsPassed ? 'test' : !verification.lintPassed ? 'lint' : 'build',
              verification.testsOutput || verification.lintOutput || verification.buildOutput
            );
          }
          await this.saveCheckpoint(workOrder, 'verification', attempt);
        } else {
          verification = this.createSkippedVerification();
        }

        // 6. Commit changes (if not dry run)
        if (options.dryRun !== true && this.shouldExecuteStep('commit', startStep)) {
          await this.commitChanges(workOrder);
          await this.saveCheckpoint(workOrder, 'commit', attempt);
        }

        // 7. Create and save result
        const result = this.createResult(
          workOrder,
          'completed',
          startedAt,
          branchName,
          verification
        );

        await this.saveResult(result);

        // Clean up checkpoint on success
        await this.checkpointManager.deleteCheckpoint(workOrder.orderId);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Classify error to determine retry strategy
        const errorCategory = categorizeError(lastError);
        const categoryConfig = this.getCategoryRetryConfig(retryPolicy, errorCategory);

        // Handle based on error category
        if (errorCategory === 'fatal' || !categoryConfig.retry) {
          // Fatal errors: No retry, immediate return/escalation
          if (error instanceof ImplementationBlockedError) {
            const result = this.createResult(
              workOrder,
              'blocked',
              startedAt,
              await this.getCurrentBranch(),
              this.createSkippedVerification(),
              undefined,
              error.blockers
            );
            await this.saveResult(result);
            // Clean up checkpoint on terminal state
            await this.checkpointManager.deleteCheckpoint(workOrder.orderId);
            return result;
          }

          // Other fatal errors: fail immediately
          const result = this.createResult(
            workOrder,
            'failed',
            startedAt,
            await this.getCurrentBranch(),
            this.createSkippedVerification(),
            `Fatal error: ${lastError.message}`
          );
          await this.saveResult(result);
          // Clean up checkpoint on terminal state
          await this.checkpointManager.deleteCheckpoint(workOrder.orderId);
          return result;
        }

        // Check category-specific max attempts
        if (attempt >= categoryConfig.maxAttempts) {
          // Max attempts for this category reached
          break;
        }

        // Recoverable errors: May attempt self-fix before retry
        if (errorCategory === 'recoverable' && categoryConfig.requireFixAttempt) {
          // Log that fix was attempted (actual fix logic would go here)
          // For VerificationError, the runVerification() already handles lint --fix
        }

        // Transient and recoverable errors: Retry with backoff
        if (attempt < retryPolicy.maxAttempts) {
          const delay = this.calculateDelay(attempt, retryPolicy);
          await this.sleep(delay);
        }
      }
    }

    // Max retries exceeded - clean up checkpoint
    await this.checkpointManager.deleteCheckpoint(workOrder.orderId);

    // Max retries exceeded
    throw new MaxRetriesExceededError(workOrder.issueId, attempt, lastError);
  }

  /**
   * Check if there's a checkpoint to resume from
   *
   * @param workOrderId - Work order ID
   * @returns Resume step and state, or null if no checkpoint
   */
  private async checkForResume(
    workOrderId: string
  ): Promise<{ resumeStep: WorkerStep | null; resumeState: CheckpointResumeState | null }> {
    const checkpoint = await this.checkpointManager.loadCheckpoint(workOrderId);
    if (checkpoint === null || !checkpoint.resumable) {
      return { resumeStep: null, resumeState: null };
    }

    const state = this.checkpointManager.extractState(checkpoint);
    if (state === null) {
      return { resumeStep: null, resumeState: null };
    }

    const nextStep = this.checkpointManager.getNextStep(checkpoint.currentStep);
    return {
      resumeStep: nextStep,
      resumeState: {
        fileChanges: state.fileChanges,
        testsCreated: state.testsCreated,
        commits: state.commits,
        testGenerationResult: state.testGenerationResult as TestGenerationResult | null,
        branchName: state.context?.branchName ?? null,
        attemptNumber: checkpoint.attemptNumber,
      },
    };
  }

  /**
   * Restore state from checkpoint
   *
   * @param state - State to restore
   */
  private restoreState(state: CheckpointResumeState): void {
    this.fileChanges.clear();
    for (const change of state.fileChanges) {
      this.fileChanges.set(change.filePath, change);
    }

    this.testsCreated.clear();
    const testsCreated = state.testsCreated;
    if (testsCreated instanceof Map) {
      const mapRef = testsCreated as ReadonlyMap<string, number>;
      mapRef.forEach((value, key) => {
        this.testsCreated.set(key, value);
      });
    } else {
      const entries = Object.entries(testsCreated) as [string, number][];
      for (const [key, value] of entries) {
        this.testsCreated.set(key, value);
      }
    }

    this.commits.length = 0;
    this.commits.push(...state.commits);
    this.lastTestGenerationResult = state.testGenerationResult ?? null;
    this.currentBranchName = state.branchName ?? null;
  }

  /**
   * Save checkpoint for current state
   *
   * @param workOrder - Current work order
   * @param step - Current step
   * @param attempt - Current attempt number
   */
  private async saveCheckpoint(
    workOrder: WorkOrder,
    step: WorkerStep,
    attempt: number
  ): Promise<void> {
    // Build context object properly to satisfy exactOptionalPropertyTypes
    const context: CheckpointState['context'] =
      this.currentBranchName !== null
        ? { workOrder, branchName: this.currentBranchName }
        : { workOrder };

    // Build state with required fields
    const baseState: CheckpointState = {
      context,
      fileChanges: Array.from(this.fileChanges.values()),
      testsCreated: Object.fromEntries(this.testsCreated),
      commits: [...this.commits],
    };

    // Add optional testGenerationResult if present
    const state: CheckpointState =
      this.lastTestGenerationResult !== null
        ? { ...baseState, testGenerationResult: this.lastTestGenerationResult }
        : baseState;

    await this.checkpointManager.saveCheckpoint(
      workOrder.orderId,
      workOrder.issueId,
      step,
      attempt,
      state
    );
  }

  /**
   * Determine if a step should be executed based on resume state
   *
   * @param step - Step to check
   * @param resumeFromStep - Step to resume from (null if not resuming)
   * @returns True if step should be executed
   */
  private shouldExecuteStep(step: WorkerStep, resumeFromStep: WorkerStep): boolean {
    const stepOrder: WorkerStep[] = [
      'context_analysis',
      'branch_creation',
      'code_generation',
      'test_generation',
      'verification',
      'commit',
      'result_persistence',
    ];

    const stepIndex = stepOrder.indexOf(step);
    const resumeIndex = stepOrder.indexOf(resumeFromStep);

    // Execute if step is at or after resume point
    return stepIndex >= resumeIndex;
  }

  /**
   * Check if a checkpoint exists for a work order
   *
   * @param workOrderId - Work order ID
   * @returns True if checkpoint exists
   */
  public async hasCheckpoint(workOrderId: string): Promise<boolean> {
    return this.checkpointManager.hasCheckpoint(workOrderId);
  }

  /**
   * Get the checkpoint manager for external access
   */
  public getCheckpointManager(): CheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Analyze context from work order
   * Reads related files and analyzes code patterns
   * Uses SecureFileOps for path traversal prevention
   */
  public async analyzeContext(workOrder: WorkOrder): Promise<CodeContext> {
    try {
      const relatedFiles: FileContext[] = [];

      // Read all related files from work order context
      for (const file of workOrder.context.relatedFiles) {
        // Use SecureFileOps for path validation - prevents path traversal
        if (this.fileOps.existsSync(file.path)) {
          try {
            const content = await this.fileOps.readFile(file.path);
            relatedFiles.push({
              path: file.path,
              content,
              reason: file.reason,
            });
          } catch (error) {
            // Log but continue - some files may be inaccessible
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Could not read file ${file.path}: ${errorMessage}`);
          }
        }
      }

      // Analyze patterns from the files
      const patterns = this.analyzePatterns(relatedFiles);

      return {
        relatedFiles,
        patterns,
        workOrder,
      };
    } catch (error) {
      throw new ContextAnalysisError(workOrder.issueId, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Analyze code patterns from file contents
   */
  private analyzePatterns(files: readonly FileContext[]): CodePatterns {
    // Start with defaults
    let indentation: 'spaces' | 'tabs' = 'spaces';
    let indentSize = 2;
    let quoteStyle: 'single' | 'double' = 'single';
    let useSemicolons = true;
    let trailingComma: 'none' | 'es5' | 'all' = 'es5';
    let testFramework: 'jest' | 'vitest' | 'mocha' | 'other' | undefined;

    const tsFiles = files.filter((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));

    if (tsFiles.length > 0 && tsFiles[0] !== undefined) {
      // Analyze first TypeScript file
      const content = tsFiles[0].content;
      const lines = content.split('\n');

      // Check indentation
      for (const line of lines) {
        if (line.startsWith('\t')) {
          indentation = 'tabs';
          break;
        }
        const match = line.match(/^( +)/);
        if (match !== null && match[1] !== undefined) {
          indentSize = match[1].length;
          break;
        }
      }

      // Check quote style
      const singleQuotes = (content.match(/'/g) ?? []).length;
      const doubleQuotes = (content.match(/"/g) ?? []).length;
      quoteStyle = singleQuotes >= doubleQuotes ? 'single' : 'double';

      // Check semicolons
      const statementsWithSemi = (content.match(/;\s*$/gm) ?? []).length;
      const statementsWithoutSemi = (content.match(/[^;{}\s]\s*$/gm) ?? []).length;
      useSemicolons = statementsWithSemi >= statementsWithoutSemi;

      // Check trailing commas
      if (content.includes(',\n}') || content.includes(',\n]')) {
        trailingComma = 'es5';
      }

      // Detect test framework
      if (content.includes('vitest') || content.includes("from 'vitest'")) {
        testFramework = 'vitest';
      } else if (content.includes('jest') || content.includes("from '@jest")) {
        testFramework = 'jest';
      } else if (content.includes('mocha')) {
        testFramework = 'mocha';
      }
    }

    // Check package.json for test framework if not detected
    if (testFramework === undefined) {
      const packageJsonFile = files.find((f) => f.path.endsWith('package.json'));
      if (packageJsonFile !== undefined) {
        if (packageJsonFile.content.includes('vitest')) {
          testFramework = 'vitest';
        } else if (packageJsonFile.content.includes('jest')) {
          testFramework = 'jest';
        }
      }
    }

    return {
      indentation,
      indentSize,
      quoteStyle,
      useSemicolons,
      trailingComma,
      importStyle: 'named',
      exportStyle: 'named',
      errorHandling: 'try-catch',
      testFramework: testFramework ?? 'vitest',
    };
  }

  /**
   * Create a feature branch for the implementation
   */
  public async createBranch(workOrder: WorkOrder): Promise<string> {
    const prefix = this.determineBranchPrefix(workOrder);
    const slug = this.slugify(workOrder.issueId);
    const branchName = `${prefix}/${slug}`;

    try {
      // Check if branch already exists
      const { stdout: branches } = await this.execGit('branch --list');
      if (branches.includes(branchName)) {
        // Branch exists, just checkout
        await this.execGit(`checkout ${branchName}`);
        return branchName;
      }

      // Create and checkout new branch
      await this.execGit(`checkout -b ${branchName}`);
      return branchName;
    } catch (error) {
      throw new BranchCreationError(branchName, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Determine the branch prefix based on work order
   */
  private determineBranchPrefix(workOrder: WorkOrder): BranchPrefix {
    const issueId = workOrder.issueId.toLowerCase();

    if (issueId.includes('fix') || issueId.includes('bug')) {
      return 'fix';
    }
    if (issueId.includes('doc')) {
      return 'docs';
    }
    if (issueId.includes('test')) {
      return 'test';
    }
    if (issueId.includes('refactor')) {
      return 'refactor';
    }

    return 'feature';
  }

  /**
   * Generate code based on work order
   * This is a placeholder that demonstrates the structure
   * In a real implementation, this would integrate with an LLM
   */
  public async generateCode(_context: ExecutionContext): Promise<void> {
    // This method would be overridden or enhanced with actual code generation logic
    // For now, it serves as a structural placeholder
    // Record that we attempted code generation
    // Actual file changes would be tracked here
  }

  /**
   * Generate tests for the implemented code
   * Analyzes source files and generates comprehensive test suites
   * Uses SecureFileOps for path traversal prevention
   */
  public async generateTests(context: ExecutionContext): Promise<TestGenerationResult> {
    const { codeContext } = context;

    // Generate tests for all source files in context
    const result = this.testGenerator.generateTestsForFiles(
      codeContext.relatedFiles,
      codeContext.patterns
    );

    // Write test files to disk
    for (const suite of result.testSuites) {
      // Generate test file content
      const content = this.testGenerator.generateTestFileContent(suite, codeContext.patterns);

      // Write test file using SecureFileOps (auto-creates directories)
      await this.fileOps.writeFile(suite.testFile, content);

      // Record the test file creation
      this.recordTestFile(suite.testFile, suite.totalTests);
      this.recordFileChange({
        filePath: suite.testFile,
        changeType: 'create',
        description: `Generated test suite for ${suite.sourceFile}`,
        linesAdded: content.split('\n').length,
        linesRemoved: 0,
      });
    }

    // Store result for later access
    this.lastTestGenerationResult = result;

    return result;
  }

  /**
   * Get the last test generation result
   */
  public getLastTestGenerationResult(): TestGenerationResult | null {
    return this.lastTestGenerationResult;
  }

  /**
   * Get the test generator instance
   */
  public getTestGenerator(): TestGenerator {
    return this.testGenerator;
  }

  /**
   * Run verification (tests, lint, build)
   */
  public async runVerification(): Promise<VerificationResult> {
    const testsResult = await this.runCommand(this.config.testCommand);
    const testsPassed = testsResult.exitCode === 0;

    let lintResult = await this.runCommand(this.config.lintCommand);
    let lintPassed = lintResult.exitCode === 0;

    // Try auto-fix if lint failed and auto-fix is enabled
    if (!lintPassed && this.config.autoFixLint) {
      const fixResult = await this.runCommand(`${this.config.lintCommand} --fix`);
      if (fixResult.exitCode === 0) {
        lintResult = await this.runCommand(this.config.lintCommand);
        lintPassed = lintResult.exitCode === 0;
      }
    }

    const buildResult = await this.runCommand(this.config.buildCommand);
    const buildPassed = buildResult.exitCode === 0;

    return {
      testsPassed,
      testsOutput: testsResult.stdout + testsResult.stderr,
      lintPassed,
      lintOutput: lintResult.stdout + lintResult.stderr,
      buildPassed,
      buildOutput: buildResult.stdout + buildResult.stderr,
    };
  }

  /**
   * Commit changes to git
   */
  public async commitChanges(workOrder: WorkOrder): Promise<void> {
    try {
      // Stage all changes
      await this.execGit('add -A');

      // Check if there are changes to commit
      const { stdout: status } = await this.execGit('status --porcelain');
      if (status.trim() === '') {
        // No changes to commit
        return;
      }

      // Create commit message
      const commitType = this.determineCommitType(workOrder);
      const commitMessage = this.formatCommitMessage(commitType, workOrder);

      // Commit
      await this.execGit(`commit -m "${this.escapeQuotes(commitMessage)}"`);

      // Get commit hash
      const { stdout: hash } = await this.execGit('rev-parse HEAD');

      this.commits.push({
        hash: hash.trim(),
        message: commitMessage,
      });
    } catch (error) {
      throw new CommitError(
        `Commit for ${workOrder.issueId}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Determine commit type from work order
   */
  private determineCommitType(workOrder: WorkOrder): CommitType {
    const issueId = workOrder.issueId.toLowerCase();

    if (issueId.includes('fix') || issueId.includes('bug')) {
      return 'fix';
    }
    if (issueId.includes('doc')) {
      return 'docs';
    }
    if (issueId.includes('test')) {
      return 'test';
    }
    if (issueId.includes('refactor')) {
      return 'refactor';
    }
    if (issueId.includes('perf')) {
      return 'perf';
    }
    if (issueId.includes('style')) {
      return 'style';
    }
    if (issueId.includes('chore')) {
      return 'chore';
    }

    return 'feat';
  }

  /**
   * Format commit message following conventional commits
   */
  private formatCommitMessage(type: CommitType, workOrder: WorkOrder): string {
    const scope = workOrder.context.sdsComponent ?? '';
    const scopePart = scope !== '' ? `(${scope})` : '';

    // Extract a short description from the issue ID
    const description = workOrder.issueId
      .replace(/^ISS-\d+-?/, '')
      .replace(/-/g, ' ')
      .trim();

    const message = `${type}${scopePart}: implement ${description || workOrder.issueId}`;

    return `${message}\n\nRefs: #${workOrder.issueId}`;
  }

  /**
   * Create implementation result
   */
  public createResult(
    workOrder: WorkOrder,
    status: ImplementationStatus,
    startedAt: string,
    branchName: string,
    verification: VerificationResult,
    notes?: string,
    blockers?: readonly string[]
  ): ImplementationResult {
    const changes = Array.from(this.fileChanges.values());
    const testsFiles = Array.from(this.testsCreated.entries()).map(([path, count]) => ({
      filePath: path,
      testCount: count,
    }));

    const totalTests = testsFiles.reduce((sum, t) => sum + t.testCount, 0);

    // Build base result
    const baseResult = {
      workOrderId: workOrder.orderId,
      issueId: workOrder.issueId,
      status,
      startedAt,
      completedAt: new Date().toISOString(),
      changes,
      tests: {
        filesCreated: testsFiles.map((t) => t.filePath),
        totalTests,
        coveragePercentage: 0, // Would be parsed from test output
      },
      verification,
      branch: {
        name: branchName,
        commits: this.commits,
      },
    };

    // Add optional fields
    const result: ImplementationResult = { ...baseResult };

    if (notes !== undefined) {
      (result as { notes: string }).notes = notes;
    }

    if (blockers !== undefined && blockers.length > 0) {
      (result as { blockers: readonly string[] }).blockers = blockers;
    }

    // Extract GitHub issue number if available
    const issueMatch = workOrder.issueUrl?.match(/\/issues\/(\d+)/);
    if (issueMatch !== null && issueMatch !== undefined && issueMatch[1] !== undefined) {
      (result as { githubIssue: number }).githubIssue = parseInt(issueMatch[1], 10);
    }

    return result;
  }

  /**
   * Save implementation result to disk
   * Uses SecureFileOps for path traversal prevention
   */
  public async saveResult(result: ImplementationResult): Promise<void> {
    // Construct relative path from project root
    const resultFilePath = join(
      this.config.resultsPath,
      'results',
      `${result.workOrderId}-result.yaml`
    );

    try {
      const yamlContent = this.toYaml(result as unknown as Record<string, unknown>);

      // Write using SecureFileOps (auto-creates directories and validates path)
      await this.fileOps.writeFile(resultFilePath, yamlContent);
    } catch (error) {
      throw new ResultPersistenceError(
        result.workOrderId,
        'save',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Record a file change
   */
  public recordFileChange(change: FileChange): void {
    this.fileChanges.set(change.filePath, change);
  }

  /**
   * Record test creation
   */
  public recordTestFile(filePath: string, testCount: number): void {
    this.testsCreated.set(filePath, testCount);
  }

  /**
   * Get current git branch name
   */
  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await this.execGit('branch --show-current');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Execute a git command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async execGit(command: string): Promise<{ stdout: string; stderr: string }> {
    const sanitizer = getCommandSanitizer();
    // Split command string into arguments array
    const args = command.split(/\s+/).filter((arg) => arg.length > 0);

    try {
      const result = await sanitizer.execGit(args, {
        cwd: this.config.projectRoot,
      });
      if (!result.success) {
        throw new GitOperationError(command, new Error(result.stderr));
      }
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      if (error instanceof GitOperationError) {
        throw error;
      }
      throw new GitOperationError(command, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Run a shell command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async runCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.config.projectRoot,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.success ? 0 : (result.exitCode ?? 1),
      };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; exitCode?: number };
      return {
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? '',
        exitCode: execError.exitCode ?? 1,
      };
    }
  }

  /**
   * Build retry policy with defaults
   */
  private buildRetryPolicy(override?: Partial<RetryPolicy>): RetryPolicy {
    const base: RetryPolicy = {
      maxAttempts: override?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
      baseDelayMs: override?.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
      backoff: override?.backoff ?? DEFAULT_RETRY_POLICY.backoff,
      maxDelayMs: override?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
    };

    // Include byCategory only if defined in override or default
    const byCategory = override?.byCategory ?? DEFAULT_RETRY_POLICY.byCategory;
    if (byCategory !== undefined) {
      return { ...base, byCategory };
    }

    return base;
  }

  /**
   * Get category-specific retry configuration
   *
   * Returns retry settings based on error category:
   * - transient: Full retries with backoff (network issues, timeouts)
   * - recoverable: Retry with fix attempts (test failures, lint errors)
   * - fatal: No retry (missing dependencies, permission denied)
   */
  private getCategoryRetryConfig(
    policy: RetryPolicy,
    category: ErrorCategory
  ): { retry: boolean; maxAttempts: number; requireFixAttempt: boolean } {
    const defaults = {
      transient: { retry: true, maxAttempts: policy.maxAttempts, requireFixAttempt: false },
      recoverable: { retry: true, maxAttempts: policy.maxAttempts, requireFixAttempt: true },
      fatal: { retry: false, maxAttempts: 0, requireFixAttempt: false },
    };

    const categoryConfig = policy.byCategory?.[category];
    const defaultConfig = defaults[category];

    return {
      retry: categoryConfig?.retry ?? defaultConfig.retry,
      maxAttempts: categoryConfig?.maxAttempts ?? defaultConfig.maxAttempts,
      requireFixAttempt: categoryConfig?.requireFixAttempt ?? defaultConfig.requireFixAttempt,
    };
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    let delay: number;

    switch (policy.backoff) {
      case 'fixed':
        delay = policy.baseDelayMs;
        break;
      case 'linear':
        delay = policy.baseDelayMs * attempt;
        break;
      case 'exponential':
        delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
        break;
      default:
        delay = policy.baseDelayMs;
    }

    return Math.min(delay, policy.maxDelayMs);
  }

  /**
   * Sleep for a given duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a slugified version of a string for branch names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Escape quotes for shell commands
   */
  private escapeQuotes(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  /**
   * Create a skipped verification result
   */
  private createSkippedVerification(): VerificationResult {
    return {
      testsPassed: true,
      testsOutput: 'Skipped',
      lintPassed: true,
      lintOutput: 'Skipped',
      buildPassed: true,
      buildOutput: 'Skipped',
    };
  }

  /**
   * Convert object to YAML string
   */
  private toYaml(obj: Record<string, unknown>): string {
    const yaml: string[] = [];

    const stringify = (value: unknown, indent: number): void => {
      const prefix = '  '.repeat(indent);

      if (value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            yaml.push(`${prefix}-`);
            const entries = Object.entries(item as Record<string, unknown>);
            for (const entry of entries) {
              const [k, v] = entry;
              if (typeof v === 'object' && v !== null) {
                yaml.push(`${prefix}  ${k}:`);
                stringify(v, indent + 2);
              } else {
                yaml.push(`${prefix}  ${k}: ${this.formatYamlValue(v)}`);
              }
            }
          } else {
            yaml.push(`${prefix}- ${this.formatYamlValue(item)}`);
          }
        }
      } else if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        for (const [k, v] of entries) {
          if (typeof v === 'object' && v !== null) {
            yaml.push(`${prefix}${k}:`);
            stringify(v, indent + 1);
          } else {
            yaml.push(`${prefix}${k}: ${this.formatYamlValue(v)}`);
          }
        }
      }
    };

    yaml.push('implementation_result:');
    stringify(obj, 1);

    return yaml.join('\n') + '\n';
  }

  /**
   * Format a value for YAML output
   */
  private formatYamlValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'string') {
      // Quote strings that could be misinterpreted
      if (
        value.includes(':') ||
        value.includes('#') ||
        value.includes('\n') ||
        value.startsWith('"') ||
        value.startsWith("'")
      ) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    // Handle objects by serializing to JSON (arrays are also objects)
    return JSON.stringify(value);
  }

  /**
   * Reset internal state for new implementation
   */
  private resetState(): void {
    this.fileChanges.clear();
    this.testsCreated.clear();
    this.commits.length = 0;
    this.lastTestGenerationResult = null;
    this.currentBranchName = null;
  }

  /**
   * Get the configuration
   */
  public getConfig(): Required<WorkerAgentConfig> {
    return { ...this.config };
  }
}
