/**
 * SQLite-based backend for Scratchpad
 *
 * Stores data in a SQLite database for improved I/O performance
 * and query capability. Supports transactions for atomic operations.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { IScratchpadBackend, BatchOperation, BackendHealth } from './IScratchpadBackend.js';
import type { SQLiteBackendConfig } from './types.js';

/**
 * Default values
 */
const DEFAULT_DB_PATH = '.ad-sdlc/scratchpad.db';
const DEFAULT_WAL_MODE = true;
const DEFAULT_BUSY_TIMEOUT = 5000;

/**
 * Database interface (compatible with better-sqlite3)
 */
interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  transaction<T>(fn: () => T): () => T;
  pragma(pragma: string, value?: boolean | number): unknown;
  close(): void;
}

/**
 * Statement interface (compatible with better-sqlite3)
 */
interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * Run result interface
 */
interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * SQLite-based storage backend
 *
 * Implements IScratchpadBackend using SQLite for efficient
 * key-value storage with transaction support.
 */
export class SQLiteBackend implements IScratchpadBackend {
  public readonly name = 'sqlite';

  private readonly dbPath: string;
  private readonly walMode: boolean;
  private readonly busyTimeout: number;
  private db: Database | null = null;

  // Cached prepared statements
  private stmtRead: Statement | null = null;
  private stmtWrite: Statement | null = null;
  private stmtDelete: Statement | null = null;
  private stmtList: Statement | null = null;
  private stmtExists: Statement | null = null;

  constructor(config: SQLiteBackendConfig = {}) {
    this.dbPath = config.dbPath ?? DEFAULT_DB_PATH;
    this.walMode = config.walMode ?? DEFAULT_WAL_MODE;
    this.busyTimeout = config.busyTimeout ?? DEFAULT_BUSY_TIMEOUT;
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Dynamic import of better-sqlite3
    const BetterSqlite3Module = await import('better-sqlite3');
    const BetterSqlite3 =
      'default' in BetterSqlite3Module ? BetterSqlite3Module.default : BetterSqlite3Module;

    // Create database connection
    this.db = new (BetterSqlite3 as new (path: string) => Database)(this.dbPath);

    // Configure database
    if (this.walMode) {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma(`busy_timeout = ${String(this.busyTimeout)}`);

    // Create table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scratchpad (
        section TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (section, key)
      );
      CREATE INDEX IF NOT EXISTS idx_scratchpad_section ON scratchpad(section);
    `);

    // Prepare statements
    this.stmtRead = this.db.prepare('SELECT value FROM scratchpad WHERE section = ? AND key = ?');
    this.stmtWrite = this.db.prepare(`
      INSERT INTO scratchpad (section, key, value, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(section, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);
    this.stmtDelete = this.db.prepare('DELETE FROM scratchpad WHERE section = ? AND key = ?');
    this.stmtList = this.db.prepare('SELECT key FROM scratchpad WHERE section = ?');
    this.stmtExists = this.db.prepare(
      'SELECT 1 FROM scratchpad WHERE section = ? AND key = ? LIMIT 1'
    );
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('SQLiteBackend not initialized. Call initialize() first.');
    }
  }

  async read<T>(section: string, key: string): Promise<T | null> {
    this.ensureInitialized();

    const row = this.stmtRead!.get(section, key) as { value: string } | undefined;
    if (!row) {
      return null;
    }

    return JSON.parse(row.value) as T;
  }

  async write<T>(section: string, key: string, value: T): Promise<void> {
    this.ensureInitialized();

    const serialized = JSON.stringify(value);
    this.stmtWrite!.run(section, key, serialized);
  }

  async delete(section: string, key: string): Promise<boolean> {
    this.ensureInitialized();

    const result = this.stmtDelete!.run(section, key);
    return result.changes > 0;
  }

  async list(section: string): Promise<string[]> {
    this.ensureInitialized();

    const rows = this.stmtList!.all(section) as Array<{ key: string }>;
    return rows.map((row) => row.key);
  }

  async exists(section: string, key: string): Promise<boolean> {
    this.ensureInitialized();

    const result = this.stmtExists!.get(section, key);
    return result !== undefined;
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    this.ensureInitialized();

    const executeBatch = this.db!.transaction(() => {
      for (const op of operations) {
        if (op.type === 'write') {
          const serialized = JSON.stringify(op.value);
          this.stmtWrite!.run(op.section, op.key, serialized);
        } else {
          this.stmtDelete!.run(op.section, op.key);
        }
      }
    });

    executeBatch();
  }

  async healthCheck(): Promise<BackendHealth> {
    try {
      this.ensureInitialized();

      const startTime = Date.now();
      // Simple query to check database is responsive
      this.db!.prepare('SELECT 1').get();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        message: 'SQLite backend is healthy',
        latencyMs,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `SQLite backend error: ${(error as Error).message}`,
      };
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.stmtRead = null;
      this.stmtWrite = null;
      this.stmtDelete = null;
      this.stmtList = null;
      this.stmtExists = null;
    }
  }
}
