/**
 * SecureFileOps - Centralized secure file operations wrapper
 *
 * Features:
 * - Path traversal prevention via InputValidator
 * - Project root confinement
 * - Audit logging for all file operations
 * - Consistent error handling
 * - Support for both async and sync operations
 *
 * FIXME(P2): allowedExternalDirs can be bypassed with symlinks
 * If a path within projectRoot is a symlink to an external location,
 * the current validation may not catch it. Should resolve symlinks
 * before validation.
 *
 * TODO(P3): Add file change watching with security filters
 * Watch for unauthorized file modifications within the project.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PathResolver } from './PathResolver.js';
import { getAuditLogger } from './AuditLogger.js';
import type { AuditEventType } from './types.js';

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
export class SecureFileOps {
  private readonly resolver: PathResolver;
  private readonly enableAuditLog: boolean;
  private readonly actor: string;
  private readonly fileMode: number;
  private readonly dirMode: number;
  private readonly projectRoot: string;

  constructor(config: SecureFileOpsConfig) {
    this.projectRoot = path.resolve(config.projectRoot);
    this.resolver = new PathResolver({
      projectRoot: this.projectRoot,
      allowedExternalDirs: config.allowedExternalDirs ?? [],
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
   * Read file with path validation
   *
   * @param relativePath - Path relative to project root
   * @param options - Read options
   * @returns File content
   * @throws PathTraversalError if path escapes project root
   */
  public async readFile(relativePath: string, options: ReadOptions = {}): Promise<string> {
    const absolutePath = this.validatePath(relativePath);
    const { encoding = 'utf-8' } = options;

    const content = await fs.promises.readFile(absolutePath, encoding);

    this.logFileOperation('secret_accessed', absolutePath, 'read');

    return content;
  }

  /**
   * Read file synchronously with path validation
   *
   * @param relativePath - Path relative to project root
   * @param options - Read options
   * @returns File content
   * @throws PathTraversalError if path escapes project root
   */
  public readFileSync(relativePath: string, options: ReadOptions = {}): string {
    const absolutePath = this.validatePath(relativePath);
    const { encoding = 'utf-8' } = options;

    const content = fs.readFileSync(absolutePath, encoding);

    this.logFileOperation('secret_accessed', absolutePath, 'read');

    return content;
  }

  /**
   * Read file as buffer with path validation
   *
   * @param relativePath - Path relative to project root
   * @returns File content as buffer
   * @throws PathTraversalError if path escapes project root
   */
  public async readFileBuffer(relativePath: string): Promise<Buffer> {
    const absolutePath = this.validatePath(relativePath);
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
  // Private Methods
  // ============================================================

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
