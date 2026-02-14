/**
 * Prerequisite validation for project initialization
 *
 * @packageDocumentation
 */

import type {
  PrerequisiteCheck,
  PrerequisiteResult,
  PrerequisiteValidationResult,
} from './types.js';
import { getCommandSanitizer } from '../security/index.js';

/**
 * Validates prerequisites required for AD-SDLC project initialization
 */
export class PrerequisiteValidator {
  private readonly checks: PrerequisiteCheck[];

  constructor() {
    this.checks = [
      {
        name: 'Node.js Version',
        check: this.checkNodeVersion.bind(this),
        fix: 'Install Node.js 18 or higher from https://nodejs.org',
        required: true,
      },
      {
        name: 'Claude API Key',
        check: this.checkClaudeApiKey.bind(this),
        fix: 'Set CLAUDE_API_KEY environment variable or ANTHROPIC_API_KEY',
        required: false,
      },
      {
        name: 'GitHub CLI',
        check: this.checkGitHubCli.bind(this),
        fix: 'Install GitHub CLI (gh) from https://cli.github.com and run: gh auth login',
        required: false,
      },
      {
        name: 'Git',
        check: this.checkGit.bind(this),
        fix: 'Install Git from https://git-scm.com',
        required: true,
      },
    ];
  }

  /**
   * Run all prerequisite checks
   * @returns Validation result containing check statuses and overall validity
   */
  async validate(): Promise<PrerequisiteValidationResult> {
    const results: PrerequisiteResult[] = [];
    let warnings = 0;

    for (const check of this.checks) {
      try {
        const passed = await check.check();
        results.push({
          name: check.name,
          passed,
          fix: passed ? undefined : check.fix,
          required: check.required,
        });

        if (!passed && !check.required) {
          warnings++;
        }
      } catch {
        results.push({
          name: check.name,
          passed: false,
          fix: check.fix,
          required: check.required,
        });

        if (!check.required) {
          warnings++;
        }
      }
    }

    const valid = results.filter((r) => r.required).every((r) => r.passed);

    return {
      checks: results,
      valid,
      warnings,
    };
  }

  /**
   * Check if Node.js version is 18 or higher
   * @returns True if Node.js version is 18 or higher, false otherwise
   */
  private checkNodeVersion(): Promise<boolean> {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0] ?? '0', 10);
    return Promise.resolve(major >= 18);
  }

  /**
   * Check if Claude API key is set
   * @returns True if CLAUDE_API_KEY or ANTHROPIC_API_KEY is set, false otherwise
   */
  private checkClaudeApiKey(): Promise<boolean> {
    const claudeKey = process.env['CLAUDE_API_KEY'];
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const hasKey =
      (typeof claudeKey === 'string' && claudeKey.length > 0) ||
      (typeof anthropicKey === 'string' && anthropicKey.length > 0);
    return Promise.resolve(hasKey);
  }

  /**
   * Check if GitHub CLI is installed and authenticated
   * @returns True if GitHub CLI is installed and user is logged in, false otherwise
   */
  private async checkGitHubCli(): Promise<boolean> {
    const sanitizer = getCommandSanitizer();
    try {
      const result = await sanitizer.execGh(['auth', 'status'], {});
      return result.stdout.includes('Logged in') || result.stdout.includes('logged in');
    } catch {
      return false;
    }
  }

  /**
   * Check if Git is installed
   * @returns True if Git is installed and executable, false otherwise
   */
  private async checkGit(): Promise<boolean> {
    const sanitizer = getCommandSanitizer();
    try {
      const result = await sanitizer.execGit(['--version'], {});
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Add a custom prerequisite check
   * @param check - The prerequisite check to add to the validation list
   */
  addCheck(check: PrerequisiteCheck): void {
    this.checks.push(check);
  }

  /**
   * Get all registered checks
   * @returns Read-only array of all registered prerequisite checks
   */
  getChecks(): readonly PrerequisiteCheck[] {
    return this.checks;
  }
}

// Singleton instance
let validatorInstance: PrerequisiteValidator | null = null;

/**
 * Get the singleton PrerequisiteValidator instance
 * @returns The singleton PrerequisiteValidator instance
 */
export function getPrerequisiteValidator(): PrerequisiteValidator {
  if (!validatorInstance) {
    validatorInstance = new PrerequisiteValidator();
  }
  return validatorInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPrerequisiteValidator(): void {
  validatorInstance = null;
}
