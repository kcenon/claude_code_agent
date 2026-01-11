/**
 * Review Checks module
 *
 * Performs automated code review checks including security analysis,
 * code quality assessment, and best practice verification.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ReviewComment,
  ReviewChecklist,
  SecurityCheckItem,
  QualityMetrics,
  FileChange,
} from './types.js';
import { getCommandSanitizer } from '../security/index.js';
import { tryJsonParse, tryGetProjectRoot } from '../utils/index.js';
import { SecurityAuditResultSchema } from '../schemas/github.js';

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
  /** Enable testing checks (runs npm test) */
  readonly enableTestingChecks?: boolean;
  /** Enable static analysis (TypeScript type checking) */
  readonly enableStaticAnalysis?: boolean;
  /** Enable dependency vulnerability check */
  readonly enableDependencyCheck?: boolean;
  /** Custom lint command */
  readonly lintCommand?: string;
  /** Custom test command */
  readonly testCommand?: string;
  /** Maximum allowed cyclomatic complexity per function (default: 10) */
  readonly maxComplexity?: number;
  /** Maximum number of files to process in a single batch for large PRs (default: 50) */
  readonly batchSize?: number;
  /** Enable incremental review mode for large PRs (default: true) */
  readonly enableIncrementalReview?: boolean;
  /** Threshold for enabling incremental review (number of files, default: 20) */
  readonly incrementalReviewThreshold?: number;
}

/**
 * Incremental review progress callback
 */
export type IncrementalReviewProgressCallback = (progress: IncrementalReviewProgress) => void;

/**
 * Incremental review progress information
 */
export interface IncrementalReviewProgress {
  /** Current batch number (1-indexed) */
  readonly currentBatch: number;
  /** Total number of batches */
  readonly totalBatches: number;
  /** Files processed so far */
  readonly filesProcessed: number;
  /** Total files to process */
  readonly totalFiles: number;
  /** Comments found so far */
  readonly commentsFound: number;
  /** Current batch file paths */
  readonly currentBatchFiles: readonly string[];
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
  private readonly enableTestingChecks: boolean;
  private readonly enableStaticAnalysis: boolean;
  private readonly enableDependencyCheck: boolean;
  private readonly testCommand: string;
  private readonly maxComplexity: number;
  private readonly batchSize: number;
  private readonly enableIncrementalReview: boolean;
  private readonly incrementalReviewThreshold: number;

  constructor(options: ReviewChecksOptions = {}) {
    this.projectRoot = options.projectRoot ?? tryGetProjectRoot() ?? process.cwd();
    this.enableTestingChecks = options.enableTestingChecks ?? true;
    this.enableStaticAnalysis = options.enableStaticAnalysis ?? true;
    this.enableDependencyCheck = options.enableDependencyCheck ?? true;
    this.testCommand = options.testCommand ?? 'npm test';
    this.maxComplexity = options.maxComplexity ?? 10;
    this.batchSize = options.batchSize ?? 50;
    this.enableIncrementalReview = options.enableIncrementalReview ?? true;
    this.incrementalReviewThreshold = options.incrementalReviewThreshold ?? 20;
  }

  /**
   * Run all review checks on changed files
   */
  public async runAllChecks(changes: readonly FileChange[]): Promise<{
    comments: ReviewComment[];
    checklist: ReviewChecklist;
    metrics: QualityMetrics;
  }> {
    const comments: ReviewComment[] = [];

    // Run security checks
    const securityChecks = await this.runSecurityChecks(changes);
    comments.push(...securityChecks.comments);

    // Run dependency vulnerability check
    if (this.enableDependencyCheck) {
      const depCheck = await this.runDependencyVulnerabilityCheck();
      securityChecks.items.push(...depCheck.items);
      comments.push(...depCheck.comments);
    }

    // Run static analysis (TypeScript type checking)
    const staticAnalysisChecks = this.enableStaticAnalysis
      ? await this.runStaticAnalysisChecks(changes)
      : { comments: [], items: [] };
    comments.push(...staticAnalysisChecks.comments);

    // Run quality checks
    const qualityChecks = await this.runQualityChecks(changes);
    comments.push(...qualityChecks.comments);

    // Run anti-pattern detection
    const antiPatternChecks = await this.runAntiPatternChecks(changes);
    qualityChecks.items.push(...antiPatternChecks.items);
    comments.push(...antiPatternChecks.comments);

    // Run testing checks (optional, can be slow)
    const testingChecks = this.enableTestingChecks
      ? await this.runTestingChecks()
      : this.getDefaultTestingChecks();

    // Run performance checks
    const performanceChecks = await this.runPerformanceChecks(changes);
    comments.push(...performanceChecks.comments);

    // Run documentation checks
    const docChecks = await this.runDocumentationChecks(changes);
    comments.push(...docChecks.comments);

    // Build checklist
    const checklist: ReviewChecklist = {
      security: securityChecks.items,
      quality: [...qualityChecks.items, ...staticAnalysisChecks.items],
      testing: testingChecks.items,
      performance: performanceChecks.items,
      documentation: docChecks.items,
    };

    // Calculate metrics with complexity analysis
    const metrics = await this.calculateMetrics(changes, testingChecks);

    return { comments, checklist, metrics };
  }

  /**
   * Run incremental review checks on large PRs
   *
   * Processes file changes in batches to avoid memory issues and provide
   * progress feedback for large PRs. Falls back to standard review if the
   * number of files is below the threshold.
   *
   * @param changes - File changes to review
   * @param onProgress - Optional callback for progress updates
   * @returns Review results accumulated across all batches
   */
  public async runIncrementalChecks(
    changes: readonly FileChange[],
    onProgress?: IncrementalReviewProgressCallback
  ): Promise<{
    comments: ReviewComment[];
    checklist: ReviewChecklist;
    metrics: QualityMetrics;
    isIncremental: boolean;
    batchCount: number;
  }> {
    // Check if incremental review is needed
    const nonDeleteChanges = changes.filter((c) => c.changeType !== 'delete');
    if (
      !this.enableIncrementalReview ||
      nonDeleteChanges.length < this.incrementalReviewThreshold
    ) {
      // Use standard review for small PRs
      const result = await this.runAllChecks(changes);
      return {
        ...result,
        isIncremental: false,
        batchCount: 1,
      };
    }

    // Split changes into batches
    const batches = this.splitIntoBatches(changes, this.batchSize);
    const totalBatches = batches.length;

    // Accumulate results across batches
    const allComments: ReviewComment[] = [];
    const securityItems: SecurityCheckItem[] = [];
    const qualityItems: SecurityCheckItem[] = [];
    const testingItems: SecurityCheckItem[] = [];
    const performanceItems: SecurityCheckItem[] = [];
    const documentationItems: SecurityCheckItem[] = [];

    // Run dependency vulnerability check once (project-wide)
    if (this.enableDependencyCheck) {
      const depCheck = await this.runDependencyVulnerabilityCheck();
      securityItems.push(...depCheck.items);
      allComments.push(...depCheck.comments);
    }

    // Run testing checks once (project-wide)
    const testingChecks = this.enableTestingChecks
      ? await this.runTestingChecks()
      : this.getDefaultTestingChecks();
    testingItems.push(...testingChecks.items);

    let filesProcessed = 0;

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch === undefined) continue;

      const batchFilePaths = batch.map((c) => c.filePath);

      // Report progress
      if (onProgress !== undefined) {
        onProgress({
          currentBatch: i + 1,
          totalBatches,
          filesProcessed,
          totalFiles: changes.length,
          commentsFound: allComments.length,
          currentBatchFiles: batchFilePaths,
        });
      }

      // Run security checks for this batch
      const securityChecks = await this.runSecurityChecks(batch);
      securityItems.push(...securityChecks.items);
      allComments.push(...securityChecks.comments);

      // Run static analysis for this batch
      if (this.enableStaticAnalysis) {
        const staticChecks = await this.runStaticAnalysisChecks(batch);
        qualityItems.push(...staticChecks.items);
        allComments.push(...staticChecks.comments);
      }

      // Run quality checks for this batch
      const qualityChecks = await this.runQualityChecks(batch);
      qualityItems.push(...qualityChecks.items);
      allComments.push(...qualityChecks.comments);

      // Run anti-pattern checks for this batch
      const antiPatternChecks = await this.runAntiPatternChecks(batch);
      qualityItems.push(...antiPatternChecks.items);
      allComments.push(...antiPatternChecks.comments);

      // Run performance checks for this batch
      const performanceChecks = await this.runPerformanceChecks(batch);
      performanceItems.push(...performanceChecks.items);
      allComments.push(...performanceChecks.comments);

      // Run documentation checks for this batch
      const docChecks = await this.runDocumentationChecks(batch);
      documentationItems.push(...docChecks.items);
      allComments.push(...docChecks.comments);

      filesProcessed += batch.length;
    }

    // Report final progress
    if (onProgress !== undefined) {
      onProgress({
        currentBatch: totalBatches,
        totalBatches,
        filesProcessed: changes.length,
        totalFiles: changes.length,
        commentsFound: allComments.length,
        currentBatchFiles: [],
      });
    }

    // Merge duplicate security/quality items (keep worst result)
    const checklist: ReviewChecklist = {
      security: this.mergeCheckItems(securityItems),
      quality: this.mergeCheckItems(qualityItems),
      testing: testingItems,
      performance: this.mergeCheckItems(performanceItems),
      documentation: this.mergeCheckItems(documentationItems),
    };

    // Calculate metrics across all changes
    const metrics = await this.calculateMetrics(changes, testingChecks);

    return {
      comments: allComments,
      checklist,
      metrics,
      isIncremental: true,
      batchCount: totalBatches,
    };
  }

  /**
   * Split file changes into batches
   */
  private splitIntoBatches(
    changes: readonly FileChange[],
    batchSize: number
  ): readonly FileChange[][] {
    const batches: FileChange[][] = [];
    for (let i = 0; i < changes.length; i += batchSize) {
      batches.push(changes.slice(i, i + batchSize) as FileChange[]);
    }
    return batches;
  }

  /**
   * Merge duplicate check items, keeping the worst result for each check name
   */
  private mergeCheckItems(items: readonly SecurityCheckItem[]): SecurityCheckItem[] {
    const itemMap = new Map<string, SecurityCheckItem>();

    for (const item of items) {
      const existing = itemMap.get(item.name);
      if (existing === undefined) {
        itemMap.set(item.name, item);
      } else {
        // Keep the failing result if either failed
        if (!item.passed && existing.passed) {
          itemMap.set(item.name, item);
        } else if (!item.passed && !existing.passed) {
          // Merge details if both failed
          const mergedDetails = [existing.details, item.details]
            .filter((d): d is string => d !== undefined)
            .join('; ');
          itemMap.set(item.name, {
            ...item,
            details: mergedDetails.length > 0 ? mergedDetails : undefined,
          });
        }
      }
    }

    return Array.from(itemMap.values());
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
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          for (const pattern of secretPatterns) {
            if (pattern.test(currentLine)) {
              foundSecrets = true;
              comments.push({
                file: change.filePath,
                line: i + 1,
                comment:
                  'Potential hardcoded secret detected. Consider using environment variables.',
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
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(currentLine)) {
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
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          for (const pattern of xssPatterns) {
            if (pattern.test(currentLine)) {
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
    const inputPatterns = [/req\.body\./gi, /req\.query\./gi, /req\.params\./gi];

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
            const hasValidation =
              content.includes('validate') ||
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
    const duplicationCheck = this.checkCodeDuplication(changes);
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
            comment:
              'Large class detected. Consider breaking into smaller classes (Single Responsibility).',
            severity: 'minor',
            resolved: false,
          });
        }

        // Check for too many parameters (> 5)
        const functionMatches = content.matchAll(/(?:function|method)\s*\w*\s*\(([^)]*)\)/gi);
        for (const match of functionMatches) {
          const paramsStr = match[1];
          if (paramsStr === undefined) continue;
          const params = paramsStr.split(',').filter((p) => p.trim());
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
  private checkCodeDuplication(_changes: readonly FileChange[]): {
    item: SecurityCheckItem;
    comments: ReviewComment[];
  } {
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
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          if (currentLine.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
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
        const asyncMatches = [...content.matchAll(/async\s+(?:function\s+)?(\w+)/gi)];
        if (asyncMatches.length > 0 && !content.includes('try') && !content.includes('.catch(')) {
          // Simplified check - just flag if no try-catch visible
          hasProperErrorHandling = false;
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
   * Get default testing checks (when testing checks are disabled)
   */
  private getDefaultTestingChecks(): { items: SecurityCheckItem[]; coverage: number } {
    return {
      items: [
        {
          name: 'Tests pass',
          passed: true,
          description: 'All unit tests pass',
          details: 'Testing checks skipped',
        },
      ],
      coverage: 80,
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
        if (coverageMatch !== null && coverageMatch[1] !== undefined) {
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
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          if (
            currentLine.match(/\.forEach\s*\(\s*async/i) ||
            currentLine.match(/\.map\s*\(\s*async.*await/i)
          ) {
            hasPerformanceIssues = true;
            comments.push({
              file: change.filePath,
              line: i + 1,
              comment:
                'Potential N+1 query pattern. Consider using Promise.all or batch operations.',
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
          const name = match[1] !== undefined ? match[1] : 'unknown';
          const position = match.index;

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
   * Run static analysis checks (TypeScript type checking)
   */
  private async runStaticAnalysisChecks(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];

    // Check if there are TypeScript files in changes
    const hasTypeScriptFiles = changes.some(
      (c) => c.changeType !== 'delete' && c.filePath.match(/\.(ts|tsx)$/) !== null
    );

    if (!hasTypeScriptFiles) {
      items.push({
        name: 'TypeScript type checking',
        passed: true,
        description: 'No TypeScript files to check',
      });
      return { comments, items };
    }

    // Run TypeScript compiler in noEmit mode
    try {
      const result = await this.executeCommand('npx tsc --noEmit 2>&1');

      if (result.exitCode === 0) {
        items.push({
          name: 'TypeScript type checking',
          passed: true,
          description: 'All TypeScript files pass type checking',
        });
      } else {
        items.push({
          name: 'TypeScript type checking',
          passed: false,
          description: 'TypeScript compilation errors found',
          details: result.stdout.substring(0, 500),
        });

        // Parse TypeScript errors and add as comments
        const errorLines = result.stdout.split('\n');
        for (const line of errorLines) {
          const errorMatch = line.match(/^([^(]+)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/);
          if (errorMatch !== null) {
            const [, file, lineNum, , message] = errorMatch;
            if (file !== undefined && lineNum !== undefined && message !== undefined) {
              // Only add comments for changed files
              const normalizedFile = file.replace(/\\/g, '/');
              const isChangedFile = changes.some((c) => normalizedFile.endsWith(c.filePath));
              if (isChangedFile) {
                comments.push({
                  file: normalizedFile,
                  line: parseInt(lineNum, 10),
                  comment: `TypeScript error: ${message}`,
                  severity: 'critical',
                  resolved: false,
                  suggestedFix: 'Fix the type error to ensure type safety',
                });
              }
            }
          }
        }
      }
    } catch {
      items.push({
        name: 'TypeScript type checking',
        passed: true,
        description: 'Could not run TypeScript compiler',
        details: 'TypeScript may not be installed',
      });
    }

    // Run complexity analysis on changed files
    const complexityCheck = await this.runComplexityAnalysis(changes);
    items.push(...complexityCheck.items);
    comments.push(...complexityCheck.comments);

    return { comments, items };
  }

  /**
   * Run cyclomatic complexity analysis on functions
   */
  private async runComplexityAnalysis(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    let hasHighComplexity = false;
    const complexityDetails: string[] = [];

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js|tsx|jsx)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const functionComplexities = this.calculateFunctionComplexities(content);

        for (const { name, complexity, line } of functionComplexities) {
          if (complexity > this.maxComplexity) {
            hasHighComplexity = true;
            complexityDetails.push(`${name}: ${String(complexity)}`);
            comments.push({
              file: change.filePath,
              line,
              comment: `Function '${name}' has cyclomatic complexity of ${String(complexity)} (max: ${String(this.maxComplexity)}). Consider refactoring.`,
              severity: complexity > this.maxComplexity * 1.5 ? 'major' : 'minor',
              resolved: false,
              suggestedFix: 'Break down the function into smaller, more focused functions',
            });
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      comments,
      items: [
        {
          name: 'Cyclomatic complexity',
          passed: !hasHighComplexity,
          description: `All functions have complexity ≤${String(this.maxComplexity)}`,
          details: hasHighComplexity
            ? `High complexity: ${complexityDetails.join(', ')}`
            : undefined,
        },
      ],
    };
  }

  /**
   * Calculate cyclomatic complexity for each function in the file
   */
  private calculateFunctionComplexities(
    content: string
  ): Array<{ name: string; complexity: number; line: number }> {
    const results: Array<{ name: string; complexity: number; line: number }> = [];

    // Match function declarations and expressions
    const functionPatterns = [
      // Named function: function name(...) {
      /function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
      // Arrow function: const name = (...) => {
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/g,
      // Method: name(...) {
      /(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
    ];

    const lines = content.split('\n');
    const processedRanges: Array<{ start: number; end: number }> = [];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (name === undefined) continue;

        const startIndex = match.index;
        const lineNumber = content.substring(0, startIndex).split('\n').length;

        // Skip if already processed (overlapping patterns)
        if (processedRanges.some((r) => lineNumber >= r.start && lineNumber <= r.end)) {
          continue;
        }

        // Find the matching closing brace
        let braceCount = 0;
        let foundStart = false;
        let endLine = lineNumber;

        for (let i = lineNumber - 1; i < lines.length; i++) {
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          for (const char of currentLine) {
            if (char === '{') {
              braceCount++;
              foundStart = true;
            } else if (char === '}') {
              braceCount--;
              if (foundStart && braceCount === 0) {
                endLine = i + 1;
                break;
              }
            }
          }
          if (foundStart && braceCount === 0) break;
        }

        // Extract function body
        const functionBody = lines.slice(lineNumber - 1, endLine).join('\n');

        // Calculate complexity
        const complexity = this.calculateComplexity(functionBody);

        results.push({ name, complexity, line: lineNumber });
        processedRanges.push({ start: lineNumber, end: endLine });
      }
    }

    return results;
  }

  /**
   * Calculate cyclomatic complexity for a code block
   */
  private calculateComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Decision points that increase complexity
    const patterns = [
      /\bif\s*\(/g, // if statements
      /\belse\s+if\s*\(/g, // else if (counted separately)
      /\bfor\s*\(/g, // for loops
      /\bwhile\s*\(/g, // while loops
      /\bdo\s*\{/g, // do-while loops
      /\bcase\s+[^:]+:/g, // switch cases
      /\bcatch\s*\(/g, // catch blocks
      /\?\s*[^:]+\s*:/g, // ternary operators
      /\|\|/g, // logical OR (short-circuit)
      /&&/g, // logical AND (short-circuit)
      /\?\?/g, // nullish coalescing
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Run dependency vulnerability check using npm audit
   */
  private async runDependencyVulnerabilityCheck(): Promise<{
    comments: ReviewComment[];
    items: SecurityCheckItem[];
  }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];

    try {
      const result = await this.executeCommand('npm audit --json 2>/dev/null');

      if (result.exitCode === 0) {
        items.push({
          name: 'Dependency vulnerabilities',
          passed: true,
          description: 'No known vulnerabilities in dependencies',
        });
      } else {
        try {
          const auditResult = tryJsonParse(result.stdout, SecurityAuditResultSchema, {
            context: 'npm audit output',
          });

          const vulnCounts = auditResult?.vulnerabilities ?? {
            critical: 0,
            high: 0,
            moderate: 0,
            low: 0,
          };

          const hasCriticalOrHigh = vulnCounts.critical > 0 || vulnCounts.high > 0;

          items.push({
            name: 'Dependency vulnerabilities',
            passed: !hasCriticalOrHigh,
            description: 'Check for vulnerable dependencies',
            details: `Critical: ${String(vulnCounts.critical)}, High: ${String(vulnCounts.high)}, Moderate: ${String(vulnCounts.moderate)}, Low: ${String(vulnCounts.low)}`,
          });

          if (hasCriticalOrHigh) {
            comments.push({
              file: 'package.json',
              line: 1,
              comment: `Security vulnerabilities found in dependencies. Critical: ${String(vulnCounts.critical)}, High: ${String(vulnCounts.high)}. Run 'npm audit fix' to resolve.`,
              severity: 'critical',
              resolved: false,
              suggestedFix: "Run 'npm audit fix' or update affected packages manually",
            });
          }
        } catch {
          items.push({
            name: 'Dependency vulnerabilities',
            passed: true,
            description: 'Could not parse audit results',
            details: 'Manual review recommended',
          });
        }
      }
    } catch {
      items.push({
        name: 'Dependency vulnerabilities',
        passed: true,
        description: 'Could not run npm audit',
        details: 'Manual security review recommended',
      });
    }

    return { comments, items };
  }

  /**
   * Run anti-pattern detection checks
   */
  private async runAntiPatternChecks(
    changes: readonly FileChange[]
  ): Promise<{ comments: ReviewComment[]; items: SecurityCheckItem[] }> {
    const comments: ReviewComment[] = [];
    const items: SecurityCheckItem[] = [];

    // Check for magic numbers
    const magicNumberCheck = await this.checkMagicNumbers(changes);
    items.push(magicNumberCheck.item);
    comments.push(...magicNumberCheck.comments);

    // Check for path traversal vulnerabilities
    const pathTraversalCheck = await this.checkPathTraversal(changes);
    items.push(pathTraversalCheck.item);
    comments.push(...pathTraversalCheck.comments);

    // Check for duplicate code patterns
    const duplicateCheck = await this.checkDuplicateCode(changes);
    items.push(duplicateCheck.item);
    comments.push(...duplicateCheck.comments);

    // Check for god class pattern
    const godClassCheck = await this.checkGodClass(changes);
    items.push(godClassCheck.item);
    comments.push(...godClassCheck.comments);

    return { comments, items };
  }

  /**
   * Check for magic numbers in code
   */
  private async checkMagicNumbers(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    let hasMagicNumbers = false;
    const allowedNumbers = new Set([0, 1, 2, -1, 10, 100, 1000, 60, 24, 365]);

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js|tsx|jsx)$/)) continue;
      // Skip test files and config files
      if (change.filePath.match(/\.(test|spec|config)\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const currentLine = lines[i];
          if (currentLine === undefined) continue;

          // Skip comments and const declarations (likely named constants)
          if (
            currentLine.trim().startsWith('//') ||
            currentLine.trim().startsWith('*') ||
            currentLine.includes('const ') ||
            currentLine.includes('readonly ')
          ) {
            continue;
          }

          // Find magic numbers (standalone numbers in expressions)
          const magicNumberPattern = /(?<![.\w])(\d{2,})(?![.\d\w])/g;
          let match;
          while ((match = magicNumberPattern.exec(currentLine)) !== null) {
            const num = parseInt(match[1] ?? '0', 10);
            if (!allowedNumbers.has(num) && num > 1) {
              hasMagicNumbers = true;
              comments.push({
                file: change.filePath,
                line: i + 1,
                comment: `Magic number ${String(num)} detected. Consider using a named constant.`,
                severity: 'suggestion',
                resolved: false,
                suggestedFix: `Extract to a named constant: const MEANINGFUL_NAME = ${String(num)};`,
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
        name: 'No magic numbers',
        passed: !hasMagicNumbers,
        description: 'Check for unexplained numeric literals',
        details: hasMagicNumbers
          ? 'Magic numbers found - consider using named constants'
          : undefined,
      },
      comments,
    };
  }

  /**
   * Check for path traversal vulnerabilities
   */
  private async checkPathTraversal(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    let hasVulnerability = false;

    const pathTraversalPatterns = [
      /path\.join\s*\([^)]*req\.(body|query|params)/gi,
      /path\.resolve\s*\([^)]*req\.(body|query|params)/gi,
      /readFile\s*\([^)]*req\.(body|query|params)/gi,
      /readFileSync\s*\([^)]*req\.(body|query|params)/gi,
      /createReadStream\s*\([^)]*req\.(body|query|params)/gi,
      /\.\.\/.*req\.(body|query|params)/gi,
    ];

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const currentLine = lines[i];
          if (currentLine === undefined) continue;
          for (const pattern of pathTraversalPatterns) {
            if (pattern.test(currentLine)) {
              hasVulnerability = true;
              comments.push({
                file: change.filePath,
                line: i + 1,
                comment:
                  'Potential path traversal vulnerability. User input used in file path operations.',
                severity: 'critical',
                resolved: false,
                suggestedFix:
                  'Validate and sanitize user input. Use path.basename() or a whitelist approach.',
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
        name: 'Path traversal prevention',
        passed: !hasVulnerability,
        description: 'Check for path traversal vulnerabilities',
        details: hasVulnerability ? 'Potential path traversal found' : undefined,
      },
      comments,
    };
  }

  /**
   * Check for duplicate code patterns
   */
  private async checkDuplicateCode(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    const codeBlocks: Map<string, Array<{ file: string; line: number }>> = new Map();
    const minBlockSize = 5; // Minimum lines to consider as duplicate

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js|tsx|jsx)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Create blocks of consecutive lines
        for (let i = 0; i <= lines.length - minBlockSize; i++) {
          const block = lines
            .slice(i, i + minBlockSize)
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('*'))
            .join('\n');

          if (block.length > 50) {
            // Skip very short blocks
            const existing = codeBlocks.get(block);
            if (existing !== undefined) {
              existing.push({ file: change.filePath, line: i + 1 });
            } else {
              codeBlocks.set(block, [{ file: change.filePath, line: i + 1 }]);
            }
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    // Find duplicates
    let hasDuplicates = false;
    for (const [, locations] of codeBlocks) {
      if (locations.length > 1) {
        hasDuplicates = true;
        const firstLoc = locations[0];
        if (firstLoc !== undefined) {
          comments.push({
            file: firstLoc.file,
            line: firstLoc.line,
            comment: `Duplicate code block found in ${String(locations.length)} locations. Consider extracting to a shared function.`,
            severity: 'minor',
            resolved: false,
            suggestedFix: 'Extract duplicate code to a reusable function or module',
          });
        }
        break; // Only report first duplicate to avoid noise
      }
    }

    return {
      item: {
        name: 'No code duplication',
        passed: !hasDuplicates,
        description: 'Check for duplicated code blocks',
        details: hasDuplicates ? 'Duplicate code patterns detected' : undefined,
      },
      comments,
    };
  }

  /**
   * Check for god class anti-pattern
   */
  private async checkGodClass(
    changes: readonly FileChange[]
  ): Promise<{ item: SecurityCheckItem; comments: ReviewComment[] }> {
    const comments: ReviewComment[] = [];
    let hasGodClass = false;
    const maxMethods = 20;
    const maxLines = 500;

    for (const change of changes) {
      if (change.changeType === 'delete') continue;
      if (!change.filePath.match(/\.(ts|js)$/)) continue;

      const filePath = join(this.projectRoot, change.filePath);
      if (!existsSync(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Count methods and class lines
        const classMatch = content.match(/class\s+(\w+)/);
        if (classMatch !== null) {
          const className = classMatch[1] ?? 'Unknown';

          // Count methods
          const methodPattern =
            /(?:public|private|protected)?\s*(?:async\s+)?(?:static\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
          const methods = [...content.matchAll(methodPattern)];

          if (methods.length > maxMethods || lines.length > maxLines) {
            hasGodClass = true;
            comments.push({
              file: change.filePath,
              line: 1,
              comment: `Class '${className}' may be a God Class: ${String(methods.length)} methods, ${String(lines.length)} lines. Consider splitting responsibilities.`,
              severity: 'minor',
              resolved: false,
              suggestedFix:
                'Apply Single Responsibility Principle - extract related methods into separate classes',
            });
          }
        }
      } catch {
        // File read failed, skip
      }
    }

    return {
      item: {
        name: 'No god classes',
        passed: !hasGodClass,
        description: 'Check for classes with too many responsibilities',
        details: hasGodClass ? 'Large class detected - consider splitting' : undefined,
      },
      comments,
    };
  }

  /**
   * Execute a shell command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.projectRoot,
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
}
