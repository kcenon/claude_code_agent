/**
 * PathSanitizer - Dedicated path sanitization utility
 *
 * Features:
 * - Null byte detection and rejection
 * - Path component validation
 * - Cross-platform case handling
 * - Security audit logging
 * - Comprehensive path normalization
 */

import * as path from 'node:path';
import type { AuditLogger } from './AuditLogger.js';
import { PathTraversalError } from './errors.js';

/**
 * Configuration options for PathSanitizer
 */
export interface PathSanitizerOptions {
  /** Base directory for path validation */
  readonly baseDir: string;
  /** Additional allowed directories */
  readonly allowedDirs?: readonly string[] | undefined;
  /** Enable case-insensitive comparison (auto-detected if not specified) */
  readonly caseInsensitive?: boolean | undefined;
  /** Maximum path length (default: 4096) */
  readonly maxPathLength?: number | undefined;
  /** Audit logger for security events (optional) */
  readonly auditLogger?: AuditLogger | undefined;
  /** Actor name for audit logging (default: 'system') */
  readonly actor?: string | undefined;
}

/**
 * Path sanitization result
 */
export interface SanitizationResult {
  /** Whether the path is valid */
  readonly valid: boolean;
  /** Sanitized path (if valid) */
  readonly sanitizedPath?: string;
  /** Error message (if invalid) */
  readonly error?: string;
  /** Rejection reason code */
  readonly reasonCode?: PathRejectionReason;
}

/**
 * Reasons for path rejection
 */
export type PathRejectionReason =
  | 'NULL_BYTE'
  | 'PATH_TOO_LONG'
  | 'TRAVERSAL_ATTEMPT'
  | 'INVALID_COMPONENT'
  | 'OUTSIDE_BOUNDARY'
  | 'EMPTY_PATH'
  | 'INVALID_CHARACTERS';

/**
 * Dangerous path patterns that should be rejected
 */
const DANGEROUS_PATTERNS = [
  /\0/, // Null byte
  /\.\.[/\\]/, // Parent directory traversal
  /[/\\]\.\.[/\\]/, // Embedded traversal
  /^\.\.([/\\]|$)/, // Start with parent
  /[/\\]\.\.([/\\]|$)/, // Contains parent at boundary
];

/**
 * Invalid path component patterns
 */
const INVALID_COMPONENT_PATTERNS = [
  /^\.+$/, // Only dots (., .., ...)
  /^CON$/i, // Windows reserved names
  /^PRN$/i,
  /^AUX$/i,
  /^NUL$/i,
  /^COM[1-9]$/i,
  /^LPT[1-9]$/i,
];

/**
 * Characters not allowed in path components
 */
const INVALID_PATH_CHARS = /[\x00-\x1f<>:"|?*]/;

/**
 * Dedicated path sanitizer with security audit logging
 */
export class PathSanitizer {
  private readonly baseDir: string;
  private readonly allowedDirs: readonly string[];
  private readonly caseInsensitive: boolean;
  private readonly maxPathLength: number;
  private readonly auditLogger: AuditLogger | undefined;
  private readonly actor: string;

  constructor(options: PathSanitizerOptions) {
    this.baseDir = path.resolve(options.baseDir);
    this.allowedDirs = (options.allowedDirs ?? []).map((dir) => path.resolve(dir));
    this.caseInsensitive =
      options.caseInsensitive ?? (process.platform === 'win32' || process.platform === 'darwin');
    this.maxPathLength = options.maxPathLength ?? 4096;
    this.auditLogger = options.auditLogger;
    this.actor = options.actor ?? 'system';
  }

  /**
   * Sanitize and validate a path
   *
   * @param inputPath - Path to sanitize
   * @returns Sanitization result
   */
  public sanitize(inputPath: string): SanitizationResult {
    // Check for empty path
    if (!inputPath || inputPath.trim() === '') {
      return this.reject(inputPath, 'EMPTY_PATH', 'Path cannot be empty');
    }

    // Check for null bytes first (highest priority security check)
    if (this.containsNullByte(inputPath)) {
      return this.reject(inputPath, 'NULL_BYTE', 'Path contains null byte');
    }

    // Check path length
    if (inputPath.length > this.maxPathLength) {
      return this.reject(inputPath, 'PATH_TOO_LONG', `Path exceeds maximum length of ${String(this.maxPathLength)}`);
    }

    // Check for invalid characters
    if (INVALID_PATH_CHARS.test(inputPath)) {
      return this.reject(inputPath, 'INVALID_CHARACTERS', 'Path contains invalid characters');
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(inputPath)) {
        return this.reject(inputPath, 'TRAVERSAL_ATTEMPT', 'Path traversal pattern detected');
      }
    }

    // Normalize the path
    const normalized = path.normalize(inputPath);

    // Re-check after normalization (normalization might reveal hidden patterns)
    if (this.containsTraversalAfterNormalize(normalized)) {
      return this.reject(inputPath, 'TRAVERSAL_ATTEMPT', 'Path traversal detected after normalization');
    }

    // Validate path components
    const componentValidation = this.validateComponents(normalized);
    if (!componentValidation.valid) {
      return this.reject(inputPath, 'INVALID_COMPONENT', componentValidation.error ?? 'Invalid path component');
    }

    // Resolve against base directory
    const resolved = path.resolve(this.baseDir, normalized);

    // Check if within allowed boundaries
    if (!this.isWithinBoundary(resolved)) {
      return this.reject(inputPath, 'OUTSIDE_BOUNDARY', 'Path is outside allowed directory');
    }

    return {
      valid: true,
      sanitizedPath: resolved,
    };
  }

  /**
   * Sanitize a path and throw if invalid
   *
   * @param inputPath - Path to sanitize
   * @returns Sanitized absolute path
   * @throws PathTraversalError if validation fails
   */
  public sanitizeOrThrow(inputPath: string): string {
    const result = this.sanitize(inputPath);

    if (!result.valid) {
      throw new PathTraversalError(inputPath);
    }

    return result.sanitizedPath!;
  }

  /**
   * Check if a path contains a null byte
   */
  public containsNullByte(inputPath: string): boolean {
    return inputPath.includes('\0');
  }

  /**
   * Validate individual path components
   */
  private validateComponents(inputPath: string): { valid: boolean; error?: string } {
    const components = inputPath.split(path.sep).filter((c) => c.length > 0);

    for (const component of components) {
      // Check for reserved names and patterns
      for (const pattern of INVALID_COMPONENT_PATTERNS) {
        if (pattern.test(component)) {
          return {
            valid: false,
            error: `Invalid path component: ${component}`,
          };
        }
      }

      // Check component length (Windows has 255 char limit per component)
      if (component.length > 255) {
        return {
          valid: false,
          error: `Path component too long: ${component.substring(0, 20)}...`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check for traversal after normalization
   */
  private containsTraversalAfterNormalize(normalizedPath: string): boolean {
    const components = normalizedPath.split(path.sep);

    for (const component of components) {
      if (component === '..') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a path is within allowed boundaries
   */
  private isWithinBoundary(absolutePath: string): boolean {
    const isWithinBase = this.isPathWithin(absolutePath, this.baseDir);
    const isWithinAllowed = this.allowedDirs.some((dir) => this.isPathWithin(absolutePath, dir));
    return isWithinBase || isWithinAllowed;
  }

  /**
   * Check if a path is within a directory
   */
  private isPathWithin(targetPath: string, basePath: string): boolean {
    let normalizedTarget = path.normalize(targetPath);
    let normalizedBase = path.normalize(basePath);

    if (this.caseInsensitive) {
      normalizedTarget = normalizedTarget.toLowerCase();
      normalizedBase = normalizedBase.toLowerCase();
    }

    const relativePath = path.relative(normalizedBase, normalizedTarget);
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * Create a rejection result and log to audit
   */
  private reject(
    inputPath: string,
    reasonCode: PathRejectionReason,
    error: string
  ): SanitizationResult {
    // Log rejection to audit logger if available
    if (this.auditLogger) {
      this.auditLogger.logSecurityViolation('path_traversal_attempt', this.actor, {
        inputPath: this.sanitizeForLogging(inputPath),
        reasonCode,
        error,
        baseDir: this.baseDir,
      });
    }

    return {
      valid: false,
      error,
      reasonCode,
    };
  }

  /**
   * Sanitize path for safe logging (remove control chars, truncate)
   */
  private sanitizeForLogging(inputPath: string): string {
    // Remove control characters and truncate
    // Intentionally matching control characters for logging sanitization
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x1f\x7f]/g;
    return inputPath.replace(controlCharRegex, '?').substring(0, 200);
  }

  /**
   * Validate multiple paths
   *
   * @param paths - Paths to validate
   * @returns Map of path to sanitization result
   */
  public sanitizeMany(paths: readonly string[]): Map<string, SanitizationResult> {
    const results = new Map<string, SanitizationResult>();

    for (const inputPath of paths) {
      results.set(inputPath, this.sanitize(inputPath));
    }

    return results;
  }

  /**
   * Check if a path would be valid without full sanitization
   * (faster for quick validation checks)
   *
   * @param inputPath - Path to check
   * @returns True if path appears valid
   */
  public isValid(inputPath: string): boolean {
    // Quick checks without full resolution
    if (!inputPath || inputPath.trim() === '') {
      return false;
    }

    if (this.containsNullByte(inputPath)) {
      return false;
    }

    if (inputPath.length > this.maxPathLength) {
      return false;
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(inputPath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the configured base directory
   */
  public getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Get allowed directories
   */
  public getAllowedDirs(): readonly string[] {
    return this.allowedDirs;
  }

  /**
   * Check if case-insensitive mode is enabled
   */
  public isCaseInsensitive(): boolean {
    return this.caseInsensitive;
  }

  /**
   * Get maximum path length
   */
  public getMaxPathLength(): number {
    return this.maxPathLength;
  }
}
