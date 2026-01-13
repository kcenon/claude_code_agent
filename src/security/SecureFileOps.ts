/**
 * SecureFileOps - Centralized secure file operations wrapper
 *
 * Features:
 * - Path traversal prevention via InputValidator
 * - Project root confinement
 * - Symbolic link validation to prevent symlink bypass attacks
 * - Audit logging for all file operations
 * - Consistent error handling
 * - Support for both async and sync operations
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PathResolver } from './PathResolver.js';
import { getAuditLogger } from './AuditLogger.js';
import { PathTraversalError } from './errors.js';
import type {
  AuditEventType,
  FileWatchCallback,
  FileWatcherConfig,
  FileWatcherHandle,
  FileWatchEvent,
  FileWatchEventType,
} from './types.js';

/**
 * Configuration options for SecureFileOps
 */
export interface SecureFileOpsConfig {
  /** Project root directory (all paths relative to this) */
  readonly projectRoot: string;
  /** Additional allowed directories outside project root */
  readonly allowedExternalDirs?: readonly string[];
  /** Enable audit logging for file operations */
  readonly enableAuditLog?: boolean;
  /** Actor name for audit logging */
  readonly actor?: string;
  /** File permission mode (default: 0o600) */
  readonly fileMode?: number;
  /** Directory permission mode (default: 0o700) */
  readonly dirMode?: number;
  /** Validate symbolic link targets to prevent symlink bypass attacks (default: true) */
  readonly validateSymlinks?: boolean;
}

/**
 * Options for write operations
 */
export interface WriteOptions {
  /** File encoding (default: 'utf-8') */
  readonly encoding?: BufferEncoding;
  /** File permission mode */
  readonly mode?: number;
  /** Create parent directories if needed (default: true) */
  readonly createDirs?: boolean;
}

/**
 * Options for read operations
 */
export interface ReadOptions {
  /** File encoding (default: 'utf-8') */
  readonly encoding?: BufferEncoding;
}

/**
 * Options for mkdir operations
 */
export interface MkdirOptions {
  /** Create parent directories (default: true) */
  readonly recursive?: boolean;
  /** Directory permission mode */
  readonly mode?: number;
}

/**
 * Default file permission mode (owner read/write only)
 */
const DEFAULT_FILE_MODE = 0o600;

/**
 * Default directory permission mode (owner read/write/execute only)
 */
const DEFAULT_DIR_MODE = 0o700;

/**
 * Centralized secure file operations wrapper
 *
 * All file operations are validated against the project root to prevent
 * path traversal attacks. Operations are optionally logged for audit.
 */
/**
 * Internal watcher state tracking
 */
interface WatcherState {
  watcher: fs.FSWatcher;
  callback: FileWatchCallback;
  config: FileWatcherConfig;
  watchPath: string;
  debounceTimers: Map<string, NodeJS.Timeout>;
  active: boolean;
}

export class SecureFileOps {
  private readonly resolver: PathResolver;
  private readonly enableAuditLog: boolean;
  private readonly actor: string;
  private readonly fileMode: number;
  private readonly dirMode: number;
  private readonly projectRoot: string;
  private readonly validateSymlinks: boolean;
  private readonly watchers: Map<string, WatcherState> = new Map();

  constructor(config: SecureFileOpsConfig) {
    this.projectRoot = path.resolve(config.projectRoot);
    this.validateSymlinks = config.validateSymlinks ?? true;
    this.resolver = new PathResolver({
      projectRoot: this.projectRoot,
      allowedExternalDirs: config.allowedExternalDirs ?? [],
      validateSymlinks: this.validateSymlinks,
    });
    this.enableAuditLog = config.enableAuditLog ?? false;
    this.actor = config.actor ?? 'system';
    this.fileMode = config.fileMode ?? DEFAULT_FILE_MODE;
    this.dirMode = config.dirMode ?? DEFAULT_DIR_MODE;
  }

  // ============================================================
  // Path Validation
  // ============================================================

  /**
   * Validate and resolve a file path
   *
   * @param relativePath - Path relative to project root
   * @returns Absolute validated path
   * @throws PathTraversalError if path escapes project root
   */
  public validatePath(relativePath: string): string {
    const resolved = this.resolver.resolve(relativePath);
    return resolved.absolutePath;
  }

  /**
   * Validate and resolve a file path with symlink validation (async)
   *
   * @param relativePath - Path relative to project root
   * @returns Absolute validated path
   * @throws PathTraversalError if path or symlink target escapes project root
   */
  public async validatePathWithSymlinkCheck(relativePath: string): Promise<string> {
    const resolved = await this.resolver.resolveWithSymlinkCheck(relativePath);
    return resolved.absolutePath;
  }

  /**
   * Validate and resolve a file path with symlink validation (sync)
   *
   * @param relativePath - Path relative to project root
   * @returns Absolute validated path
   * @throws PathTraversalError if path or symlink target escapes project root
   */
  public validatePathWithSymlinkCheckSync(relativePath: string): string {
    const resolved = this.resolver.resolveWithSymlinkCheckSync(relativePath);
    return resolved.absolutePath;
  }

  /**
   * Validate path without throwing
   *
   * @param relativePath - Path to validate
   * @returns True if path is valid
   */
  public isValidPath(relativePath: string): boolean {
    return this.resolver.isValid(relativePath);
  }

  // ============================================================
  // Write Operations
  // ============================================================

  /**
   * Write file with path validation
   *
   * @param relativePath - Path relative to project root
   * @param content - Content to write
   * @param options - Write options
   * @throws PathTraversalError if path escapes project root
   */
  public async writeFile(
    relativePath: string,
    content: string | Buffer,
    options: WriteOptions = {}
  ): Promise<void> {
    const absolutePath = this.validatePath(relativePath);
    const { encoding = 'utf-8', mode = this.fileMode, createDirs = true } = options;

    if (createDirs) {
      const dir = path.dirname(absolutePath);
      await fs.promises.mkdir(dir, { recursive: true, mode: this.dirMode });
    }

    await fs.promises.writeFile(absolutePath, content, { encoding, mode });

    this.logFileOperation('file_created', absolutePath, 'write');
  }

  /**
   * Write file synchronously with path validation
   *
   * @param relativePath - Path relative to project root
   * @param content - Content to write
   * @param options - Write options
   * @throws PathTraversalError if path escapes project root
   */
  public writeFileSync(
    relativePath: string,
    content: string | Buffer,
    options: WriteOptions = {}
  ): void {
    const absolutePath = this.validatePath(relativePath);
    const { encoding = 'utf-8', mode = this.fileMode, createDirs = true } = options;

    if (createDirs) {
      const dir = path.dirname(absolutePath);
      fs.mkdirSync(dir, { recursive: true, mode: this.dirMode });
    }

    fs.writeFileSync(absolutePath, content, { encoding, mode });

    this.logFileOperation('file_created', absolutePath, 'write');
  }

  // ============================================================
  // Read Operations
  // ============================================================

  /**
   * Read file with path validation and symlink check
   *
   * @param relativePath - Path relative to project root
   * @param options - Read options
   * @returns File content
   * @throws PathTraversalError if path or symlink target escapes project root
   */
  public async readFile(relativePath: string, options: ReadOptions = {}): Promise<string> {
    // Use symlink validation to prevent reading files outside allowed directories via symlinks
    const absolutePath = await this.validatePathWithSymlinkCheck(relativePath);
    const { encoding = 'utf-8' } = options;

    const content = await fs.promises.readFile(absolutePath, encoding);

    this.logFileOperation('secret_accessed', absolutePath, 'read');

    return content;
  }

  /**
   * Read file synchronously with path validation and symlink check
   *
   * @param relativePath - Path relative to project root
   * @param options - Read options
   * @returns File content
   * @throws PathTraversalError if path or symlink target escapes project root
   */
  public readFileSync(relativePath: string, options: ReadOptions = {}): string {
    // Use symlink validation to prevent reading files outside allowed directories via symlinks
    const absolutePath = this.validatePathWithSymlinkCheckSync(relativePath);
    const { encoding = 'utf-8' } = options;

    const content = fs.readFileSync(absolutePath, encoding);

    this.logFileOperation('secret_accessed', absolutePath, 'read');

    return content;
  }

  /**
   * Read file as buffer with path validation and symlink check
   *
   * @param relativePath - Path relative to project root
   * @returns File content as buffer
   * @throws PathTraversalError if path or symlink target escapes project root
   */
  public async readFileBuffer(relativePath: string): Promise<Buffer> {
    // Use symlink validation to prevent reading files outside allowed directories via symlinks
    const absolutePath = await this.validatePathWithSymlinkCheck(relativePath);
    return fs.promises.readFile(absolutePath);
  }

  // ============================================================
  // Append Operations
  // ============================================================

  /**
   * Append to file with path validation
   *
   * @param relativePath - Path relative to project root
   * @param content - Content to append
   * @param options - Write options
   * @throws PathTraversalError if path escapes project root
   */
  public async appendFile(
    relativePath: string,
    content: string | Buffer,
    options: WriteOptions = {}
  ): Promise<void> {
    const absolutePath = this.validatePath(relativePath);
    const { encoding = 'utf-8', mode = this.fileMode, createDirs = true } = options;

    if (createDirs) {
      const dir = path.dirname(absolutePath);
      await fs.promises.mkdir(dir, { recursive: true, mode: this.dirMode });
    }

    await fs.promises.appendFile(absolutePath, content, { encoding, mode });

    this.logFileOperation('file_modified', absolutePath, 'append');
  }

  /**
   * Append to file synchronously with path validation
   *
   * @param relativePath - Path relative to project root
   * @param content - Content to append
   * @param options - Write options
   * @throws PathTraversalError if path escapes project root
   */
  public appendFileSync(
    relativePath: string,
    content: string | Buffer,
    options: WriteOptions = {}
  ): void {
    const absolutePath = this.validatePath(relativePath);
    const { encoding = 'utf-8', mode = this.fileMode, createDirs = true } = options;

    if (createDirs) {
      const dir = path.dirname(absolutePath);
      fs.mkdirSync(dir, { recursive: true, mode: this.dirMode });
    }

    fs.appendFileSync(absolutePath, content, { encoding, mode });

    this.logFileOperation('file_modified', absolutePath, 'append');
  }

  // ============================================================
  // Directory Operations
  // ============================================================

  /**
   * Create directory with path validation
   *
   * @param relativePath - Path relative to project root
   * @param options - Mkdir options
   * @throws PathTraversalError if path escapes project root
   */
  public async mkdir(relativePath: string, options: MkdirOptions = {}): Promise<void> {
    const absolutePath = this.validatePath(relativePath);
    const { recursive = true, mode = this.dirMode } = options;

    await fs.promises.mkdir(absolutePath, { recursive, mode });

    this.logFileOperation('file_created', absolutePath, 'mkdir');
  }

  /**
   * Create directory synchronously with path validation
   *
   * @param relativePath - Path relative to project root
   * @param options - Mkdir options
   * @throws PathTraversalError if path escapes project root
   */
  public mkdirSync(relativePath: string, options: MkdirOptions = {}): void {
    const absolutePath = this.validatePath(relativePath);
    const { recursive = true, mode = this.dirMode } = options;

    fs.mkdirSync(absolutePath, { recursive, mode });

    this.logFileOperation('file_created', absolutePath, 'mkdir');
  }

  /**
   * Read directory contents with path validation
   *
   * @param relativePath - Path relative to project root
   * @returns Directory entries
   * @throws PathTraversalError if path escapes project root
   */
  public async readdir(relativePath: string): Promise<string[]> {
    const absolutePath = this.validatePath(relativePath);
    return fs.promises.readdir(absolutePath);
  }

  /**
   * Read directory contents with file types
   *
   * @param relativePath - Path relative to project root
   * @returns Directory entries with file type information
   * @throws PathTraversalError if path escapes project root
   */
  public async readdirWithTypes(relativePath: string): Promise<fs.Dirent[]> {
    const absolutePath = this.validatePath(relativePath);
    return fs.promises.readdir(absolutePath, { withFileTypes: true });
  }

  // ============================================================
  // Delete Operations
  // ============================================================

  /**
   * Delete file with path validation
   *
   * @param relativePath - Path relative to project root
   * @throws PathTraversalError if path escapes project root
   */
  public async unlink(relativePath: string): Promise<void> {
    const absolutePath = this.validatePath(relativePath);

    await fs.promises.unlink(absolutePath);

    this.logFileOperation('file_deleted', absolutePath, 'unlink');
  }

  /**
   * Delete file synchronously with path validation
   *
   * @param relativePath - Path relative to project root
   * @throws PathTraversalError if path escapes project root
   */
  public unlinkSync(relativePath: string): void {
    const absolutePath = this.validatePath(relativePath);

    fs.unlinkSync(absolutePath);

    this.logFileOperation('file_deleted', absolutePath, 'unlink');
  }

  /**
   * Remove file or directory recursively with path validation
   *
   * @param relativePath - Path relative to project root
   * @throws PathTraversalError if path escapes project root
   */
  public async rm(relativePath: string): Promise<void> {
    const absolutePath = this.validatePath(relativePath);

    await fs.promises.rm(absolutePath, { recursive: true, force: true });

    this.logFileOperation('file_deleted', absolutePath, 'rm');
  }

  // ============================================================
  // Existence and Stat Operations
  // ============================================================

  /**
   * Check if path exists with validation
   *
   * @param relativePath - Path relative to project root
   * @returns True if path exists
   * @throws PathTraversalError if path escapes project root
   */
  public async exists(relativePath: string): Promise<boolean> {
    const absolutePath = this.validatePath(relativePath);

    try {
      await fs.promises.access(absolutePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path exists synchronously with validation
   *
   * @param relativePath - Path relative to project root
   * @returns True if path exists
   * @throws PathTraversalError if path escapes project root
   */
  public existsSync(relativePath: string): boolean {
    const absolutePath = this.validatePath(relativePath);

    try {
      fs.accessSync(absolutePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats with path validation
   *
   * @param relativePath - Path relative to project root
   * @returns File stats
   * @throws PathTraversalError if path escapes project root
   */
  public async stat(relativePath: string): Promise<fs.Stats> {
    const absolutePath = this.validatePath(relativePath);
    return fs.promises.stat(absolutePath);
  }

  /**
   * Get file stats synchronously with path validation
   *
   * @param relativePath - Path relative to project root
   * @returns File stats
   * @throws PathTraversalError if path escapes project root
   */
  public statSync(relativePath: string): fs.Stats {
    const absolutePath = this.validatePath(relativePath);
    return fs.statSync(absolutePath);
  }

  // ============================================================
  // Rename/Move Operations
  // ============================================================

  /**
   * Rename/move file with path validation
   *
   * @param oldPath - Current path relative to project root
   * @param newPath - New path relative to project root
   * @throws PathTraversalError if either path escapes project root
   */
  public async rename(oldPath: string, newPath: string): Promise<void> {
    const absoluteOld = this.validatePath(oldPath);
    const absoluteNew = this.validatePath(newPath);

    await fs.promises.rename(absoluteOld, absoluteNew);

    this.logFileOperation('file_modified', `${absoluteOld} -> ${absoluteNew}`, 'rename');
  }

  /**
   * Rename/move file synchronously with path validation
   *
   * @param oldPath - Current path relative to project root
   * @param newPath - New path relative to project root
   * @throws PathTraversalError if either path escapes project root
   */
  public renameSync(oldPath: string, newPath: string): void {
    const absoluteOld = this.validatePath(oldPath);
    const absoluteNew = this.validatePath(newPath);

    fs.renameSync(absoluteOld, absoluteNew);

    this.logFileOperation('file_modified', `${absoluteOld} -> ${absoluteNew}`, 'rename');
  }

  // ============================================================
  // Copy Operations
  // ============================================================

  /**
   * Copy file with path validation
   *
   * @param srcPath - Source path relative to project root
   * @param destPath - Destination path relative to project root
   * @throws PathTraversalError if either path escapes project root
   */
  public async copyFile(srcPath: string, destPath: string): Promise<void> {
    const absoluteSrc = this.validatePath(srcPath);
    const absoluteDest = this.validatePath(destPath);

    // Ensure destination directory exists
    const destDir = path.dirname(absoluteDest);
    await fs.promises.mkdir(destDir, { recursive: true, mode: this.dirMode });

    await fs.promises.copyFile(absoluteSrc, absoluteDest);

    this.logFileOperation('file_created', absoluteDest, 'copy');
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Get the project root path
   */
  public getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get absolute path for a relative path (with validation)
   *
   * @param relativePath - Path relative to project root
   * @returns Absolute path
   * @throws PathTraversalError if path escapes project root
   */
  public getAbsolutePath(relativePath: string): string {
    return this.validatePath(relativePath);
  }

  /**
   * Get relative path from absolute path
   *
   * @param absolutePath - Absolute path
   * @returns Path relative to project root
   */
  public getRelativePath(absolutePath: string): string {
    return path.relative(this.projectRoot, absolutePath);
  }

  /**
   * Join path segments and validate
   *
   * @param segments - Path segments to join
   * @returns Validated absolute path
   * @throws PathTraversalError if result escapes project root
   */
  public join(...segments: string[]): string {
    const joined = path.join(...segments);
    return this.validatePath(joined);
  }

  // ============================================================
  // File Watching Operations
  // ============================================================

  /**
   * Watch a file or directory for changes with security validation
   *
   * @param relativePath - Path relative to project root
   * @param callback - Callback function for change events
   * @param config - Watcher configuration
   * @returns Handle to control the watcher
   * @throws PathTraversalError if path escapes project root
   */
  public watch(
    relativePath: string,
    callback: FileWatchCallback,
    config: FileWatcherConfig = {}
  ): FileWatcherHandle {
    const absolutePath = this.validatePath(relativePath);
    const watcherId = randomUUID();
    const {
      recursive = true,
      debounceMs = 100,
      patterns,
      followSymlinks = false,
      validateSymlinkTargets = true,
      enableAuditLog = true,
    } = config;

    // Security check: ensure path exists and is accessible
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Watch target does not exist: ${relativePath}`);
    }

    // Security check: validate symlink target if it's a symlink
    if (validateSymlinkTargets && this.validateSymlinks) {
      const stats = fs.lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        this.validateSymlinkTargetSync(absolutePath);
      }
    }

    const resolvedConfig: FileWatcherConfig = {
      recursive,
      debounceMs,
      followSymlinks,
      validateSymlinkTargets,
      enableAuditLog,
      ...(patterns !== undefined ? { patterns } : {}),
    };

    const watcherState: WatcherState = {
      watcher: null as unknown as fs.FSWatcher,
      callback,
      config: resolvedConfig,
      watchPath: absolutePath,
      debounceTimers: new Map(),
      active: true,
    };

    // Determine if watching a file or directory
    const watchStats = fs.statSync(absolutePath);
    const isWatchingFile = watchStats.isFile();

    // Create the file system watcher
    const fsWatcher = fs.watch(
      absolutePath,
      { recursive: isWatchingFile ? false : recursive, persistent: true },
      (eventType, filename) => {
        if (!watcherState.active) {
          return;
        }

        // For file watching, filename may be null or the basename
        let changedPath: string;
        let changedRelativePath: string;

        if (isWatchingFile) {
          changedPath = absolutePath;
          changedRelativePath = path.relative(this.projectRoot, absolutePath);
        } else {
          if (filename === null) {
            return;
          }
          changedPath = path.join(absolutePath, filename);
          changedRelativePath = path.relative(this.projectRoot, changedPath);
        }

        // Security filter: ensure changed path is within allowed boundaries
        if (!this.isPathWithinBoundary(changedPath)) {
          this.logFileOperation('security_violation', changedPath, 'watch_boundary_violation');
          return;
        }

        // Pattern filter (skip for file watching)
        if (!isWatchingFile) {
          const filenameToCheck = filename ?? path.basename(changedPath);
          if (!this.matchesPatternFilter(filenameToCheck, patterns)) {
            return;
          }
        }

        // Symlink security check
        if (validateSymlinkTargets && this.validateSymlinks) {
          try {
            const stats = fs.lstatSync(changedPath);
            if (stats.isSymbolicLink()) {
              this.validateSymlinkTargetSync(changedPath);
            }
          } catch {
            // File may have been deleted, which is OK
          }
        }

        // Debounce the event
        this.debounceWatchEvent(
          watcherState,
          watcherId,
          changedRelativePath,
          changedPath,
          eventType as 'change' | 'rename',
          debounceMs
        );
      }
    );

    fsWatcher.on('error', (error) => {
      const event: FileWatchEvent = {
        type: 'error',
        path: relativePath,
        absolutePath,
        timestamp: new Date(),
        error,
      };
      void callback(event);
    });

    watcherState.watcher = fsWatcher;
    this.watchers.set(watcherId, watcherState);

    // Audit log
    if (enableAuditLog) {
      this.logFileOperation('file_watched', absolutePath, 'watch_start');
    }

    return {
      id: watcherId,
      watchPath: relativePath,
      close: (): void => {
        this.unwatch(watcherId);
      },
      isActive: (): boolean => watcherState.active,
    };
  }

  /**
   * Stop watching a specific path
   *
   * @param watcherId - Watcher handle ID to stop
   */
  public unwatch(watcherId: string): void {
    const watcherState = this.watchers.get(watcherId);
    if (watcherState === undefined) {
      return;
    }

    watcherState.active = false;
    watcherState.watcher.close();

    // Clear all pending debounce timers
    for (const timer of watcherState.debounceTimers.values()) {
      clearTimeout(timer);
    }
    watcherState.debounceTimers.clear();

    this.logFileOperation('file_watch_stopped', watcherState.watchPath, 'watch_stop');
    this.watchers.delete(watcherId);
  }

  /**
   * Stop all active watchers
   */
  public unwatchAll(): void {
    for (const watcherId of this.watchers.keys()) {
      this.unwatch(watcherId);
    }
  }

  /**
   * Get all active watcher handles
   *
   * @returns Array of active watcher handles
   */
  public getActiveWatchers(): FileWatcherHandle[] {
    const handles: FileWatcherHandle[] = [];

    for (const [id, state] of this.watchers.entries()) {
      if (state.active) {
        handles.push({
          id,
          watchPath: path.relative(this.projectRoot, state.watchPath),
          close: (): void => {
            this.unwatch(id);
          },
          isActive: (): boolean => state.active,
        });
      }
    }

    return handles;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Debounce file watch events
   */
  private debounceWatchEvent(
    watcherState: WatcherState,
    watcherId: string,
    relativePath: string,
    absolutePath: string,
    eventType: 'change' | 'rename',
    debounceMs: number
  ): void {
    const key = `${watcherId}:${relativePath}`;

    // Clear existing timer for this path
    const existingTimer = watcherState.debounceTimers.get(key);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      watcherState.debounceTimers.delete(key);

      if (!watcherState.active) {
        return;
      }

      // Determine the actual event type
      let type: FileWatchEventType;
      if (eventType === 'rename') {
        // Check if file exists to determine add vs unlink
        type = fs.existsSync(absolutePath) ? 'add' : 'unlink';
      } else {
        type = 'change';
      }

      const event: FileWatchEvent = {
        type,
        path: relativePath,
        absolutePath,
        timestamp: new Date(),
      };

      void watcherState.callback(event);
    }, debounceMs);

    watcherState.debounceTimers.set(key, timer);
  }

  /**
   * Check if a path is within the security boundary
   */
  private isPathWithinBoundary(absolutePath: string): boolean {
    try {
      // Check if within project root
      const relativePath = path.relative(this.projectRoot, absolutePath);
      if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
        return true;
      }

      // Check allowed external directories
      const allowedDirs = this.resolver.getAllowedExternalDirs();
      for (const dir of allowedDirs) {
        const relToAllowed = path.relative(dir, absolutePath);
        if (!relToAllowed.startsWith('..') && !path.isAbsolute(relToAllowed)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if a filename matches the pattern filter
   */
  private matchesPatternFilter(
    filename: string,
    patterns?: { readonly include?: readonly string[]; readonly exclude?: readonly string[] }
  ): boolean {
    if (patterns === undefined) {
      return true;
    }

    const { include, exclude } = patterns;

    // Check exclude patterns first
    if (exclude !== undefined && exclude.length > 0) {
      for (const pattern of exclude) {
        if (this.matchGlob(filename, pattern)) {
          return false;
        }
      }
    }

    // If no include patterns, accept all (that weren't excluded)
    if (include === undefined || include.length === 0) {
      return true;
    }

    // Check include patterns
    for (const pattern of include) {
      if (this.matchGlob(filename, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple glob pattern matching for file names
   * Supports: * (any chars), ? (single char), ** (recursive)
   */
  private matchGlob(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*\*/g, '.*') // ** matches anything including /
      .replace(/\*/g, '[^/]*') // * matches any chars except /
      .replace(/\?/g, '.'); // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }

  /**
   * Validate that a symlink target is within allowed boundaries (sync)
   */
  private validateSymlinkTargetSync(absolutePath: string): void {
    try {
      const realPath = fs.realpathSync(absolutePath);

      if (!this.isPathWithinBoundary(realPath)) {
        throw new PathTraversalError(
          `Symbolic link target escapes allowed directories: ${absolutePath} -> ${realPath}`
        );
      }
    } catch (error) {
      if (error instanceof PathTraversalError) {
        throw error;
      }
      // If we can't resolve the symlink, treat it as a security violation
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new PathTraversalError(`Cannot validate symbolic link target: ${absolutePath}`);
      }
    }
  }

  /**
   * Log file operation to audit log
   */
  private logFileOperation(type: AuditEventType, resource: string, action: string): void {
    if (!this.enableAuditLog) {
      return;
    }

    try {
      const logger = getAuditLogger();
      logger.log({
        type,
        actor: this.actor,
        resource,
        action,
        result: 'success',
      });
    } catch {
      // Silently ignore audit logging errors
    }
  }
}

/**
 * Singleton instance cache for global access
 */
const instanceCache = new Map<string, SecureFileOps>();

/**
 * Get or create a SecureFileOps instance for a project root
 *
 * @param config - Configuration options
 * @returns SecureFileOps instance
 */
export function getSecureFileOps(config: SecureFileOpsConfig): SecureFileOps {
  const key = path.resolve(config.projectRoot);

  let instance = instanceCache.get(key);
  if (instance === undefined) {
    instance = new SecureFileOps(config);
    instanceCache.set(key, instance);
  }

  return instance;
}

/**
 * Create a new SecureFileOps instance (without caching)
 *
 * @param config - Configuration options
 * @returns New SecureFileOps instance
 */
export function createSecureFileOps(config: SecureFileOpsConfig): SecureFileOps {
  return new SecureFileOps(config);
}

/**
 * Reset all cached SecureFileOps instances (for testing)
 */
export function resetSecureFileOps(): void {
  instanceCache.clear();
}
