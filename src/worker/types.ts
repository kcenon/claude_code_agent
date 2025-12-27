/**
 * Worker module type definitions
 *
 * Defines types for Worker Agent code generation, test writing,
 * and self-verification functionality.
 */

import type { WorkOrder, WorkOrderContext, RelatedFile } from '../controller/types.js';

/**
 * Worker Agent configuration
 */
export interface WorkerAgentConfig {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Path to store results (default: '.ad-sdlc/scratchpad/progress') */
  readonly resultsPath?: string;
  /** Maximum retry attempts (default: 3) */
  readonly maxRetries?: number;
  /** Test command (default: 'npm test') */
  readonly testCommand?: string;
  /** Lint command (default: 'npm run lint') */
  readonly lintCommand?: string;
  /** Build command (default: 'npm run build') */
  readonly buildCommand?: string;
  /** Enable auto-fix for lint errors (default: true) */
  readonly autoFixLint?: boolean;
  /** Minimum coverage threshold (default: 80) */
  readonly coverageThreshold?: number;
}

/**
 * Default worker agent configuration
 */
export const DEFAULT_WORKER_AGENT_CONFIG: Required<WorkerAgentConfig> = {
  projectRoot: process.cwd(),
  resultsPath: '.ad-sdlc/scratchpad/progress',
  maxRetries: 3,
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build',
  autoFixLint: true,
  coverageThreshold: 80,
} as const;

/**
 * Implementation status
 */
export type ImplementationStatus = 'completed' | 'failed' | 'blocked';

/**
 * File change type
 */
export type FileChangeType = 'create' | 'modify' | 'delete';

/**
 * File change information
 */
export interface FileChange {
  /** File path relative to project root */
  readonly filePath: string;
  /** Type of change */
  readonly changeType: FileChangeType;
  /** Description of the change */
  readonly description: string;
  /** Number of lines added */
  readonly linesAdded: number;
  /** Number of lines removed */
  readonly linesRemoved: number;
}

/**
 * Test information
 */
export interface TestInfo {
  /** Test file path relative to project root */
  readonly filePath: string;
  /** Number of test cases */
  readonly testCount: number;
}

/**
 * Verification result for tests, lint, and build
 */
export interface VerificationResult {
  /** Whether tests passed */
  readonly testsPassed: boolean;
  /** Test output */
  readonly testsOutput: string;
  /** Whether lint passed */
  readonly lintPassed: boolean;
  /** Lint output */
  readonly lintOutput: string;
  /** Whether build passed */
  readonly buildPassed: boolean;
  /** Build output */
  readonly buildOutput: string;
}

/**
 * Commit information
 */
export interface CommitInfo {
  /** Commit hash */
  readonly hash: string;
  /** Commit message */
  readonly message: string;
}

/**
 * Branch information
 */
export interface BranchInfo {
  /** Branch name */
  readonly name: string;
  /** Commits on this branch */
  readonly commits: readonly CommitInfo[];
}

/**
 * Tests summary
 */
export interface TestsSummary {
  /** Test files created */
  readonly filesCreated: readonly string[];
  /** Total number of tests */
  readonly totalTests: number;
  /** Coverage percentage */
  readonly coveragePercentage: number;
}

/**
 * Implementation result from Worker Agent
 */
export interface ImplementationResult {
  /** Work order ID reference */
  readonly workOrderId: string;
  /** Issue ID reference */
  readonly issueId: string;
  /** GitHub issue number (optional) */
  readonly githubIssue?: number;
  /** Implementation status */
  readonly status: ImplementationStatus;
  /** Start timestamp */
  readonly startedAt: string;
  /** Completion timestamp */
  readonly completedAt: string;
  /** File changes made */
  readonly changes: readonly FileChange[];
  /** Tests summary */
  readonly tests: TestsSummary;
  /** Verification results */
  readonly verification: VerificationResult;
  /** Branch information */
  readonly branch: BranchInfo;
  /** Additional notes */
  readonly notes?: string;
  /** Blockers (if blocked) */
  readonly blockers?: readonly string[];
}

/**
 * Code context for generation
 */
export interface CodeContext {
  /** Related files with content */
  readonly relatedFiles: readonly FileContext[];
  /** Detected code patterns */
  readonly patterns: CodePatterns;
  /** Work order being processed */
  readonly workOrder: WorkOrder;
}

/**
 * File context with content
 */
export interface FileContext {
  /** File path */
  readonly path: string;
  /** File content */
  readonly content: string;
  /** Reason for inclusion */
  readonly reason: string;
}

/**
 * Detected code patterns
 */
export interface CodePatterns {
  /** Indentation style (spaces or tabs) */
  readonly indentation: 'spaces' | 'tabs';
  /** Indentation size (if spaces) */
  readonly indentSize: number;
  /** Quote style for strings */
  readonly quoteStyle: 'single' | 'double';
  /** Whether semicolons are used */
  readonly useSemicolons: boolean;
  /** Trailing comma preference */
  readonly trailingComma: 'none' | 'es5' | 'all';
  /** Import style */
  readonly importStyle: 'named' | 'default' | 'mixed';
  /** Export style */
  readonly exportStyle: 'named' | 'default' | 'mixed';
  /** Error handling pattern */
  readonly errorHandling: 'try-catch' | 'result-type' | 'mixed';
  /** Testing framework detected */
  readonly testFramework?: 'jest' | 'vitest' | 'mocha' | 'other';
}

/**
 * Default code patterns
 */
export const DEFAULT_CODE_PATTERNS: CodePatterns = {
  indentation: 'spaces',
  indentSize: 2,
  quoteStyle: 'single',
  useSemicolons: true,
  trailingComma: 'es5',
  importStyle: 'named',
  exportStyle: 'named',
  errorHandling: 'try-catch',
  testFramework: 'vitest',
} as const;

/**
 * Branch naming convention
 */
export type BranchPrefix = 'feature' | 'fix' | 'docs' | 'test' | 'refactor';

/**
 * Commit type for conventional commits
 */
export type CommitType = 'feat' | 'fix' | 'docs' | 'test' | 'refactor' | 'style' | 'chore' | 'perf';

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of attempts */
  readonly maxAttempts: number;
  /** Base delay in milliseconds */
  readonly baseDelayMs: number;
  /** Backoff strategy */
  readonly backoff: 'fixed' | 'linear' | 'exponential';
  /** Maximum delay in milliseconds */
  readonly maxDelayMs: number;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  backoff: 'exponential',
  maxDelayMs: 60000,
} as const;

/**
 * Worker execution options
 */
export interface WorkerExecutionOptions {
  /** Skip test generation */
  readonly skipTests?: boolean;
  /** Skip verification */
  readonly skipVerification?: boolean;
  /** Dry run mode (don't commit changes) */
  readonly dryRun?: boolean;
  /** Custom retry policy */
  readonly retryPolicy?: Partial<RetryPolicy>;
}

/**
 * Execution context passed to implementation methods
 */
export interface ExecutionContext {
  /** Work order being processed */
  readonly workOrder: WorkOrder;
  /** Code context with analyzed patterns */
  readonly codeContext: CodeContext;
  /** Worker configuration */
  readonly config: Required<WorkerAgentConfig>;
  /** Execution options */
  readonly options: WorkerExecutionOptions;
  /** Current attempt number */
  readonly attemptNumber: number;
}

// Re-export types from controller for convenience
export type { WorkOrder, WorkOrderContext, RelatedFile };
