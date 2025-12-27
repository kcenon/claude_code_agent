/**
 * Prerequisite validation for project initialization
 *
 * @packageDocumentation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import type { PrerequisiteCheck, PrerequisiteResult, PrerequisiteValidationResult } from './types.js';

const execAsync = promisify(exec);

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
   */
  private checkNodeVersion(): Promise<boolean> {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0] ?? '0', 10);
    return Promise.resolve(major >= 18);
  }

  /**
   * Check if Claude API key is set
   */
  private checkClaudeApiKey(): Promise<boolean> {
    const claudeKey = process.env['CLAUDE_API_KEY'];
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const hasKey = (typeof claudeKey === 'string' && claudeKey.length > 0) ||
                   (typeof anthropicKey === 'string' && anthropicKey.length > 0);
    return Promise.resolve(hasKey);
  }

  /**
   * Check if GitHub CLI is installed and authenticated
   */
  private async checkGitHubCli(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('gh auth status 2>&1');
      return stdout.includes('Logged in') || stdout.includes('logged in');
    } catch {
      return false;
    }
  }

  /**
   * Check if Git is installed
   */
  private async checkGit(): Promise<boolean> {
    try {
      await execAsync('git --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add a custom prerequisite check
   */
  addCheck(check: PrerequisiteCheck): void {
    this.checks.push(check);
  }

  /**
   * Get all registered checks
   */
  getChecks(): readonly PrerequisiteCheck[] {
    return this.checks;
  }
}

// Singleton instance
let validatorInstance: PrerequisiteValidator | null = null;

/**
 * Get the singleton PrerequisiteValidator instance
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
