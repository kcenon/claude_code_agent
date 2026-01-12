/**
 * Worker module type definitions
 *
 * Defines types for Worker Agent code generation, test writing,
 * and self-verification functionality.
 *
 * Uses factory functions to resolve projectRoot at runtime for consistent
 * behavior with ProjectContext.
 */

import type { WorkOrder, WorkOrderContext, RelatedFile } from '../controller/types.js';
import type { ErrorCategory } from '../errors/index.js';
import { tryGetProjectRoot } from '../utils/index.js';

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
 * Resolve project root using ProjectContext when available.
 *
 * Priority:
 * 1. Initialized project root from ProjectContext
 * 2. Current working directory (fallback)
 */
function resolveProjectRoot(): string {
  return tryGetProjectRoot() ?? process.cwd();
}

/**
 * Static default worker agent configuration values (excluding projectRoot).
 * Use getDefaultWorkerAgentConfig() for runtime configuration with proper projectRoot.
 */
const STATIC_WORKER_DEFAULTS = {
  resultsPath: '.ad-sdlc/scratchpad/progress',
  maxRetries: 3,
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build',
  autoFixLint: true,
  coverageThreshold: 80,
} as const;

/**
 * Get default worker agent configuration with runtime project root resolution.
 *
 * Uses ProjectContext.tryGetProjectRoot() for consistent behavior in monorepos.
 * Falls back to process.cwd() if ProjectContext is not initialized.
 *
 * @returns Complete worker agent configuration with resolved projectRoot
 */
export function getDefaultWorkerAgentConfig(): Required<WorkerAgentConfig> {
  return {
    projectRoot: resolveProjectRoot(),
    ...STATIC_WORKER_DEFAULTS,
  };
}

/**
 * Default worker agent configuration
 *
 * @deprecated Use getDefaultWorkerAgentConfig() for runtime-resolved projectRoot.
 * This constant is kept for backward compatibility but evaluates projectRoot
 * at module load time, which may not reflect the actual project root.
 */
export const DEFAULT_WORKER_AGENT_CONFIG: Required<WorkerAgentConfig> = {
  projectRoot: process.cwd(),
  ...STATIC_WORKER_DEFAULTS,
};

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
 * Error category for retry decision
 * - transient: Network issues, API rate limits - retry with backoff
 * - recoverable: Test failures, lint errors - attempt self-fix then retry
 * - fatal: Missing dependencies, permission denied - immediate escalation
 *
 * Re-exported from errors module for backward compatibility
 */
export type { ErrorCategory };

/**
 * Extended worker error information
 * Provides detailed context for error handling and reporting
 */
export interface WorkerErrorInfo {
  /** Error category for retry decision */
  readonly category: ErrorCategory;
  /** Error code for identification */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Additional context information */
  readonly context: Record<string, unknown>;
  /** Stack trace if available */
  readonly stackTrace?: string;
  /** Whether the error is retryable */
  readonly retryable: boolean;
  /** Suggested action for resolution */
  readonly suggestedAction: string;
}

/**
 * Retry policy configuration by error category
 */
export interface CategoryRetryPolicy {
  /** Whether to retry for this category */
  readonly retry: boolean;
  /** Maximum attempts for this category */
  readonly maxAttempts: number;
  /** Whether to require fix attempt before retry (for recoverable) */
  readonly requireFixAttempt?: boolean;
  /** Whether to escalate immediately (for fatal) */
  readonly escalateImmediately?: boolean;
}

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
  /** Operation timeout in milliseconds (default: 600000 = 10 min) */
  readonly timeoutMs?: number;
  /** Category-specific retry policies */
  readonly byCategory?: {
    readonly transient?: Partial<CategoryRetryPolicy>;
    readonly recoverable?: Partial<CategoryRetryPolicy>;
    readonly fatal?: Partial<CategoryRetryPolicy>;
  };
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoff: 'exponential',
  maxDelayMs: 30000,
  timeoutMs: 600000, // 10 minutes
  byCategory: {
    transient: {
      retry: true,
      maxAttempts: 3,
    },
    recoverable: {
      retry: true,
      maxAttempts: 3,
      requireFixAttempt: true,
    },
    fatal: {
      retry: false,
      maxAttempts: 0,
      escalateImmediately: true,
    },
  },
} as const;

/**
 * Retry attempt record
 */
export interface RetryAttempt {
  /** Attempt number (1-based) */
  readonly attempt: number;
  /** Timestamp of the attempt */
  readonly timestamp: string;
  /** Error encountered */
  readonly error: WorkerErrorInfo;
  /** Whether fix was attempted */
  readonly fixAttempted: boolean;
  /** Duration of the attempt in milliseconds */
  readonly durationMs: number;
}

/**
 * Progress checkpoint for resume capability
 */
export interface ProgressCheckpoint {
  /** Work order ID */
  readonly workOrderId: string;
  /** Task ID */
  readonly taskId: string;
  /** Current step being executed */
  readonly currentStep: WorkerStep;
  /** Timestamp of the checkpoint */
  readonly timestamp: string;
  /** Attempt number at checkpoint */
  readonly attemptNumber: number;
  /** Progress snapshot data */
  readonly progressSnapshot: Record<string, unknown>;
  /** Files changed so far */
  readonly filesChanged: readonly string[];
  /** Whether checkpoint is resumable */
  readonly resumable: boolean;
}

/**
 * Worker execution steps
 */
export type WorkerStep =
  | 'context_analysis'
  | 'branch_creation'
  | 'code_generation'
  | 'test_generation'
  | 'verification'
  | 'commit'
  | 'result_persistence';

/**
 * Escalation report for Controller notification
 */
export interface EscalationReport {
  /** Task ID requiring escalation */
  readonly taskId: string;
  /** Worker ID that encountered the issue */
  readonly workerId: string;
  /** Error information */
  readonly error: WorkerErrorInfo;
  /** All retry attempts made */
  readonly attempts: readonly RetryAttempt[];
  /** Context information */
  readonly context: {
    /** Original work order */
    readonly workOrder: Record<string, unknown>;
    /** Progress snapshot at failure */
    readonly progressSnapshot: Record<string, unknown>;
  };
  /** Recommended action */
  readonly recommendation: string;
  /** Timestamp of escalation */
  readonly timestamp: string;
}

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

// ============================================================================
// Test Generation Types
// ============================================================================

/**
 * Test case category
 */
export type TestCategory = 'happy_path' | 'edge_case' | 'error_handling' | 'integration';

/**
 * Test case priority
 */
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Individual test case specification
 */
export interface TestCase {
  /** Test case name following should_[expected]_when_[condition] convention */
  readonly name: string;
  /** Test category */
  readonly category: TestCategory;
  /** Test priority */
  readonly priority: TestPriority;
  /** Description of what the test verifies */
  readonly description: string;
  /** Setup/Arrange phase description */
  readonly arrange: string;
  /** Action/Act phase description */
  readonly act: string;
  /** Verification/Assert phase description */
  readonly assert: string;
  /** Mock dependencies required */
  readonly mocks: readonly MockDependency[];
  /** Expected coverage contribution */
  readonly coversBranches: readonly string[];
}

/**
 * Mock dependency specification
 */
export interface MockDependency {
  /** Dependency name/identifier */
  readonly name: string;
  /** Type of dependency (class, function, module) */
  readonly type: 'class' | 'function' | 'module' | 'external';
  /** Mock implementation strategy */
  readonly strategy: 'spy' | 'stub' | 'mock' | 'fake';
  /** Return value or behavior description */
  readonly behavior: string;
}

/**
 * Test suite specification for a source file
 */
export interface TestSuite {
  /** Source file being tested */
  readonly sourceFile: string;
  /** Test file path */
  readonly testFile: string;
  /** Test framework to use */
  readonly framework: 'jest' | 'vitest' | 'mocha';
  /** Test suites (describe blocks) */
  readonly suites: readonly TestSuiteBlock[];
  /** Total test count */
  readonly totalTests: number;
  /** Estimated coverage */
  readonly estimatedCoverage: number;
}

/**
 * Test suite block (describe block)
 */
export interface TestSuiteBlock {
  /** Suite name (typically class/function name) */
  readonly name: string;
  /** Nested suites for method grouping */
  readonly nestedSuites: readonly TestSuiteBlock[];
  /** Test cases in this suite */
  readonly testCases: readonly TestCase[];
  /** Setup function (beforeEach) */
  readonly setup?: string;
  /** Teardown function (afterEach) */
  readonly teardown?: string;
}

/**
 * Test generation configuration
 */
export interface TestGeneratorConfig {
  /** Minimum coverage target (default: 80) */
  readonly coverageTarget?: number;
  /** Test naming convention */
  readonly namingConvention?: 'should_when' | 'it_does' | 'test_case';
  /** Include edge case tests */
  readonly includeEdgeCases?: boolean;
  /** Include error handling tests */
  readonly includeErrorHandling?: boolean;
  /** Include integration tests */
  readonly includeIntegration?: boolean;
  /** Mock generation strategy */
  readonly mockStrategy?: 'minimal' | 'comprehensive';
  /** Test file naming pattern */
  readonly testFilePattern?: 'test' | 'spec';
}

/**
 * Default test generator configuration
 */
export const DEFAULT_TEST_GENERATOR_CONFIG: Required<TestGeneratorConfig> = {
  coverageTarget: 80,
  namingConvention: 'should_when',
  includeEdgeCases: true,
  includeErrorHandling: true,
  includeIntegration: true,
  mockStrategy: 'comprehensive',
  testFilePattern: 'test',
} as const;

/**
 * Code analysis result for test generation
 */
export interface CodeAnalysis {
  /** Classes found in the source */
  readonly classes: readonly ClassInfo[];
  /** Standalone functions found */
  readonly functions: readonly FunctionInfo[];
  /** Imports and dependencies */
  readonly dependencies: readonly DependencyInfo[];
  /** Export statements */
  readonly exports: readonly ExportInfo[];
}

/**
 * Class information for test generation
 */
export interface ClassInfo {
  /** Class name */
  readonly name: string;
  /** Constructor parameters */
  readonly constructorParams: readonly ParameterInfo[];
  /** Public methods */
  readonly methods: readonly MethodInfo[];
  /** Public properties */
  readonly properties: readonly PropertyInfo[];
  /** Whether it's exported */
  readonly isExported: boolean;
  /** Line number in source */
  readonly lineNumber: number;
}

/**
 * Method information
 */
export interface MethodInfo {
  /** Method name */
  readonly name: string;
  /** Parameters */
  readonly params: readonly ParameterInfo[];
  /** Return type */
  readonly returnType: string;
  /** Whether it's async */
  readonly isAsync: boolean;
  /** Visibility */
  readonly visibility: 'public' | 'private' | 'protected';
  /** Complexity estimate */
  readonly complexity: number;
  /** Line number in source */
  readonly lineNumber: number;
}

/**
 * Function information for test generation
 */
export interface FunctionInfo {
  /** Function name */
  readonly name: string;
  /** Parameters */
  readonly params: readonly ParameterInfo[];
  /** Return type */
  readonly returnType: string;
  /** Whether it's async */
  readonly isAsync: boolean;
  /** Whether it's exported */
  readonly isExported: boolean;
  /** Complexity estimate */
  readonly complexity: number;
  /** Line number in source */
  readonly lineNumber: number;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  /** Parameter name */
  readonly name: string;
  /** Parameter type */
  readonly type: string;
  /** Whether it's optional */
  readonly isOptional: boolean;
  /** Default value if any */
  readonly defaultValue?: string;
}

/**
 * Property information
 */
export interface PropertyInfo {
  /** Property name */
  readonly name: string;
  /** Property type */
  readonly type: string;
  /** Whether it's readonly */
  readonly isReadonly: boolean;
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  /** Module/package name */
  readonly module: string;
  /** Imported names */
  readonly imports: readonly string[];
  /** Whether it's a type-only import */
  readonly isTypeOnly: boolean;
  /** Whether it's external (node_modules) */
  readonly isExternal: boolean;
}

/**
 * Export information
 */
export interface ExportInfo {
  /** Exported name */
  readonly name: string;
  /** Type of export */
  readonly type: 'class' | 'function' | 'const' | 'type' | 'interface';
  /** Whether it's a default export */
  readonly isDefault: boolean;
}

/**
 * Test generation result
 */
export interface TestGenerationResult {
  /** Generated test suites */
  readonly testSuites: readonly TestSuite[];
  /** Total tests generated */
  readonly totalTests: number;
  /** Estimated coverage */
  readonly estimatedCoverage: number;
  /** Coverage breakdown by category */
  readonly coverageByCategory: Record<TestCategory, number>;
  /** Warnings during generation */
  readonly warnings: readonly string[];
}

// ============================================================================
// Self-Verification Types (UC-013)
// ============================================================================

/**
 * Verification step types
 */
export type VerificationStep = 'test' | 'lint' | 'build' | 'typecheck';

/**
 * Final status of the self-verification process
 */
export type SelfVerificationStatus = 'passed' | 'failed' | 'escalated';

/**
 * Individual verification step result
 */
export interface VerificationStepResult {
  /** Step name */
  readonly step: VerificationStep;
  /** Whether the step passed */
  readonly passed: boolean;
  /** Exit code from command */
  readonly exitCode: number;
  /** Command output (stdout + stderr) */
  readonly output: string;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Error count (parsed from output if available) */
  readonly errorCount: number;
  /** Warning count (parsed from output if available) */
  readonly warningCount: number;
  /** Whether auto-fix was applied */
  readonly autoFixApplied: boolean;
}

/**
 * Fix attempt record
 */
export interface FixAttempt {
  /** Iteration number (1-3) */
  readonly iteration: number;
  /** Step that was being fixed */
  readonly step: VerificationStep;
  /** Fixes that were applied */
  readonly fixesApplied: readonly string[];
  /** Whether the fix resolved the issue */
  readonly success: boolean;
  /** Error message if fix failed */
  readonly errorMessage?: string;
  /** Duration of fix attempt in milliseconds */
  readonly durationMs: number;
}

/**
 * Self-verification report
 * Generated after running the full verification pipeline
 */
export interface VerificationReport {
  /** Task/work order ID */
  readonly taskId: string;
  /** Report generation timestamp */
  readonly timestamp: string;
  /** Results for each verification step */
  readonly results: {
    readonly tests: VerificationStepResult | null;
    readonly lint: VerificationStepResult | null;
    readonly build: VerificationStepResult | null;
    readonly typecheck: VerificationStepResult | null;
  };
  /** Test summary (if tests were run) */
  readonly testSummary?: {
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    readonly coverage: number;
  };
  /** Lint summary (if lint was run) */
  readonly lintSummary?: {
    readonly errors: number;
    readonly warnings: number;
    readonly autoFixed: number;
  };
  /** All fix attempts made */
  readonly fixAttempts: readonly FixAttempt[];
  /** Final status of the verification */
  readonly finalStatus: SelfVerificationStatus;
  /** Total duration in milliseconds */
  readonly totalDurationMs: number;
  /** Escalation details if escalated */
  readonly escalation?: {
    readonly reason: string;
    readonly failedSteps: readonly VerificationStep[];
    readonly errorLogs: readonly string[];
    readonly attemptedFixes: readonly string[];
    readonly analysis: string;
  };
}

/**
 * Self-verification configuration
 */
export interface SelfVerificationConfig {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Test command (default: 'npm test') */
  readonly testCommand?: string;
  /** Lint command (default: 'npm run lint') */
  readonly lintCommand?: string;
  /** Build command (default: 'npm run build') */
  readonly buildCommand?: string;
  /** Type check command (default: 'npm run typecheck' or 'npx tsc --noEmit') */
  readonly typecheckCommand?: string;
  /** Maximum fix iterations per step (default: 3) */
  readonly maxFixIterations?: number;
  /** Enable auto-fix for lint errors (default: true) */
  readonly autoFixLint?: boolean;
  /** Steps to run (default: all) */
  readonly stepsToRun?: readonly VerificationStep[];
  /** Command timeout in milliseconds (default: 300000 = 5 min) */
  readonly commandTimeout?: number;
  /** Continue on step failure (default: false) */
  readonly continueOnFailure?: boolean;
}

/**
 * Static default self-verification configuration values (excluding projectRoot).
 * Use getDefaultSelfVerificationConfig() for runtime configuration with proper projectRoot.
 */
const STATIC_VERIFICATION_DEFAULTS = {
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build',
  typecheckCommand: 'npx tsc --noEmit',
  maxFixIterations: 3,
  autoFixLint: true,
  stepsToRun: ['test', 'lint', 'build', 'typecheck'] as const,
  commandTimeout: 300000,
  continueOnFailure: false,
} as const;

/**
 * Get default self-verification configuration with runtime project root resolution.
 *
 * Uses ProjectContext.tryGetProjectRoot() for consistent behavior in monorepos.
 * Falls back to process.cwd() if ProjectContext is not initialized.
 *
 * @returns Complete self-verification configuration with resolved projectRoot
 */
export function getDefaultSelfVerificationConfig(): Required<SelfVerificationConfig> {
  return {
    projectRoot: resolveProjectRoot(),
    ...STATIC_VERIFICATION_DEFAULTS,
  };
}

/**
 * Default self-verification configuration
 *
 * @deprecated Use getDefaultSelfVerificationConfig() for runtime-resolved projectRoot.
 * This constant is kept for backward compatibility but evaluates projectRoot
 * at module load time, which may not reflect the actual project root.
 */
export const DEFAULT_SELF_VERIFICATION_CONFIG: Required<SelfVerificationConfig> = {
  projectRoot: process.cwd(),
  ...STATIC_VERIFICATION_DEFAULTS,
};

/**
 * Fix suggestion for a verification error
 */
export interface FixSuggestion {
  /** Description of the fix */
  readonly description: string;
  /** Type of fix */
  readonly type: 'auto' | 'manual' | 'partial';
  /** Command to apply fix (if auto) */
  readonly command?: string;
  /** Files affected */
  readonly affectedFiles: readonly string[];
  /** Confidence level (0-100) */
  readonly confidence: number;
}

/**
 * Parsed error from verification output
 */
export interface VerificationError {
  /** Error type */
  readonly type: VerificationStep;
  /** File path where error occurred */
  readonly filePath?: string;
  /** Line number */
  readonly line?: number;
  /** Column number */
  readonly column?: number;
  /** Error message */
  readonly message: string;
  /** Error code (e.g., TS2345, ESLint rule name) */
  readonly code?: string;
  /** Severity */
  readonly severity: 'error' | 'warning';
}

// Re-export types from controller for convenience
export type { WorkOrder, WorkOrderContext, RelatedFile };
