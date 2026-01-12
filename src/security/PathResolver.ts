/**
 * PathResolver - Project-aware path resolution with security validation
 *
 * Features:
 * - Project root confinement
 * - Path traversal prevention
 * - Symbolic link validation
 * - Additional allowed directories support
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { PathTraversalError } from './errors.js';

/**
 * Configuration options for PathResolver
 */
export interface PathResolverOptions {
  /** Project root directory (all paths relative to this) */
  readonly projectRoot: string;
  /** Additional allowed directories outside project root */
  readonly allowedExternalDirs?: readonly string[];
  /** Follow symbolic links and validate targets (default: true) */
  readonly validateSymlinks?: boolean;
}

/**
 * Result of path resolution
 */
export interface ResolvedPath {
  /** The resolved absolute path */
  readonly absolutePath: string;
  /** The original input path */
  readonly originalPath: string;
  /** Whether the path is within project root */
  readonly isWithinProjectRoot: boolean;
  /** Whether the path is in an allowed external directory */
  readonly isInAllowedExternal: boolean;
}

/**
 * Project-aware path resolver with security validation
 */
export class PathResolver {
  private readonly projectRoot: string;
  private readonly allowedExternalDirs: readonly string[];
  private readonly validateSymlinks: boolean;

  constructor(options: PathResolverOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.allowedExternalDirs = (options.allowedExternalDirs ?? []).map((dir) => path.resolve(dir));
    this.validateSymlinks = options.validateSymlinks ?? true;
  }

  /**
   * Resolve and validate a file path
   *
   * @param inputPath - The path to resolve (relative or absolute)
   * @returns Resolved path information
   * @throws PathTraversalError if path escapes allowed directories
   */
  public resolve(inputPath: string): ResolvedPath {
    // Normalize the input path
    const normalized = path.normalize(inputPath);

    // Resolve against project root
    const resolved = path.isAbsolute(normalized)
      ? path.normalize(normalized)
      : path.resolve(this.projectRoot, normalized);

    // Check if within project root
    const isWithinProjectRoot = this.isPathWithin(resolved, this.projectRoot);

    // Check if in allowed external directories
    const isInAllowedExternal = this.allowedExternalDirs.some((dir) =>
      this.isPathWithin(resolved, dir)
    );

    // If not in any allowed location, throw error
    if (!isWithinProjectRoot && !isInAllowedExternal) {
      throw new PathTraversalError(inputPath);
    }

    return {
      absolutePath: resolved,
      originalPath: inputPath,
      isWithinProjectRoot,
      isInAllowedExternal,
    };
  }

  /**
   * Resolve path without throwing (returns null if invalid)
   *
   * @param inputPath - The path to resolve
   * @returns Resolved path or null if validation fails
   */
  public resolveSafe(inputPath: string): ResolvedPath | null {
    try {
      return this.resolve(inputPath);
    } catch {
      return null;
    }
  }

  /**
   * Validate that a path is safe without resolving
   *
   * @param inputPath - The path to validate
   * @returns True if path would be valid
   */
  public isValid(inputPath: string): boolean {
    return this.resolveSafe(inputPath) !== null;
  }

  /**
   * Resolve path and validate symbolic link target if applicable
   *
   * @param inputPath - The path to resolve
   * @returns Resolved path with symlink validation
   * @throws PathTraversalError if symlink target escapes allowed directories
   */
  public async resolveWithSymlinkCheck(inputPath: string): Promise<ResolvedPath> {
    const resolved = this.resolve(inputPath);

    if (!this.validateSymlinks) {
      return resolved;
    }

    try {
      const stats = await fs.promises.lstat(resolved.absolutePath);

      if (stats.isSymbolicLink()) {
        const realPath = await fs.promises.realpath(resolved.absolutePath);
        const isRealPathWithinProject = this.isPathWithin(realPath, this.projectRoot);
        const isRealPathInAllowed = this.allowedExternalDirs.some((dir) =>
          this.isPathWithin(realPath, dir)
        );

        if (!isRealPathWithinProject && !isRealPathInAllowed) {
          throw new PathTraversalError(
            `Symbolic link target escapes allowed directories: ${inputPath}`
          );
        }
      }
    } catch (error) {
      // If file doesn't exist yet, that's OK (we're creating it)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof PathTraversalError) {
          throw error;
        }
        // Re-throw other errors
        throw error;
      }
    }

    return resolved;
  }

  /**
   * Check if a path is within a base directory
   *
   * @param targetPath - Path to check
   * @param basePath - Base directory
   * @returns True if targetPath is within basePath
   */
  private isPathWithin(targetPath: string, basePath: string): boolean {
    const relativePath = path.relative(basePath, targetPath);
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * Get the configured project root
   */
  public getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get allowed external directories
   */
  public getAllowedExternalDirs(): readonly string[] {
    return this.allowedExternalDirs;
  }

  /**
   * Join paths safely within the project root
   *
   * @param segments - Path segments to join
   * @returns Resolved path
   * @throws PathTraversalError if result escapes allowed directories
   */
  public join(...segments: string[]): ResolvedPath {
    const joined = path.join(...segments);
    return this.resolve(joined);
  }

  /**
   * Get the relative path from project root
   *
   * @param absolutePath - Absolute path
   * @returns Relative path from project root
   */
  public relativeTo(absolutePath: string): string {
    return path.relative(this.projectRoot, absolutePath);
  }

  /**
   * Resolve path and validate symbolic link target synchronously
   *
   * @param inputPath - The path to resolve
   * @returns Resolved path with symlink validation
   * @throws PathTraversalError if symlink target escapes allowed directories
   */
  public resolveWithSymlinkCheckSync(inputPath: string): ResolvedPath {
    const resolved = this.resolve(inputPath);

    if (!this.validateSymlinks) {
      return resolved;
    }

    try {
      const stats = fs.lstatSync(resolved.absolutePath);

      if (stats.isSymbolicLink()) {
        const realPath = fs.realpathSync(resolved.absolutePath);
        const isRealPathWithinProject = this.isPathWithin(realPath, this.projectRoot);
        const isRealPathInAllowed = this.allowedExternalDirs.some((dir) =>
          this.isPathWithin(realPath, dir)
        );

        if (!isRealPathWithinProject && !isRealPathInAllowed) {
          throw new PathTraversalError(
            `Symbolic link target escapes allowed directories: ${inputPath}`
          );
        }
      }
    } catch (error) {
      // If file doesn't exist yet, that's OK (we're creating it)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof PathTraversalError) {
          throw error;
        }
        // Re-throw other errors
        throw error;
      }
    }

    return resolved;
  }
}
