/**
 * Scratchpad - File-based state sharing between agents
 *
 * Implements the Scratchpad pattern for inter-agent communication
 * by providing structured file operations with:
 * - Atomic writes (write to temp, then rename)
 * - File locking for concurrent access with TOCTOU-safe implementation
 * - YAML/JSON/Markdown helper functions
 * - Project ID management
 * - Path traversal prevention via InputValidator
 *
 * ## File Locking
 *
 * The file locking mechanism uses an atomic link()+unlink() pattern to prevent
 * TOCTOU (Time-of-Check-Time-of-Use) race conditions. This is more reliable
 * than rename() which silently overwrites existing files on POSIX systems.
 *
 * Cooperative Lock Release:
 * Lock stealing now uses a cooperative release pattern to prevent data corruption.
 * Before forcibly stealing an expired lock, a release request is sent to notify
 * the current holder, giving them time to release gracefully. This is enabled
 * by default and can be configured via LockOptions.cooperativeRelease.
 *
 * For production multi-process deployments, consider using proper distributed locking.
 *
 * NOTE: Lock heartbeat and configurable serialization are planned.
 * See Issues #260 and #261 for implementation details.
 *
 * Features:
 * - Atomic lock acquisition using hard links (EEXIST on collision)
 * - Automatic retry with exponential backoff and jitter
 * - Generation counter to prevent ABA problems during lock stealing
 * - Configurable timeout, retry attempts, and steal threshold
 * - Custom error classes: LockContentionError, LockStolenError, LockTimeoutError
 *
 * @example
 * ```typescript
 * const scratchpad = new Scratchpad({
 *   basePath: '.ad-sdlc/scratchpad',
 *   lockRetryAttempts: 10,
 *   lockRetryDelayMs: 100,
 *   lockTimeout: 5000,
 * });
 *
 * // Using withLock for automatic lock management
 * const result = await scratchpad.withLock('/path/to/file', async () => {
 *   const data = await scratchpad.readJson('/path/to/file');
 *   data.counter += 1;
 *   await scratchpad.writeJson('/path/to/file', data);
 *   return data;
 * });
 *
 * // Manual lock management
 * try {
 *   await scratchpad.acquireLock('/path/to/file', 'worker-1');
 *   // ... do work ...
 * } finally {
 *   await scratchpad.releaseLock('/path/to/file', 'worker-1');
 * }
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as yaml from 'js-yaml';
import { InputValidator } from '../security/index.js';
import { tryGetProjectRoot } from '../utils/index.js';
import { FileBackend } from './backends/FileBackend.js';
import type { IScratchpadBackend } from './backends/IScratchpadBackend.js';
import type {
  ScratchpadOptions,
  ScratchpadSection,
  ProgressSubsection,
  DocumentType,
  AtomicWriteOptions,
  ReadOptions,
  FileLock,
  ProjectInfo,
  LockConfig,
  LockOptions,
  LockReleaseRequest,
} from './types.js';
import { LockContentionError } from './errors.js';

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
 * Default number of retry attempts for lock acquisition
 */
const DEFAULT_LOCK_RETRY_ATTEMPTS = 10;

/**
 * Default base delay between retries in milliseconds
 */
const DEFAULT_LOCK_RETRY_DELAY_MS = 100;

/**
 * Default threshold for stealing expired locks in milliseconds
 */
const DEFAULT_LOCK_STEAL_THRESHOLD_MS = 5000;

/**
 * Maximum delay between retries (cap for exponential backoff)
 */
const MAX_RETRY_DELAY_MS = 5000;

/**
 * Lock file extension
 */
const LOCK_EXTENSION = '.lock';

/**
 * Release request file extension
 */
const RELEASE_REQUEST_EXTENSION = '.release-request';

/**
 * Default timeout for cooperative release in milliseconds
 */
const DEFAULT_COOPERATIVE_RELEASE_TIMEOUT_MS = 1000;

/**
 * Extended lock configuration with cooperative release settings
 */
interface ExtendedLockConfig extends Required<LockConfig> {
  cooperativeRelease: boolean;
  cooperativeReleaseTimeoutMs: number;
}

/**
 * Scratchpad implementation for file-based state sharing
 */
export class Scratchpad {
  private readonly basePath: string;
  private readonly fileMode: number;
  private readonly dirMode: number;
  private readonly enableLocking: boolean;
  private readonly lockTimeout: number;
  private readonly lockConfig: ExtendedLockConfig;
  private readonly activeLocks: Map<string, NodeJS.Timeout> = new Map();
  private readonly validator: InputValidator;
  private readonly projectRoot: string;
  /** Pending release requests created by this instance */
  private readonly pendingReleaseRequests: Set<string> = new Set();
  /** File backend for storage operations */
  private readonly backend: IScratchpadBackend;
  /** Whether the backend has been initialized */
  private backendInitialized = false;

  constructor(options: ScratchpadOptions = {}) {
    this.basePath = options.basePath ?? DEFAULT_BASE_PATH;
    this.fileMode = options.fileMode ?? DEFAULT_FILE_MODE;
    this.dirMode = options.dirMode ?? DEFAULT_DIR_MODE;
    this.enableLocking = options.enableLocking ?? true;
    this.lockTimeout = options.lockTimeout ?? DEFAULT_LOCK_TIMEOUT;
    // Lock configuration with defaults (including cooperative release settings)
    this.lockConfig = {
      lockRetryAttempts: options.lockRetryAttempts ?? DEFAULT_LOCK_RETRY_ATTEMPTS,
      lockRetryDelayMs: options.lockRetryDelayMs ?? DEFAULT_LOCK_RETRY_DELAY_MS,
      lockStealThresholdMs: options.lockStealThresholdMs ?? DEFAULT_LOCK_STEAL_THRESHOLD_MS,
      cooperativeRelease: true, // Enable by default for safety
      cooperativeReleaseTimeoutMs: DEFAULT_COOPERATIVE_RELEASE_TIMEOUT_MS,
    };
    // Use projectRoot if provided, then try ProjectContext, fallback to cwd
    this.projectRoot = options.projectRoot ?? tryGetProjectRoot() ?? process.cwd();
    // Initialize validator with resolved basePath to prevent path traversal
    // The basePath is resolved against projectRoot for relative paths
    const resolvedBasePath = path.isAbsolute(this.basePath)
      ? this.basePath
      : path.resolve(this.projectRoot, this.basePath);
    this.validator = new InputValidator({ basePath: resolvedBasePath });

    // Initialize file backend with raw format (no extension manipulation)
    this.backend = new FileBackend({
      basePath: resolvedBasePath,
      fileMode: this.fileMode,
      dirMode: this.dirMode,
      format: 'raw',
    });
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
  // Backend Operations
  // ============================================================

  /**
   * Ensure the backend is initialized
   */
  private async ensureBackendInitialized(): Promise<void> {
    if (!this.backendInitialized) {
      await this.backend.initialize();
      this.backendInitialized = true;
    }
  }

  /**
   * Convert a file path to section and key for backend operations
   *
   * @param filePath - Full file path
   * @returns Object with section (directory relative to basePath) and key (filename)
   */
  private pathToSectionKey(filePath: string): { section: string; key: string } {
    const resolvedBasePath = path.isAbsolute(this.basePath)
      ? this.basePath
      : path.resolve(this.projectRoot, this.basePath);

    // Get the path relative to basePath
    const relativePath = path.relative(resolvedBasePath, filePath);

    // Split into directory (section) and filename (key)
    const section = path.dirname(relativePath);
    const key = path.basename(relativePath);

    return { section: section === '.' ? '' : section, key };
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
   * Uses FileBackend internally for atomic write operations.
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
    const { createDirs = true } = options;

    // Create parent directories if needed
    if (createDirs) {
      const dir = path.dirname(validatedPath);
      await this.ensureDir(dir);
    }

    // Use backend for atomic write
    await this.ensureBackendInitialized();
    const { section, key } = this.pathToSectionKey(validatedPath);
    await this.backend.write(section, key, content);
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
   * Sleep helper for retry delays
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set up auto-release timer for a lock
   *
   * @param filePath - Validated file path
   * @param lockId - Lock holder ID
   */
  private setupAutoRelease(filePath: string, lockId: string): void {
    const timer = setTimeout(() => {
      this.releaseLock(filePath, lockId).catch(() => {});
    }, this.lockTimeout);
    this.activeLocks.set(filePath, timer);
  }

  /**
   * Try to atomically steal an expired lock
   *
   * Uses atomic rename to prevent race conditions when multiple
   * processes try to steal the same expired lock.
   *
   * @param lockPath - Path to the lock file
   * @param tempPath - Path to the temporary lock file
   * @param existingLock - The existing lock to steal from
   * @param newLock - The new lock to install
   * @returns True if lock was successfully stolen
   */
  private async tryStealLock(
    lockPath: string,
    tempPath: string,
    existingLock: FileLock,
    newLock: FileLock
  ): Promise<boolean> {
    try {
      // Write new lock to temp file with incremented generation
      const lockWithGeneration: FileLock = {
        ...newLock,
        generation: (existingLock.generation ?? 0) + 1,
      };
      await fs.promises.writeFile(tempPath, JSON.stringify(lockWithGeneration), {
        mode: this.fileMode,
      });

      // Read current lock again to verify it hasn't changed
      const currentLock = await this.readLock(lockPath);
      if (currentLock === null) {
        // Lock was removed, try direct rename
        try {
          await fs.promises.rename(tempPath, lockPath);
          return true;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            // Temp file was cleaned up, try again
            return false;
          }
          throw err;
        }
      }

      // Check if the lock was modified by another process
      if (currentLock.generation !== existingLock.generation) {
        // Lock was already stolen by another process
        return false;
      }

      // Check if the lock holder changed
      if (currentLock.holderId !== existingLock.holderId) {
        // Lock was taken by a different holder
        return false;
      }

      // Atomic replace using rename (atomic on POSIX systems)
      await fs.promises.rename(tempPath, lockPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Acquire a lock on a file using atomic operations
   *
   * This implementation uses the atomic rename pattern to prevent
   * TOCTOU (Time-of-Check-Time-of-Use) race conditions:
   *
   * 1. Write lock info to a temporary file
   * 2. Attempt atomic rename to the lock file
   * 3. If rename fails (lock exists), check if expired and try to steal
   * 4. Retry with exponential backoff on contention
   *
   * @param filePath - File to lock
   * @param holderId - Lock holder identifier
   * @param options - Lock acquisition options
   * @returns True if lock acquired, throws LockContentionError on max retries
   * @throws PathTraversalError if path escapes project root
   * @throws LockContentionError if lock cannot be acquired after retries
   */
  public async acquireLock(
    filePath: string,
    holderId?: string,
    options?: LockOptions
  ): Promise<boolean> {
    if (!this.enableLocking) {
      return true;
    }

    // Validate the file path first
    const validatedPath = this.validatePath(filePath);
    const lockPath = `${validatedPath}${LOCK_EXTENSION}`;
    const lockId = holderId ?? options?.holderId ?? randomUUID();
    const retryAttempts = options?.retryAttempts ?? this.lockConfig.lockRetryAttempts;
    const retryDelayMs = options?.retryDelayMs ?? this.lockConfig.lockRetryDelayMs;
    const useCooperativeRelease = options?.cooperativeRelease ?? this.lockConfig.cooperativeRelease;
    const cooperativeTimeoutMs =
      options?.cooperativeReleaseTimeoutMs ?? this.lockConfig.cooperativeReleaseTimeoutMs;

    // Track if we've already attempted cooperative release for a specific lock holder
    let cooperativeReleaseAttempted: string | null = null;

    // Ensure lock directory exists
    const lockDir = path.dirname(lockPath);
    try {
      await fs.promises.mkdir(lockDir, { recursive: true, mode: this.dirMode });
    } catch {
      // Directory may already exist
    }

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      const now = Date.now();
      const expiresAt = now + this.lockTimeout;
      const tempLockPath = `${lockPath}.${randomUUID()}.tmp`;

      const lock: FileLock = {
        filePath: validatedPath,
        holderId: lockId,
        acquiredAt: new Date(now).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        generation: 0,
      };

      try {
        // Step 1: Write lock to temp file
        await fs.promises.writeFile(tempLockPath, JSON.stringify(lock), {
          mode: this.fileMode,
        });

        // Step 2: Try atomic link (fails if lock exists)
        // Note: rename() on POSIX overwrites existing files, so we use link() instead
        // link() will fail with EEXIST if the target already exists
        try {
          await fs.promises.link(tempLockPath, lockPath);
          // Link succeeded, remove temp file
          await fs.promises.unlink(tempLockPath).catch(() => {});

          // Lock acquired successfully!
          this.setupAutoRelease(validatedPath, lockId);
          return true;
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== 'EEXIST') {
            // Clean up temp file and rethrow unexpected errors
            await fs.promises.unlink(tempLockPath).catch(() => {});
            throw err;
          }
          // Lock exists, continue to check if expired
        }

        // Step 3: Check if existing lock is expired
        const existingLock = await this.readLock(lockPath);
        if (existingLock !== null) {
          const expirationTime = new Date(existingLock.expiresAt).getTime();
          const isExpired = expirationTime <= now;
          const isPastStealThreshold = now - expirationTime >= this.lockConfig.lockStealThresholdMs;

          if (isExpired || isPastStealThreshold) {
            // Step 3a: Try cooperative release first (only once per holder)
            if (useCooperativeRelease && cooperativeReleaseAttempted !== existingLock.holderId) {
              cooperativeReleaseAttempted = existingLock.holderId;
              const wasReleased = await this.tryCooperativeRelease(
                lockPath,
                existingLock,
                lockId,
                cooperativeTimeoutMs
              );

              if (wasReleased) {
                // Lock was released cooperatively, try to acquire it now
                // Don't wait, try again immediately
                continue;
              }
              // Cooperative release failed or timed out, proceed to forceful steal
            }

            // Step 3b: Try to steal the expired lock atomically
            if (await this.tryStealLock(lockPath, tempLockPath, existingLock, lock)) {
              // Clean up any release request we created
              await this.deleteReleaseRequest(lockPath);
              this.setupAutoRelease(validatedPath, lockId);
              return true;
            }
          }
        } else {
          // Lock file was removed between our check and now
          // Try again immediately without waiting
          continue;
        }

        // Step 4: Wait and retry with exponential backoff
        const delay = Math.min(retryDelayMs * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * delay * 0.1;
        await this.sleep(delay + jitter);
      } finally {
        // Clean up temp file if it still exists
        await fs.promises.unlink(tempLockPath).catch(() => {});
      }
    }

    // Max retries exceeded
    throw new LockContentionError(filePath, retryAttempts);
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
      // Internal data saved by this class - use direct parse with type assertion
      return JSON.parse(content) as FileLock;
    } catch {
      return null;
    }
  }

  // ============================================================
  // Cooperative Lock Release
  // ============================================================

  /**
   * Get the release request file path for a lock
   *
   * @param lockPath - Lock file path
   * @returns Release request file path
   */
  private getReleaseRequestPath(lockPath: string): string {
    return lockPath.replace(LOCK_EXTENSION, RELEASE_REQUEST_EXTENSION);
  }

  /**
   * Create a release request for an expired lock
   *
   * This notifies the current lock holder that another process
   * wants to acquire the lock and gives them time to release gracefully.
   *
   * @param lockPath - Lock file path
   * @param existingLock - The existing expired lock
   * @param requesterId - ID of the process requesting release
   * @param timeoutMs - How long the request is valid
   * @returns The created release request, or null if creation failed
   */
  private async createReleaseRequest(
    lockPath: string,
    existingLock: FileLock,
    requesterId: string,
    timeoutMs: number
  ): Promise<LockReleaseRequest | null> {
    const releaseRequestPath = this.getReleaseRequestPath(lockPath);
    const now = Date.now();
    const request: LockReleaseRequest = {
      filePath: existingLock.filePath,
      requesterId,
      requestedAt: new Date(now).toISOString(),
      originalHolderId: existingLock.holderId,
      expiresAt: new Date(now + timeoutMs).toISOString(),
    };

    try {
      await fs.promises.writeFile(releaseRequestPath, JSON.stringify(request), {
        mode: this.fileMode,
      });
      this.pendingReleaseRequests.add(releaseRequestPath);
      return request;
    } catch {
      return null;
    }
  }

  /**
   * Read a release request
   *
   * @param lockPath - Lock file path
   * @returns Release request or null if not found
   */
  private async readReleaseRequest(lockPath: string): Promise<LockReleaseRequest | null> {
    const releaseRequestPath = this.getReleaseRequestPath(lockPath);
    try {
      const content = await fs.promises.readFile(releaseRequestPath, 'utf8');
      return JSON.parse(content) as LockReleaseRequest;
    } catch {
      return null;
    }
  }

  /**
   * Delete a release request
   *
   * @param lockPath - Lock file path
   */
  private async deleteReleaseRequest(lockPath: string): Promise<void> {
    const releaseRequestPath = this.getReleaseRequestPath(lockPath);
    try {
      await fs.promises.unlink(releaseRequestPath);
      this.pendingReleaseRequests.delete(releaseRequestPath);
    } catch {
      // Ignore if not found
    }
  }

  /**
   * Check if a release request exists for a lock
   *
   * Lock holders can call this periodically to check if another
   * process is waiting for the lock and release it gracefully.
   *
   * @param filePath - File path (not lock path)
   * @param holderId - Current lock holder ID
   * @returns True if a release is being requested for this holder
   * @throws PathTraversalError if path escapes project root
   */
  public async isReleaseRequested(filePath: string, holderId: string): Promise<boolean> {
    if (!this.enableLocking) {
      return false;
    }

    const validatedPath = this.validatePath(filePath);
    const lockPath = `${validatedPath}${LOCK_EXTENSION}`;
    const request = await this.readReleaseRequest(lockPath);

    if (request === null) {
      return false;
    }

    // Check if request is for this holder and not expired
    const now = Date.now();
    const expiresAt = new Date(request.expiresAt).getTime();
    return request.originalHolderId === holderId && expiresAt > now;
  }

  /**
   * Attempt cooperative lock release before stealing
   *
   * This method:
   * 1. Creates a release request to notify the current holder
   * 2. Waits for the holder to release or for timeout
   * 3. Returns whether the lock was released cooperatively
   *
   * @param lockPath - Lock file path
   * @param existingLock - The existing expired lock
   * @param requesterId - ID of the process requesting release
   * @param timeoutMs - How long to wait for cooperative release
   * @returns True if lock was released cooperatively
   */
  private async tryCooperativeRelease(
    lockPath: string,
    existingLock: FileLock,
    requesterId: string,
    timeoutMs: number
  ): Promise<boolean> {
    // Create release request
    const request = await this.createReleaseRequest(lockPath, existingLock, requesterId, timeoutMs);

    if (request === null) {
      return false;
    }

    // Wait for cooperative release with polling
    const pollInterval = Math.min(100, timeoutMs / 4);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await this.sleep(pollInterval);

      // Check if lock was released
      const currentLock = await this.readLock(lockPath);
      if (currentLock === null) {
        // Lock was released! Clean up request and return success
        await this.deleteReleaseRequest(lockPath);
        return true;
      }

      // Check if lock holder changed (holder acknowledged by releasing and someone else took it)
      if (currentLock.holderId !== existingLock.holderId) {
        // Lock was taken by another process
        await this.deleteReleaseRequest(lockPath);
        return false;
      }
    }

    // Timeout - cooperative release failed
    // Keep the release request so holder knows stealing will occur
    return false;
  }

  /**
   * Execute a function with file lock
   *
   * Automatically acquires the lock before executing the function
   * and releases it afterward, even if the function throws.
   *
   * @param filePath - File to lock
   * @param fn - Function to execute while holding the lock
   * @param options - Lock options (holderId, retryAttempts, retryDelayMs)
   * @returns Result of function
   * @throws LockContentionError if lock cannot be acquired
   */
  public async withLock<T>(
    filePath: string,
    fn: () => Promise<T>,
    options?: LockOptions | string
  ): Promise<T> {
    // Support both old (holderId string) and new (LockOptions) signature
    const lockOptions: LockOptions | undefined =
      typeof options === 'string' ? { holderId: options } : options;
    const lockId = lockOptions?.holderId ?? randomUUID();

    // acquireLock now throws LockContentionError on failure
    await this.acquireLock(filePath, lockId, lockOptions);

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
    const { allowMissing = false } = options;

    try {
      await this.ensureBackendInitialized();
      const { section, key } = this.pathToSectionKey(validatedPath);
      const content = await this.backend.read<string>(section, key);

      if (content === null) {
        if (allowMissing) {
          return null;
        }
        const error = new Error(`ENOENT: no such file or directory, open '${validatedPath}'`);
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }

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
    const { allowMissing = false } = options;

    try {
      await this.ensureBackendInitialized();
      const { section, key } = this.pathToSectionKey(validatedPath);
      const content = await this.backend.read<string>(section, key);

      if (content === null) {
        if (allowMissing) {
          return null;
        }
        const error = new Error(`ENOENT: no such file or directory, open '${validatedPath}'`);
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }

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
    const { allowMissing = false } = options;

    try {
      await this.ensureBackendInitialized();
      const { section, key } = this.pathToSectionKey(validatedPath);
      const content = await this.backend.read<string>(section, key);

      if (content === null) {
        if (allowMissing) {
          return null;
        }
        const error = new Error(`ENOENT: no such file or directory, open '${validatedPath}'`);
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }

      return content;
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
    await this.ensureBackendInitialized();
    const { section, key } = this.pathToSectionKey(validatedPath);
    return this.backend.exists(section, key);
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
    await this.ensureBackendInitialized();
    const { section, key } = this.pathToSectionKey(validatedPath);
    const deleted = await this.backend.delete(section, key);
    if (!deleted) {
      const error = new Error(`ENOENT: no such file or directory, unlink '${validatedPath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
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
   * Clean up all active locks, pending release requests, and close backend
   */
  public async cleanup(): Promise<void> {
    // Clean up active locks
    for (const [filePath, timer] of this.activeLocks) {
      clearTimeout(timer);
      try {
        await this.releaseLock(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.activeLocks.clear();

    // Clean up pending release requests
    for (const requestPath of this.pendingReleaseRequests) {
      try {
        await fs.promises.unlink(requestPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.pendingReleaseRequests.clear();

    // Close backend
    if (this.backendInitialized) {
      await this.backend.close();
      this.backendInitialized = false;
    }
  }

  /**
   * Clean up all active locks (synchronous)
   */
  public cleanupSync(): void {
    for (const [, timer] of this.activeLocks) {
      clearTimeout(timer);
    }
    this.activeLocks.clear();

    // Clean up pending release requests synchronously
    for (const requestPath of this.pendingReleaseRequests) {
      try {
        fs.unlinkSync(requestPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.pendingReleaseRequests.clear();
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
