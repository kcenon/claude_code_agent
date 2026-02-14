/**
 * Centralized project context management
 *
 * Provides a singleton pattern for managing project root directory,
 * eliminating the need for process.cwd() in default configurations.
 * This ensures consistent path resolution regardless of the current
 * working directory.
 *
 * @module utils/ProjectContext
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { getLogger } from '../logging/index.js';

// ============================================================
// Error Classes
// ============================================================

/**
 * Error thrown when project context operations fail
 */
export class ProjectContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectContextError';
    Object.setPrototypeOf(this, ProjectContextError.prototype);
  }
}

// ============================================================
// Types
// ============================================================

/**
 * Options for ProjectContext initialization
 */
export interface ProjectContextOptions {
  /**
   * Suppress warning messages (useful for testing)
   */
  silent?: boolean;

  /**
   * Require .ad-sdlc directory to exist
   */
  requireAdSdlc?: boolean;
}

// ============================================================
// Implementation
// ============================================================

/**
 * Internal implementation class for ProjectContext
 *
 * Manages project root directory and provides path resolution utilities.
 * Uses singleton pattern to ensure consistent project root across modules.
 */
class ProjectContextImpl {
  private readonly logger = getLogger();
  private projectRoot: string | null = null;
  private initialized = false;
  private silent = false;

  /**
   * Initialize project context with the given root directory
   *
   * @param projectRoot - Root directory path (will be resolved to absolute)
   * @param options - Initialization options
   * @throws ProjectContextError if directory is invalid
   */
  public initialize(projectRoot: string, options?: ProjectContextOptions): void {
    const resolvedRoot = path.resolve(projectRoot);
    this.silent = options?.silent ?? false;

    // Validate directory exists
    if (!fs.existsSync(resolvedRoot)) {
      throw new ProjectContextError(`Project root does not exist: ${resolvedRoot}`);
    }

    // Validate it's a directory
    const stats = fs.statSync(resolvedRoot);
    if (!stats.isDirectory()) {
      throw new ProjectContextError(`Project root is not a directory: ${resolvedRoot}`);
    }

    // Check for .ad-sdlc (warn if missing, fail if required)
    const adSdlcPath = path.join(resolvedRoot, '.ad-sdlc');
    if (!fs.existsSync(adSdlcPath)) {
      if (options?.requireAdSdlc === true) {
        throw new ProjectContextError(
          `.ad-sdlc directory not found in ${resolvedRoot}. Run "ad-sdlc init" to initialize.`
        );
      }
      if (!this.silent) {
        this.logger.warn(`.ad-sdlc directory not found in ${resolvedRoot}`);
        this.logger.warn('Run "ad-sdlc init" to initialize the project.');
      }
    }

    // Warn if CWD differs (informational, not an error)
    if (!this.silent && process.cwd() !== resolvedRoot) {
      this.logger.warn('Current working directory differs from project root', {
        cwd: process.cwd(),
        projectRoot: resolvedRoot,
      });
    }

    this.projectRoot = resolvedRoot;
    this.initialized = true;
  }

  /**
   * Get the current project root
   *
   * @returns The resolved project root path
   * @throws ProjectContextError if not initialized
   */
  public getProjectRoot(): string {
    if (!this.initialized || this.projectRoot === null) {
      throw new ProjectContextError(
        'ProjectContext not initialized. Call initialize() first or pass projectRoot in config.'
      );
    }
    return this.projectRoot;
  }

  /**
   * Try to get the project root without throwing
   *
   * @returns The project root or undefined if not initialized
   */
  public tryGetProjectRoot(): string | undefined {
    if (!this.initialized || this.projectRoot === null) {
      return undefined;
    }
    return this.projectRoot;
  }

  /**
   * Resolve a path relative to the project root
   *
   * @param relativePath - Path relative to project root
   * @returns Absolute resolved path
   * @throws ProjectContextError if not initialized
   */
  public resolvePath(relativePath: string): string {
    return path.resolve(this.getProjectRoot(), relativePath);
  }

  /**
   * Check if a path is within the project root
   *
   * @param targetPath - Path to check
   * @returns True if path is within project root
   * @throws ProjectContextError if not initialized
   */
  public isWithinProject(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    const root = this.getProjectRoot();
    const relative = path.relative(root, resolved);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  /**
   * Check if context is initialized
   *
   * @returns True if initialize() has been called successfully
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset context (primarily for testing)
   *
   * Clears the project root and resets initialization state.
   */
  public reset(): void {
    this.projectRoot = null;
    this.initialized = false;
    this.silent = false;
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let instance: ProjectContextImpl | null = null;

/**
 * Get the singleton ProjectContext instance
 *
 * @returns The ProjectContext singleton
 */
export function getProjectContext(): ProjectContextImpl {
  if (instance === null) {
    instance = new ProjectContextImpl();
  }
  return instance;
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Initialize the project context
 *
 * Must be called before using other ProjectContext functions.
 * Typically called at CLI entry point.
 *
 * @param projectRoot - Root directory path
 * @param options - Initialization options
 * @throws ProjectContextError if directory is invalid
 *
 * @example
 * ```typescript
 * import { initializeProject } from './utils/ProjectContext.js';
 *
 * // At CLI entry point
 * initializeProject(options.project ?? process.cwd());
 * ```
 */
export function initializeProject(projectRoot: string, options?: ProjectContextOptions): void {
  getProjectContext().initialize(projectRoot, options);
}

/**
 * Get the current project root
 *
 * @returns The resolved project root path
 * @throws ProjectContextError if not initialized
 *
 * @example
 * ```typescript
 * import { getProjectRoot } from './utils/ProjectContext.js';
 *
 * const root = getProjectRoot();
 * ```
 */
export function getProjectRoot(): string {
  return getProjectContext().getProjectRoot();
}

/**
 * Try to get the project root without throwing
 *
 * Useful for modules that need to work both with and without
 * initialized context (e.g., for backwards compatibility).
 *
 * @returns The project root or undefined if not initialized
 *
 * @example
 * ```typescript
 * import { tryGetProjectRoot } from './utils/ProjectContext.js';
 *
 * const root = tryGetProjectRoot() ?? process.cwd();
 * ```
 */
export function tryGetProjectRoot(): string | undefined {
  return getProjectContext().tryGetProjectRoot();
}

/**
 * Resolve a path relative to the project root
 *
 * @param relativePath - Path relative to project root
 * @returns Absolute resolved path
 * @throws ProjectContextError if not initialized
 *
 * @example
 * ```typescript
 * import { resolveProjectPath } from './utils/ProjectContext.js';
 *
 * const configPath = resolveProjectPath('.ad-sdlc/config.yaml');
 * ```
 */
export function resolveProjectPath(relativePath: string): string {
  return getProjectContext().resolvePath(relativePath);
}

/**
 * Check if project context is initialized
 *
 * @returns True if initialize() has been called
 *
 * @example
 * ```typescript
 * import { isProjectInitialized } from './utils/ProjectContext.js';
 *
 * if (!isProjectInitialized()) {
 *   initializeProject(process.cwd());
 * }
 * ```
 */
export function isProjectInitialized(): boolean {
  return getProjectContext().isInitialized();
}

/**
 * Check if a path is within the project root
 *
 * Useful for security validation to prevent path traversal.
 *
 * @param targetPath - Path to check
 * @returns True if path is within project root
 * @throws ProjectContextError if not initialized
 *
 * @example
 * ```typescript
 * import { isPathWithinProject } from './utils/ProjectContext.js';
 *
 * if (!isPathWithinProject(userProvidedPath)) {
 *   throw new Error('Path traversal detected');
 * }
 * ```
 */
export function isPathWithinProject(targetPath: string): boolean {
  return getProjectContext().isWithinProject(targetPath);
}

/**
 * Reset project context (for testing only)
 *
 * @internal
 */
export function resetProjectContext(): void {
  getProjectContext().reset();
}
