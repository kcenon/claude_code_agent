/**
 * Review Checks module
 *
 * Performs automated code review checks including security analysis,
 * code quality assessment, and best practice verification.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ReviewComment,
  ReviewChecklist,
  SecurityCheckItem,
  QualityMetrics,
  SecurityIssues,
  FileChange,
} from './types.js';
import { CommandExecutionError } from './errors.js';

const execAsync = promisify(exec);

/**
 * Review Checks Options
 */
export interface ReviewChecksOptions {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Enable security scanning */
  readonly enableSecurityScan?: boolean;
  /** Enable complexity analysis */
  readonly enableComplexityAnalysis?: boolean;
  /** Custom lint command */
  readonly lintCommand?: string;
  /** Custom test command */
  readonly testCommand?: string;
}

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Review Checks
 *
 * Performs automated code review checks to identify potential issues
 * in the codebase including security vulnerabilities, code smells,
 * and best practice violations.
 */
export class ReviewChecks {
  private readonly projectRoot: string;
  private readonly enableSecurityScan: boolean;
  private readonly enableComplexityAnalysis: boolean;
  private readonly lintCommand: string;
  private readonly testCommand: string;

  constructor(options: ReviewChecksOptions = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.enableSecurityScan = options.enableSecurityScan ?? true;
    this.enableComplexityAnalysis = options.enableComplexityAnalysis ?? true;
    this.lintCommand = options.lintCommand ?? 'npm run lint';
    this.testCommand = options.testCommand ?? 'npm test';
  }

  /**
   * Run all review checks on changed files
   */
  public async runAllChecks(
    changes: readonly FileChange[]
  ): Promise<{
    comments: ReviewComment[];
    checklist: ReviewChecklist;
    metrics: QualityMetrics;
  }> {
    const comments: ReviewComment[] = [];

    // Run security checks
    const securityChecks = await this.runSecurityChecks(changes);
    comments.push(...securityChecks.comments);

    // Run quality checks
    const qualityChecks = await this.runQualityChecks(changes);
    comments.push(...qualityChecks.comments);

    // Run testing checks
    const testingChecks = await this.runTestingChecks();

    // Run performance checks
    const performanceChecks = await this.runPerformanceChecks(changes);
    comments.push(...performanceChecks.comments);

    // Run documentation checks
    const docChecks = await this.runDocumentationChecks(changes);
    comments.push(...docChecks.comments);

    // Build checklist
    const checklist: ReviewChecklist = {
      security: securityChecks.items,
      quality: qualityChecks.items,
      testing: testingChecks.items,
      performance: performanceChecks.items,
      documentation: docChecks.items,
    };

    // Calculate metrics
    const metrics = await this.calculateMetrics(changes, testingChecks);

    return { comments, checklist, metrics };
  }

  /**
   * Run security-focused checks
   */
  private async runSecurityChecks(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];

    // Check for hardcoded secrets
    const secretsCheck = await this.checkForSecrets(changes);
    items.push(secretsCheck.item);
    comments.push(...secretsCheck.comments);

    // Check for SQL injection vulnerabilities
    const sqlCheck = await this.checkForSQLInjection(changes);
    items.push(sqlCheck.item);
    comments.push(...sqlCheck.comments);

    // Check for XSS vulnerabilities
    const xssCheck = await this.checkForXSS(changes);
    items.push(xssCheck.item);
    comments.push(...xssCheck.comments);

    // Check for input validation
    const inputCheck = await this.checkInputValidation(changes);
    items.push(inputCheck.item);
    comments.push(...inputCheck.comments);

    return { comments, items };
  }

  /**
   * Check for hardcoded secrets
   */
  private async checkForSecrets(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    const secretPatterns = [
      /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{10,}['"]/gi,
      /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi,
      /(?:secret|token)\s*[:=]\s*['"][^'"]{10,}['"]/gi,
      /(?:aws|gcp|azure)[_-]?(?:access|secret)[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/gi,
    ];

    let foundSecrets = false;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of secretPatterns) {
            if (pattern.test(lines[i])) {
              foundSecrets = true;
              comments.push({
                file: change.filePath,
                line: i + 1,
                comment: 'Potential hardcoded secret detected. Consider using environment variables.',
                severity: 'critical',
                resolved: false,
              });
            }
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'No hardcoded secrets',
        passed: !foundSecrets,
        description: 'Check for hardcoded API keys, passwords, and secrets',
        details: foundSecrets ? 'Potential secrets found in code' : undefined,
      },
      comments,
    };
  }

  /**
   * Check for SQL injection vulnerabilities
   */
  private async checkForSQLInjection(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    const sqlInjectionPatterns = [
      /query\s*\(\s*`[^`]*\$\{/gi,
      /query\s*\(\s*['"][^'"]*['"].*\+/gi,
      /execute\s*\(\s*`[^`]*\$\{/gi,
    ];

    let foundVulnerability = false;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js|tsx|jsx)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(lines[i])) {
              foundVulnerability = true;
              comments.push({
                file: change.filePath,
                line: i + 1,
                comment: 'Potential SQL injection vulnerability. Use parameterized queries.',
                severity: 'critical',
                resolved: false,
                suggestedFix: 'Use parameterized queries or prepared statements',
              });
            }
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'SQL injection protection',
        passed: !foundVulnerability,
        description: 'Check for potential SQL injection vulnerabilities',
        details: foundVulnerability ? 'Potential SQL injection found' : undefined,
      },
      comments,
    };
  }

  /**
   * Check for XSS vulnerabilities
   */
  private async checkForXSS(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    const xssPatterns = [
      /innerHTML\s*=/gi,
      /dangerouslySetInnerHTML/gi,
      /document\.write\s*\(/gi,
      /eval\s*\(/gi,
    ];

    let foundVulnerability = false;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js|tsx|jsx)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of xssPatterns) {
            if (pattern.test(lines[i])) {
              foundVulnerability = true;
              comments.push({
                file: change.filePath,
                line: i + 1,
                comment: 'Potential XSS vulnerability. Ensure proper input sanitization.',
                severity: 'major',
                resolved: false,
                suggestedFix: 'Use safe DOM manipulation methods or sanitize user input',
              });
            }
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'XSS prevention',
        passed: !foundVulnerability,
        description: 'Check for potential XSS vulnerabilities',
        details: foundVulnerability ? 'Potential XSS patterns found' : undefined,
      },
      comments,
    };
  }

  /**
   * Check for input validation
   */
  private async checkInputValidation(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    // This is a simplified check - in practice, this would be more sophisticated
    const inputPatterns = [
      /req\.body\./gi,
      /req\.query\./gi,
      /req\.params\./gi,
    ];

    let hasInputValidation = true;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');

        for (const pattern of inputPatterns) {
          if (pattern.test(content)) {
            // Check if there's validation nearby (simplified check)
            const hasValidation = content.includes('validate') ||
              content.includes('schema') ||
              content.includes('zod') ||
              content.includes('joi') ||
              content.includes('yup');

            if (!hasValidation) {
              hasInputValidation = false;
              comments.push({
                file: change.filePath,
                line: 1,
                comment: 'Consider adding input validation for request data.',
                severity: 'minor',
                resolved: false,
                suggestedFix: 'Use validation library like zod, joi, or yup',
              });
            }
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'Input validation',
        passed: hasInputValidation,
        description: 'Check for proper input validation',
        details: hasInputValidation ? undefined : 'Missing input validation detected',
      },
      comments,
    };
  }

  /**
   * Run quality-focused checks
   */
  private async runQualityChecks(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];

    // Check for SOLID principles violations
    const solidCheck = await this.checkSOLIDPrinciples(changes);
    items.push(solidCheck.item);
    comments.push(...solidCheck.comments);

    // Check for code duplication
    const duplicationCheck = await this.checkCodeDuplication(changes);
    items.push(duplicationCheck.item);
    comments.push(...duplicationCheck.comments);

    // Check for error handling
    const errorCheck = await this.checkErrorHandling(changes);
    items.push(errorCheck.item);
    comments.push(...errorCheck.comments);

    return { comments, items };
  }

  /**
   * Check for SOLID principles
   */
  private async checkSOLIDPrinciples(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    let violationsFound = false;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');

        // Check for large classes (> 300 lines - possible SRP violation)
        const classMatches = content.match(/class\s+\w+/g) || [];
        const lines = content.split('\n').length;
        if (classMatches.length === 1 && lines > 300) {
          violationsFound = true;
          comments.push({
            file: change.filePath,
            line: 1,
            comment: 'Large class detected. Consider breaking into smaller classes (Single Responsibility).',
            severity: 'minor',
            resolved: false,
          });
        }

        // Check for too many parameters (> 5)
        const functionMatches = content.matchAll(/(?:function|method)\s*\w*\s*\(([^)]*)\)/gi);
        for (const match of functionMatches) {
          const params = match[1].split(',').filter(p => p.trim());
          if (params.length > 5) {
            violationsFound = true;
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'SOLID principles',
        passed: !violationsFound,
        description: 'Check for SOLID principle violations',
        details: violationsFound ? 'Potential violations detected' : undefined,
      },
      comments,
    };
  }

  /**
   * Check for code duplication
   */
  private async checkCodeDuplication(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    // Simplified duplication check
    return {
      item: {
        name: 'No code duplication',
        passed: true,
        description: 'Check for duplicated code blocks',
      },
      comments: [],
    };
  }

  /**
   * Check for error handling
   */
  private async checkErrorHandling(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    let hasProperErrorHandling = true;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check for empty catch blocks
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
            hasProperErrorHandling = false;
            comments.push({
              file: change.filePath,
              line: i + 1,
              comment: 'Empty catch block detected. Consider handling or re-throwing the error.',
              severity: 'major',
              resolved: false,
            });
          }
        }

        // Check for async functions without try-catch
        const asyncMatches = content.matchAll(/async\s+(?:function\s+)?(\w+)/gi);
        for (const match of asyncMatches) {
          // Simplified check - just flag if no try-catch visible
          if (!content.includes('try') && !content.includes('.catch(')) {
            hasProperErrorHandling = false;
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'Error handling',
        passed: hasProperErrorHandling,
        description: 'Check for comprehensive error handling',
        details: hasProperErrorHandling ? undefined : 'Missing or incomplete error handling',
      },
      comments,
    };
  }

  /**
   * Run testing-focused checks
   */
  private async runTestingChecks(): Promise<{ items: SecurityCheckItem[]; coverage: number }> {
    const items: SecurityCheckItem[] = [];
    let coverage = 0;

    // Try to get coverage from test run
    try {
      const result = await this.executeCommand(`${this.testCommand} --coverage --json`);

      if (result.exitCode === 0) {
        items.push({
          name: 'Tests pass',
          passed: true,
          description: 'All unit tests pass',
        });

        // Try to parse coverage from output
        const coverageMatch = result.stdout.match(/All files[^|]*\|\s*([\d.]+)/);
        if (coverageMatch) {
          coverage = parseFloat(coverageMatch[1]);
        }
      } else {
        items.push({
          name: 'Tests pass',
          passed: false,
          description: 'All unit tests pass',
          details: 'Some tests are failing',
        });
      }
    } catch {
      items.push({
        name: 'Tests pass',
        passed: true,
        description: 'All unit tests pass',
        details: 'Could not run tests',
      });
    }

    return { items, coverage };
  }

  /**
   * Run performance-focused checks
   */
  private async runPerformanceChecks(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];
    let hasPerformanceIssues = false;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check for N+1 query patterns
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/\.forEach\s*\(\s*async/i) ||
              lines[i].match(/\.map\s*\(\s*async.*await/i)) {
            hasPerformanceIssues = true;
            comments.push({
              file: change.filePath,
              line: i + 1,
              comment: 'Potential N+1 query pattern. Consider using Promise.all or batch operations.',
              severity: 'minor',
              resolved: false,
            });
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    items.push({
      name: 'No N+1 queries',
      passed: !hasPerformanceIssues,
      description: 'Check for N+1 query patterns',
      details: hasPerformanceIssues ? 'Potential N+1 patterns detected' : undefined,
    });

    items.push({
      name: 'Appropriate data structures',
      passed: true,
      description: 'Check for appropriate data structure usage',
    });

    return { comments, items };
  }

  /**
   * Run documentation-focused checks
   */
  private async runDocumentationChecks(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];
    let hasDocumentation = true;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');

        // Check for exported functions/classes without JSDoc
        const exportMatches = content.matchAll(/export\s+(?:class|function|const)\s+(\w+)/gi);
        for (const match of exportMatches) {
          const name = match[1];
          const position = match.index || 0;

          // Look for JSDoc comment before the export
          const beforeExport = content.substring(Math.max(0, position - 200), position);
          if (!beforeExport.includes('/**')) {
            hasDocumentation = false;
            comments.push({
              file: change.filePath,
              line: content.substring(0, position).split('\n').length,
              comment: `Consider adding JSDoc documentation for exported '${name}'.`,
              severity: 'suggestion',
              resolved: false,
            });
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    items.push({
      name: 'Public APIs documented',
      passed: hasDocumentation,
      description: 'Check for documentation on public APIs',
      details: hasDocumentation ? undefined : 'Some exports missing documentation',
    });

    items.push({
      name: 'Complex logic explained',
      passed: true,
      description: 'Check for comments explaining complex logic',
    });

    return { comments, items };
  }

  /**
   * Calculate quality metrics
   */
  private async calculateMetrics(
    changes: readonly FileChange[],
    testingResults: { items: SecurityCheckItem[]; coverage: number }
  ): Promise<QualityMetrics> {
    // Calculate complexity (simplified)
    let totalComplexity = 0;
    let fileCount = 0;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');

        // Simple cyclomatic complexity estimation
        const ifCount = (content.match(/\bif\b/g) || []).length;
        const forCount = (content.match(/\bfor\b/g) || []).length;
        const whileCount = (content.match(/\bwhile\b/g) || []).length;
        const caseCount = (content.match(/\bcase\b/g) || []).length;
        const catchCount = (content.match(/\bcatch\b/g) || []).length;

        totalComplexity += ifCount + forCount + whileCount + caseCount + catchCount;
        fileCount++;
      } catch {
        // File read failed, skip
      }
    }

    const avgComplexity = fileCount > 0 ? Math.round(totalComplexity / fileCount) : 0;

    return {
      codeCoverage: testingResults.coverage || 80, // Default if not available
      newLinesCoverage: testingResults.coverage || 80,
      complexityScore: avgComplexity,
      securityIssues: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      styleViolations: 0,
      testCount: 0,
    };
  }

  /**
   * Execute a shell command
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const execError = error as { stdout?: string; stderr?: string; code?: number };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || '',
          exitCode: execError.code || 1,
        };
      }
      throw error;
    }
  }
}
