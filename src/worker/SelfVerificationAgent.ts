/**
 * Self-Verification Agent module
 *
 * Implements the self-verification loop (UC-013) that automatically
 * runs tests, linting, building, and type checking with automatic
 * fix attempts and escalation when necessary.
 *
 * @module worker/SelfVerificationAgent
 */

import type {
  SelfVerificationConfig,
  VerificationStep,
  VerificationStepResult,
  VerificationReport,
  FixAttempt,
  FixSuggestion,
  VerificationError,
  SelfVerificationStatus,
} from './types.js';
import { getDefaultSelfVerificationConfig } from './types.js';
import { EscalationRequiredError, CommandTimeoutError } from './errors.js';
import { getCommandSanitizer } from '../security/index.js';
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
 * Self-Verification Agent
 *
 * Runs a verification pipeline (tests, lint, build, typecheck) with
 * automatic fix attempts and generates detailed verification reports.
 */
export class SelfVerificationAgent {
  private readonly config: Required<SelfVerificationConfig>;
  private readonly fixAttempts: FixAttempt[];
  private readonly stepResults: Map<VerificationStep, VerificationStepResult>;

  constructor(config: SelfVerificationConfig = {}) {
    const defaults = getDefaultSelfVerificationConfig();
    this.config = {
      projectRoot: config.projectRoot ?? tryGetProjectRoot() ?? defaults.projectRoot,
      testCommand: config.testCommand ?? defaults.testCommand,
      lintCommand: config.lintCommand ?? defaults.lintCommand,
      buildCommand: config.buildCommand ?? defaults.buildCommand,
      typecheckCommand: config.typecheckCommand ?? defaults.typecheckCommand,
      maxFixIterations: config.maxFixIterations ?? defaults.maxFixIterations,
      autoFixLint: config.autoFixLint ?? defaults.autoFixLint,
      stepsToRun: config.stepsToRun ?? defaults.stepsToRun,
      commandTimeout: config.commandTimeout ?? defaults.commandTimeout,
      continueOnFailure: config.continueOnFailure ?? defaults.continueOnFailure,
    };

    this.fixAttempts = [];
    this.stepResults = new Map();
  }

  /**
   * Run the full verification pipeline
   *
   * Executes all configured verification steps in order:
   * test -> lint -> build -> typecheck
   *
   * For each failed step, attempts automatic fixes up to maxFixIterations times.
   * If all attempts fail, escalates the issue.
   *
   * @param taskId - The task/work order ID for tracking
   * @returns Verification report with results and any escalation details
   */
  public async runVerificationPipeline(taskId: string): Promise<VerificationReport> {
    const startTime = Date.now();
    this.resetState();

    const failedSteps: VerificationStep[] = [];
    const errorLogs: string[] = [];

    // Run each step in order
    for (const step of this.config.stepsToRun) {
      const result = await this.runStepWithRetry(step);
      this.stepResults.set(step, result);

      if (!result.passed) {
        failedSteps.push(step);
        errorLogs.push(`[${step}] ${result.output.slice(0, 1000)}`);

        if (!this.config.continueOnFailure) {
          break;
        }
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const finalStatus = this.determineFinalStatus(failedSteps);

    // Build the report
    const report = this.buildReport(taskId, finalStatus, totalDurationMs, failedSteps, errorLogs);

    // Throw escalation error if needed
    if (finalStatus === 'escalated') {
      throw new EscalationRequiredError(
        taskId,
        failedSteps,
        this.fixAttempts.length,
        errorLogs,
        this.analyzeFailures(failedSteps)
      );
    }

    return report;
  }

  /**
   * Run a single verification step with retry attempts
   */
  private async runStepWithRetry(step: VerificationStep): Promise<VerificationStepResult> {
    let lastResult = await this.runStep(step);

    if (lastResult.passed) {
      return lastResult;
    }

    // Attempt fixes up to maxFixIterations times
    for (let iteration = 1; iteration <= this.config.maxFixIterations; iteration++) {
      const fixAttempt = await this.attemptFix(step, lastResult, iteration);
      this.fixAttempts.push(fixAttempt);

      if (fixAttempt.success) {
        // Re-run the step to verify the fix worked
        lastResult = await this.runStep(step);
        if (lastResult.passed) {
          return lastResult;
        }
      }
    }

    return lastResult;
  }

  /**
   * Run a single verification step
   */
  public async runStep(step: VerificationStep): Promise<VerificationStepResult> {
    const startTime = Date.now();
    const command = this.getCommandForStep(step);

    const result = await this.runCommand(command);
    const durationMs = Date.now() - startTime;

    const { errorCount, warningCount } = this.parseOutputCounts(
      step,
      result.stdout + result.stderr
    );

    return {
      step,
      passed: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.stdout + result.stderr,
      durationMs,
      errorCount,
      warningCount,
      autoFixApplied: false,
    };
  }

  /**
   * Attempt to fix a failed verification step
   */
  private async attemptFix(
    step: VerificationStep,
    stepResult: VerificationStepResult,
    iteration: number
  ): Promise<FixAttempt> {
    const startTime = Date.now();
    const fixesApplied: string[] = [];
    let success = false;
    let errorMessage: string | undefined;

    try {
      const suggestions = this.analyzeError(step, stepResult.output);

      for (const suggestion of suggestions) {
        if (suggestion.type === 'auto' && suggestion.command !== undefined) {
          const result = await this.runCommand(suggestion.command);
          fixesApplied.push(suggestion.description);

          if (result.exitCode === 0) {
            success = true;
          }
        }
      }

      // For lint, try the built-in --fix option
      if (step === 'lint' && this.config.autoFixLint && !success) {
        const lintFixCommand = `${this.config.lintCommand} --fix`;
        const result = await this.runCommand(lintFixCommand);
        fixesApplied.push('Applied lint auto-fix');

        if (result.exitCode === 0) {
          success = true;
        }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const durationMs = Date.now() - startTime;

    // Build the result with conditional errorMessage
    const result: FixAttempt = {
      iteration,
      step,
      fixesApplied,
      success,
      durationMs,
    };

    // Only add errorMessage if it's defined
    if (errorMessage !== undefined) {
      return { ...result, errorMessage };
    }

    return result;
  }

  /**
   * Analyze verification output to suggest fixes
   */
  public analyzeError(step: VerificationStep, output: string): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const errors = this.parseErrors(step, output);

    for (const error of errors) {
      const suggestion = this.getSuggestionForError(error);
      if (suggestion !== null) {
        suggestions.push(suggestion);
      }
    }

    // Add step-specific auto-fix suggestions
    switch (step) {
      case 'lint':
        if (this.config.autoFixLint) {
          suggestions.push({
            description: 'Run lint with auto-fix flag',
            type: 'auto',
            command: `${this.config.lintCommand} --fix`,
            affectedFiles: [],
            confidence: 80,
          });
        }
        break;

      case 'test':
        // Test failures typically need manual intervention
        break;

      case 'build':
        // Build errors often need manual fixes
        break;

      case 'typecheck':
        // Type errors need manual fixes
        break;
    }

    return suggestions;
  }

  /**
   * Parse errors from verification output
   */
  public parseErrors(step: VerificationStep, output: string): VerificationError[] {
    const errors: VerificationError[] = [];
    const lines = output.split('\n');

    switch (step) {
      case 'typecheck':
        // TypeScript error format: file(line,col): error TS1234: message
        for (const line of lines) {
          const tsMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/);
          if (
            tsMatch !== null &&
            tsMatch[1] !== undefined &&
            tsMatch[2] !== undefined &&
            tsMatch[3] !== undefined &&
            tsMatch[4] !== undefined &&
            tsMatch[5] !== undefined &&
            tsMatch[6] !== undefined
          ) {
            errors.push({
              type: step,
              filePath: tsMatch[1],
              line: parseInt(tsMatch[2], 10),
              column: parseInt(tsMatch[3], 10),
              severity: tsMatch[4] as 'error' | 'warning',
              code: tsMatch[5],
              message: tsMatch[6],
            });
          }
        }
        break;

      case 'lint':
        // ESLint error format: file:line:col: message (rule-name)
        for (const line of lines) {
          const eslintMatch = line.match(/^(.+?):(\d+):(\d+):\s*(.+?)\s+\((.+?)\)$/);
          if (
            eslintMatch !== null &&
            eslintMatch[1] !== undefined &&
            eslintMatch[2] !== undefined &&
            eslintMatch[3] !== undefined &&
            eslintMatch[4] !== undefined &&
            eslintMatch[5] !== undefined
          ) {
            errors.push({
              type: step,
              filePath: eslintMatch[1],
              line: parseInt(eslintMatch[2], 10),
              column: parseInt(eslintMatch[3], 10),
              severity: line.includes('error') ? 'error' : 'warning',
              code: eslintMatch[5],
              message: eslintMatch[4],
            });
          }
        }
        break;

      case 'test':
        // Generic test failure detection
        for (const line of lines) {
          if (line.includes('FAIL') || line.includes('AssertionError') || line.includes('Error:')) {
            errors.push({
              type: step,
              severity: 'error',
              message: line.trim(),
            });
          }
        }
        break;

      case 'build':
        // Generic build error detection
        for (const line of lines) {
          if (line.toLowerCase().includes('error')) {
            errors.push({
              type: step,
              severity: 'error',
              message: line.trim(),
            });
          }
        }
        break;
    }

    return errors;
  }

  /**
   * Get a fix suggestion for a specific error
   */
  private getSuggestionForError(error: VerificationError): FixSuggestion | null {
    // Common patterns that can be auto-fixed
    if (error.type === 'lint' && error.code !== undefined) {
      // Some lint rules can be auto-fixed
      const autoFixableRules = [
        'prettier/prettier',
        'semi',
        'quotes',
        'indent',
        'comma-dangle',
        'no-trailing-spaces',
        'eol-last',
        '@typescript-eslint/semi',
        '@typescript-eslint/quotes',
      ];

      if (autoFixableRules.includes(error.code)) {
        return {
          description: `Auto-fix lint rule: ${error.code}`,
          type: 'auto',
          command: `${this.config.lintCommand} --fix`,
          affectedFiles: error.filePath !== undefined ? [error.filePath] : [],
          confidence: 90,
        };
      }
    }

    // For most errors, we can only suggest manual fixes
    if (error.filePath !== undefined) {
      return {
        description: `Fix ${error.type} error in ${error.filePath}: ${error.message}`,
        type: 'manual',
        affectedFiles: [error.filePath],
        confidence: 30,
      };
    }

    return null;
  }

  /**
   * Parse error and warning counts from output
   */
  private parseOutputCounts(
    step: VerificationStep,
    output: string
  ): { errorCount: number; warningCount: number } {
    let errorCount = 0;
    let warningCount = 0;

    switch (step) {
      case 'test': {
        // Vitest/Jest format: "X failed"
        const failMatch = output.match(/(\d+)\s+failed/i);
        if (failMatch !== null && failMatch[1] !== undefined) {
          errorCount = parseInt(failMatch[1], 10);
        }
        break;
      }

      case 'lint': {
        // ESLint format: "X errors, Y warnings"
        const errorMatch = output.match(/(\d+)\s+errors?/i);
        const warnMatch = output.match(/(\d+)\s+warnings?/i);
        if (errorMatch !== null && errorMatch[1] !== undefined) {
          errorCount = parseInt(errorMatch[1], 10);
        }
        if (warnMatch !== null && warnMatch[1] !== undefined) {
          warningCount = parseInt(warnMatch[1], 10);
        }
        break;
      }

      case 'typecheck': {
        // TypeScript: count "error TS" occurrences
        const tsErrors = output.match(/error TS\d+/gi);
        errorCount = tsErrors?.length ?? 0;
        break;
      }

      case 'build': {
        // Generic error counting
        const errors = output.match(/\berror\b/gi);
        const warnings = output.match(/\bwarning\b/gi);
        errorCount = errors?.length ?? 0;
        warningCount = warnings?.length ?? 0;
        break;
      }
    }

    return { errorCount, warningCount };
  }

  /**
   * Get the command for a verification step
   */
  private getCommandForStep(step: VerificationStep): string {
    switch (step) {
      case 'test':
        return this.config.testCommand;
      case 'lint':
        return this.config.lintCommand;
      case 'build':
        return this.config.buildCommand;
      case 'typecheck':
        return this.config.typecheckCommand;
    }
  }

  /**
   * Run a shell command with timeout using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async runCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.config.projectRoot,
        timeout: this.config.commandTimeout,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.success ? 0 : (result.exitCode ?? 1),
      };
    } catch (error: unknown) {
      // Check for timeout
      const errorObj = error as {
        killed?: boolean;
        code?: string | number;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
      };
      if (errorObj.killed === true || errorObj.code === 'ETIMEDOUT') {
        throw new CommandTimeoutError(command, this.config.commandTimeout);
      }

      // ExecException has stdout, stderr, and code
      return {
        stdout: errorObj.stdout ?? '',
        stderr: errorObj.stderr ?? '',
        exitCode: errorObj.exitCode ?? (typeof errorObj.code === 'number' ? errorObj.code : 1),
      };
    }
  }

  /**
   * Determine the final status based on failed steps
   */
  private determineFinalStatus(failedSteps: readonly VerificationStep[]): SelfVerificationStatus {
    if (failedSteps.length === 0) {
      return 'passed';
    }

    // Check if any step still fails after all fix attempts
    const unresolvedSteps = failedSteps.filter((step) => {
      const result = this.stepResults.get(step);
      return result !== undefined && !result.passed;
    });

    if (unresolvedSteps.length > 0) {
      return 'escalated';
    }

    return 'failed';
  }

  /**
   * Analyze failures to provide a summary for escalation
   */
  private analyzeFailures(failedSteps: readonly VerificationStep[]): string {
    const analyses: string[] = [];

    for (const step of failedSteps) {
      const result = this.stepResults.get(step);
      if (result === undefined) continue;

      const errors = this.parseErrors(step, result.output);
      const errorTypes = new Set(errors.map((e) => e.code ?? 'unknown'));

      analyses.push(
        `${step}: ${String(result.errorCount)} error(s), ${String(result.warningCount)} warning(s). ` +
          `Error types: ${Array.from(errorTypes).join(', ')}`
      );
    }

    const totalFixAttempts = this.fixAttempts.length;
    const successfulFixes = this.fixAttempts.filter((f) => f.success).length;

    return (
      `Analysis Summary:\n` +
      analyses.join('\n') +
      `\n\nFix Attempts: ${String(totalFixAttempts)} total, ${String(successfulFixes)} successful`
    );
  }

  /**
   * Build the verification report
   */
  private buildReport(
    taskId: string,
    finalStatus: SelfVerificationStatus,
    totalDurationMs: number,
    failedSteps: readonly VerificationStep[],
    errorLogs: readonly string[]
  ): VerificationReport {
    const testResult = this.stepResults.get('test') ?? null;
    const lintResult = this.stepResults.get('lint') ?? null;
    const buildResult = this.stepResults.get('build') ?? null;
    const typecheckResult = this.stepResults.get('typecheck') ?? null;

    const report: VerificationReport = {
      taskId,
      timestamp: new Date().toISOString(),
      results: {
        tests: testResult,
        lint: lintResult,
        build: buildResult,
        typecheck: typecheckResult,
      },
      fixAttempts: [...this.fixAttempts],
      finalStatus,
      totalDurationMs,
    };

    // Add test summary if tests were run
    if (testResult !== null) {
      const passMatch = testResult.output.match(/(\d+)\s+passed/i);
      const failMatch = testResult.output.match(/(\d+)\s+failed/i);
      const skipMatch = testResult.output.match(/(\d+)\s+skipped/i);
      const covMatch = testResult.output.match(/(\d+(?:\.\d+)?)\s*%\s*(?:coverage|statements)/i);

      (report as { testSummary: VerificationReport['testSummary'] }).testSummary = {
        passed: passMatch !== null && passMatch[1] !== undefined ? parseInt(passMatch[1], 10) : 0,
        failed: failMatch !== null && failMatch[1] !== undefined ? parseInt(failMatch[1], 10) : 0,
        skipped: skipMatch !== null && skipMatch[1] !== undefined ? parseInt(skipMatch[1], 10) : 0,
        coverage: covMatch !== null && covMatch[1] !== undefined ? parseFloat(covMatch[1]) : 0,
      };
    }

    // Add lint summary if lint was run
    if (lintResult !== null) {
      const autoFixedAttempts = this.fixAttempts.filter((f) => f.step === 'lint' && f.success);

      (report as { lintSummary: VerificationReport['lintSummary'] }).lintSummary = {
        errors: lintResult.errorCount,
        warnings: lintResult.warningCount,
        autoFixed: autoFixedAttempts.length,
      };
    }

    // Add escalation details if escalated
    if (finalStatus === 'escalated') {
      (report as { escalation: VerificationReport['escalation'] }).escalation = {
        reason: `${String(failedSteps.length)} verification step(s) failed after ${String(this.config.maxFixIterations)} fix attempt(s)`,
        failedSteps: [...failedSteps],
        errorLogs: [...errorLogs],
        attemptedFixes: this.fixAttempts.flatMap((f) => f.fixesApplied),
        analysis: this.analyzeFailures(failedSteps),
      };
    }

    return report;
  }

  /**
   * Reset internal state for a new verification run
   */
  private resetState(): void {
    this.fixAttempts.length = 0;
    this.stepResults.clear();
  }

  /**
   * Get the configuration
   */
  public getConfig(): Required<SelfVerificationConfig> {
    return { ...this.config };
  }

  /**
   * Get fix attempts made during last verification
   */
  public getFixAttempts(): readonly FixAttempt[] {
    return [...this.fixAttempts];
  }

  /**
   * Get step results from last verification
   */
  public getStepResults(): ReadonlyMap<VerificationStep, VerificationStepResult> {
    return new Map(this.stepResults);
  }

  /**
   * Check if all steps passed in the last verification
   */
  public allStepsPassed(): boolean {
    for (const step of this.config.stepsToRun) {
      const result = this.stepResults.get(step);
      if (result === undefined || !result.passed) {
        return false;
      }
    }
    return true;
  }
}
