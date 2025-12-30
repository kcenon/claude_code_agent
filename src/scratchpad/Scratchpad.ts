/**
 * Scratchpad - File-based state sharing between agents
 *
 * Implements the Scratchpad pattern for inter-agent communication
 * by providing structured file operations with:
 * - Atomic writes (write to temp, then rename)
 * - File locking for concurrent access
 * - YAML/JSON/Markdown helper functions
 * - Project ID management
 * - Path traversal prevention via InputValidator
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as yaml from 'js-yaml';
import { InputValidator, PathTraversalError } from '../security/index.js';
import type {
  ScratchpadOptions,
  ScratchpadSection,
  ProgressSubsection,
  DocumentType,
  AtomicWriteOptions,
  ReadOptions,
  FileLock,
  ProjectInfo,
} from './types.js';

/**
 * Default base path for scratchpad
 */
const DEFAULT_BASE_PATH = '.ad-sdlc/scratchpad';

/**
 * Default file permission mode (owner read/write only)
 */
const DEFAULT_FILE_MODE = 0o600;

/**
 * Default directory permission mode (owner read/write/execute only)
 */
const DEFAULT_DIR_MODE = 0o700;

/**
 * Default lock timeout in milliseconds
 */
const DEFAULT_LOCK_TIMEOUT = 5000;

/**
 * Lock file extension
 */
const LOCK_EXTENSION = '.lock';

/**
 * Scratchpad implementation for file-based state sharing
 */
export class Scratchpad {
  private readonly basePath: string;
  private readonly fileMode: number;
  private readonly dirMode: number;
  private readonly enableLocking: boolean;
  private readonly lockTimeout: number;
  private readonly activeLocks: Map<string, NodeJS.Timeout> = new Map();
  private readonly validator: InputValidator;
  private readonly projectRoot: string;

  constructor(options: ScratchpadOptions = {}) {
    this.basePath = options.basePath ?? DEFAULT_BASE_PATH;
    this.fileMode = options.fileMode ?? DEFAULT_FILE_MODE;
    this.dirMode = options.dirMode ?? DEFAULT_DIR_MODE;
    this.enableLocking = options.enableLocking ?? true;
    this.lockTimeout = options.lockTimeout ?? DEFAULT_LOCK_TIMEOUT;
    // Use projectRoot if provided, otherwise use current working directory
    this.projectRoot = options.projectRoot ?? process.cwd();
    // Initialize validator with project root to prevent path traversal
    this.validator = new InputValidator({ basePath: this.projectRoot });
  }

  // ============================================================
  // Path Validation
  // ============================================================

  /**
   * Validate that a path is within the project root
   *
   * @param filePath - Path to validate
   * @returns Validated absolute path
   * @throws PathTraversalError if path escapes project root
   */
  private validatePath(filePath: string): string {
    return this.validator.validateFilePath(filePath);
  }

  // ============================================================
  // Path Resolution
  // ============================================================

  /**
   * Get the base scratchpad directory path
   *
   * @returns Absolute path to scratchpad directory
   */
  public getBasePath(): string {
    return path.resolve(this.basePath);
  }

  /**
   * Get path to a section directory
   *
   * @param section - Scratchpad section
   * @returns Absolute path to section directory
   */
  public getSectionPath(section: ScratchpadSection): string {
    return path.join(this.getBasePath(), section);
  }

  /**
   * Get path to a project directory within a section
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @returns Absolute path to project directory
   */
  public getProjectPath(section: ScratchpadSection, projectId: string): string {
    return path.join(this.getSectionPath(section), projectId);
  }

  /**
   * Get path to collected info file
   *
   * @param projectId - Project identifier
   * @returns Path to collected_info.yaml
   */
  public getCollectedInfoPath(projectId: string): string {
    return path.join(this.getProjectPath('info', projectId), 'collected_info.yaml');
  }

  /**
   * Get path to a document file
   *
   * @param projectId - Project identifier
   * @param docType - Document type (prd, srs, sds)
   * @returns Path to document file
   */
  public getDocumentPath(projectId: string, docType: DocumentType): string {
    return path.join(this.getProjectPath('documents', projectId), `${docType}.md`);
  }

  /**
   * Get path to issue list file
   *
   * @param projectId - Project identifier
   * @returns Path to issue_list.json
   */
  public getIssueListPath(projectId: string): string {
    return path.join(this.getProjectPath('issues', projectId), 'issue_list.json');
  }

  /**
   * Get path to dependency graph file
   *
   * @param projectId - Project identifier
   * @returns Path to dependency_graph.json
   */
  public getDependencyGraphPath(projectId: string): string {
    return path.join(this.getProjectPath('issues', projectId), 'dependency_graph.json');
  }

  /**
   * Get path to controller state file
   *
   * @param projectId - Project identifier
   * @returns Path to controller_state.yaml
   */
  public getControllerStatePath(projectId: string): string {
    return path.join(this.getProjectPath('progress', projectId), 'controller_state.yaml');
  }

  /**
   * Get path to progress subsection directory
   *
   * @param projectId - Project identifier
   * @param subsection - Progress subsection
   * @returns Path to subsection directory
   */
  public getProgressSubsectionPath(projectId: string, subsection: ProgressSubsection): string {
    return path.join(this.getProjectPath('progress', projectId), subsection);
  }

  /**
   * Get path to a work order file
   *
   * @param projectId - Project identifier
   * @param orderId - Work order identifier
   * @returns Path to work order file
   */
  public getWorkOrderPath(projectId: string, orderId: string): string {
    return path.join(this.getProgressSubsectionPath(projectId, 'work_orders'), `${orderId}.yaml`);
  }

  /**
   * Get path to an implementation result file
   *
   * @param projectId - Project identifier
   * @param orderId - Work order identifier
   * @returns Path to result file
   */
  public getResultPath(projectId: string, orderId: string): string {
    return path.join(this.getProgressSubsectionPath(projectId, 'results'), `${orderId}.yaml`);
  }

  /**
   * Get path to a review file
   *
   * @param projectId - Project identifier
   * @param reviewId - Review identifier
   * @returns Path to review file
   */
  public getReviewPath(projectId: string, reviewId: string): string {
    return path.join(this.getProgressSubsectionPath(projectId, 'reviews'), `${reviewId}.yaml`);
  }

  // ============================================================
  // Project ID Management
  // ============================================================

  /**
   * Generate a new unique project ID
   *
   * @returns New project ID (format: XXX where X is 0-9)
   */
  public async generateProjectId(): Promise<string> {
    const existingIds = await this.listProjectIds();
    const maxId = existingIds.reduce((max, id) => {
      const num = parseInt(id, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return String(maxId + 1).padStart(3, '0');
  }

  /**
   * Generate a new unique project ID (synchronous)
   *
   * @returns New project ID
   */
  public generateProjectIdSync(): string {
    const existingIds = this.listProjectIdsSync();
    const maxId = existingIds.reduce((max, id) => {
      const num = parseInt(id, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return String(maxId + 1).padStart(3, '0');
  }

  /**
   * List all existing project IDs
   *
   * @returns Array of project IDs
   */
  public async listProjectIds(): Promise<string[]> {
    const documentsPath = this.getSectionPath('documents');
    try {
      const entries = await fs.promises.readdir(documentsPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  /**
   * List all existing project IDs (synchronous)
   *
   * @returns Array of project IDs
   */
  public listProjectIdsSync(): string[] {
    const documentsPath = this.getSectionPath('documents');
    try {
      const entries = fs.readdirSync(documentsPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Initialize a new project with all required directories
   *
   * @param projectId - Project identifier
   * @param name - Project name
   * @returns Project info
   */
  public async initializeProject(projectId: string, name: string): Promise<ProjectInfo> {
    // Create all section directories for the project
    const sections: ScratchpadSection[] = ['info', 'documents', 'issues', 'progress'];
    for (const section of sections) {
      await this.ensureDir(this.getProjectPath(section, projectId));
    }

    // Create progress subsections
    const subsections: ProgressSubsection[] = ['work_orders', 'results', 'reviews'];
    for (const subsection of subsections) {
      await this.ensureDir(this.getProgressSubsectionPath(projectId, subsection));
    }

    const now = new Date().toISOString();
    const projectInfo: ProjectInfo = {
      projectId,
      name,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };

    // Save project info
    const infoPath = path.join(this.getProjectPath('info', projectId), 'project.yaml');
    await this.writeYaml(infoPath, projectInfo);

    return projectInfo;
  }

  // ============================================================
  // Atomic File Operations
  // ============================================================

  /**
   * Write content atomically (write to temp file, then rename)
   *
   * @param filePath - Target file path
   * @param content - Content to write
   * @param options - Write options
   * @throws PathTraversalError if path escapes project root
   */
  public async atomicWrite(
    filePath: string,
    content: string,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    // Validate path before any file operations
    const validatedPath = this.validatePath(filePath);
    const { createDirs = true, mode = this.fileMode, encoding = 'utf8' } = options;

    const dir = path.dirname(validatedPath);
    const tempPath = `${validatedPath}.${randomUUID()}.tmp`;

    try {
      // Create parent directories if needed
      if (createDirs) {
        await this.ensureDir(dir);
      }

      // Write to temporary file
      await fs.promises.writeFile(tempPath, content, { encoding, mode });

      // Atomically rename to target
      await fs.promises.rename(tempPath, validatedPath);
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
   * Write content atomically (synchronous)
   *
   * @param filePath - Target file path
   * @param content - Content to write
   * @param options - Write options
   * @throws PathTraversalError if path escapes project root
   */
  public atomicWriteSync(
    filePath: string,
    content: string,
    options: AtomicWriteOptions = {}
  ): void {
    // Validate path before any file operations
    const validatedPath = this.validatePath(filePath);
    const { createDirs = true, mode = this.fileMode, encoding = 'utf8' } = options;

    const dir = path.dirname(validatedPath);
    const tempPath = `${validatedPath}.${randomUUID()}.tmp`;

    try {
      if (createDirs) {
        this.ensureDirSync(dir);
      }

      fs.writeFileSync(tempPath, content, { encoding, mode });
      fs.renameSync(tempPath, validatedPath);
    } catch (error) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   *
   * @param dirPath - Directory path
   * @throws PathTraversalError if path escapes project root
   */
  public async ensureDir(dirPath: string): Promise<void> {
    const validatedPath = this.validatePath(dirPath);
    await fs.promises.mkdir(validatedPath, { recursive: true, mode: this.dirMode });
  }

  /**
   * Ensure a directory exists (synchronous)
   *
   * @param dirPath - Directory path
   * @throws PathTraversalError if path escapes project root
   */
  public ensureDirSync(dirPath: string): void {
    const validatedPath = this.validatePath(dirPath);
    fs.mkdirSync(validatedPath, { recursive: true, mode: this.dirMode });
  }

  // ============================================================
  // File Locking
  // ============================================================

  /**
   * Acquire a lock on a file
   *
   * @param filePath - File to lock
   * @param holderId - Lock holder identifier
   * @returns True if lock acquired
   * @throws PathTraversalError if path escapes project root
   */
  public async acquireLock(filePath: string, holderId?: string): Promise<boolean> {
    if (!this.enableLocking) {
      return true;
    }

    // Validate the file path first
    const validatedPath = this.validatePath(filePath);
    const lockPath = `${validatedPath}${LOCK_EXTENSION}`;
    const lockId = holderId ?? randomUUID();
    const now = Date.now();
    const expiresAt = now + this.lockTimeout;

    try {
      // Check existing lock
      const existingLock = await this.readLock(lockPath);
      if (existingLock) {
        const expirationTime = new Date(existingLock.expiresAt).getTime();
        if (expirationTime > now) {
          // Lock is still valid
          return false;
        }
        // Lock expired, remove it
        await fs.promises.unlink(lockPath);
      }

      const lock: FileLock = {
        filePath: validatedPath,
        holderId: lockId,
        acquiredAt: new Date(now).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
      };

      // Try to create lock file exclusively
      await fs.promises.writeFile(lockPath, JSON.stringify(lock), {
        flag: 'wx',
        mode: this.fileMode,
      });

      // Set up auto-release timer
      const timer = setTimeout(() => {
        this.releaseLock(validatedPath, lockId).catch(() => {});
      }, this.lockTimeout);
      this.activeLocks.set(validatedPath, timer);

      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // Lock file already exists
        return false;
      }
      throw error;
    }
  }

  /**
   * Release a lock on a file
   *
   * @param filePath - File to unlock
   * @param holderId - Lock holder identifier (optional, releases if matches)
   * @throws PathTraversalError if path escapes project root
   */
  public async releaseLock(filePath: string, holderId?: string): Promise<void> {
    if (!this.enableLocking) {
      return;
    }

    // Validate the file path first
    const validatedPath = this.validatePath(filePath);
    const lockPath = `${validatedPath}${LOCK_EXTENSION}`;

    try {
      if (holderId !== undefined && holderId !== '') {
        const lock = await this.readLock(lockPath);
        if (lock !== null && lock.holderId !== holderId) {
          throw new Error('Cannot release lock: holder ID mismatch');
        }
      }

      await fs.promises.unlink(lockPath);

      // Clear auto-release timer
      const timer = this.activeLocks.get(validatedPath);
      if (timer) {
        clearTimeout(timer);
        this.activeLocks.delete(validatedPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Read lock information
   *
   * @param lockPath - Lock file path
   * @returns Lock info or null if not locked
   */
  private async readLock(lockPath: string): Promise<FileLock | null> {
    try {
      const content = await fs.promises.readFile(lockPath, 'utf8');
      return JSON.parse(content) as FileLock;
    } catch {
      return null;
    }
  }

  /**
   * Execute a function with file lock
   *
   * @param filePath - File to lock
   * @param fn - Function to execute
   * @param holderId - Lock holder ID
   * @returns Result of function
   */
  public async withLock<T>(filePath: string, fn: () => Promise<T>, holderId?: string): Promise<T> {
    const lockId = holderId ?? randomUUID();
    const acquired = await this.acquireLock(filePath, lockId);

    if (!acquired) {
      throw new Error(`Failed to acquire lock for: ${filePath}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(filePath, lockId);
    }
  }

  // ============================================================
  // YAML Helper Functions
  // ============================================================

  /* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

  /**
   * Read and parse a YAML file
   *
   * @param filePath - Path to YAML file
   * @param options - Read options
   * @returns Parsed YAML content
   * @throws PathTraversalError if path escapes project root
   */
  public async readYaml<T>(filePath: string, options: ReadOptions = {}): Promise<T | null> {
    const validatedPath = this.validatePath(filePath);
    const { encoding = 'utf8', allowMissing = false } = options;

    try {
      const content = await fs.promises.readFile(validatedPath, encoding);
      return yaml.load(content) as T;
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Read and parse a YAML file (synchronous)
   *
   * @param filePath - Path to YAML file
   * @param options - Read options
   * @returns Parsed YAML content
   * @throws PathTraversalError if path escapes project root
   */
  public readYamlSync<T>(filePath: string, options: ReadOptions = {}): T | null {
    const validatedPath = this.validatePath(filePath);
    const { encoding = 'utf8', allowMissing = false } = options;

    try {
      const content = fs.readFileSync(validatedPath, encoding);
      return yaml.load(content) as T;
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write data as YAML file
   *
   * @param filePath - Path to YAML file
   * @param data - Data to write
   * @param options - Write options
   */
  public async writeYaml<T>(
    filePath: string,
    data: T,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    const content = yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
    await this.atomicWrite(filePath, content, options);
  }

  /**
   * Write data as YAML file (synchronous)
   *
   * @param filePath - Path to YAML file
   * @param data - Data to write
   * @param options - Write options
   */
  public writeYamlSync<T>(filePath: string, data: T, options: AtomicWriteOptions = {}): void {
    const content = yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
    this.atomicWriteSync(filePath, content, options);
  }

  // ============================================================
  // JSON Helper Functions
  // ============================================================

  /**
   * Read and parse a JSON file
   *
   * @param filePath - Path to JSON file
   * @param options - Read options
   * @returns Parsed JSON content
   * @throws PathTraversalError if path escapes project root
   */
  public async readJson<T>(filePath: string, options: ReadOptions = {}): Promise<T | null> {
    const validatedPath = this.validatePath(filePath);
    const { encoding = 'utf8', allowMissing = false } = options;

    try {
      const content = await fs.promises.readFile(validatedPath, encoding);
      return JSON.parse(content) as T;
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Read and parse a JSON file (synchronous)
   *
   * @param filePath - Path to JSON file
   * @param options - Read options
   * @returns Parsed JSON content
   * @throws PathTraversalError if path escapes project root
   */
  public readJsonSync<T>(filePath: string, options: ReadOptions = {}): T | null {
    const validatedPath = this.validatePath(filePath);
    const { encoding = 'utf8', allowMissing = false } = options;

    try {
      const content = fs.readFileSync(validatedPath, encoding);
      return JSON.parse(content) as T;
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write data as JSON file
   *
   * @param filePath - Path to JSON file
   * @param data - Data to write
   * @param options - Write options
   */
  public async writeJson<T>(
    filePath: string,
    data: T,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.atomicWrite(filePath, content, options);
  }

  /**
   * Write data as JSON file (synchronous)
   *
   * @param filePath - Path to JSON file
   * @param data - Data to write
   * @param options - Write options
   */
  public writeJsonSync<T>(filePath: string, data: T, options: AtomicWriteOptions = {}): void {
    const content = JSON.stringify(data, null, 2);
    this.atomicWriteSync(filePath, content, options);
  }

  /* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

  // ============================================================
  // Markdown Helper Functions
  // ============================================================

  /**
   * Read a Markdown file
   *
   * @param filePath - Path to Markdown file
   * @param options - Read options
   * @returns Markdown content
   * @throws PathTraversalError if path escapes project root
   */
  public async readMarkdown(filePath: string, options: ReadOptions = {}): Promise<string | null> {
    const validatedPath = this.validatePath(filePath);
    const { encoding = 'utf8', allowMissing = false } = options;

    try {
      return await fs.promises.readFile(validatedPath, encoding);
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Read a Markdown file (synchronous)
   *
   * @param filePath - Path to Markdown file
   * @param options - Read options
   * @returns Markdown content
   * @throws PathTraversalError if path escapes project root
   */
  public readMarkdownSync(filePath: string, options: ReadOptions = {}): string | null {
    const validatedPath = this.validatePath(filePath);
    const { encoding = 'utf8', allowMissing = false } = options;

    try {
      return fs.readFileSync(validatedPath, encoding);
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a Markdown file
   *
   * @param filePath - Path to Markdown file
   * @param content - Markdown content
   * @param options - Write options
   */
  public async writeMarkdown(
    filePath: string,
    content: string,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    await this.atomicWrite(filePath, content, options);
  }

  /**
   * Write a Markdown file (synchronous)
   *
   * @param filePath - Path to Markdown file
   * @param content - Markdown content
   * @param options - Write options
   */
  public writeMarkdownSync(
    filePath: string,
    content: string,
    options: AtomicWriteOptions = {}
  ): void {
    this.atomicWriteSync(filePath, content, options);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Check if a file exists
   *
   * @param filePath - Path to check
   * @returns True if file exists
   * @throws PathTraversalError if path escapes project root
   */
  public async exists(filePath: string): Promise<boolean> {
    const validatedPath = this.validatePath(filePath);
    try {
      await fs.promises.access(validatedPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists (synchronous)
   *
   * @param filePath - Path to check
   * @returns True if file exists
   * @throws PathTraversalError if path escapes project root
   */
  public existsSync(filePath: string): boolean {
    const validatedPath = this.validatePath(filePath);
    try {
      fs.accessSync(validatedPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   *
   * @param filePath - Path to delete
   * @throws PathTraversalError if path escapes project root
   */
  public async deleteFile(filePath: string): Promise<void> {
    const validatedPath = this.validatePath(filePath);
    await fs.promises.unlink(validatedPath);
  }

  /**
   * Delete a file (synchronous)
   *
   * @param filePath - Path to delete
   * @throws PathTraversalError if path escapes project root
   */
  public deleteFileSync(filePath: string): void {
    const validatedPath = this.validatePath(filePath);
    fs.unlinkSync(validatedPath);
  }

  /**
   * Clean up all active locks
   */
  public async cleanup(): Promise<void> {
    for (const [filePath, timer] of this.activeLocks) {
      clearTimeout(timer);
      try {
        await this.releaseLock(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.activeLocks.clear();
  }

  /**
   * Clean up all active locks (synchronous)
   */
  public cleanupSync(): void {
    for (const [, timer] of this.activeLocks) {
      clearTimeout(timer);
    }
    this.activeLocks.clear();
  }
}

/**
 * Singleton instance for global access
 */
let globalScratchpad: Scratchpad | null = null;

/**
 * Get or create the global Scratchpad instance
 *
 * @param options - Options for creating new instance
 * @returns The global Scratchpad instance
 */
export function getScratchpad(options?: ScratchpadOptions): Scratchpad {
  if (globalScratchpad === null) {
    globalScratchpad = new Scratchpad(options);
  }
  return globalScratchpad;
}

/**
 * Reset the global Scratchpad instance (for testing)
 */
export function resetScratchpad(): void {
  if (globalScratchpad !== null) {
    globalScratchpad.cleanupSync();
    globalScratchpad = null;
  }
}
