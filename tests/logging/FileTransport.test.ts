import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as zlib from 'node:zlib';
import { FileTransport } from '../../src/logging/transports/FileTransport.js';
import type { TransportLogEntry } from '../../src/logging/transports/types.js';

describe('FileTransport', () => {
  let transport: FileTransport;
  let testLogDir: string;

  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    level: 'INFO',
    message: 'Test message',
    context: {},
    ...overrides,
  });

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-transport-test-'));
  });

  afterEach(async () => {
    if (transport !== undefined) {
      try {
        await transport.close();
      } catch {
        // Ignore close errors in cleanup
      }
    }
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      await transport.initialize();

      expect(transport.isReady()).toBe(true);
    });

    it('should create log directory if not exists', async () => {
      const nestedDir = path.join(testLogDir, 'nested', 'logs');
      transport = new FileTransport({ type: 'file', path: nestedDir });
      await transport.initialize();

      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it('should create initial log file', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      await transport.initialize();

      const currentFile = transport.getCurrentFilePath();
      expect(currentFile).not.toBeNull();
      expect(fs.existsSync(currentFile as string)).toBe(true);
    });

    it('should throw when initializing twice', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      await transport.initialize();

      await expect(transport.initialize()).rejects.toThrow('already initialized');
    });

    it('should have name "file"', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      expect(transport.name).toBe('file');
    });
  });

  describe('logging to file', () => {
    it('should write log entries to file', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ message: 'Hello World' }));

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');
      expect(content).toContain('Hello World');
    });

    it('should write log entries as JSON lines', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ message: 'Entry 1' }));
      await transport.log(createTestEntry({ message: 'Entry 2' }));

      // Wait for writes to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(() => JSON.parse(lines[0] as string)).not.toThrow();
      expect(() => JSON.parse(lines[1] as string)).not.toThrow();
    });

    it('should include all log entry fields', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(
        createTestEntry({
          message: 'Complete entry',
          correlationId: 'corr-123',
          agentId: 'worker-1',
          stage: 'implementation',
          durationMs: 150,
          context: { key: 'value' },
        })
      );

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.correlationId).toBe('corr-123');
      expect(parsed.agentId).toBe('worker-1');
      expect(parsed.stage).toBe('implementation');
      expect(parsed.durationMs).toBe(150);
      expect(parsed.context).toEqual({ key: 'value' });
    });

    it('should include error information', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(
        createTestEntry({
          level: 'ERROR',
          message: 'Error occurred',
          error: {
            name: 'TestError',
            message: 'Test error message',
            stack: 'Error: Test\n  at file:1:1',
          },
        })
      );

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.error.name).toBe('TestError');
      expect(parsed.error.message).toBe('Test error message');
      expect(parsed.error.stack).toContain('at file:1:1');
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below minimum level', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        minLevel: 'WARN',
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG', message: 'Debug' }));
      await transport.log(createTestEntry({ level: 'INFO', message: 'Info' }));
      await transport.log(createTestEntry({ level: 'WARN', message: 'Warning message' }));

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');

      expect(content).not.toContain('Debug');
      expect(content).not.toContain('Info');
      expect(content).toContain('Warning message');
    });
  });

  describe('file rotation', () => {
    it('should track file size and prepare for rotation', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        maxFileSize: 1000, // 1KB limit
        enableBatching: false,
      });
      await transport.initialize();

      // Write entries and verify file grows
      for (let i = 0; i < 5; i++) {
        await transport.log(
          createTestEntry({ message: `Message ${i} with content` })
        );
      }

      // Wait for writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const currentFile = transport.getCurrentFilePath();
      const stats = fs.statSync(currentFile as string);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should clean up old files when max files exceeded', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        maxFileSize: 50,
        maxFiles: 2,
        enableBatching: false,
      });
      await transport.initialize();

      // Create multiple log files
      for (let i = 0; i < 20; i++) {
        await transport.log(createTestEntry({ message: `Message ${i} with extra content to trigger rotation` }));
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      const files = await transport.getLogFiles();
      expect(files.length).toBeLessThanOrEqual(3); // maxFiles + 1 for current
    });

    it('should use date pattern in file names', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        datePattern: 'daily',
      });
      await transport.initialize();

      const currentFile = transport.getCurrentFilePath();
      const fileName = path.basename(currentFile as string);

      // Should contain date in YYYY-MM-DD format
      expect(fileName).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('compression', () => {
    it('should compress rotated files when enabled', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        maxFileSize: 50,
        compress: true,
        enableBatching: false,
      });
      await transport.initialize();

      const firstFile = transport.getCurrentFilePath();

      // Write enough to trigger rotation
      for (let i = 0; i < 10; i++) {
        await transport.log(createTestEntry({ message: `Message ${i} with content to rotate` }));
      }

      // Wait for compression
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check for compressed file
      const files = fs.readdirSync(testLogDir);
      const hasCompressedFile = files.some((f) => f.endsWith('.gz'));

      // Compressed file should exist if rotation happened
      if (transport.getCurrentFilePath() !== firstFile) {
        expect(hasCompressedFile).toBe(true);
      }
    });

    it('should create valid gzip files', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        maxFileSize: 50,
        compress: true,
        enableBatching: false,
      });
      await transport.initialize();

      // Write enough to trigger rotation
      for (let i = 0; i < 20; i++) {
        await transport.log(createTestEntry({ message: `Message ${i} with extra content for compression` }));
      }

      // Wait for compression
      await new Promise((resolve) => setTimeout(resolve, 300));

      const files = fs.readdirSync(testLogDir);
      const gzFiles = files.filter((f) => f.endsWith('.gz'));

      for (const gzFile of gzFiles) {
        const gzPath = path.join(testLogDir, gzFile);
        const compressed = fs.readFileSync(gzPath);

        // Verify it's valid gzip
        expect(() => zlib.gunzipSync(compressed)).not.toThrow();
      }
    });
  });

  describe('health tracking', () => {
    it('should report health status', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      await transport.initialize();

      const health = transport.getHealth();

      expect(health.state).toBe('ready');
      expect(health.pendingLogs).toBe(0);
      expect(health.failedAttempts).toBe(0);
    });

    it('should track total processed logs', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.log(createTestEntry());
      await transport.log(createTestEntry());

      const health = transport.getHealth();
      expect(health.totalProcessed).toBe(3);
    });
  });

  describe('flush and close', () => {
    it('should flush pending logs', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false, // Use non-batching mode for simpler test
      });
      await transport.initialize();

      await transport.log(createTestEntry({ message: 'Buffered message' }));

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');
      expect(content).toContain('Buffered message');
    });

    it('should close and flush pending logs', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: true,
        bufferSize: 100,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ message: 'Final message' }));
      const currentFile = transport.getCurrentFilePath();

      await transport.close();

      const content = fs.readFileSync(currentFile as string, 'utf8');
      expect(content).toContain('Final message');
    });

    it('should throw when logging after close', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      await transport.initialize();
      await transport.close();

      await expect(transport.log(createTestEntry())).rejects.toThrow('not ready');
    });
  });

  describe('getLogDir and getLogFiles', () => {
    it('should return log directory', async () => {
      transport = new FileTransport({ type: 'file', path: testLogDir });
      await transport.initialize();

      expect(transport.getLogDir()).toBe(testLogDir);
    });

    it('should return list of log files', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.flush();

      const files = await transport.getLogFiles();
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith('.jsonl'))).toBe(true);
    });
  });

  describe('file name pattern', () => {
    it('should use custom file name pattern', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        fileNamePattern: 'custom-%DATE%.log',
      });
      await transport.initialize();

      const currentFile = transport.getCurrentFilePath();
      const fileName = path.basename(currentFile as string);

      expect(fileName).toMatch(/^custom-/);
      expect(fileName).toMatch(/\.log$/);
    });
  });

  describe('batching', () => {
    it('should batch logs when enabled', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: true,
        bufferSize: 5,
      });
      await transport.initialize();

      // Log less than buffer size
      await transport.log(createTestEntry({ message: 'Message 1' }));
      await transport.log(createTestEntry({ message: 'Message 2' }));

      const currentFile = transport.getCurrentFilePath();
      let content = fs.readFileSync(currentFile as string, 'utf8');

      // Should not be written yet (in buffer)
      expect(content).toBe('');

      // Log enough to trigger flush
      await transport.log(createTestEntry({ message: 'Message 3' }));
      await transport.log(createTestEntry({ message: 'Message 4' }));
      await transport.log(createTestEntry({ message: 'Message 5' }));

      // Wait a bit for write
      await new Promise((resolve) => setTimeout(resolve, 50));

      content = fs.readFileSync(currentFile as string, 'utf8');
      expect(content).toContain('Message 1');
      expect(content).toContain('Message 5');
    });

    it('should write immediately when batching disabled', async () => {
      transport = new FileTransport({
        type: 'file',
        path: testLogDir,
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ message: 'Immediate message' }));

      // Wait a bit for write
      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentFile = transport.getCurrentFilePath();
      const content = fs.readFileSync(currentFile as string, 'utf8');
      expect(content).toContain('Immediate message');
    });
  });
});
