/**
 * WorkerProcessManager - Child process lifecycle management for worker agents
 *
 * Encapsulates all child_process interaction so that WorkerPoolManager
 * remains focused on logical work distribution.
 *
 * Responsibilities:
 * - Fork worker child processes
 * - Route IPC messages (heartbeat → HealthMonitor, result → PoolManager)
 * - Restart/shutdown workers
 * - Handle process exit/crash
 */

import { fork, type ChildProcess } from 'node:child_process';
import { getLogger } from '../logging/index.js';
import type { WorkerIPCMessage, WorkerSpawnConfig, WorkOrder, WorkerHeartbeat } from './types.js';

const logger = getLogger();

const DEFAULT_SPAWN_TIMEOUT_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const SHUTDOWN_GRACE_MS = 10_000;

/**
 * Internal handle for a spawned worker process
 */
interface WorkerProcessHandle {
  workerId: string;
  process: ChildProcess;
  pid: number | undefined;
  spawnedAt: number;
  alive: boolean;
}

/**
 * Callbacks for routing IPC events to the pool manager and health monitor
 */
export interface WorkerProcessCallbacks {
  /** Called when a worker sends a heartbeat */
  onHeartbeat?: (workerId: string, heartbeat: WorkerHeartbeat) => void;
  /** Called when a worker completes work successfully */
  onWorkComplete?: (workerId: string, result: unknown) => void;
  /** Called when a worker reports an error */
  onWorkError?: (workerId: string, error: string) => void;
  /** Called when a worker process exits unexpectedly */
  onProcessExit?: (workerId: string, code: number | null, signal: string | null) => void;
}

/**
 * Manages worker child processes for the controller.
 */
export class WorkerProcessManager {
  private readonly config: Required<
    Pick<WorkerSpawnConfig, 'workerScriptPath' | 'spawnTimeoutMs' | 'heartbeatIntervalMs'>
  > &
    WorkerSpawnConfig;
  private readonly processes: Map<string, WorkerProcessHandle> = new Map();
  private readonly callbacks: WorkerProcessCallbacks;

  constructor(config: WorkerSpawnConfig, callbacks: WorkerProcessCallbacks = {}) {
    this.config = {
      ...config,
      spawnTimeoutMs: config.spawnTimeoutMs ?? DEFAULT_SPAWN_TIMEOUT_MS,
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
    };
    this.callbacks = callbacks;
  }

  /**
   * Spawn a new worker child process.
   *
   * @param workerId - Unique worker identifier
   * @returns The spawned process handle
   */
  public spawnWorker(workerId: string): void {
    if (this.processes.has(workerId)) {
      const existing = this.processes.get(workerId);
      if (existing?.alive === true) {
        logger.warn('Worker already spawned', { agent: 'WorkerProcessManager', workerId });
        return;
      }
    }

    const env: Record<string, string | undefined> = {
      ...process.env,
      ...this.config.workerEnv,
      WORKER_ID: workerId,
      HEARTBEAT_INTERVAL_MS: String(this.config.heartbeatIntervalMs),
    };

    const child = fork(this.config.workerScriptPath, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      execArgv: this.config.nodeArgs !== undefined ? [...this.config.nodeArgs] : [],
    });

    const handle: WorkerProcessHandle = {
      workerId,
      process: child,
      pid: child.pid,
      spawnedAt: Date.now(),
      alive: true,
    };

    this.processes.set(workerId, handle);

    // Wire IPC message handler
    child.on('message', (raw: unknown) => {
      this.handleMessage(workerId, raw as WorkerIPCMessage);
    });

    // Wire exit handler
    child.on('exit', (code, signal) => {
      handle.alive = false;
      logger.info('Worker process exited', {
        agent: 'WorkerProcessManager',
        workerId,
        code,
        signal,
        pid: handle.pid,
      });
      this.callbacks.onProcessExit?.(workerId, code, signal);
    });

    // Wire error handler
    child.on('error', (err) => {
      handle.alive = false;
      logger.warn(`Worker process error: ${err.message}`, {
        agent: 'WorkerProcessManager',
        workerId,
      });
    });

    logger.info('Worker process spawned', {
      agent: 'WorkerProcessManager',
      workerId,
      pid: child.pid,
    });
  }

  /**
   * Send a work order to a worker process via IPC.
   * @param workerId
   * @param workOrder
   */
  public sendWorkOrder(workerId: string, workOrder: WorkOrder): void {
    const handle = this.processes.get(workerId);
    if (handle === undefined || !handle.alive) {
      throw new Error(`Worker ${workerId} is not alive — cannot send work order`);
    }

    const message: WorkerIPCMessage = {
      type: 'work_order',
      workerId,
      timestamp: Date.now(),
      payload: workOrder,
    };

    handle.process.send(message);
  }

  /**
   * Kill and re-spawn a worker process.
   * @param workerId
   */
  public async restartWorker(workerId: string): Promise<void> {
    await this.shutdownWorker(workerId);
    this.spawnWorker(workerId);
    logger.info('Worker restarted', { agent: 'WorkerProcessManager', workerId });
  }

  /**
   * Gracefully shut down a worker process.
   * @param workerId
   * @param timeoutMs
   */
  public async shutdownWorker(workerId: string, timeoutMs?: number): Promise<void> {
    const handle = this.processes.get(workerId);
    if (handle === undefined || !handle.alive) {
      this.processes.delete(workerId);
      return;
    }

    // Send shutdown message via IPC
    try {
      handle.process.send({
        type: 'shutdown',
        workerId,
        timestamp: Date.now(),
        payload: null,
      } satisfies WorkerIPCMessage);
    } catch {
      // IPC may already be disconnected
    }

    // Wait for graceful exit, then force kill
    const grace = timeoutMs ?? SHUTDOWN_GRACE_MS;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (handle.alive) {
          handle.process.kill('SIGKILL');
        }
        resolve();
      }, grace);

      handle.process.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    handle.alive = false;
    this.processes.delete(workerId);
  }

  /**
   * Shut down all worker processes.
   * @param timeoutMs
   */
  public async shutdownAll(timeoutMs?: number): Promise<void> {
    const workerIds = [...this.processes.keys()];
    await Promise.all(workerIds.map((id) => this.shutdownWorker(id, timeoutMs)));
  }

  /**
   * Check if a worker process is alive.
   * @param workerId
   */
  public isAlive(workerId: string): boolean {
    const handle = this.processes.get(workerId);
    return handle?.alive === true;
  }

  /**
   * Get the number of alive worker processes.
   */
  public get aliveCount(): number {
    let count = 0;
    for (const handle of this.processes.values()) {
      if (handle.alive) count++;
    }
    return count;
  }

  /**
   * Get all worker IDs managed by this process manager.
   */
  public getWorkerIds(): string[] {
    return [...this.processes.keys()];
  }

  /**
   * Handle an IPC message from a worker process.
   * @param workerId
   * @param message
   */
  private handleMessage(workerId: string, message: WorkerIPCMessage): void {
    switch (message.type) {
      case 'heartbeat':
        this.callbacks.onHeartbeat?.(workerId, message.payload as WorkerHeartbeat);
        break;
      case 'result': {
        const resultPayload = message.payload as {
          success: boolean;
          result?: unknown;
          error?: string;
        };
        if (resultPayload.success) {
          this.callbacks.onWorkComplete?.(workerId, resultPayload.result);
        } else {
          this.callbacks.onWorkError?.(workerId, resultPayload.error ?? 'Unknown error');
        }
        break;
      }
      case 'error': {
        const errorPayload = message.payload as { error?: string };
        this.callbacks.onWorkError?.(workerId, errorPayload.error ?? 'Unknown error');
        break;
      }
      default:
        break;
    }
  }
}
