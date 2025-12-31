import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  Scratchpad,
  getScratchpad,
  resetScratchpad,
  LockContentionError,
} from '../../src/scratchpad/index.js';

describe('Scratchpad', () => {
  let scratchpad: Scratchpad;
  let testBasePath: string;

  beforeEach(() => {
    resetScratchpad();
    testBasePath = path.join(os.tmpdir(), `scratchpad-test-${Date.now()}`);
    scratchpad = new Scratchpad({ basePath: testBasePath, enableLocking: false });
  });

  afterEach(async () => {
    await scratchpad.cleanup();
    resetScratchpad();
    // Clean up test directory
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Path Resolution', () => {
    it('should return correct base path', () => {
      const basePath = scratchpad.getBasePath();
      expect(basePath).toBe(path.resolve(testBasePath));
    });

    it('should return correct section path', () => {
      const infoPath = scratchpad.getSectionPath('info');
      expect(infoPath).toBe(path.join(path.resolve(testBasePath), 'info'));
    });

    it('should return correct project path', () => {
      const projectPath = scratchpad.getProjectPath('documents', '001');
      expect(projectPath).toBe(path.join(path.resolve(testBasePath), 'documents', '001'));
    });

    it('should return correct collected info path', () => {
      const infoPath = scratchpad.getCollectedInfoPath('001');
      expect(infoPath).toBe(
        path.join(path.resolve(testBasePath), 'info', '001', 'collected_info.yaml')
      );
    });

    it('should return correct document paths', () => {
      expect(scratchpad.getDocumentPath('001', 'prd')).toContain('prd.md');
      expect(scratchpad.getDocumentPath('001', 'srs')).toContain('srs.md');
      expect(scratchpad.getDocumentPath('001', 'sds')).toContain('sds.md');
    });

    it('should return correct issue list path', () => {
      const issueListPath = scratchpad.getIssueListPath('001');
      expect(issueListPath).toContain('issue_list.json');
    });

    it('should return correct dependency graph path', () => {
      const graphPath = scratchpad.getDependencyGraphPath('001');
      expect(graphPath).toContain('dependency_graph.json');
    });

    it('should return correct controller state path', () => {
      const statePath = scratchpad.getControllerStatePath('001');
      expect(statePath).toContain('controller_state.yaml');
    });

    it('should return correct work order path', () => {
      const orderPath = scratchpad.getWorkOrderPath('001', 'WO-001');
      expect(orderPath).toContain('work_orders');
      expect(orderPath).toContain('WO-001.yaml');
    });

    it('should return correct result path', () => {
      const resultPath = scratchpad.getResultPath('001', 'WO-001');
      expect(resultPath).toContain('results');
      expect(resultPath).toContain('WO-001.yaml');
    });

    it('should return correct review path', () => {
      const reviewPath = scratchpad.getReviewPath('001', 'REV-001');
      expect(reviewPath).toContain('reviews');
      expect(reviewPath).toContain('REV-001.yaml');
    });
  });

  describe('Project ID Management', () => {
    it('should generate project ID starting from 001', async () => {
      const projectId = await scratchpad.generateProjectId();
      expect(projectId).toBe('001');
    });

    it('should generate project ID synchronously', () => {
      const projectId = scratchpad.generateProjectIdSync();
      expect(projectId).toBe('001');
    });

    it('should generate incremental project IDs', async () => {
      // Initialize first project
      await scratchpad.initializeProject('001', 'First Project');

      const nextId = await scratchpad.generateProjectId();
      expect(nextId).toBe('002');
    });

    it('should list project IDs', async () => {
      await scratchpad.initializeProject('001', 'Project 1');
      await scratchpad.initializeProject('002', 'Project 2');

      const ids = await scratchpad.listProjectIds();
      expect(ids).toContain('001');
      expect(ids).toContain('002');
    });

    it('should initialize project with all directories', async () => {
      const projectInfo = await scratchpad.initializeProject('001', 'Test Project');

      expect(projectInfo.projectId).toBe('001');
      expect(projectInfo.name).toBe('Test Project');
      expect(projectInfo.status).toBe('active');

      // Check directories exist
      expect(fs.existsSync(scratchpad.getProjectPath('info', '001'))).toBe(true);
      expect(fs.existsSync(scratchpad.getProjectPath('documents', '001'))).toBe(true);
      expect(fs.existsSync(scratchpad.getProjectPath('issues', '001'))).toBe(true);
      expect(fs.existsSync(scratchpad.getProjectPath('progress', '001'))).toBe(true);

      // Check progress subsections
      expect(
        fs.existsSync(scratchpad.getProgressSubsectionPath('001', 'work_orders'))
      ).toBe(true);
      expect(fs.existsSync(scratchpad.getProgressSubsectionPath('001', 'results'))).toBe(
        true
      );
      expect(fs.existsSync(scratchpad.getProgressSubsectionPath('001', 'reviews'))).toBe(
        true
      );
    });
  });

  describe('Atomic Write Operations', () => {
    it('should write file atomically', async () => {
      const filePath = path.join(testBasePath, 'atomic-test.txt');
      const content = 'Atomic content';

      await scratchpad.atomicWrite(filePath, content);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
    });

    it('should write file atomically (sync)', () => {
      const filePath = path.join(testBasePath, 'atomic-sync.txt');
      const content = 'Sync atomic content';

      scratchpad.atomicWriteSync(filePath, content);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
    });

    it('should create parent directories', async () => {
      const filePath = path.join(testBasePath, 'deep', 'nested', 'file.txt');

      await scratchpad.atomicWrite(filePath, 'Content');

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should not leave temp files on error', async () => {
      // Create a directory where we'll try to write a file
      const dirPath = path.join(testBasePath, 'invalid');
      fs.mkdirSync(dirPath, { recursive: true });

      // Try to write to a path that is actually a directory
      try {
        await scratchpad.atomicWrite(dirPath, 'content');
      } catch {
        // Expected to fail
      }

      // Check no temp files left
      const files = fs.readdirSync(testBasePath);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('Directory Operations', () => {
    it('should ensure directory exists', async () => {
      const dirPath = path.join(testBasePath, 'ensure', 'nested');

      await scratchpad.ensureDir(dirPath);

      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });

    it('should ensure directory exists (sync)', () => {
      const dirPath = path.join(testBasePath, 'ensure-sync', 'nested');

      scratchpad.ensureDirSync(dirPath);

      expect(fs.existsSync(dirPath)).toBe(true);
    });
  });

  describe('YAML Helper Functions', () => {
    it('should write and read YAML', async () => {
      const filePath = path.join(testBasePath, 'test.yaml');
      const data = { name: 'Test', value: 42, nested: { array: [1, 2, 3] } };

      await scratchpad.writeYaml(filePath, data);
      const result = await scratchpad.readYaml<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should write and read YAML (sync)', () => {
      const filePath = path.join(testBasePath, 'test-sync.yaml');
      const data = { key: 'value' };

      scratchpad.writeYamlSync(filePath, data);
      const result = scratchpad.readYamlSync<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should return null for missing file with allowMissing', async () => {
      // Use relative path within basePath to test file-not-found behavior
      const result = await scratchpad.readYaml('nonexistent.yaml', { allowMissing: true });
      expect(result).toBeNull();
    });

    it('should throw for missing file without allowMissing', async () => {
      // Use relative path within basePath to test file-not-found behavior
      await expect(scratchpad.readYaml('nonexistent.yaml')).rejects.toThrow();
    });
  });

  describe('JSON Helper Functions', () => {
    it('should write and read JSON', async () => {
      const filePath = path.join(testBasePath, 'test.json');
      const data = { items: ['a', 'b', 'c'], count: 3 };

      await scratchpad.writeJson(filePath, data);
      const result = await scratchpad.readJson<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should write and read JSON (sync)', () => {
      const filePath = path.join(testBasePath, 'test-sync.json');
      const data = { array: [1, 2, 3] };

      scratchpad.writeJsonSync(filePath, data);
      const result = scratchpad.readJsonSync<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should return null for missing file with allowMissing', async () => {
      // Use relative path within basePath to test file-not-found behavior
      const result = await scratchpad.readJson('nonexistent.json', { allowMissing: true });
      expect(result).toBeNull();
    });
  });

  describe('Markdown Helper Functions', () => {
    it('should write and read Markdown', async () => {
      const filePath = path.join(testBasePath, 'test.md');
      const content = '# Title\n\nParagraph content.';

      await scratchpad.writeMarkdown(filePath, content);
      const result = await scratchpad.readMarkdown(filePath);

      expect(result).toBe(content);
    });

    it('should write and read Markdown (sync)', () => {
      const filePath = path.join(testBasePath, 'test-sync.md');
      const content = '## Subtitle';

      scratchpad.writeMarkdownSync(filePath, content);
      const result = scratchpad.readMarkdownSync(filePath);

      expect(result).toBe(content);
    });

    it('should return null for missing file with allowMissing', async () => {
      // Use relative path within basePath to test file-not-found behavior
      const result = await scratchpad.readMarkdown('nonexistent.md', { allowMissing: true });
      expect(result).toBeNull();
    });
  });

  describe('File Utility Methods', () => {
    it('should check if file exists', async () => {
      const filePath = path.join(testBasePath, 'exists.txt');
      await scratchpad.atomicWrite(filePath, 'content');

      expect(await scratchpad.exists(filePath)).toBe(true);
      // Use relative path within basePath to test non-existent file
      expect(await scratchpad.exists('nonexistent')).toBe(false);
    });

    it('should check if file exists (sync)', () => {
      const filePath = path.join(testBasePath, 'exists-sync.txt');
      scratchpad.atomicWriteSync(filePath, 'content');

      expect(scratchpad.existsSync(filePath)).toBe(true);
      // Use relative path within basePath to test non-existent file
      expect(scratchpad.existsSync('nonexistent')).toBe(false);
    });

    it('should delete file', async () => {
      const filePath = path.join(testBasePath, 'to-delete.txt');
      await scratchpad.atomicWrite(filePath, 'delete me');

      await scratchpad.deleteFile(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should delete file (sync)', () => {
      const filePath = path.join(testBasePath, 'to-delete-sync.txt');
      scratchpad.atomicWriteSync(filePath, 'delete me');

      scratchpad.deleteFileSync(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      resetScratchpad();
      const instance1 = getScratchpad();
      const instance2 = getScratchpad();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      resetScratchpad();
      const instance1 = getScratchpad();
      resetScratchpad();
      const instance2 = getScratchpad();

      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('Scratchpad File Locking', () => {
  let scratchpad: Scratchpad;
  let testBasePath: string;

  beforeEach(() => {
    resetScratchpad();
    testBasePath = path.join(os.tmpdir(), `scratchpad-lock-test-${Date.now()}`);
    scratchpad = new Scratchpad({ basePath: testBasePath, enableLocking: true });
  });

  afterEach(async () => {
    await scratchpad.cleanup();
    resetScratchpad();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should acquire lock on file', async () => {
    const filePath = path.join(testBasePath, 'locked.txt');
    await scratchpad.ensureDir(testBasePath);

    const acquired = await scratchpad.acquireLock(filePath, 'holder-1');
    expect(acquired).toBe(true);

    await scratchpad.releaseLock(filePath, 'holder-1');
  });

  it('should prevent concurrent locks with LockContentionError', async () => {
    // Create a contender with minimal retries to fail fast
    const contender = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockRetryAttempts: 2,
      lockRetryDelayMs: 10,
      lockTimeout: 60000, // Long timeout so lock doesn't expire
    });

    const filePath = path.join(testBasePath, 'concurrent.txt');
    await scratchpad.ensureDir(testBasePath);

    const first = await scratchpad.acquireLock(filePath, 'holder-1');
    expect(first).toBe(true);

    // Second attempt should throw LockContentionError after retries
    await expect(contender.acquireLock(filePath, 'holder-2')).rejects.toThrow(
      LockContentionError
    );

    await scratchpad.releaseLock(filePath, 'holder-1');
    await contender.cleanup();
  });

  it('should release lock after holder finishes', async () => {
    const filePath = path.join(testBasePath, 'release.txt');
    await scratchpad.ensureDir(testBasePath);

    await scratchpad.acquireLock(filePath, 'holder-1');
    await scratchpad.releaseLock(filePath, 'holder-1');

    const acquired = await scratchpad.acquireLock(filePath, 'holder-2');
    expect(acquired).toBe(true);

    await scratchpad.releaseLock(filePath, 'holder-2');
  });

  it('should execute function with lock', async () => {
    const filePath = path.join(testBasePath, 'withlock.txt');
    await scratchpad.ensureDir(testBasePath);

    const result = await scratchpad.withLock(filePath, async () => {
      return 'executed';
    });

    expect(result).toBe('executed');
  });

  it('should release lock even on error', async () => {
    const filePath = path.join(testBasePath, 'error-lock.txt');
    await scratchpad.ensureDir(testBasePath);

    try {
      await scratchpad.withLock(filePath, async () => {
        throw new Error('Test error');
      });
    } catch {
      // Expected
    }

    // Lock should be released, so we can acquire again
    const acquired = await scratchpad.acquireLock(filePath, 'holder-2');
    expect(acquired).toBe(true);

    await scratchpad.releaseLock(filePath, 'holder-2');
  });

  it('should throw error when releasing lock with wrong holder ID', async () => {
    const filePath = path.join(testBasePath, 'wrong-holder.txt');
    await scratchpad.ensureDir(testBasePath);

    await scratchpad.acquireLock(filePath, 'holder-1');

    await expect(scratchpad.releaseLock(filePath, 'wrong-holder')).rejects.toThrow(
      'Cannot release lock: holder ID mismatch'
    );

    // Clean up
    await scratchpad.releaseLock(filePath, 'holder-1');
  });

  it('should handle releasing non-existent lock gracefully', async () => {
    const filePath = path.join(testBasePath, 'no-lock.txt');
    await scratchpad.ensureDir(testBasePath);

    // Should not throw
    await expect(scratchpad.releaseLock(filePath)).resolves.toBeUndefined();
  });

  it('should acquire lock after expired lock', async () => {
    const shortTimeoutScratchpad = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockTimeout: 100, // 100ms timeout
    });

    const filePath = path.join(testBasePath, 'expired-lock.txt');
    await shortTimeoutScratchpad.ensureDir(testBasePath);

    // Acquire first lock
    const first = await shortTimeoutScratchpad.acquireLock(filePath, 'holder-1');
    expect(first).toBe(true);

    // Wait for lock to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be able to acquire after expiration
    const second = await shortTimeoutScratchpad.acquireLock(filePath, 'holder-2');
    expect(second).toBe(true);

    await shortTimeoutScratchpad.cleanup();
  });

  it('should fail to acquire lock when withLock fails due to contention', async () => {
    // Create another scratchpad to hold the lock
    const holder = new Scratchpad({ basePath: testBasePath, enableLocking: true });
    // Create a scratchpad with minimal retries for faster test
    const contender = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockRetryAttempts: 2,
      lockRetryDelayMs: 10,
    });
    const filePath = path.join(testBasePath, 'blocked-withlock.txt');
    await holder.ensureDir(testBasePath);

    // Hold the lock
    await holder.acquireLock(filePath, 'blocker');

    // Try to execute with lock - should throw LockContentionError
    await expect(
      contender.withLock(filePath, async () => {
        return 'should not reach';
      })
    ).rejects.toThrow(LockContentionError);

    await holder.cleanup();
    await contender.cleanup();
  });
});

describe('Scratchpad with Locking Disabled', () => {
  let scratchpad: Scratchpad;
  let testBasePath: string;

  beforeEach(() => {
    resetScratchpad();
    testBasePath = path.join(os.tmpdir(), `scratchpad-nolock-test-${Date.now()}`);
    scratchpad = new Scratchpad({ basePath: testBasePath, enableLocking: false });
  });

  afterEach(async () => {
    await scratchpad.cleanup();
    resetScratchpad();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should always return true for acquireLock when locking disabled', async () => {
    const filePath = path.join(testBasePath, 'no-lock.txt');
    const acquired = await scratchpad.acquireLock(filePath);
    expect(acquired).toBe(true);
  });

  it('should do nothing for releaseLock when locking disabled', async () => {
    const filePath = path.join(testBasePath, 'no-lock.txt');
    await expect(scratchpad.releaseLock(filePath)).resolves.toBeUndefined();
  });
});

describe('Scratchpad Error Handling', () => {
  let scratchpad: Scratchpad;
  let testBasePath: string;

  beforeEach(() => {
    resetScratchpad();
    testBasePath = path.join(os.tmpdir(), `scratchpad-error-test-${Date.now()}`);
    scratchpad = new Scratchpad({ basePath: testBasePath, enableLocking: false });
  });

  afterEach(async () => {
    await scratchpad.cleanup();
    resetScratchpad();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should throw on invalid YAML', async () => {
    const filePath = path.join(testBasePath, 'invalid.yaml');
    await scratchpad.ensureDir(testBasePath);
    fs.writeFileSync(filePath, '{ invalid yaml ::: }}}');

    await expect(scratchpad.readYaml(filePath)).rejects.toThrow();
  });

  it('should throw on invalid JSON', async () => {
    const filePath = path.join(testBasePath, 'invalid.json');
    await scratchpad.ensureDir(testBasePath);
    fs.writeFileSync(filePath, '{ invalid json }');

    await expect(scratchpad.readJson(filePath)).rejects.toThrow();
  });

  it('should throw on missing YAML file without allowMissing', async () => {
    // Use relative path within basePath to test file-not-found behavior
    await expect(scratchpad.readYaml('nonexistent.yaml')).rejects.toThrow();
  });

  it('should throw on missing JSON file without allowMissing', async () => {
    // Use relative path within basePath to test file-not-found behavior
    await expect(scratchpad.readJson('nonexistent.json')).rejects.toThrow();
  });

  it('should throw on missing Markdown file without allowMissing', async () => {
    // Use relative path within basePath to test file-not-found behavior
    await expect(scratchpad.readMarkdown('nonexistent.md')).rejects.toThrow();
  });

  it('should return null for missing YAML (sync) with allowMissing', () => {
    // Use relative path within basePath to test file-not-found behavior
    const result = scratchpad.readYamlSync('nonexistent.yaml', { allowMissing: true });
    expect(result).toBeNull();
  });

  it('should return null for missing JSON (sync) with allowMissing', () => {
    // Use relative path within basePath to test file-not-found behavior
    const result = scratchpad.readJsonSync('nonexistent.json', { allowMissing: true });
    expect(result).toBeNull();
  });

  it('should return null for missing Markdown (sync) with allowMissing', () => {
    // Use relative path within basePath to test file-not-found behavior
    const result = scratchpad.readMarkdownSync('nonexistent.md', { allowMissing: true });
    expect(result).toBeNull();
  });

  it('should throw on invalid YAML (sync)', () => {
    const filePath = path.join(testBasePath, 'invalid-sync.yaml');
    scratchpad.ensureDirSync(testBasePath);
    fs.writeFileSync(filePath, '{ invalid yaml ::: }}}');

    expect(() => scratchpad.readYamlSync(filePath)).toThrow();
  });

  it('should throw on invalid JSON (sync)', () => {
    const filePath = path.join(testBasePath, 'invalid-sync.json');
    scratchpad.ensureDirSync(testBasePath);
    fs.writeFileSync(filePath, '{ invalid json }');

    expect(() => scratchpad.readJsonSync(filePath)).toThrow();
  });
});

describe('Scratchpad Atomic Locking', () => {
  let testBasePath: string;

  beforeEach(() => {
    resetScratchpad();
    testBasePath = path.join(os.tmpdir(), `scratchpad-atomic-test-${Date.now()}`);
  });

  afterEach(async () => {
    resetScratchpad();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should throw LockContentionError after max retries', async () => {
    const holder = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockTimeout: 60000, // Long timeout so lock doesn't expire
    });
    const contender = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockRetryAttempts: 3,
      lockRetryDelayMs: 10,
    });

    const filePath = path.join(testBasePath, 'contention-test.txt');
    await holder.ensureDir(testBasePath);

    // Hold the lock
    await holder.acquireLock(filePath, 'holder-1');

    // Try to acquire - should fail after 3 attempts
    try {
      await contender.acquireLock(filePath, 'contender-1');
      expect.fail('Should have thrown LockContentionError');
    } catch (error) {
      expect(error).toBeInstanceOf(LockContentionError);
      expect((error as LockContentionError).attempts).toBe(3);
      expect((error as LockContentionError).filePath).toContain('contention-test.txt');
    }

    await holder.cleanup();
    await contender.cleanup();
  });

  it('should use generation counter for lock stealing', async () => {
    const scratchpad = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockTimeout: 50, // Very short timeout
      lockStealThresholdMs: 0, // Immediate steal allowed
    });

    const filePath = path.join(testBasePath, 'generation-test.txt');
    await scratchpad.ensureDir(testBasePath);

    // Acquire first lock
    await scratchpad.acquireLock(filePath, 'holder-1');

    // Wait for lock to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Release and acquire again - generation should increment
    await scratchpad.releaseLock(filePath, 'holder-1');
    await scratchpad.acquireLock(filePath, 'holder-2');

    // Read the lock file to verify generation
    const lockPath = `${path.resolve(testBasePath, 'generation-test.txt')}.lock`;
    const lockContent = fs.readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(lockContent);

    expect(lock.holderId).toBe('holder-2');
    expect(lock.generation).toBeDefined();

    await scratchpad.cleanup();
  });

  it('should handle concurrent lock attempts with retries', async () => {
    const scratchpad = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockTimeout: 100,
      lockRetryAttempts: 20,
      lockRetryDelayMs: 10,
    });

    const filePath = path.join(testBasePath, 'concurrent-retry.txt');
    await scratchpad.ensureDir(testBasePath);

    // Launch 5 concurrent lock attempts
    const results = await Promise.allSettled(
      Array(5)
        .fill(null)
        .map((_, i) =>
          scratchpad.withLock(
            filePath,
            async () => {
              // Hold lock briefly
              await new Promise((resolve) => setTimeout(resolve, 20));
              return i;
            },
            `holder-${i}`
          )
        )
    );

    // All should eventually succeed with retries
    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes.length).toBe(5);

    await scratchpad.cleanup();
  });

  it('should support custom retry options per lock operation', async () => {
    const holder = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockRetryAttempts: 10, // Default high retries
      lockRetryDelayMs: 100,
    });

    const filePath = path.join(testBasePath, 'custom-retry.txt');
    await holder.ensureDir(testBasePath);

    // Hold the lock
    await holder.acquireLock(filePath, 'holder');

    // Try with custom low retries - should fail faster
    const startTime = Date.now();
    try {
      await holder.acquireLock(filePath, 'contender', {
        retryAttempts: 2,
        retryDelayMs: 10,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(LockContentionError);
    }
    const elapsed = Date.now() - startTime;

    // Should complete quickly with only 2 retries
    expect(elapsed).toBeLessThan(500);

    await holder.cleanup();
  });

  it('should steal expired lock atomically', async () => {
    const shortTimeout = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockTimeout: 50,
      lockStealThresholdMs: 0,
    });

    const stealer = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockTimeout: 5000,
      lockStealThresholdMs: 0,
      lockRetryAttempts: 5,
      lockRetryDelayMs: 50,
    });

    const filePath = path.join(testBasePath, 'steal-test.txt');
    await shortTimeout.ensureDir(testBasePath);

    // Acquire lock with short timeout
    await shortTimeout.acquireLock(filePath, 'original');

    // Wait for it to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Steal the expired lock
    const stolen = await stealer.acquireLock(filePath, 'stealer');
    expect(stolen).toBe(true);

    // Verify the new holder
    const lockPath = `${path.resolve(testBasePath, 'steal-test.txt')}.lock`;
    const lockContent = fs.readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(lockContent);
    expect(lock.holderId).toBe('stealer');

    await shortTimeout.cleanup();
    await stealer.cleanup();
  });

  it('should not leave temp files after failed lock attempts', async () => {
    const holder = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
    });
    const contender = new Scratchpad({
      basePath: testBasePath,
      enableLocking: true,
      lockRetryAttempts: 3,
      lockRetryDelayMs: 10,
    });

    const filePath = path.join(testBasePath, 'no-temp-files.txt');
    await holder.ensureDir(testBasePath);

    await holder.acquireLock(filePath, 'holder');

    // Try to acquire and fail
    try {
      await contender.acquireLock(filePath, 'contender');
    } catch {
      // Expected
    }

    // Check no temp files remain
    const files = fs.readdirSync(testBasePath);
    const tmpFiles = files.filter((f) => f.includes('.tmp'));
    expect(tmpFiles).toHaveLength(0);

    await holder.cleanup();
    await contender.cleanup();
  });
});

describe('LockContentionError', () => {
  it('should have correct properties', () => {
    const error = new LockContentionError('/test/path.txt', 10);

    expect(error.name).toBe('LockContentionError');
    expect(error.filePath).toBe('/test/path.txt');
    expect(error.attempts).toBe(10);
    expect(error.message).toContain('/test/path.txt');
    expect(error.message).toContain('10 attempts');
  });

  it('should be instanceof Error', () => {
    const error = new LockContentionError('/test/path.txt', 5);
    expect(error).toBeInstanceOf(Error);
  });
});
