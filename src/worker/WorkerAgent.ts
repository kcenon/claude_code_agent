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
 * Parallel verification:
 * - Tests, lint, and build run concurrently for faster feedback
 * - All verification results are collected and reported together
 *
 * Error classification system implemented:
 * - Transient errors (network, timeout): Retry with exponential backoff
 * - Recoverable errors (test failures, lint errors): Attempt self-fix then retry
 * - Fatal errors (missing dependencies, blocked): No retry, immediate escalation
 *
 * NOTE: Uses string concatenation for commit messages (simple and effective).
 *
 * Implements IAgent interface for AgentFactory integration
 *
 * @module worker/WorkerAgent
 */

import { join, normalize, resolve, relative, isAbsolute } from 'node:path';
import { mkdir, writeFile as fsWriteFile, unlink } from 'node:fs/promises';
import type { IAgent } from '../agents/types.js';
import type { AgentBridge, AgentRequest } from '../agents/AgentBridge.js';
import { getLogger } from '../logging/index.js';

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
import { getDefaultWorkerAgentConfig, DEFAULT_RETRY_POLICY } from './types.js';
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
  CodeGenerationError,
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
 * Parsed code change from LLM output
 */
export interface CodeChange {
  /** File path relative to project root */
  readonly filePath: string;
  /** Action to perform */
  readonly action: 'create' | 'modify' | 'delete';
  /** File content (for create/modify) */
  readonly content?: string;
  /** Description of the change */
  readonly description: string;
  /** Lines added */
  readonly linesAdded: number;
  /** Lines removed */
  readonly linesRemoved: number;
}

/**
 * Agent ID for WorkerAgent used in AgentFactory
 */
export const WORKER_AGENT_ID = 'worker-agent';

/**
 * Worker Agent
 *
 * Processes Work Orders to implement code changes, generate tests,
 * and verify the implementation through automated checks.
 * Implements IAgent interface for unified agent instantiation through AgentFactory
 */
export class WorkerAgent implements IAgent {
  public readonly agentId = WORKER_AGENT_ID;
  public readonly name = 'Worker Agent';

  private readonly config: Required<WorkerAgentConfig>;
  private readonly fileChanges: Map<string, FileChange>;
  private readonly testsCreated: Map<string, number>;
  private readonly commits: CommitInfo[];
  private readonly testGenerator: TestGenerator;
  private readonly fileOps: SecureFileOps;
  private readonly checkpointManager: CheckpointManager;
  private lastTestGenerationResult: TestGenerationResult | null;
  private currentBranchName: string | null;
  private initialized = false;
  private bridge?: AgentBridge;

  constructor(
    config: WorkerAgentConfig = {},
    testGeneratorConfig?: TestGeneratorConfig,
    checkpointConfig?: CheckpointManagerConfig
  ) {
    const defaults = getDefaultWorkerAgentConfig();
    this.config = {
      projectRoot: config.projectRoot ?? tryGetProjectRoot() ?? defaults.projectRoot,
      resultsPath: config.resultsPath ?? defaults.resultsPath,
      maxRetries: config.maxRetries ?? defaults.maxRetries,
      testCommand: config.testCommand ?? defaults.testCommand,
      lintCommand: config.lintCommand ?? defaults.lintCommand,
      buildCommand: config.buildCommand ?? defaults.buildCommand,
      autoFixLint: config.autoFixLint ?? defaults.autoFixLint,
      coverageThreshold: config.coverageThreshold ?? defaults.coverageThreshold,
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
   * Initialize the agent (IAgent interface)
   * Called after construction, before first use
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // WorkerAgent doesn't require async initialization
    // but the interface requires this method
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Set the AgentBridge for AI-backed code generation.
   * When set, generateCode() delegates to the bridge instead of using stub behavior.
   * @param bridge - The AgentBridge implementation to use
   */
  public setBridge(bridge: AgentBridge): void {
    this.bridge = bridge;
  }

  /**
   * Dispose of the agent and release resources (IAgent interface)
   * Called when the agent is no longer needed
   * @returns Promise that resolves when cleanup is complete
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.resetState();
    this.initialized = false;
  }

  /**
   * Main implementation entry point
   * Processes a Work Order and returns the implementation result
   *
   * @param workOrder - Work order to process
   * @param options - Execution options including resume capability
   * @returns Promise resolving to complete implementation result with status and changes
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
   * @param workOrderId - Work order identifier to check
   * @returns Promise resolving to true if checkpoint exists and is valid
   */
  public async hasCheckpoint(workOrderId: string): Promise<boolean> {
    return this.checkpointManager.hasCheckpoint(workOrderId);
  }

  /**
   * Get the checkpoint manager for external access
   * @returns The CheckpointManager instance used by this worker
   */
  public getCheckpointManager(): CheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Analyze context from work order
   * Reads related files and analyzes code patterns
   * Uses SecureFileOps for path traversal prevention
   * @param workOrder - Work order containing context and related files to analyze
   * @returns Promise resolving to code context with files and detected patterns
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
            const logger = getLogger();
            logger.warn(`Could not read file ${file.path}: ${errorMessage}`, {
              filePath: file.path,
            });
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
   * @param files - Array of file contexts to analyze for coding patterns
   * @returns Detected code patterns including indentation, quotes, test framework, etc.
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
   * @param workOrder - Work order containing issue information for branch naming
   * @returns Promise resolving to the created or checked out branch name
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
   * @param workOrder - Work order containing issue ID to analyze
   * @returns Branch prefix (feature, fix, docs, test, or refactor) based on issue type
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
   * Generate code based on work order.
   *
   * When an AgentBridge is configured (via setBridge()), delegates code
   * generation to the AI backend. The bridge response is parsed for file
   * changes which are then applied to disk and recorded.
   *
   * When no bridge is set, falls back to stub behavior: records the target
   * files from the work order context so that subsequent pipeline steps
   * (test generation, verification) have awareness of the intended scope.
   *
   * @param context - Execution context containing work order, code patterns, and config
   */
  public async generateCode(context: ExecutionContext): Promise<void> {
    const { workOrder, codeContext } = context;

    // Delegate to bridge when available
    if (this.bridge) {
      const request: AgentRequest = {
        agentType: 'worker',
        input: this.buildCodeGenPrompt(workOrder, codeContext),
        scratchpadDir: this.config.resultsPath,
        projectDir: this.config.projectRoot,
        priorStageOutputs: {
          issue: JSON.stringify(workOrder),
          codeContext: JSON.stringify(codeContext),
        },
      };

      const response = await this.bridge.execute(request);
      if (!response.success) {
        throw new CodeGenerationError(
          workOrder.issueId,
          new Error(response.error ?? 'Unknown code generation error')
        );
      }

      const changes = this.parseCodeGenOutput(response.output);
      for (const change of changes) {
        await this.applyFileChange(change);
        this.recordFileChange({
          filePath: change.filePath,
          changeType:
            change.action === 'delete'
              ? 'delete'
              : change.action === 'create'
                ? 'create'
                : 'modify',
          description: change.description,
          linesAdded: change.linesAdded,
          linesRemoved: change.linesRemoved,
        });
      }
      return;
    }

    // Fallback: stub behavior — record target files as pending modifications
    for (const file of workOrder.context.relatedFiles) {
      const existingChange = this.fileChanges.get(file.path);
      if (!existingChange) {
        this.recordFileChange({
          filePath: file.path,
          changeType: 'modify',
          description: `Target file for ${workOrder.issueId}: ${file.reason}`,
          linesAdded: 0,
          linesRemoved: 0,
        });
      }
    }

    // Record additional files discovered via code context analysis
    for (const fileCtx of codeContext.relatedFiles) {
      const existingChange = this.fileChanges.get(fileCtx.path);
      if (!existingChange) {
        this.recordFileChange({
          filePath: fileCtx.path,
          changeType: 'modify',
          description: `Related file from code context analysis`,
          linesAdded: 0,
          linesRemoved: 0,
        });
      }
    }

    await Promise.resolve();
  }

  /**
   * Generate tests for the implemented code
   * Analyzes source files and generates comprehensive test suites
   * Uses SecureFileOps for path traversal prevention
   * @param context - Execution context containing code context and patterns
   * @returns Promise resolving to test generation result with suite details and coverage
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
   * @returns Last test generation result or null if no tests have been generated
   */
  public getLastTestGenerationResult(): TestGenerationResult | null {
    return this.lastTestGenerationResult;
  }

  /**
   * Get the test generator instance
   * @returns The TestGenerator instance used by this worker
   */
  public getTestGenerator(): TestGenerator {
    return this.testGenerator;
  }

  /**
   * Run verification (tests, lint, build) in parallel
   *
   * Executes all verification commands concurrently for faster feedback.
   * If lint fails and autoFixLint is enabled, a sequential fix is attempted.
   * @returns Promise resolving to verification result with test, lint, and build outcomes
   */
  public async runVerification(): Promise<VerificationResult> {
    // Run all verification commands in parallel
    const [testsResult, initialLintResult, buildResult] = await Promise.all([
      this.runCommand(this.config.testCommand),
      this.runCommand(this.config.lintCommand),
      this.runCommand(this.config.buildCommand),
    ]);

    const testsPassed = testsResult.exitCode === 0;
    const buildPassed = buildResult.exitCode === 0;

    let lintResult = initialLintResult;
    let lintPassed = lintResult.exitCode === 0;

    // Try auto-fix if lint failed and auto-fix is enabled
    if (!lintPassed && this.config.autoFixLint) {
      const fixResult = await this.runCommand(`${this.config.lintCommand} --fix`);
      if (fixResult.exitCode === 0) {
        lintResult = await this.runCommand(this.config.lintCommand);
        lintPassed = lintResult.exitCode === 0;
      }
    }

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
   * @param workOrder - Work order containing issue information for commit message
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
   * @param workOrder - Work order containing issue ID to analyze
   * @returns Conventional commit type (feat, fix, docs, test, refactor, perf, style, or chore)
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
   * @param type - Conventional commit type prefix
   * @param workOrder - Work order containing issue ID and context for message
   * @returns Formatted commit message with type, scope, description, and issue reference
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
   * @param workOrder - Work order that was processed
   * @param status - Implementation status (completed, failed, or blocked)
   * @param startedAt - ISO timestamp when implementation started
   * @param branchName - Git branch name used for implementation
   * @param verification - Verification results from tests, lint, and build
   * @param notes - Optional notes about the implementation
   * @param blockers - Optional array of blocker descriptions if status is blocked
   * @returns Complete implementation result with all changes and metadata
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
   * @param result - Implementation result to persist as YAML
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
   * @param change - File change record to track (path, type, description, and line counts)
   */
  public recordFileChange(change: FileChange): void {
    this.fileChanges.set(change.filePath, change);
  }

  /**
   * Record test creation
   * @param filePath - Path to the test file
   * @param testCount - Number of test cases in the file
   */
  public recordTestFile(filePath: string, testCount: number): void {
    this.testsCreated.set(filePath, testCount);
  }

  /**
   * Get current git branch name
   * @returns Promise resolving to current branch name or 'unknown' if detection fails
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
   * @param command - Git command string to execute (without 'git' prefix)
   * @returns Promise resolving to stdout and stderr output
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
   * @param command - Shell command string to execute
   * @returns Promise resolving to command result with stdout, stderr, and exit code
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
   * @param override - Optional partial retry policy to override defaults
   * @returns Complete retry policy with all fields populated
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
   * @param policy - Base retry policy containing category-specific overrides
   * @param category - Error category to get configuration for
   * @returns Category-specific retry configuration with retry flag, max attempts, and fix requirement
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
   * @param attempt - Current attempt number (1-based)
   * @param policy - Retry policy containing backoff strategy and delay parameters
   * @returns Delay in milliseconds for this retry attempt (capped at maxDelayMs)
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
   * @param ms - Duration to sleep in milliseconds
   * @returns Promise that resolves after the specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a slugified version of a string for branch names
   * @param text - Text to slugify
   * @returns Lowercase slug with hyphens, suitable for branch names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Escape quotes for shell commands
   * @param text - Text containing quotes to escape
   * @returns Text with all double quotes escaped for safe shell usage
   */
  private escapeQuotes(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  /**
   * Create a skipped verification result
   * @returns Verification result with all checks marked as passed and outputs as 'Skipped'
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
   * @param obj - Object to serialize as YAML
   * @returns YAML string representation of the object
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
   * @param value - Value to format
   * @returns YAML-safe string representation of the value
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
   * Build a structured prompt for code generation from work order and code context.
   * @param workOrder - The work order describing the task
   * @param codeContext - Analyzed code context with related files and patterns
   * @returns Formatted prompt string for the LLM
   */
  private buildCodeGenPrompt(workOrder: WorkOrder, codeContext: CodeContext): string {
    const sections: string[] = [];

    sections.push('## Task');
    sections.push(`Issue: ${workOrder.issueId}`);
    sections.push(`Priority: ${String(workOrder.priority)}`);
    sections.push(
      `Acceptance Criteria:\n${workOrder.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`
    );

    if (workOrder.context.relatedFiles.length > 0) {
      sections.push('\n## Related Files');
      for (const file of workOrder.context.relatedFiles) {
        sections.push(`- ${file.path}: ${file.reason}`);
      }
    }

    if (codeContext.relatedFiles.length > 0) {
      sections.push('\n## Code Context');
      for (const fileCtx of codeContext.relatedFiles) {
        sections.push(`### ${fileCtx.path}`);
        sections.push(`Reason: ${fileCtx.reason}`);
        sections.push('```');
        sections.push(fileCtx.content);
        sections.push('```');
      }
    }

    sections.push('\n## Code Style');
    sections.push(
      `Indentation: ${codeContext.patterns.indentation} (${String(codeContext.patterns.indentSize)})`
    );
    sections.push(`Quotes: ${codeContext.patterns.quoteStyle}`);
    sections.push(`Semicolons: ${String(codeContext.patterns.useSemicolons)}`);

    sections.push('\n## Output Format');
    sections.push('Respond with a JSON array of file changes:');
    sections.push('```json');
    sections.push(
      '[{ "filePath": "...", "action": "create|modify|delete", "content": "...", "description": "...", "linesAdded": N, "linesRemoved": N }]'
    );
    sections.push('```');

    return sections.join('\n');
  }

  /**
   * Parse LLM output into structured CodeChange array.
   * Supports JSON array output (with optional markdown fencing).
   * @param output - Raw output string from the LLM
   * @returns Array of parsed code changes
   */
  public parseCodeGenOutput(output: string): CodeChange[] {
    // Strip markdown code fences if present
    let jsonStr = output.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch?.[1] != null && fenceMatch[1] !== '') {
      jsonStr = fenceMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    const changes: CodeChange[] = [];
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).filePath === 'string' &&
        typeof (item as Record<string, unknown>).action === 'string'
      ) {
        const raw = item as Record<string, unknown>;
        const action = raw.action as string;
        if (action !== 'create' && action !== 'modify' && action !== 'delete') {
          continue;
        }
        const typedAction: 'create' | 'modify' | 'delete' = action;
        const base = {
          filePath: raw.filePath as string,
          action: typedAction,
          description:
            typeof raw.description === 'string'
              ? raw.description
              : `${typedAction} ${raw.filePath as string}`,
          linesAdded: typeof raw.linesAdded === 'number' ? raw.linesAdded : 0,
          linesRemoved: typeof raw.linesRemoved === 'number' ? raw.linesRemoved : 0,
        };
        const change: CodeChange =
          typeof raw.content === 'string' ? { ...base, content: raw.content } : base;
        changes.push(change);
      }
    }

    return changes;
  }

  /**
   * Apply a file change to disk, respecting project root boundaries.
   * Creates parent directories as needed. Validates path traversal.
   * @param change - The code change to apply
   * @throws CodeGenerationError if path escapes project root
   */
  private async applyFileChange(change: CodeChange): Promise<void> {
    // Validate file path stays within project root
    const projectRoot = resolve(this.config.projectRoot);
    const targetPath = isAbsolute(change.filePath)
      ? resolve(change.filePath)
      : resolve(projectRoot, change.filePath);
    const normalizedTarget = normalize(targetPath);
    const relativePath = relative(projectRoot, normalizedTarget);

    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new CodeGenerationError(
        `path-traversal:${change.filePath}`,
        new Error(`File path "${change.filePath}" escapes project root`)
      );
    }

    if (change.action === 'delete') {
      try {
        await unlink(normalizedTarget);
      } catch {
        // Ignore if file doesn't exist
      }
      return;
    }

    // create or modify
    const dir = join(normalizedTarget, '..');
    await mkdir(dir, { recursive: true });
    await fsWriteFile(normalizedTarget, change.content ?? '', 'utf-8');
  }

  /**
   * Get the current file changes map.
   * @returns Read-only view of tracked file changes
   */
  public getFileChanges(): ReadonlyMap<string, FileChange> {
    return this.fileChanges;
  }

  /**
   * Get the configuration
   * @returns Copy of the worker agent configuration
   */
  public getConfig(): Required<WorkerAgentConfig> {
    return { ...this.config };
  }
}
