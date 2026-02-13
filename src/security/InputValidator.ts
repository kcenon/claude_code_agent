/**
 * InputValidator - Secure input validation and sanitization
 *
 * Features:
 * - Path traversal prevention with symlink protection
 * - URL validation with protocol restrictions
 * - User input sanitization
 * - Internal URL blocking
 * - Null byte detection
 * - Case-sensitive/insensitive path validation
 */

import * as path from 'node:path';
import type { InputValidatorOptions, ValidationResult } from './types.js';
import { PathTraversalError, InvalidUrlError, ValidationError } from './errors.js';
import { PathSanitizer, type PathRejectionReason } from './PathSanitizer.js';
import { SymlinkResolver, type SymlinkPolicy } from './SymlinkResolver.js';
import type { AuditLogger } from './AuditLogger.js';

/**
 * Default allowed URL protocols
 */
const DEFAULT_ALLOWED_PROTOCOLS = ['https:'] as const;

/**
 * Internal hostname patterns to block
 */
const INTERNAL_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
];

/**
 * Extended validation result with additional security information
 */
export interface ExtendedValidationResult extends ValidationResult {
  /** Path rejection reason if validation failed */
  readonly rejectionReason?: PathRejectionReason | undefined;
  /** Whether the path involves a symbolic link */
  readonly isSymlink?: boolean | undefined;
  /** The real path after symlink resolution (if applicable) */
  readonly realPath?: string | undefined;
}

/**
 * Validates and sanitizes user inputs
 */
export class InputValidator {
  private readonly basePath: string;
  private readonly allowedProtocols: readonly string[];
  private readonly blockInternalUrls: boolean;
  private readonly maxInputLength: number;
  private readonly pathSanitizer: PathSanitizer;
  private readonly symlinkResolver: SymlinkResolver;
  private readonly auditLogger: AuditLogger | undefined;
  private readonly actor: string;

  constructor(options: InputValidatorOptions) {
    this.basePath = path.resolve(options.basePath);
    this.allowedProtocols = options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
    this.blockInternalUrls = options.blockInternalUrls ?? true;
    this.maxInputLength = options.maxInputLength ?? 10000;
    this.auditLogger = options.auditLogger as AuditLogger | undefined;
    this.actor = options.actor ?? 'system';

    // Initialize path sanitizer
    const pathSanitizerOptions: import('./PathSanitizer.js').PathSanitizerOptions = {
      baseDir: this.basePath,
      actor: this.actor,
    };
    if (options.allowedDirs !== undefined) {
      (pathSanitizerOptions as { allowedDirs: readonly string[] }).allowedDirs =
        options.allowedDirs;
    }
    if (options.caseInsensitive !== undefined) {
      (pathSanitizerOptions as { caseInsensitive: boolean }).caseInsensitive =
        options.caseInsensitive;
    }
    if (options.maxPathLength !== undefined) {
      (pathSanitizerOptions as { maxPathLength: number }).maxPathLength = options.maxPathLength;
    }
    if (this.auditLogger !== undefined) {
      (pathSanitizerOptions as { auditLogger: AuditLogger }).auditLogger = this.auditLogger;
    }
    this.pathSanitizer = new PathSanitizer(pathSanitizerOptions);

    // Initialize symlink resolver
    const symlinkResolverOptions: import('./SymlinkResolver.js').SymlinkResolverOptions = {
      baseDir: this.basePath,
    };
    if (options.allowedDirs !== undefined) {
      (symlinkResolverOptions as { allowedDirs: readonly string[] }).allowedDirs =
        options.allowedDirs;
    }
    if (options.symlinkPolicy !== undefined) {
      (symlinkResolverOptions as { symlinkPolicy: SymlinkPolicy }).symlinkPolicy =
        options.symlinkPolicy as SymlinkPolicy;
    }
    if (options.caseInsensitive !== undefined) {
      (symlinkResolverOptions as { caseInsensitive: boolean }).caseInsensitive =
        options.caseInsensitive;
    }
    this.symlinkResolver = new SymlinkResolver(symlinkResolverOptions);
  }

  /**
   * Validate and normalize a file path
   * Prevents path traversal attacks including symlink-based attacks
   *
   * @param inputPath - The path to validate
   * @returns The validated and resolved absolute path
   * @throws PathTraversalError if path traversal is detected
   */
  public validateFilePath(inputPath: string): string {
    // First sanitize the path (checks null bytes, dangerous patterns, etc.)
    const sanitizationResult = this.pathSanitizer.sanitize(inputPath);

    if (!sanitizationResult.valid) {
      this.logPathRejection(inputPath, sanitizationResult.reasonCode ?? 'TRAVERSAL_ATTEMPT');
      throw new PathTraversalError(inputPath);
    }

    // Then validate with symlink resolution
    const symlinkResult = this.symlinkResolver.resolve(inputPath);

    if (!symlinkResult.isWithinBoundary) {
      this.logPathRejection(inputPath, 'OUTSIDE_BOUNDARY', {
        isSymlink: symlinkResult.isSymlink,
        symlinkTarget: symlinkResult.symlinkTarget,
      });
      throw new PathTraversalError(inputPath);
    }

    // Return the real path if symlink was resolved, otherwise the sanitized path
    // sanitizedPath is guaranteed to exist when valid is true
    return symlinkResult.realPath ?? (sanitizationResult.sanitizedPath as string);
  }

  /**
   * Validate a file path asynchronously with full symlink resolution
   *
   * @param inputPath - The path to validate
   * @returns Promise resolving to the validated absolute path
   * @throws PathTraversalError if validation fails
   */
  public async validateFilePathAsync(inputPath: string): Promise<string> {
    // First sanitize the path
    const sanitizationResult = this.pathSanitizer.sanitize(inputPath);

    if (!sanitizationResult.valid) {
      this.logPathRejection(inputPath, sanitizationResult.reasonCode ?? 'TRAVERSAL_ATTEMPT');
      throw new PathTraversalError(inputPath);
    }

    // Then validate with async symlink resolution
    const symlinkResult = await this.symlinkResolver.resolveAsync(inputPath);

    if (!symlinkResult.isWithinBoundary) {
      this.logPathRejection(inputPath, 'OUTSIDE_BOUNDARY', {
        isSymlink: symlinkResult.isSymlink,
        symlinkTarget: symlinkResult.symlinkTarget,
      });
      throw new PathTraversalError(inputPath);
    }

    // sanitizedPath is guaranteed to exist when valid is true
    return symlinkResult.realPath ?? (sanitizationResult.sanitizedPath as string);
  }

  /**
   * Validate a file path and return a result object
   *
   * @param inputPath - The path to validate
   * @returns Validation result with valid flag and normalized value or error
   */
  public validateFilePathSafe(inputPath: string): ValidationResult {
    try {
      const value = this.validateFilePath(inputPath);
      return { valid: true, value };
    } catch (error) {
      if (error instanceof PathTraversalError) {
        return { valid: false, error: 'Path traversal detected' };
      }
      return { valid: false, error: 'Invalid path' };
    }
  }

  /**
   * Validate a file path and return extended result with security details
   *
   * @param inputPath - The path to validate
   * @returns Extended validation result with symlink and rejection information
   */
  public validateFilePathExtended(inputPath: string): ExtendedValidationResult {
    // Check sanitization first
    const sanitizationResult = this.pathSanitizer.sanitize(inputPath);

    if (!sanitizationResult.valid) {
      const result: ExtendedValidationResult = {
        valid: false,
        error: sanitizationResult.error ?? 'Validation failed',
      };
      if (sanitizationResult.reasonCode !== undefined) {
        (result as { rejectionReason: PathRejectionReason }).rejectionReason =
          sanitizationResult.reasonCode;
      }
      return result;
    }

    // Check symlink resolution
    const symlinkResult = this.symlinkResolver.resolve(inputPath);

    if (!symlinkResult.isWithinBoundary) {
      const result: ExtendedValidationResult = {
        valid: false,
        error: 'Path escapes allowed directory',
        rejectionReason: 'OUTSIDE_BOUNDARY',
        isSymlink: symlinkResult.isSymlink,
      };
      if (symlinkResult.realPath !== null) {
        (result as { realPath: string }).realPath = symlinkResult.realPath;
      }
      return result;
    }

    const result: ExtendedValidationResult = {
      valid: true,
      value: symlinkResult.realPath ?? sanitizationResult.sanitizedPath ?? inputPath,
      isSymlink: symlinkResult.isSymlink,
    };
    if (symlinkResult.realPath !== null) {
      (result as { realPath: string }).realPath = symlinkResult.realPath;
    }
    return result;
  }

  /**
   * Check if a path contains null bytes
   *
   * @param inputPath - The path to check
   * @returns True if path contains null bytes
   */
  public containsNullByte(inputPath: string): boolean {
    return this.pathSanitizer.containsNullByte(inputPath);
  }

  /**
   * Quick validation check without full resolution
   *
   * @param inputPath - The path to check
   * @returns True if path appears valid
   */
  public isValidPath(inputPath: string): boolean {
    return this.pathSanitizer.isValid(inputPath);
  }

  /**
   * Validate a URL
   *
   * @param urlString - The URL to validate
   * @returns The validated URL object
   * @throws InvalidUrlError if validation fails
   */
  public validateUrl(urlString: string): URL {
    let parsed: URL;

    try {
      parsed = new URL(urlString);
    } catch {
      throw new InvalidUrlError(urlString, 'Invalid URL format');
    }

    // Check protocol
    if (!this.allowedProtocols.includes(parsed.protocol)) {
      throw new InvalidUrlError(
        urlString,
        `Protocol '${parsed.protocol}' not allowed. Allowed: ${this.allowedProtocols.join(', ')}`
      );
    }

    // Check for internal URLs if blocking is enabled
    if (this.blockInternalUrls && this.isInternalHostname(parsed.hostname)) {
      throw new InvalidUrlError(urlString, 'Internal URLs not allowed');
    }

    return parsed;
  }

  /**
   * Validate a URL and return a result object
   *
   * @param urlString - The URL to validate
   * @returns Validation result with valid flag and normalized value or error
   */
  public validateUrlSafe(urlString: string): ValidationResult {
    try {
      const url = this.validateUrl(urlString);
      return { valid: true, value: url.href };
    } catch (error) {
      if (error instanceof InvalidUrlError) {
        return { valid: false, error: error.reason };
      }
      return { valid: false, error: 'Invalid URL' };
    }
  }

  /**
   * Check if a hostname is internal/private
   *
   * @param hostname - The hostname to check
   * @returns True if the hostname is internal
   */
  private isInternalHostname(hostname: string): boolean {
    return INTERNAL_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
  }

  /**
   * Sanitize user input by removing control characters
   *
   * @param input - The input string to sanitize
   * @returns The sanitized string
   */
  public sanitizeUserInput(input: string): string {
    // Check length first
    if (input.length > this.maxInputLength) {
      throw new ValidationError(
        'input',
        `exceeds maximum length of ${String(this.maxInputLength)}`
      );
    }

    // Remove control characters (except newline, carriage return, tab)
    // Intentionally matching control characters for security sanitization
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
    return input.replace(controlCharRegex, '');
  }

  /**
   * Sanitize input and return a result object
   *
   * @param input - The input string to sanitize
   * @returns Validation result with sanitized value
   */
  public sanitizeUserInputSafe(input: string): ValidationResult {
    try {
      const value = this.sanitizeUserInput(input);
      return { valid: true, value };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { valid: false, error: error.constraint };
      }
      return { valid: false, error: 'Sanitization failed' };
    }
  }

  /**
   * Validate an email address format
   *
   * @param email - The email to validate
   * @returns True if the email format is valid
   */
  public isValidEmail(email: string): boolean {
    // RFC 5322 simplified email regex
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return email.length <= 254 && emailRegex.test(email);
  }

  /**
   * Validate a GitHub repository URL or path
   *
   * @param repoRef - Repository reference (URL or owner/repo format)
   * @returns Validated repository reference
   * @throws ValidationError if format is invalid
   */
  public validateGitHubRepo(repoRef: string): string {
    // Accept owner/repo format
    const ownerRepoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (ownerRepoRegex.test(repoRef)) {
      return repoRef;
    }

    // Accept GitHub URLs
    try {
      const url = new URL(repoRef);
      if (url.hostname !== 'github.com') {
        throw new ValidationError('repository', 'must be a github.com URL');
      }
      // Extract owner/repo from path
      const pathMatch = /^\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/.exec(url.pathname);
      if (pathMatch === null) {
        throw new ValidationError('repository', 'invalid GitHub repository path');
      }
      const owner = pathMatch[1];
      const repo = pathMatch[2];
      if (owner === undefined || repo === undefined) {
        throw new ValidationError('repository', 'invalid GitHub repository path');
      }
      return `${owner}/${repo}`;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('repository', 'must be owner/repo format or GitHub URL');
    }
  }

  /**
   * Validate a semantic version string
   *
   * @param version - The version string to validate
   * @returns True if the version is valid semver
   */
  public isValidSemver(version: string): boolean {
    const semverRegex =
      /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  /**
   * Validate a branch name
   *
   * @param branchName - The branch name to validate
   * @returns True if the branch name is valid
   */
  public isValidBranchName(branchName: string): boolean {
    // Git branch name rules
    if (branchName.length === 0 || branchName.length > 255) {
      return false;
    }

    // Cannot start with - or .
    if (branchName.startsWith('-') || branchName.startsWith('.')) {
      return false;
    }

    // Cannot end with .lock or /
    if (branchName.endsWith('.lock') || branchName.endsWith('/')) {
      return false;
    }

    // Cannot contain certain characters
    // Intentionally matching control characters for git branch validation
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\u0000-\u001F\u007F]/;
    const invalidPatterns = [
      /\.\./, // consecutive dots
      /\/\//, // consecutive slashes
      /@\{/, // @{
      controlCharRegex, // control characters including DEL
      /[ ~^:?*[\]\\]/, // space and special chars ([ and ] in char class)
    ];

    return !invalidPatterns.some((pattern) => pattern.test(branchName));
  }

  /**
   * Get the configured base path
   */
  public getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get the path sanitizer instance
   */
  public getPathSanitizer(): PathSanitizer {
    return this.pathSanitizer;
  }

  /**
   * Get the symlink resolver instance
   */
  public getSymlinkResolver(): SymlinkResolver {
    return this.symlinkResolver;
  }

  /**
   * Log a path rejection event for security audit
   * @param inputPath
   * @param reason
   * @param details
   */
  private logPathRejection(
    inputPath: string,
    reason: PathRejectionReason,
    details?: Record<string, unknown>
  ): void {
    if (this.auditLogger) {
      this.auditLogger.logSecurityViolation('path_validation_failed', this.actor, {
        inputPath: this.sanitizePathForLogging(inputPath),
        reason,
        ...details,
      });
    }
  }

  /**
   * Sanitize a path for safe logging (remove control chars, truncate)
   * @param inputPath
   */
  private sanitizePathForLogging(inputPath: string): string {
    // Remove control characters and truncate for safe logging
    // Intentionally matching control characters for logging sanitization
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x1f\x7f]/g;
    return inputPath.replace(controlCharRegex, '?').substring(0, 200);
  }
}
