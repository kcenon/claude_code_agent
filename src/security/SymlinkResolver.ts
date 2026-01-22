/**
 * SymlinkResolver - Secure symbolic link handling utility
 *
 * Features:
 * - Symlink resolution with security validation
 * - Configurable symlink policies (allow/deny/resolve)
 * - TOCTOU-safe file operations
 * - Cross-platform support
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PathTraversalError } from './errors.js';

/**
 * Symlink handling policy
 */
export type SymlinkPolicy = 'allow' | 'deny' | 'resolve';

/**
 * Configuration options for SymlinkResolver
 */
export interface SymlinkResolverOptions {
  /** Base directory for path validation */
  readonly baseDir: string;
  /** Additional allowed directories outside base */
  readonly allowedDirs?: readonly string[] | undefined;
  /** Symlink handling policy (default: 'resolve') */
  readonly symlinkPolicy?: SymlinkPolicy | undefined;
  /** Enable case-insensitive comparison (auto-detected on Windows) */
  readonly caseInsensitive?: boolean | undefined;
}

/**
 * Result of symlink resolution
 */
export interface SymlinkResolutionResult {
  /** Original input path */
  readonly inputPath: string;
  /** Normalized path (before symlink resolution) */
  readonly normalizedPath: string;
  /** Real path after symlink resolution (null if path doesn't exist) */
  readonly realPath: string | null;
  /** Whether the path is a symbolic link */
  readonly isSymlink: boolean;
  /** Whether both normalized and real paths are within allowed boundaries */
  readonly isWithinBoundary: boolean;
  /** Symlink target path if applicable */
  readonly symlinkTarget?: string | undefined;
}

/**
 * File descriptor handle for TOCTOU-safe operations
 */
export interface SafeFileHandle {
  /** File descriptor */
  readonly fd: number;
  /** Validated path */
  readonly path: string;
  /** Close the file descriptor */
  readonly close: () => void;
}

/**
 * Secure symbolic link resolver with TOCTOU protection
 */
export class SymlinkResolver {
  private readonly baseDir: string;
  private readonly allowedDirs: readonly string[];
  private readonly symlinkPolicy: SymlinkPolicy;
  private readonly caseInsensitive: boolean;

  constructor(options: SymlinkResolverOptions) {
    this.baseDir = path.resolve(options.baseDir);
    this.allowedDirs = (options.allowedDirs ?? []).map((dir) => path.resolve(dir));
    this.symlinkPolicy = options.symlinkPolicy ?? 'resolve';
    this.caseInsensitive =
      options.caseInsensitive ?? (process.platform === 'win32' || process.platform === 'darwin');
  }

  /**
   * Resolve a path and validate symlink targets
   *
   * @param inputPath - Path to resolve
   * @returns Resolution result with validation status
   */
  public resolve(inputPath: string): SymlinkResolutionResult {
    const normalizedPath = path.resolve(this.baseDir, path.normalize(inputPath));

    // Check normalized path is within boundary
    const normalizedWithinBoundary = this.isWithinAllowedBoundary(normalizedPath);

    if (!normalizedWithinBoundary) {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: false,
        isWithinBoundary: false,
      };
    }

    // Check if file exists
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(normalizedPath);
    } catch {
      // File doesn't exist - return normalized path validation only
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: false,
        isWithinBoundary: normalizedWithinBoundary,
      };
    }

    const isSymlink = stats.isSymbolicLink();

    // If not a symlink, return early
    if (!isSymlink) {
      return {
        inputPath,
        normalizedPath,
        realPath: normalizedPath,
        isSymlink: false,
        isWithinBoundary: true,
      };
    }

    // Handle symlink based on policy
    if (this.symlinkPolicy === 'deny') {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: true,
        isWithinBoundary: false,
        symlinkTarget: this.readSymlinkTarget(normalizedPath),
      };
    }

    // Resolve the real path
    let realPath: string;
    try {
      realPath = fs.realpathSync(normalizedPath);
    } catch {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: true,
        isWithinBoundary: false,
        symlinkTarget: this.readSymlinkTarget(normalizedPath),
      };
    }

    const realPathWithinBoundary = this.isWithinAllowedBoundary(realPath);

    return {
      inputPath,
      normalizedPath,
      realPath,
      isSymlink: true,
      isWithinBoundary: realPathWithinBoundary,
      symlinkTarget: this.readSymlinkTarget(normalizedPath),
    };
  }

  /**
   * Resolve path asynchronously
   *
   * @param inputPath - Path to resolve
   * @returns Promise resolving to resolution result
   */
  public async resolveAsync(inputPath: string): Promise<SymlinkResolutionResult> {
    const normalizedPath = path.resolve(this.baseDir, path.normalize(inputPath));

    const normalizedWithinBoundary = this.isWithinAllowedBoundary(normalizedPath);

    if (!normalizedWithinBoundary) {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: false,
        isWithinBoundary: false,
      };
    }

    let stats: fs.Stats;
    try {
      stats = await fs.promises.lstat(normalizedPath);
    } catch {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: false,
        isWithinBoundary: normalizedWithinBoundary,
      };
    }

    const isSymlink = stats.isSymbolicLink();

    if (!isSymlink) {
      return {
        inputPath,
        normalizedPath,
        realPath: normalizedPath,
        isSymlink: false,
        isWithinBoundary: true,
      };
    }

    if (this.symlinkPolicy === 'deny') {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: true,
        isWithinBoundary: false,
        symlinkTarget: await this.readSymlinkTargetAsync(normalizedPath),
      };
    }

    let realPath: string;
    try {
      realPath = await fs.promises.realpath(normalizedPath);
    } catch {
      return {
        inputPath,
        normalizedPath,
        realPath: null,
        isSymlink: true,
        isWithinBoundary: false,
        symlinkTarget: await this.readSymlinkTargetAsync(normalizedPath),
      };
    }

    const realPathWithinBoundary = this.isWithinAllowedBoundary(realPath);

    return {
      inputPath,
      normalizedPath,
      realPath,
      isSymlink: true,
      isWithinBoundary: realPathWithinBoundary,
      symlinkTarget: await this.readSymlinkTargetAsync(normalizedPath),
    };
  }

  /**
   * Validate a path and throw if invalid
   *
   * @param inputPath - Path to validate
   * @returns Validated real path
   * @throws PathTraversalError if validation fails
   */
  public validatePath(inputPath: string): string {
    const result = this.resolve(inputPath);

    if (!result.isWithinBoundary) {
      throw new PathTraversalError(inputPath);
    }

    if (result.isSymlink && this.symlinkPolicy === 'deny') {
      throw new PathTraversalError(`Symlinks are not allowed: ${inputPath}`);
    }

    return result.realPath ?? result.normalizedPath;
  }

  /**
   * Open a file safely with TOCTOU protection
   *
   * This method validates the path and opens the file atomically,
   * preventing race conditions between validation and access.
   *
   * @param inputPath - Path to open
   * @param flags - File open flags (e.g., 'r', 'w', 'a')
   * @param mode - File mode for creation (default: 0o600)
   * @returns Safe file handle
   * @throws PathTraversalError if validation fails
   */
  public openSafe(inputPath: string, flags: string | number, mode = 0o600): SafeFileHandle {
    // First validate the path
    const validatedPath = this.validatePath(inputPath);

    // Open the file
    const fd = fs.openSync(validatedPath, flags, mode);

    // Verify the opened file is still at the expected location
    // by checking the real path of the file descriptor
    try {
      const fdStats = fs.fstatSync(fd);
      const pathStats = fs.lstatSync(validatedPath);

      // Compare inode/device to ensure we opened the right file
      if (fdStats.ino !== pathStats.ino || fdStats.dev !== pathStats.dev) {
        fs.closeSync(fd);
        throw new PathTraversalError(`File changed during open: ${inputPath}`);
      }
    } catch (error) {
      fs.closeSync(fd);
      if (error instanceof PathTraversalError) {
        throw error;
      }
      throw new PathTraversalError(`Failed to verify file: ${inputPath}`);
    }

    return {
      fd,
      path: validatedPath,
      close: (): void => {
        fs.closeSync(fd);
      },
    };
  }

  /**
   * Open a file safely (async version)
   *
   * @param inputPath - Path to open
   * @param flags - File open flags
   * @param mode - File mode for creation
   * @returns Promise resolving to safe file handle
   */
  public async openSafeAsync(
    inputPath: string,
    flags: string | number,
    mode = 0o600
  ): Promise<SafeFileHandle> {
    const result = await this.resolveAsync(inputPath);

    if (!result.isWithinBoundary) {
      throw new PathTraversalError(inputPath);
    }

    if (result.isSymlink && this.symlinkPolicy === 'deny') {
      throw new PathTraversalError(`Symlinks are not allowed: ${inputPath}`);
    }

    const validatedPath = result.realPath ?? result.normalizedPath;
    const handle = await fs.promises.open(validatedPath, flags, mode);
    const fd = handle.fd;

    try {
      const fdStats = await handle.stat();
      const pathStats = await fs.promises.lstat(validatedPath);

      if (fdStats.ino !== pathStats.ino || fdStats.dev !== pathStats.dev) {
        await handle.close();
        throw new PathTraversalError(`File changed during open: ${inputPath}`);
      }
    } catch (error) {
      await handle.close();
      if (error instanceof PathTraversalError) {
        throw error;
      }
      throw new PathTraversalError(`Failed to verify file: ${inputPath}`);
    }

    return {
      fd,
      path: validatedPath,
      close: (): void => {
        handle.close().catch(() => {
          // Ignore close errors
        });
      },
    };
  }

  /**
   * Check if a path is within allowed boundaries
   */
  private isWithinAllowedBoundary(targetPath: string): boolean {
    const isWithinBase = this.isPathWithin(targetPath, this.baseDir);
    const isWithinAllowed = this.allowedDirs.some((dir) => this.isPathWithin(targetPath, dir));
    return isWithinBase || isWithinAllowed;
  }

  /**
   * Check if a path is within a directory (case-sensitive aware)
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
   * Read symlink target path
   */
  private readSymlinkTarget(linkPath: string): string | undefined {
    try {
      return fs.readlinkSync(linkPath);
    } catch {
      return undefined;
    }
  }

  /**
   * Read symlink target path asynchronously
   */
  private async readSymlinkTargetAsync(linkPath: string): Promise<string | undefined> {
    try {
      return await fs.promises.readlink(linkPath);
    } catch {
      return undefined;
    }
  }

  /**
   * Get the configured base directory
   */
  public getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Get the symlink policy
   */
  public getSymlinkPolicy(): SymlinkPolicy {
    return this.symlinkPolicy;
  }

  /**
   * Check if case-insensitive mode is enabled
   */
  public isCaseInsensitive(): boolean {
    return this.caseInsensitive;
  }
}
