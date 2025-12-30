/**
 * CI Log Analyzer module
 *
 * Parses and analyzes CI failure logs to identify root causes
 * and categorize issues by type and severity.
 *
 * @module ci-fixer/CILogAnalyzer
 */

import type {
  CIAnalysisResult,
  CIFailure,
  CIFailureCategory,
  CILogPattern,
} from './types.js';
import { CILogParseError } from './errors.js';

// ============================================================================
// Log Patterns
// ============================================================================

/**
 * Predefined patterns for detecting CI failures
 */
const CI_LOG_PATTERNS: readonly CILogPattern[] = [
  // TypeScript errors
  {
    name: 'typescript-error',
    pattern: /(?<file>[^\s]+\.tsx?):(?<line>\d+):(?<column>\d+)\s*-\s*error\s+TS(?<code>\d+):\s*(?<message>.+)/gm,
    category: 'type',
    autoFixable: true,
    extractLocation: (match) => ({
      file: match.groups?.['file'],
      line: match.groups?.['line'] ? parseInt(match.groups['line'], 10) : undefined,
      column: match.groups?.['column'] ? parseInt(match.groups['column'], 10) : undefined,
    }),
    extractMessage: (match) => match.groups?.['message'] ?? 'TypeScript error',
  },

  // ESLint errors
  {
    name: 'eslint-error',
    pattern: /(?<file>[^\s]+\.[jt]sx?)\s*\n\s*(?<line>\d+):(?<column>\d+)\s+error\s+(?<message>.+?)\s+(?<rule>\S+)/gm,
    category: 'lint',
    autoFixable: true,
    extractLocation: (match) => ({
      file: match.groups?.['file'],
      line: match.groups?.['line'] ? parseInt(match.groups['line'], 10) : undefined,
      column: match.groups?.['column'] ? parseInt(match.groups['column'], 10) : undefined,
    }),
    extractMessage: (match) => `${match.groups?.['message'] ?? ''} (${match.groups?.['rule'] ?? ''})`,
  },

  // ESLint summary
  {
    name: 'eslint-summary',
    pattern: /✖\s+(?<count>\d+)\s+problems?\s+\((?<errors>\d+)\s+errors?,\s*(?<warnings>\d+)\s+warnings?\)/gm,
    category: 'lint',
    autoFixable: true,
    extractMessage: (match) =>
      `${match.groups?.['errors'] ?? '0'} errors, ${match.groups?.['warnings'] ?? '0'} warnings`,
  },

  // Jest test failures
  {
    name: 'jest-failure',
    pattern: /FAIL\s+(?<file>[^\s]+\.test\.[jt]sx?)/gm,
    category: 'test',
    autoFixable: true,
    extractLocation: (match) => ({
      file: match.groups?.['file'],
    }),
    extractMessage: () => 'Test file failed',
  },

  // Jest assertion errors
  {
    name: 'jest-assertion',
    pattern: /expect\((?<received>.+?)\)\.(?<matcher>\w+)\((?<expected>.*?)\)/gm,
    category: 'test',
    autoFixable: true,
    extractMessage: (match) =>
      `Expected ${match.groups?.['received'] ?? ''} ${match.groups?.['matcher'] ?? ''} ${match.groups?.['expected'] ?? ''}`,
  },

  // Vitest test failures
  {
    name: 'vitest-failure',
    pattern: /❌\s+(?<file>[^\s]+\.test\.[jt]sx?)\s+>\s+(?<testName>.+)/gm,
    category: 'test',
    autoFixable: true,
    extractLocation: (match) => ({
      file: match.groups?.['file'],
    }),
    extractMessage: (match) => `Test "${match.groups?.['testName'] ?? ''}" failed`,
  },

  // Build errors - Module not found
  {
    name: 'module-not-found',
    pattern: /Module not found:\s*(?:Can't resolve|Error:)\s*['"]?(?<module>[^'"]+)['"]?/gm,
    category: 'build',
    autoFixable: true,
    extractMessage: (match) => `Module not found: ${match.groups?.['module'] ?? ''}`,
  },

  // Build errors - Cannot resolve
  {
    name: 'cannot-resolve',
    pattern: /Cannot (?:find|resolve)\s+(?:module\s+)?['"]?(?<module>[^'"]+)['"]?/gm,
    category: 'build',
    autoFixable: true,
    extractMessage: (match) => `Cannot resolve: ${match.groups?.['module'] ?? ''}`,
  },

  // Security vulnerabilities
  {
    name: 'security-critical',
    pattern: /(?<count>\d+)\s+critical\s+vulnerabilit(?:y|ies)/gim,
    category: 'security',
    autoFixable: false,
    extractMessage: (match) => `${match.groups?.['count'] ?? '0'} critical vulnerabilities`,
  },

  // Security vulnerabilities - high
  {
    name: 'security-high',
    pattern: /(?<count>\d+)\s+high\s+vulnerabilit(?:y|ies)/gim,
    category: 'security',
    autoFixable: false,
    extractMessage: (match) => `${match.groups?.['count'] ?? '0'} high vulnerabilities`,
  },

  // Dependency errors
  {
    name: 'peer-dependency',
    pattern: /npm\s+(?:WARN|ERR!)\s+peer\s+(?:dep|dependency)\s+(?<message>.+)/gim,
    category: 'dependency',
    autoFixable: true,
    extractMessage: (match) => match.groups?.['message'] ?? 'Peer dependency issue',
  },

  // npm audit issues
  {
    name: 'npm-audit',
    pattern: /found\s+(?<count>\d+)\s+vulnerabilit(?:y|ies)/gim,
    category: 'dependency',
    autoFixable: true,
    extractMessage: (match) => `${match.groups?.['count'] ?? '0'} vulnerabilities found`,
  },
];

/**
 * CI Log Analyzer class
 *
 * Analyzes CI logs to detect and categorize failures.
 */
export class CILogAnalyzer {
  private readonly patterns: readonly CILogPattern[];
  private readonly maxLogSize: number;

  constructor(options?: { customPatterns?: readonly CILogPattern[]; maxLogSize?: number }) {
    this.patterns = options?.customPatterns
      ? [...CI_LOG_PATTERNS, ...options.customPatterns]
      : CI_LOG_PATTERNS;
    this.maxLogSize = options?.maxLogSize ?? 100000; // 100KB default
  }

  /**
   * Analyze CI logs and extract failure information
   *
   * @param logs - Raw CI logs
   * @returns Analysis result with identified failures
   */
  public analyze(logs: string): CIAnalysisResult {
    const truncatedLogs = this.truncateLogs(logs);
    const failures: CIFailure[] = [];
    const matchedRanges: Array<{ start: number; end: number }> = [];

    // Apply each pattern
    for (const pattern of this.patterns) {
      const matches = this.findMatches(truncatedLogs, pattern, matchedRanges);
      failures.push(...matches);
    }

    // Find unidentified causes (lines with ERROR/FAIL that weren't matched)
    const unidentifiedCauses = this.findUnidentifiedCauses(truncatedLogs, matchedRanges);

    // Group by category
    const byCategory = this.groupByCategory(failures);

    return {
      totalFailures: failures.length + unidentifiedCauses.length,
      identifiedCauses: failures,
      unidentifiedCauses,
      byCategory,
      analyzedAt: new Date().toISOString(),
      rawLogs: truncatedLogs,
    };
  }

  /**
   * Parse TypeScript error output specifically
   *
   * @param output - TypeScript compiler output
   * @returns Array of TypeScript failures
   */
  public parseTypeScriptErrors(output: string): CIFailure[] {
    const failures: CIFailure[] = [];
    const pattern = /^(.+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/gm;

    let match;
    while ((match = pattern.exec(output)) !== null) {
      failures.push({
        category: 'type',
        message: match[5] ?? '',
        file: match[1],
        line: parseInt(match[2] ?? '0', 10),
        column: parseInt(match[3] ?? '0', 10),
        details: `${match[4] ?? ''}: ${match[5] ?? ''}`,
        confidence: 1.0,
        autoFixable: true,
      });
    }

    return failures;
  }

  /**
   * Parse ESLint output specifically
   *
   * @param output - ESLint output
   * @returns Array of lint failures
   */
  public parseEslintErrors(output: string): CIFailure[] {
    const failures: CIFailure[] = [];

    // Parse individual errors
    const errorPattern = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(\S+)$/gm;
    const filePattern = /^([^\s].+\.[jt]sx?)$/gm;

    let currentFile: string | undefined;
    const lines = output.split('\n');

    for (const line of lines) {
      // Check if this is a file header
      const fileMatch = filePattern.exec(line);
      if (fileMatch !== null) {
        currentFile = fileMatch[1];
        continue;
      }

      // Check if this is an error line
      const errorMatch = errorPattern.exec(line);
      if (errorMatch !== null && currentFile !== undefined) {
        const isError = errorMatch[3] === 'error';
        failures.push({
          category: 'lint',
          message: `${errorMatch[4] ?? ''} (${errorMatch[5] ?? ''})`,
          file: currentFile,
          line: parseInt(errorMatch[1] ?? '0', 10),
          column: parseInt(errorMatch[2] ?? '0', 10),
          details: line.trim(),
          confidence: 1.0,
          autoFixable: true,
          suggestedFix: isError ? 'Run npm run lint -- --fix' : undefined,
        });
      }
    }

    return failures;
  }

  /**
   * Parse test output (Jest/Vitest)
   *
   * @param output - Test runner output
   * @returns Array of test failures
   */
  public parseTestErrors(output: string): CIFailure[] {
    const failures: CIFailure[] = [];

    // Jest/Vitest FAIL pattern
    const failPattern = /FAIL\s+(.+\.test\.[jt]sx?)/g;
    let match;

    while ((match = failPattern.exec(output)) !== null) {
      failures.push({
        category: 'test',
        message: 'Test suite failed',
        file: match[1],
        details: this.extractTestDetails(output, match[1] ?? ''),
        confidence: 1.0,
        autoFixable: true,
      });
    }

    // Extract specific assertion failures
    const assertionPattern = /expect\(received\)\.(\w+)\(expected\)/g;
    while ((match = assertionPattern.exec(output)) !== null) {
      failures.push({
        category: 'test',
        message: `Assertion failed: ${match[1] ?? ''}`,
        details: match[0],
        confidence: 0.8,
        autoFixable: true,
      });
    }

    return failures;
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(pattern: CILogPattern, _matchedText: string): number {
    // Base confidence from pattern specificity
    let confidence = 0.7;

    // Higher confidence for patterns with location extraction
    if (pattern.extractLocation !== undefined) {
      confidence += 0.2;
    }

    // Higher confidence for named patterns
    if (pattern.name.includes('error') || pattern.name.includes('failure')) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Find all matches for a pattern in the logs
   */
  private findMatches(
    logs: string,
    pattern: CILogPattern,
    matchedRanges: Array<{ start: number; end: number }>
  ): CIFailure[] {
    const failures: CIFailure[] = [];
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

    let match;
    while ((match = regex.exec(logs)) !== null) {
      // Skip if this range was already matched
      const range = { start: match.index, end: match.index + match[0].length };
      if (this.isRangeOverlapping(range, matchedRanges)) {
        continue;
      }
      matchedRanges.push(range);

      // Extract location info
      const location = pattern.extractLocation?.(match) ?? {};

      // Extract message
      const message = pattern.extractMessage?.(match) ?? match[0];

      failures.push({
        category: pattern.category,
        message,
        file: location.file,
        line: location.line,
        column: location.column,
        details: match[0],
        confidence: this.calculateConfidence(pattern, match[0]),
        autoFixable: pattern.autoFixable,
      });
    }

    return failures;
  }

  /**
   * Check if a range overlaps with existing ranges
   */
  private isRangeOverlapping(
    range: { start: number; end: number },
    existingRanges: readonly { start: number; end: number }[]
  ): boolean {
    return existingRanges.some(
      (existing) => range.start < existing.end && range.end > existing.start
    );
  }

  /**
   * Find error lines that weren't matched by any pattern
   */
  private findUnidentifiedCauses(
    logs: string,
    matchedRanges: readonly { start: number; end: number }[]
  ): string[] {
    const unidentified: string[] = [];
    const errorIndicators = [
      /\berror\b/i,
      /\bfail(?:ed|ure)?\b/i,
      /\bexception\b/i,
      /\bcritical\b/i,
    ];

    const lines = logs.split('\n');
    let currentPosition = 0;

    for (const line of lines) {
      const lineStart = currentPosition;
      const lineEnd = currentPosition + line.length;
      currentPosition = lineEnd + 1; // +1 for newline

      // Skip if this line is within a matched range
      if (
        matchedRanges.some(
          (range) => lineStart < range.end && lineEnd > range.start
        )
      ) {
        continue;
      }

      // Check if line contains error indicators
      if (errorIndicators.some((indicator) => indicator.test(line))) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0 && trimmedLine.length < 500) {
          unidentified.push(trimmedLine);
        }
      }
    }

    // Limit to first 20 unidentified causes
    return unidentified.slice(0, 20);
  }

  /**
   * Group failures by category
   */
  private groupByCategory(
    failures: readonly CIFailure[]
  ): ReadonlyMap<CIFailureCategory, readonly CIFailure[]> {
    const grouped = new Map<CIFailureCategory, CIFailure[]>();

    for (const failure of failures) {
      const existing = grouped.get(failure.category) ?? [];
      grouped.set(failure.category, [...existing, failure]);
    }

    return grouped;
  }

  /**
   * Truncate logs if too large
   */
  private truncateLogs(logs: string): string {
    if (logs.length <= this.maxLogSize) {
      return logs;
    }

    // Keep first and last parts, indicating truncation
    const halfSize = Math.floor(this.maxLogSize / 2);
    const firstPart = logs.slice(0, halfSize);
    const lastPart = logs.slice(-halfSize);

    return `${firstPart}\n\n... [TRUNCATED ${String(logs.length - this.maxLogSize)} characters] ...\n\n${lastPart}`;
  }

  /**
   * Extract test details for a specific test file
   */
  private extractTestDetails(output: string, testFile: string): string {
    const lines = output.split('\n');
    const testFileIndex = lines.findIndex((line) => line.includes(testFile));

    if (testFileIndex === -1) {
      return `Test file failed: ${testFile}`;
    }

    // Extract context around the test file mention
    const start = Math.max(0, testFileIndex - 2);
    const end = Math.min(lines.length, testFileIndex + 10);

    return lines.slice(start, end).join('\n');
  }
}

/**
 * Get singleton instance of CILogAnalyzer
 */
let analyzerInstance: CILogAnalyzer | null = null;

export function getCILogAnalyzer(options?: {
  customPatterns?: readonly CILogPattern[];
  maxLogSize?: number;
}): CILogAnalyzer {
  if (analyzerInstance === null) {
    analyzerInstance = new CILogAnalyzer(options);
  }
  return analyzerInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetCILogAnalyzer(): void {
  analyzerInstance = null;
}
