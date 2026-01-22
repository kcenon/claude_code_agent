/**
 * SecureFileHandler - Secure temporary file handling
 *
 * Features:
 * - Secure temporary file creation
 * - Automatic cleanup on exit
 * - Restricted file permissions
 * - Safe file operations
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { SecureFileHandlerOptions } from './types.js';
import type { Logger } from '../logging/index.js';
import { getLogger } from '../logging/index.js';

/**
 * Default temporary file prefix
 */
const DEFAULT_TEMP_PREFIX = 'ad-sdlc-';

/**
 * Default file permission mode (owner read/write only)
 */
const DEFAULT_FILE_MODE = 0o600;

/**
 * Default directory permission mode (owner read/write/execute only)
 */
const DEFAULT_DIR_MODE = 0o700;

/**
 * Handles secure file operations with auto-cleanup
 */
export class SecureFileHandler {
  private readonly tempPrefix: string;
  private readonly autoCleanup: boolean;
  private readonly fileMode: number;
  private readonly trackedPaths: Set<string> = new Set();
  private readonly logger: Logger;
  private cleanupRegistered = false;

  constructor(options: SecureFileHandlerOptions = {}) {
    this.tempPrefix = options.tempPrefix ?? DEFAULT_TEMP_PREFIX;
    this.autoCleanup = options.autoCleanup ?? true;
    this.fileMode = options.fileMode ?? DEFAULT_FILE_MODE;
    this.logger = getLogger().child({ agent: 'SecureFileHandler' });

    if (this.autoCleanup) {
      this.registerCleanup();
    }
  }

  /**
   * Register process exit cleanup handler
   */
  private registerCleanup(): void {
    if (this.cleanupRegistered) {
      return;
    }

    const cleanup = (): void => {
      this.cleanupAllSync();
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });

    this.cleanupRegistered = true;
  }

  /**
   * Create a secure temporary directory
   *
   * @returns Path to the created temporary directory
   */
  public async createTempDir(): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), this.tempPrefix));

    // Set restrictive permissions
    await fs.promises.chmod(tempDir, DEFAULT_DIR_MODE);

    this.trackedPaths.add(tempDir);
    return tempDir;
  }

  /**
   * Create a secure temporary directory (synchronous)
   *
   * @returns Path to the created temporary directory
   */
  public createTempDirSync(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), this.tempPrefix));
    fs.chmodSync(tempDir, DEFAULT_DIR_MODE);
    this.trackedPaths.add(tempDir);
    return tempDir;
  }

  /**
   * Create a secure temporary file with content
   *
   * @param content - The content to write to the file
   * @param extension - Optional file extension (e.g., '.txt')
   * @returns Path to the created temporary file
   */
  public async createTempFile(content: string, extension = '.txt'): Promise<string> {
    const tempDir = await this.createTempDir();
    const fileName = `${randomUUID()}${extension}`;
    const tempFile = path.join(tempDir, fileName);

    await fs.promises.writeFile(tempFile, content, {
      encoding: 'utf8',
      mode: this.fileMode,
    });

    return tempFile;
  }

  /**
   * Create a secure temporary file with content (synchronous)
   *
   * @param content - The content to write to the file
   * @param extension - Optional file extension
   * @returns Path to the created temporary file
   */
  public createTempFileSync(content: string, extension = '.txt'): string {
    const tempDir = this.createTempDirSync();
    const fileName = `${randomUUID()}${extension}`;
    const tempFile = path.join(tempDir, fileName);

    fs.writeFileSync(tempFile, content, {
      encoding: 'utf8',
      mode: this.fileMode,
    });

    return tempFile;
  }

  /**
   * Write content to a file with secure permissions
   *
   * @param filePath - Path to the file
   * @param content - Content to write
   */
  public async writeSecure(filePath: string, content: string): Promise<void> {
    // Create parent directory if needed
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true, mode: DEFAULT_DIR_MODE });

    // Write with secure permissions
    await fs.promises.writeFile(filePath, content, {
      encoding: 'utf8',
      mode: this.fileMode,
    });
  }

  /**
   * Write content to a file with secure permissions (synchronous)
   *
   * @param filePath - Path to the file
   * @param content - Content to write
   */
  public writeSecureSync(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true, mode: DEFAULT_DIR_MODE });
    fs.writeFileSync(filePath, content, {
      encoding: 'utf8',
      mode: this.fileMode,
    });
  }

  /**
   * Read a file securely (verifies permissions first)
   *
   * @param filePath - Path to the file
   * @returns File content
   */
  public async readSecure(filePath: string): Promise<string> {
    const stats = await fs.promises.stat(filePath);

    // Check if file is readable by others (warning)
    const mode = stats.mode & 0o777;
    if ((mode & 0o044) !== 0) {
      this.logger.warn('File is readable by others', { filePath, mode: mode.toString(8) });
    }

    return fs.promises.readFile(filePath, 'utf8');
  }

  /**
   * Delete a file or directory securely
   *
   * @param targetPath - Path to delete
   */
  public async deleteSecure(targetPath: string): Promise<void> {
    const stats = await fs.promises.stat(targetPath);

    if (stats.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }

    this.trackedPaths.delete(targetPath);
  }

  /**
   * Delete a file or directory securely (synchronous)
   *
   * @param targetPath - Path to delete
   */
  public deleteSecureSync(targetPath: string): void {
    try {
      const stats = fs.statSync(targetPath);

      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }

      this.trackedPaths.delete(targetPath);
    } catch {
      // Ignore if already deleted
    }
  }

  /**
   * Clean up all tracked temporary files and directories
   */
  public async cleanupAll(): Promise<void> {
    const paths = Array.from(this.trackedPaths);

    for (const trackedPath of paths) {
      try {
        await this.deleteSecure(trackedPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    this.trackedPaths.clear();
  }

  /**
   * Clean up all tracked temporary files and directories (synchronous)
   */
  public cleanupAllSync(): void {
    for (const trackedPath of this.trackedPaths) {
      this.deleteSecureSync(trackedPath);
    }
    this.trackedPaths.clear();
  }

  /**
   * Check if a path is tracked for cleanup
   *
   * @param targetPath - Path to check
   */
  public isTracked(targetPath: string): boolean {
    return this.trackedPaths.has(targetPath);
  }

  /**
   * Get count of tracked paths
   */
  public getTrackedCount(): number {
    return this.trackedPaths.size;
  }

  /**
   * Manually track a path for cleanup
   *
   * @param targetPath - Path to track
   */
  public track(targetPath: string): void {
    this.trackedPaths.add(targetPath);
  }

  /**
   * Remove a path from tracking without deleting it
   *
   * @param targetPath - Path to untrack
   */
  public untrack(targetPath: string): void {
    this.trackedPaths.delete(targetPath);
  }

  /**
   * Copy a file securely with proper permissions
   *
   * @param source - Source file path
   * @param destination - Destination file path
   */
  public async copySecure(source: string, destination: string): Promise<void> {
    const content = await fs.promises.readFile(source);
    const dir = path.dirname(destination);

    await fs.promises.mkdir(dir, { recursive: true, mode: DEFAULT_DIR_MODE });
    await fs.promises.writeFile(destination, content, { mode: this.fileMode });
  }

  /**
   * Move a file securely
   *
   * @param source - Source file path
   * @param destination - Destination file path
   */
  public async moveSecure(source: string, destination: string): Promise<void> {
    await this.copySecure(source, destination);
    await fs.promises.unlink(source);

    if (this.trackedPaths.has(source)) {
      this.trackedPaths.delete(source);
      this.trackedPaths.add(destination);
    }
  }

  /**
   * Check if a file exists and is accessible
   *
   * @param filePath - Path to check
   */
  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats with security info
   *
   * @param filePath - Path to the file
   * @returns Object with file stats and security info
   */
  public async getSecureStats(filePath: string): Promise<{
    size: number;
    mode: number;
    isSecure: boolean;
    warnings: string[];
  }> {
    const stats = await fs.promises.stat(filePath);
    const mode = stats.mode & 0o777;
    const warnings: string[] = [];

    // Check for insecure permissions
    if ((mode & 0o002) !== 0) {
      warnings.push('File is world-writable');
    }
    if ((mode & 0o020) !== 0) {
      warnings.push('File is group-writable');
    }
    if ((mode & 0o004) !== 0) {
      warnings.push('File is world-readable');
    }

    return {
      size: stats.size,
      mode,
      isSecure: warnings.length === 0,
      warnings,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalFileHandler: SecureFileHandler | null = null;

/**
 * Get or create the global SecureFileHandler instance
 *
 * @param options - Options for creating new instance
 * @returns The global SecureFileHandler instance
 */
export function getSecureFileHandler(options?: SecureFileHandlerOptions): SecureFileHandler {
  if (globalFileHandler === null) {
    globalFileHandler = new SecureFileHandler(options);
  }
  return globalFileHandler;
}

/**
 * Reset the global SecureFileHandler instance (for testing)
 */
export function resetSecureFileHandler(): void {
  if (globalFileHandler !== null) {
    globalFileHandler.cleanupAllSync();
    globalFileHandler = null;
  }
}
