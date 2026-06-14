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
 * Internal hostname patterns to block (string-based, no DNS resolution).
 *
 * Covers:
 *  - loopback: localhost, 127.x.x.x, ::1
 *  - private ranges: 10.x, 172.16-31.x, 192.168.x
 *  - link-local: 169.254.x.x (incl. cloud-metadata 169.254.169.254), fe80::
 *  - ULA IPv6: fc00:, fd00:
 *  - unspecified: 0.0.0.0
 *  - special TLD suffixes: .local, .internal, .localhost
 *  - decimal IPv4 (e.g. 2130706433 == 127.0.0.1)
 *  - hex IPv4 (e.g. 0x7f000001)
 *  - octal-segment IPv4 (e.g. 0177.0.0.1)
 *  - IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
 */
const INTERNAL_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // link-local (incl. cloud-metadata 169.254.169.254)
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
  // IPv4-mapped IPv6: ::ffff:a.b.c.d or ::ffff:0xNN...
  /^::ffff:/i,
];

/**
 * Maximum numeric IPv4 address (255.255.255.255 as decimal)
 */
const MAX_IPV4_DECIMAL = 0xffffffff;

/**
 * Private/reserved IPv4 ranges encoded as [start, end] inclusive pairs
 * (32-bit unsigned integers, big-endian).
 */
const RESERVED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8  (this-network + unspecified)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8  loopback
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16  link-local (cloud-metadata)
  [0x0a000000, 0x0affffff], // 10.0.0.0/8  private
  [0xac100000, 0xac1fffff], // 172.16.0.0/12  private
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16  private
  [0xe0000000, 0xffffffff], // 224.0.0.0/4+  multicast + reserved
];

/**
 * Parse a hostname token as a 32-bit IPv4 integer, supporting decimal,
 * hex (0x…), and octal (0…) representations.
 * Returns undefined when the token is not a valid single-component IPv4.
 *
 * @param token - A single dot-delimited segment from an IPv4 hostname string
 * @returns The 32-bit unsigned value of the token, or undefined if unparseable
 */
function parseSingleComponentIpv4(token: string): number | undefined {
  if (token.length === 0) return undefined;
  let value: number;
  if (/^0x[0-9a-f]+$/i.test(token)) {
    value = parseInt(token, 16);
  } else if (token.startsWith('0') && token.length > 1 && /^[0-7]+$/.test(token)) {
    value = parseInt(token, 8);
  } else if (/^\d+$/.test(token)) {
    value = parseInt(token, 10);
  } else {
    return undefined;
  }
  if (!isFinite(value) || value < 0 || value > MAX_IPV4_DECIMAL) return undefined;
  return value >>> 0; // treat as unsigned 32-bit
}

/**
 * Determine whether a hostname represents a reserved/private IPv4 address,
 * including decimal (2130706433), hex (0x7f000001), octal (0177.0.0.1),
 * and mixed-radix dotted forms.
 *
 * @param hostname - The hostname string to evaluate (brackets already stripped)
 * @returns True when the hostname encodes a reserved/private IPv4 address
 */
function isReservedIpv4Hostname(hostname: string): boolean {
  // Strip surrounding brackets (IPv6 literal in URL won't reach here, but guard anyway)
  const h = hostname.replace(/^\[|\]$/g, '');
  const parts = h.split('.');

  // Single-component: pure decimal, hex, or octal encoding of full 32-bit address
  if (parts.length === 1) {
    const v = parseSingleComponentIpv4(parts[0] as string);
    if (v === undefined) return false;
    return RESERVED_IPV4_RANGES.some(([lo, hi]) => v >= lo && v <= hi);
  }

  // Dotted forms: 1–4 components; last component may carry multiple octets
  if (parts.length > 4) return false;

  let ip32 = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) return false;
    const v = parseSingleComponentIpv4(part);
    if (v === undefined) return false;

    if (i < parts.length - 1) {
      // Leading components must be single-octet (0–255)
      if (v > 0xff) return false;
      ip32 = (ip32 | (v << (24 - i * 8))) >>> 0;
    } else {
      // Last component carries the remaining octets
      const remainingBits = (4 - parts.length + 1) * 8;
      const maxVal = (1 << remainingBits) - 1;
      if (v > maxVal) return false;
      ip32 = (ip32 | v) >>> 0;
    }
  }

  return RESERVED_IPV4_RANGES.some(([lo, hi]) => ip32 >= lo && ip32 <= hi);
}

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
        options.symlinkPolicy;
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
   * Checks pattern-based blocklist first (fast), then handles IPv6 literals
   * (which arrive with surrounding brackets from URL.hostname) and finally
   * parses alternative IPv4 representations (decimal, hex, octal, mixed-radix)
   * that bypass naive regex.
   *
   * Note on Node.js URL normalisation: the built-in URL parser already
   * normalises decimal/hex/octal IPv4 addresses to dotted-decimal form, so
   * e.g. "2130706433", "0x7f000001", and "0177.0.0.1" all become "127.0.0.1"
   * before reaching this method.  The isReservedIpv4Hostname helper remains as
   * a defence-in-depth layer for environments where URL normalisation differs.
   *
   * @param hostname - The hostname as returned by URL.hostname (may include
   *   surrounding brackets for IPv6 literals, e.g. "[::ffff:7f00:1]").
   * @returns True if the hostname is internal
   */
  private isInternalHostname(hostname: string): boolean {
    // Strip brackets from IPv6 literals: URL.hostname returns "[::1]" etc.
    const bare =
      hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

    if (INTERNAL_HOSTNAME_PATTERNS.some((pattern) => pattern.test(bare))) {
      return true;
    }
    // Catch non-standard IPv4 encodings (decimal, hex, octal, mixed-radix)
    return isReservedIpv4Hostname(bare);
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
   * @returns The resolved base path for validation
   */
  public getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get the path sanitizer instance
   * @returns The PathSanitizer used by this validator
   */
  public getPathSanitizer(): PathSanitizer {
    return this.pathSanitizer;
  }

  /**
   * Get the symlink resolver instance
   * @returns The SymlinkResolver used by this validator
   */
  public getSymlinkResolver(): SymlinkResolver {
    return this.symlinkResolver;
  }

  /**
   * Log a path rejection event for security audit
   * @param inputPath - The rejected input path
   * @param reason - The rejection reason code
   * @param details - Additional context about the rejection
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
   * @param inputPath - The path to sanitize for logging
   * @returns Sanitized path string safe for log output
   */
  private sanitizePathForLogging(inputPath: string): string {
    // Remove control characters and truncate for safe logging
    // Intentionally matching control characters for logging sanitization
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x1f\x7f]/g;
    return inputPath.replace(controlCharRegex, '?').substring(0, 200);
  }
}
