/**
 * E2E Test Environment Setup
 *
 * Provides utilities for setting up and tearing down test environments
 * for end-to-end pipeline tests.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  /** Base name for temp directory */
  baseName: string;
  /** Whether to initialize as git repository */
  initGit?: boolean;
  /** Whether to create scratchpad structure */
  initScratchpad?: boolean;
  /** Custom directory structure to create */
  directories?: string[];
}

/**
 * Test environment instance
 */
export interface TestEnvironment {
  /** Root directory path */
  rootDir: string;
  /** Scratchpad base path */
  scratchpadPath: string;
  /** Documents path */
  docsPath: string;
  /** Public docs path */
  publicDocsPath: string;
  /** Cleanup function */
  cleanup: () => Promise<void>;
}

/**
 * Create a test environment
 */
export async function createTestEnvironment(
  config: TestEnvironmentConfig
): Promise<TestEnvironment> {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${config.baseName}-`));
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');
  const docsPath = path.join(scratchpadPath, 'documents');
  const publicDocsPath = path.join(rootDir, 'docs');

  // Create base directories
  if (config.initScratchpad !== false) {
    fs.mkdirSync(path.join(scratchpadPath, 'info'), { recursive: true });
    fs.mkdirSync(path.join(scratchpadPath, 'documents'), { recursive: true });
    fs.mkdirSync(path.join(scratchpadPath, 'issues'), { recursive: true });
    fs.mkdirSync(path.join(publicDocsPath, 'prd'), { recursive: true });
    fs.mkdirSync(path.join(publicDocsPath, 'srs'), { recursive: true });
    fs.mkdirSync(path.join(publicDocsPath, 'sds'), { recursive: true });
  }

  // Create custom directories
  if (config.directories) {
    for (const dir of config.directories) {
      fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
    }
  }

  // Initialize git repository if requested
  if (config.initGit) {
    await execAsync('git init', { cwd: rootDir });
    await execAsync('git config user.email "test@test.com"', { cwd: rootDir });
    await execAsync('git config user.name "Test User"', { cwd: rootDir });
    fs.writeFileSync(path.join(rootDir, 'README.md'), '# Test Project\n');
    await execAsync('git add .', { cwd: rootDir });
    await execAsync('git commit -m "Initial commit"', { cwd: rootDir });
  }

  const cleanup = async (): Promise<void> => {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    rootDir,
    scratchpadPath,
    docsPath,
    publicDocsPath,
    cleanup,
  };
}

/**
 * Reset all agent singletons
 */
export async function resetAllAgents(): Promise<void> {
  // Dynamic imports to avoid circular dependencies
  const { resetCollectorAgent } = await import('../../../src/collector/index.js');
  const { resetPRDWriterAgent } = await import('../../../src/prd-writer/index.js');
  const { resetSRSWriterAgent } = await import('../../../src/srs-writer/index.js');
  const { resetSDSWriterAgent } = await import('../../../src/sds-writer/index.js');
  const { resetIssueGenerator } = await import('../../../src/issue-generator/index.js');
  const { resetScratchpad } = await import('../../../src/scratchpad/index.js');

  resetCollectorAgent();
  resetPRDWriterAgent();
  resetSRSWriterAgent();
  resetSDSWriterAgent();
  resetIssueGenerator();
  resetScratchpad();
}

/**
 * Create a project directory structure for a specific project ID
 */
export function createProjectStructure(env: TestEnvironment, projectId: string): void {
  const projectDocsPath = path.join(env.docsPath, projectId);
  const projectInfoPath = path.join(env.scratchpadPath, 'info', projectId);

  fs.mkdirSync(projectDocsPath, { recursive: true });
  fs.mkdirSync(projectInfoPath, { recursive: true });
}

/**
 * Wait for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timer utility for benchmarking
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    this.endTime = Date.now();
    return this.elapsed();
  }

  elapsed(): number {
    return this.endTime - this.startTime;
  }

  elapsedSeconds(): number {
    return this.elapsed() / 1000;
  }
}
