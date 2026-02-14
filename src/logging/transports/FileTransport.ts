/**
 * FileTransport - File log transport implementation
 *
 * Implements ILogTransport for file-based logging with support for
 * log rotation by size and date, file compression, and automatic cleanup.
 *
 * @module logging/transports
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { BaseTransport } from './BaseTransport.js';
import type { TransportLogEntry, FileTransportConfig } from './types.js';

/**
 * Default max file size (10MB)
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Default max files to keep
 */
const DEFAULT_MAX_FILES = 5;

/**
 * Default file name pattern
 */
const DEFAULT_FILE_NAME_PATTERN = 'app-%DATE%.jsonl';

/**
 * File log transport implementation
 *
 * Supports:
 * - Size-based log rotation
 * - Date-based log rotation
 * - Automatic compression of rotated files
 * - Automatic cleanup of old log files
 *
 * @example
 * ```typescript
 * const transport = new FileTransport({
 *   type: 'file',
 *   path: '.logs',
 *   maxFileSize: 10 * 1024 * 1024, // 10MB
 *   maxFiles: 5,
 *   compress: true,
 * });
 *
 * await transport.initialize();
 * await transport.log({
 *   timestamp: new Date(),
 *   level: 'INFO',
 *   message: 'Application started',
 *   context: {},
 * });
 * ```
 */
export class FileTransport extends BaseTransport {
  /**
   * Log directory path
   */
  private readonly logDir: string;

  /**
   * Maximum file size before rotation
   */
  private readonly maxFileSize: number;

  /**
   * Maximum number of files to keep
   */
  private readonly maxFiles: number;

  /**
   * File name pattern
   */
  private readonly fileNamePattern: string;

  /**
   * Whether to compress rotated files
   */
  private readonly compress: boolean;

  /**
   * Date pattern for file names (e.g., 'daily', 'hourly')
   */
  private readonly datePattern: string | undefined;

  /**
   * Current log file path
   */
  private currentFilePath: string | null = null;

  /**
   * Current file size in bytes
   */
  private currentFileSize = 0;

  /**
   * File stream for writing
   */
  private writeStream: fs.WriteStream | null = null;

  /**
   * Last date string for date-based rotation
   */
  private lastDateString: string | null = null;

  /**
   * Create a new FileTransport instance
   *
   * @param config - File transport configuration
   */
  constructor(config: FileTransportConfig) {
    super('file', config);

    this.logDir = config.path;
    this.maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES;
    this.fileNamePattern = config.fileNamePattern ?? DEFAULT_FILE_NAME_PATTERN;
    this.compress = config.compress ?? false;
    this.datePattern = config.datePattern;
  }

  /**
   * Initialize the file transport
   *
   * Creates log directory and initial log file.
   */
  protected async doInitialize(): Promise<void> {
    // Ensure log directory exists
    await this.ensureDirectory(this.logDir);

    // Create initial log file
    this.createNewLogFile();
  }

  /**
   * Log entries to file
   *
   * @param entries - Log entries to write
   */
  protected async doLog(entries: TransportLogEntry[]): Promise<void> {
    for (const entry of entries) {
      // Check if rotation is needed
      if (this.needsRotation()) {
        await this.rotate();
      }

      const line = this.formatEntry(entry);
      await this.writeLine(line);
    }
  }

  /**
   * Flush file buffer
   */
  protected async doFlush(): Promise<void> {
    if (this.writeStream !== null) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream?.once('drain', resolve);
        this.writeStream?.once('error', reject);
        // If already flushed, resolve immediately
        if (this.writeStream?.writableNeedDrain === false) {
          resolve();
        }
      });
    }
  }

  /**
   * Close the file transport
   *
   * Closes write stream and compresses current file if enabled.
   */
  protected async doClose(): Promise<void> {
    if (this.writeStream !== null) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream?.once('close', resolve);
        this.writeStream?.once('error', reject);
        this.writeStream?.end();
      });
      this.writeStream = null;
    }
  }

  /**
   * Ensure directory exists
   *
   * @param dirPath - Absolute or relative path of the directory to create if missing
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Create a new log file
   */
  private createNewLogFile(): void {
    // Close existing stream
    if (this.writeStream !== null) {
      this.writeStream.end();
      this.writeStream = null;
    }

    // Generate new file name
    const dateString = this.getDateString();
    this.lastDateString = dateString;

    const fileName = this.fileNamePattern.replace('%DATE%', dateString);
    this.currentFilePath = path.join(this.logDir, fileName);
    this.currentFileSize = 0;

    // Check if file already exists and get its size
    if (fs.existsSync(this.currentFilePath)) {
      const stats = fs.statSync(this.currentFilePath);
      this.currentFileSize = stats.size;
    } else {
      // Create empty file to ensure it exists
      fs.closeSync(fs.openSync(this.currentFilePath, 'a'));
    }

    // Create write stream with append mode
    this.writeStream = fs.createWriteStream(this.currentFilePath, {
      flags: 'a',
      mode: 0o644,
      encoding: 'utf8',
    });

    // Handle stream errors
    this.writeStream.on('error', (error) => {
      this.handleError('Write stream error', error);
    });

    // Clean up old files
    void this.cleanupOldFiles();
  }

  /**
   * Get date string for file name
   *
   * @returns Date string formatted according to the datePattern (daily, hourly, or full timestamp)
   */
  private getDateString(): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (this.datePattern === 'daily') {
      return `${year}-${month}-${day}`;
    } else if (this.datePattern === 'hourly') {
      return `${year}-${month}-${day}-${hours}`;
    }

    // Default: include full timestamp
    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
  }

  /**
   * Check if date-based rotation is needed
   *
   * @returns True if the current date string differs from the last file's date string
   */
  private needsDateRotation(): boolean {
    if (this.datePattern === undefined) {
      return false;
    }

    const currentDateString = this.getDateString();
    return currentDateString !== this.lastDateString;
  }

  /**
   * Check if rotation is needed
   *
   * @returns True if the current file exceeds maxFileSize or the date period has changed
   */
  private needsRotation(): boolean {
    // Check date-based rotation first
    if (this.needsDateRotation()) {
      return true;
    }

    // Check size-based rotation
    return this.currentFileSize >= this.maxFileSize;
  }

  /**
   * Rotate log file
   */
  private async rotate(): Promise<void> {
    const oldFilePath = this.currentFilePath;

    // Create new log file
    this.createNewLogFile();

    // Compress old file if enabled
    if (this.compress && oldFilePath !== null && fs.existsSync(oldFilePath)) {
      await this.compressFile(oldFilePath);
    }
  }

  /**
   * Compress a log file
   *
   * @param filePath - Path to the log file to gzip-compress and replace with a .gz archive
   */
  private async compressFile(filePath: string): Promise<void> {
    const gzPath = `${filePath}.gz`;

    try {
      const content = await fs.promises.readFile(filePath);
      const compressed = await new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(content, { level: 6 }, (err, result) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      await fs.promises.writeFile(gzPath, compressed, { mode: 0o644 });
      await fs.promises.unlink(filePath);
    } catch (error) {
      this.handleError('Compression error', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files
        .filter((f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
        .map((f) => ({
          name: f,
          path: path.join(this.logDir, f),
          isCompressed: f.endsWith('.gz'),
        }));

      // Get file stats and sort by mtime
      const filesWithStats = await Promise.all(
        logFiles.map(async (f) => {
          const stats = await fs.promises.stat(f.path);
          return { ...f, mtime: stats.mtime.getTime() };
        })
      );

      // Sort by modification time (newest first)
      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      // Remove files beyond the limit
      const filesToDelete = filesWithStats.slice(this.maxFiles);
      for (const file of filesToDelete) {
        try {
          await fs.promises.unlink(file.path);
        } catch {
          // Ignore deletion errors
        }
      }
    } catch (error) {
      this.handleError('Cleanup error', error);
    }
  }

  /**
   * Format entry as JSON line
   *
   * @param entry - Log entry to serialize into a single-line JSON (JSONL) string
   * @returns JSON string containing all non-empty fields from the log entry
   */
  private formatEntry(entry: TransportLogEntry): string {
    const jsonEntry: Record<string, unknown> = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
    };

    // Add optional fields
    if (entry.correlationId !== undefined) {
      jsonEntry['correlationId'] = entry.correlationId;
    }
    if (entry.agentId !== undefined) {
      jsonEntry['agentId'] = entry.agentId;
    }
    if (entry.traceId !== undefined) {
      jsonEntry['traceId'] = entry.traceId;
    }
    if (entry.spanId !== undefined) {
      jsonEntry['spanId'] = entry.spanId;
    }
    if (entry.parentSpanId !== undefined) {
      jsonEntry['parentSpanId'] = entry.parentSpanId;
    }
    if (entry.stage !== undefined) {
      jsonEntry['stage'] = entry.stage;
    }
    if (entry.projectId !== undefined) {
      jsonEntry['projectId'] = entry.projectId;
    }
    if (entry.sessionId !== undefined) {
      jsonEntry['sessionId'] = entry.sessionId;
    }
    if (entry.durationMs !== undefined) {
      jsonEntry['durationMs'] = entry.durationMs;
    }
    if (entry.error !== undefined) {
      jsonEntry['error'] = entry.error;
    }
    if (entry.source !== undefined) {
      jsonEntry['source'] = entry.source;
    }
    if (entry.hostname !== undefined) {
      jsonEntry['hostname'] = entry.hostname;
    }
    if (entry.pid !== undefined) {
      jsonEntry['pid'] = entry.pid;
    }
    if (Object.keys(entry.context).length > 0) {
      jsonEntry['context'] = entry.context;
    }

    return JSON.stringify(jsonEntry);
  }

  /**
   * Write a line to the current log file
   *
   * @param line - Formatted log line to append with a trailing newline
   */
  private async writeLine(line: string): Promise<void> {
    const lineWithNewline = `${line}\n`;
    const byteLength = Buffer.byteLength(lineWithNewline, 'utf8');

    if (this.writeStream !== null) {
      const canWrite = this.writeStream.write(lineWithNewline);
      this.currentFileSize += byteLength;

      // Wait for drain if buffer is full
      if (!canWrite) {
        await new Promise<void>((resolve) => {
          this.writeStream?.once('drain', resolve);
        });
      }
    } else {
      // Fallback to sync write if stream not available
      if (this.currentFilePath !== null) {
        await fs.promises.appendFile(this.currentFilePath, lineWithNewline, {
          mode: 0o644,
          encoding: 'utf8',
        });
        this.currentFileSize += byteLength;
      }
    }
  }

  /**
   * Get the current log file path
   *
   * @returns Absolute path to the active log file, or null if not yet initialized
   */
  public getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  /**
   * Get the log directory path
   *
   * @returns Configured directory path where log files are stored
   */
  public getLogDir(): string {
    return this.logDir;
  }

  /**
   * Get list of log files in the directory
   *
   * @returns Sorted array of absolute paths to .jsonl and .jsonl.gz files in the log directory
   */
  public async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.logDir);
      return files
        .filter((f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
        .map((f) => path.join(this.logDir, f))
        .sort();
    } catch {
      return [];
    }
  }
}
