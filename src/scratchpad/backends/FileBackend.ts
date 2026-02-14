/**
 * File-based backend for Scratchpad
 *
 * Stores data in YAML or JSON files on the local filesystem.
 * This is the default backend that maintains backward compatibility
 * with existing Scratchpad file structure.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as yaml from 'js-yaml';
import type { IScratchpadBackend, BatchOperation, BackendHealth } from './IScratchpadBackend.js';
import type { FileBackendConfig } from './types.js';
import { DEFAULT_PATHS } from '../../config/paths.js';

/**
 * Default values
 */
const DEFAULT_BASE_PATH = DEFAULT_PATHS.SCRATCHPAD;
const DEFAULT_FILE_MODE = 0o600;
const DEFAULT_DIR_MODE = 0o700;
const DEFAULT_FORMAT = 'yaml';

/**
 * File extension for each format
 */
const FORMAT_EXTENSIONS: Record<'yaml' | 'json' | 'raw', string> = {
  yaml: '.yaml',
  json: '.json',
  raw: '',
};

/**
 * File-based storage backend
 *
 * Implements IScratchpadBackend using the filesystem with YAML or JSON
 * serialization. Provides atomic writes using temp files and rename.
 */
export class FileBackend implements IScratchpadBackend {
  public readonly name = 'file';

  private readonly basePath: string;
  private readonly fileMode: number;
  private readonly dirMode: number;
  private readonly format: 'yaml' | 'json' | 'raw';
  private readonly extension: string;

  constructor(config: FileBackendConfig = {}) {
    this.basePath = config.basePath ?? DEFAULT_BASE_PATH;
    this.fileMode = config.fileMode ?? DEFAULT_FILE_MODE;
    this.dirMode = config.dirMode ?? DEFAULT_DIR_MODE;
    this.format = config.format ?? DEFAULT_FORMAT;
    this.extension = FORMAT_EXTENSIONS[this.format];
  }

  /**
   * Get the file path for a section/key combination
   * @param section - Storage section name
   * @param key - Entry key within the section
   * @returns The absolute file path for the entry
   */
  private getFilePath(section: string, key: string): string {
    return path.join(this.basePath, section, `${key}${this.extension}`);
  }

  /**
   * Get the section directory path
   * @param section - Storage section name
   * @returns The absolute directory path for the section
   */
  private getSectionPath(section: string): string {
    return path.join(this.basePath, section);
  }

  /**
   * Serialize data to string
   * @param data - The data to serialize
   * @returns The serialized string representation
   */
  private serialize(data: unknown): string {
    if (this.format === 'raw') {
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
    if (this.format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    return yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
  }

  /**
   * Deserialize string to data
   * @param content - The serialized string to deserialize
   * @returns The deserialized data
   */
  private deserialize(content: string): unknown {
    if (this.format === 'raw') {
      return content;
    }
    if (this.format === 'json') {
      return JSON.parse(content) as unknown;
    }
    return yaml.load(content);
  }

  /**
   * Ensure a directory exists
   * @param dirPath - The directory path to create if missing
   */
  private async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true, mode: this.dirMode });
  }

  /**
   * Write file atomically (write to temp, then rename)
   * @param filePath - The target file path
   * @param content - The content to write
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    const tempPath = `${filePath}.${randomUUID()}.tmp`;

    try {
      await this.ensureDir(dir);
      await fs.promises.writeFile(tempPath, content, {
        encoding: 'utf8',
        mode: this.fileMode,
      });
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Initialize the file backend by ensuring the base directory exists
   */
  async initialize(): Promise<void> {
    await this.ensureDir(this.basePath);
  }

  /**
   * Read a value from the filesystem by section and key
   * @param section - Storage section name
   * @param key - Entry key within the section
   * @returns The deserialized value, or null if the file does not exist
   */
  async read<T>(section: string, key: string): Promise<T | null> {
    const filePath = this.getFilePath(section, key);

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return this.deserialize(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a value to the filesystem under the given section and key
   * @param section - Storage section name
   * @param key - Entry key within the section
   * @param value - The value to serialize and store
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  async write<T>(section: string, key: string, value: T): Promise<void> {
    const filePath = this.getFilePath(section, key);
    const content = this.serialize(value);
    await this.atomicWrite(filePath, content);
  }

  /**
   * Delete a file entry by section and key
   * @param section - Storage section name
   * @param key - Entry key within the section
   * @returns True if the file was deleted, false if it did not exist
   */
  async delete(section: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(section, key);

    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all keys within a section directory
   * @param section - Storage section name
   * @returns Array of key names in the section
   */
  async list(section: string): Promise<string[]> {
    const sectionPath = this.getSectionPath(section);

    try {
      const entries = await fs.promises.readdir(sectionPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(this.extension))
        .map((entry) => entry.name.slice(0, -this.extension.length));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a file entry exists
   * @param section - Storage section name
   * @param key - Entry key within the section
   * @returns True if the file exists
   */
  async exists(section: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(section, key);

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute multiple operations sequentially
   * @param operations - Array of batch operations to execute
   */
  async batch(operations: BatchOperation[]): Promise<void> {
    // File backend doesn't have true transactions, so we execute sequentially
    // For atomicity, we could use a journal-based approach, but that's complex
    // For now, we execute operations one by one
    for (const op of operations) {
      if (op.type === 'write') {
        await this.write(op.section, op.key, op.value);
      } else {
        await this.delete(op.section, op.key);
      }
    }
  }

  /**
   * Check the health of the file backend
   * @returns Health status including filesystem accessibility and latency
   */
  async healthCheck(): Promise<BackendHealth> {
    try {
      const startTime = Date.now();
      // Check if base path is accessible
      await fs.promises.access(this.basePath, fs.constants.R_OK | fs.constants.W_OK);
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        message: 'File backend is healthy',
        latencyMs,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `File backend error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Close the file backend (no-op as there are no resources to release)
   */
  async close(): Promise<void> {
    // No resources to release for file backend
  }
}
