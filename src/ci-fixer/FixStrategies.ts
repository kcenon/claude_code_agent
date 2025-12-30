/**
 * Fix Strategies module
 *
 * Implements automated fix strategies for different types of CI failures.
 * Supports lint, type, test, build, and dependency fixes.
 *
 * @module ci-fixer/FixStrategies
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { AppliedFix, CIFailure, CIFailureCategory, VerificationResult } from './types.js';
import { LintFixError, TypeFixError } from './errors.js';
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
 * Fix strategy options
 */
export interface FixStrategyOptions {
  /** Project root directory */
  readonly projectRoot: string;
  /** Timeout for fix commands (ms) */
  readonly timeout?: number;
  /** Dry run mode (don't actually apply fixes) */
  readonly dryRun?: boolean;
}

/**
 * Fix Strategies class
 *
 * Provides methods to automatically fix different types of CI failures.
 */
export class FixStrategies {
  private readonly projectRoot: string;
  private readonly timeout: number;
  private readonly dryRun: boolean;

  constructor(options: FixStrategyOptions) {
    this.projectRoot = options.projectRoot;
    this.timeout = options.timeout ?? 120000; // 2 minutes default
    this.dryRun = options.dryRun ?? false;
  }

  // ==========================================================================
  // Lint Fixes
  // ==========================================================================

  /**
   * Apply lint auto-fix
   *
   * @returns Applied fix result
   */
  public async applyLintFix(): Promise<AppliedFix> {
    try {
      if (this.dryRun) {
        return this.createDryRunResult('lint', 'project', 'Would run lint --fix');
      }

      // Try npm run lint -- --fix first
      const result = await this.executeCommand('npm run lint -- --fix', {
        ignoreExitCode: true,
      });

      const success = result.exitCode === 0;

      return {
        type: 'lint',
        file: 'project',
        description: success
          ? 'Applied ESLint auto-fixes'
          : `Lint fix completed with warnings: exit code ${String(result.exitCode)}`,
        success,
        error: success ? undefined : result.stderr.slice(0, 500),
      };
    } catch (error) {
      throw new LintFixError(1, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Apply Prettier formatting
   *
   * @returns Applied fix result
   */
  public async applyPrettierFix(): Promise<AppliedFix> {
    try {
      if (this.dryRun) {
        return this.createDryRunResult('lint', 'project', 'Would run prettier --write');
      }

      // Check if prettier is available
      const hasPrettier = await this.commandExists('npm run format');

      if (!hasPrettier) {
        return {
          type: 'lint',
          file: 'project',
          description: 'Prettier not configured in project',
          success: false,
          error: 'npm run format script not found',
        };
      }

      const result = await this.executeCommand('npm run format', {
        ignoreExitCode: true,
      });

      return {
        type: 'lint',
        file: 'project',
        description: 'Applied Prettier formatting',
        success: result.exitCode === 0,
        error: result.exitCode !== 0 ? result.stderr.slice(0, 500) : undefined,
      };
    } catch (error) {
      return {
        type: 'lint',
        file: 'project',
        description: 'Failed to apply Prettier formatting',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Type Fixes
  // ==========================================================================

  /**
   * Attempt to fix TypeScript type errors
   *
   * @param failures - Type failures to fix
   * @returns Array of applied fixes
   */
  public async applyTypeFixes(failures: readonly CIFailure[]): Promise<AppliedFix[]> {
    const results: AppliedFix[] = [];

    for (const failure of failures) {
      if (failure.category !== 'type' || failure.file === undefined) {
        continue;
      }

      try {
        const fix = await this.attemptTypeErrorFix(failure);
        results.push(fix);
      } catch (error) {
        results.push({
          type: 'type',
          file: failure.file,
          description: `Failed to fix: ${failure.message}`,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Attempt to fix a single type error
   */
  private async attemptTypeErrorFix(failure: CIFailure): Promise<AppliedFix> {
    if (failure.file === undefined) {
      throw new TypeFixError('unknown', 0, 'No file path provided');
    }

    const filePath = join(this.projectRoot, failure.file);

    if (!existsSync(filePath)) {
      throw new TypeFixError(failure.file, failure.line ?? 0, 'File not found');
    }

    if (this.dryRun) {
      return this.createDryRunResult('type', failure.file, `Would fix: ${failure.message}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Try different fix strategies based on error message
    const fixedContent = this.attemptTypeErrorFixStrategies(
      lines,
      failure.line ?? 0,
      failure.message
    );

    if (fixedContent === null) {
      return {
        type: 'type',
        file: failure.file,
        description: `Could not auto-fix: ${failure.message}`,
        success: false,
        error: 'No applicable auto-fix strategy',
      };
    }

    await writeFile(filePath, fixedContent, 'utf-8');

    return {
      type: 'type',
      file: failure.file,
      description: `Fixed: ${failure.message}`,
      success: true,
    };
  }

  /**
   * Try different type error fix strategies
   */
  private attemptTypeErrorFixStrategies(
    lines: string[],
    lineNumber: number,
    errorMessage: string
  ): string | null {
    // Strategy 1: Add type assertion for 'possibly undefined'
    if (
      errorMessage.includes('possibly undefined') ||
      errorMessage.includes("possibly 'undefined'")
    ) {
      return this.addNonNullAssertion(lines, lineNumber);
    }

    // Strategy 2: Add type annotation for implicit 'any'
    if (errorMessage.includes('implicitly has an') && errorMessage.includes("'any'")) {
      return this.addExplicitAny(lines, lineNumber);
    }

    // Strategy 3: Fix missing property errors
    if (errorMessage.includes('does not exist on type')) {
      // This requires more complex analysis, skip for now
      return null;
    }

    // Strategy 4: Add missing import
    if (errorMessage.includes('Cannot find name')) {
      // This requires analyzing what needs to be imported
      return null;
    }

    return null;
  }

  /**
   * Add non-null assertion to fix 'possibly undefined' errors
   */
  private addNonNullAssertion(lines: string[], lineNumber: number): string | null {
    const lineIndex = lineNumber - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return null;
    }

    // This is a simplified fix - in practice, we'd use AST manipulation
    // For now, just return null to indicate we can't auto-fix
    return null;
  }

  /**
   * Add explicit 'any' type annotation
   */
  private addExplicitAny(lines: string[], lineNumber: number): string | null {
    const lineIndex = lineNumber - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return null;
    }

    // This is a simplified fix - in practice, we'd use AST manipulation
    return null;
  }

  // ==========================================================================
  // Test Fixes
  // ==========================================================================

  /**
   * Attempt to fix test failures
   *
   * @param failures - Test failures to fix
   * @returns Array of applied fixes
   */
  public async applyTestFixes(failures: readonly CIFailure[]): Promise<AppliedFix[]> {
    const results: AppliedFix[] = [];

    for (const failure of failures) {
      if (failure.category !== 'test') {
        continue;
      }

      try {
        const fix = await this.attemptTestFix(failure);
        results.push(fix);
      } catch (error) {
        results.push({
          type: 'test',
          file: failure.file ?? 'unknown',
          description: `Failed to fix test: ${failure.message}`,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Attempt to fix a single test failure
   */
  private async attemptTestFix(failure: CIFailure): Promise<AppliedFix> {
    if (this.dryRun) {
      return this.createDryRunResult(
        'test',
        failure.file ?? 'unknown',
        `Would attempt to fix: ${failure.message}`
      );
    }

    // Strategy 1: Update snapshots
    if (failure.message.includes('snapshot') || failure.details.includes('snapshot')) {
      return this.updateSnapshots();
    }

    // Strategy 2: Test-specific fixes would require more analysis
    return {
      type: 'test',
      file: failure.file ?? 'unknown',
      description: `Cannot auto-fix: ${failure.message}`,
      success: false,
      error: 'Test fixes require manual intervention',
    };
  }

  /**
   * Update test snapshots
   */
  private async updateSnapshots(): Promise<AppliedFix> {
    try {
      const result = await this.executeCommand('npm test -- --updateSnapshot', {
        ignoreExitCode: true,
      });

      return {
        type: 'test',
        file: 'snapshots',
        description: 'Updated test snapshots',
        success: result.exitCode === 0,
        error: result.exitCode !== 0 ? result.stderr.slice(0, 500) : undefined,
      };
    } catch (error) {
      return {
        type: 'test',
        file: 'snapshots',
        description: 'Failed to update snapshots',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Build Fixes
  // ==========================================================================

  /**
   * Attempt to fix build failures
   *
   * @param failures - Build failures to fix
   * @returns Array of applied fixes
   */
  public async applyBuildFixes(failures: readonly CIFailure[]): Promise<AppliedFix[]> {
    const results: AppliedFix[] = [];

    // First, try clean install
    const cleanResult = await this.cleanInstall();
    results.push(cleanResult);

    if (!cleanResult.success) {
      return results;
    }

    // Then try to address specific build failures
    for (const failure of failures) {
      if (failure.category !== 'build') {
        continue;
      }

      const fix = this.attemptBuildFix(failure);
      results.push(fix);
    }

    return results;
  }

  /**
   * Perform clean install
   */
  private async cleanInstall(): Promise<AppliedFix> {
    if (this.dryRun) {
      return this.createDryRunResult('build', 'project', 'Would run npm ci');
    }

    try {
      const result = await this.executeCommand('npm ci', {
        timeout: 180000, // 3 minutes for npm ci
      });

      return {
        type: 'build',
        file: 'project',
        description: 'Performed clean dependency install',
        success: result.exitCode === 0,
        error: result.exitCode !== 0 ? result.stderr.slice(0, 500) : undefined,
      };
    } catch (error) {
      return {
        type: 'build',
        file: 'project',
        description: 'Failed to perform clean install',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Attempt to fix a single build failure
   */
  private attemptBuildFix(failure: CIFailure): AppliedFix {
    // Check for module not found errors
    if (
      failure.message.includes('Module not found') ||
      failure.message.includes('Cannot resolve')
    ) {
      return this.attemptModuleInstall(failure);
    }

    return {
      type: 'build',
      file: failure.file ?? 'unknown',
      description: `Cannot auto-fix build error: ${failure.message}`,
      success: false,
      error: 'Build error requires manual intervention',
    };
  }

  /**
   * Attempt to install missing module
   */
  private attemptModuleInstall(failure: CIFailure): AppliedFix {
    // Extract module name from error message
    const moduleMatch = failure.message.match(/['"]([^'"]+)['"]/);
    if (moduleMatch === null) {
      return {
        type: 'build',
        file: 'package.json',
        description: 'Could not determine missing module name',
        success: false,
        error: 'Unable to parse module name from error',
      };
    }

    const moduleName = moduleMatch[1];

    if (this.dryRun) {
      return this.createDryRunResult(
        'build',
        'package.json',
        `Would install: ${moduleName ?? 'unknown'}`
      );
    }

    // Don't auto-install packages without user confirmation in production
    return {
      type: 'build',
      file: 'package.json',
      description: `Missing module: ${moduleName ?? 'unknown'}`,
      success: false,
      error: 'Auto-installing packages requires manual confirmation',
    };
  }

  // ==========================================================================
  // Dependency Fixes
  // ==========================================================================

  /**
   * Fix dependency issues
   *
   * @returns Applied fix result
   */
  public async applyDependencyFix(): Promise<AppliedFix> {
    if (this.dryRun) {
      return this.createDryRunResult('dependency', 'package-lock.json', 'Would run npm audit fix');
    }

    try {
      const result = await this.executeCommand('npm audit fix', {
        ignoreExitCode: true,
      });

      return {
        type: 'dependency',
        file: 'package-lock.json',
        description: 'Applied npm audit fixes',
        success: result.exitCode === 0,
        error: result.exitCode !== 0 ? result.stderr.slice(0, 500) : undefined,
      };
    } catch (error) {
      return {
        type: 'dependency',
        file: 'package-lock.json',
        description: 'Failed to apply dependency fixes',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Verification
  // ==========================================================================

  /**
   * Run local verification after applying fixes
   *
   * @returns Verification result
   */
  public async runVerification(): Promise<VerificationResult> {
    const outputs = {
      lint: '',
      typecheck: '',
      test: '',
      build: '',
    };

    // Run lint check
    const lintResult = await this.executeCommand('npm run lint', {
      ignoreExitCode: true,
      timeout: 60000,
    });
    outputs.lint = lintResult.stdout + lintResult.stderr;
    const lintPassed = lintResult.exitCode === 0;

    // Run typecheck
    const typecheckResult = await this.executeCommand('npm run typecheck', {
      ignoreExitCode: true,
      timeout: 120000,
    });
    outputs.typecheck = typecheckResult.stdout + typecheckResult.stderr;
    const typecheckPassed = typecheckResult.exitCode === 0;

    // Run tests
    const testResult = await this.executeCommand('npm test', {
      ignoreExitCode: true,
      timeout: 300000, // 5 minutes for tests
    });
    outputs.test = testResult.stdout + testResult.stderr;
    const testsPassed = testResult.exitCode === 0;

    // Run build
    const buildResult = await this.executeCommand('npm run build', {
      ignoreExitCode: true,
      timeout: 180000, // 3 minutes for build
    });
    outputs.build = buildResult.stdout + buildResult.stderr;
    const buildPassed = buildResult.exitCode === 0;

    return {
      lintPassed,
      typecheckPassed,
      testsPassed,
      buildPassed,
      outputs,
    };
  }

  // ==========================================================================
  // Apply All Fixes
  // ==========================================================================

  /**
   * Apply all applicable fixes for detected failures
   *
   * @param failures - Detected failures
   * @param categories - Categories to fix (default: all)
   * @returns Array of all applied fixes
   */
  public async applyAllFixes(
    failures: readonly CIFailure[],
    categories?: readonly CIFailureCategory[]
  ): Promise<AppliedFix[]> {
    const results: AppliedFix[] = [];
    const targetCategories = categories ?? ['lint', 'type', 'test', 'build', 'dependency'];

    // Apply lint fixes first (most common and usually safe)
    if (targetCategories.includes('lint')) {
      const lintFix = await this.applyLintFix();
      results.push(lintFix);

      const prettierFix = await this.applyPrettierFix();
      results.push(prettierFix);
    }

    // Apply type fixes
    if (targetCategories.includes('type')) {
      const typeFailures = failures.filter((f) => f.category === 'type');
      const typeFixes = await this.applyTypeFixes(typeFailures);
      results.push(...typeFixes);
    }

    // Apply test fixes
    if (targetCategories.includes('test')) {
      const testFailures = failures.filter((f) => f.category === 'test');
      const testFixes = await this.applyTestFixes(testFailures);
      results.push(...testFixes);
    }

    // Apply build fixes
    if (targetCategories.includes('build')) {
      const buildFailures = failures.filter((f) => f.category === 'build');
      const buildFixes = await this.applyBuildFixes(buildFailures);
      results.push(...buildFixes);
    }

    // Apply dependency fixes
    if (targetCategories.includes('dependency')) {
      const depFix = await this.applyDependencyFix();
      results.push(depFix);
    }

    return results;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Execute a shell command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async executeCommand(
    command: string,
    options?: {
      timeout?: number;
      ignoreExitCode?: boolean;
    }
  ): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.projectRoot,
        timeout: options?.timeout ?? this.timeout,
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

        if (options?.ignoreExitCode === true) {
          return {
            stdout: execError.stdout ?? '',
            stderr: execError.stderr ?? '',
            exitCode: execError.exitCode ?? 1,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Check if a command/script exists
   */
  private async commandExists(npmScript: string): Promise<boolean> {
    try {
      const packageJsonPath = join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
        scripts?: Record<string, string>;
      };

      const scriptName = npmScript.replace('npm run ', '');
      return packageJson.scripts?.[scriptName] !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Create a dry-run result
   */
  private createDryRunResult(
    type: CIFailureCategory,
    file: string,
    description: string
  ): AppliedFix {
    return {
      type,
      file,
      description: `[DRY RUN] ${description}`,
      success: true,
    };
  }
}
