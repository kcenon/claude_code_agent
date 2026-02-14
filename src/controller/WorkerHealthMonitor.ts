/**
 * Worker Health Monitor module
 *
 * Provides heartbeat tracking, health check execution, and zombie worker detection
 * for the Worker Pool Manager.
 *
 * @module controller/WorkerHealthMonitor
 */

import type {
  WorkerHeartbeat,
  HealthCheckConfig,
  WorkerHealthStatus,
  WorkerHealthInfo,
  HealthMonitorStatus,
  HealthEvent,
  HealthEventType,
  HealthEventCallback,
  WorkerInfo,
} from './types.js';
import { DEFAULT_HEALTH_CHECK_CONFIG } from './types.js';
import { HealthMonitorAlreadyRunningError, HealthMonitorNotRunningError } from './errors.js';

/**
 * Internal mutable worker health state
 */
interface MutableWorkerHealthState {
  workerId: string;
  healthStatus: WorkerHealthStatus;
  lastHeartbeat: WorkerHeartbeat | null;
  missedHeartbeats: number;
  restartCount: number;
  lastRestartAt: number | null;
}

/**
 * Callback type for zombie worker handling
 */
export type ZombieWorkerHandler = (workerId: string, currentTask: string | null) => Promise<void>;

/**
 * Callback type for worker restart
 */
export type WorkerRestartHandler = (workerId: string) => Promise<void>;

/**
 * Callback type for task reassignment
 */
export type TaskReassignmentHandler = (
  taskId: string,
  fromWorkerId: string
) => Promise<string | null>;

/**
 * Worker Health Monitor
 *
 * Monitors worker health through heartbeats and periodic health checks.
 * Detects zombie workers and triggers recovery actions.
 */
export class WorkerHealthMonitor {
  private readonly config: Required<HealthCheckConfig>;
  private readonly workerStates: Map<string, MutableWorkerHealthState>;
  private readonly eventListeners: HealthEventCallback[];

  private healthCheckTimer: ReturnType<typeof setInterval> | null;
  private isRunning: boolean;

  private onZombieDetected?: ZombieWorkerHandler;
  private onWorkerRestart?: WorkerRestartHandler;
  private onTaskReassign?: TaskReassignmentHandler;

  constructor(config: HealthCheckConfig = {}) {
    this.config = {
      heartbeatIntervalMs:
        config.heartbeatIntervalMs ?? DEFAULT_HEALTH_CHECK_CONFIG.heartbeatIntervalMs,
      healthCheckIntervalMs:
        config.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_CONFIG.healthCheckIntervalMs,
      missedHeartbeatThreshold:
        config.missedHeartbeatThreshold ?? DEFAULT_HEALTH_CHECK_CONFIG.missedHeartbeatThreshold,
      memoryThresholdBytes:
        config.memoryThresholdBytes ?? DEFAULT_HEALTH_CHECK_CONFIG.memoryThresholdBytes,
      maxRestarts: config.maxRestarts ?? DEFAULT_HEALTH_CHECK_CONFIG.maxRestarts,
      restartCooldownMs: config.restartCooldownMs ?? DEFAULT_HEALTH_CHECK_CONFIG.restartCooldownMs,
    };

    this.workerStates = new Map();
    this.eventListeners = [];
    this.healthCheckTimer = null;
    this.isRunning = false;
  }

  /**
   * Initialize health tracking for a worker
   * @param workerId - Unique identifier of the worker to register
   */
  public registerWorker(workerId: string): void {
    if (!this.workerStates.has(workerId)) {
      this.workerStates.set(workerId, {
        workerId,
        healthStatus: 'healthy',
        lastHeartbeat: null,
        missedHeartbeats: 0,
        restartCount: 0,
        lastRestartAt: null,
      });
    }
  }

  /**
   * Remove health tracking for a worker
   * @param workerId - Unique identifier of the worker to unregister
   */
  public unregisterWorker(workerId: string): void {
    this.workerStates.delete(workerId);
  }

  /**
   * Start health monitoring
   * @param getActiveWorkers Function to get current active workers
   * @throws HealthMonitorAlreadyRunningError if already running
   */
  public start(getActiveWorkers: () => readonly WorkerInfo[]): void {
    if (this.isRunning) {
      throw new HealthMonitorAlreadyRunningError();
    }

    this.isRunning = true;

    // Register all active workers
    const workers = getActiveWorkers();
    for (const worker of workers) {
      this.registerWorker(worker.id);
    }

    // Start periodic health checks
    this.healthCheckTimer = setInterval(() => {
      void this.performHealthCheck(getActiveWorkers);
    }, this.config.healthCheckIntervalMs);

    // Run initial check
    void this.performHealthCheck(getActiveWorkers);
  }

  /**
   * Stop health monitoring
   * @throws HealthMonitorNotRunningError if not running
   */
  public stop(): void {
    if (!this.isRunning) {
      throw new HealthMonitorNotRunningError();
    }

    if (this.healthCheckTimer !== null) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * Check if the monitor is currently running
   * @returns True if health check loop is active
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Record a heartbeat from a worker
   * @param heartbeat - Heartbeat payload containing worker ID, timestamp, and metrics
   */
  public recordHeartbeat(heartbeat: WorkerHeartbeat): void {
    const state = this.workerStates.get(heartbeat.workerId);

    if (state === undefined) {
      // Auto-register unknown worker
      this.registerWorker(heartbeat.workerId);
      const newState = this.workerStates.get(heartbeat.workerId);
      if (newState !== undefined) {
        newState.lastHeartbeat = heartbeat;
        newState.missedHeartbeats = 0;
        newState.healthStatus = 'healthy';
      }
    } else {
      state.lastHeartbeat = heartbeat;
      state.missedHeartbeats = 0;

      // Recover from degraded state
      if (state.healthStatus === 'degraded') {
        state.healthStatus = 'healthy';
      }
    }

    void this.emitEvent('heartbeat_received', heartbeat.workerId, {
      timestamp: heartbeat.timestamp,
      memoryUsage: heartbeat.memoryUsage,
      currentTask: heartbeat.currentTask,
    });
  }

  /**
   * Perform periodic health check on all workers
   * @param getActiveWorkers - Callback that returns the current list of active workers
   */
  private async performHealthCheck(getActiveWorkers: () => readonly WorkerInfo[]): Promise<void> {
    const now = Date.now();
    const activeWorkers = getActiveWorkers();

    // Sync worker list
    for (const worker of activeWorkers) {
      if (!this.workerStates.has(worker.id)) {
        this.registerWorker(worker.id);
      }
    }

    // Check each tracked worker
    for (const state of this.workerStates.values()) {
      await this.checkWorkerHealth(state, now);
    }
  }

  /**
   * Check health of a single worker
   * @param state - Mutable health state for the worker being checked
   * @param now - Current timestamp in milliseconds for heartbeat comparison
   */
  private async checkWorkerHealth(state: MutableWorkerHealthState, now: number): Promise<void> {
    // Skip workers that are already being restarted
    if (state.healthStatus === 'restarting') {
      return;
    }

    // Check heartbeat status
    if (state.lastHeartbeat === null) {
      // No heartbeat ever received - increment missed count
      state.missedHeartbeats++;
    } else {
      // Calculate missed heartbeats based on time since last heartbeat
      const timeSinceHeartbeat = now - state.lastHeartbeat.timestamp;
      const expectedHeartbeats = Math.floor(timeSinceHeartbeat / this.config.heartbeatIntervalMs);

      if (expectedHeartbeats > 0) {
        state.missedHeartbeats = expectedHeartbeats;
      }
    }

    // Check for missed heartbeat threshold
    if (state.missedHeartbeats >= this.config.missedHeartbeatThreshold) {
      await this.handleZombieWorker(state);
    } else if (state.missedHeartbeats > 0 && state.healthStatus === 'healthy') {
      // Mark as degraded if any heartbeats missed
      state.healthStatus = 'degraded';
      void this.emitEvent('heartbeat_missed', state.workerId, {
        missedCount: state.missedHeartbeats,
      });
    }

    // Check memory threshold
    if (
      state.lastHeartbeat !== null &&
      state.lastHeartbeat.memoryUsage > this.config.memoryThresholdBytes
    ) {
      void this.emitEvent('memory_threshold_exceeded', state.workerId, {
        memoryUsage: state.lastHeartbeat.memoryUsage,
        threshold: this.config.memoryThresholdBytes,
      });
    }
  }

  /**
   * Handle a zombie worker
   * @param state - Health state of the worker identified as a zombie
   */
  private async handleZombieWorker(state: MutableWorkerHealthState): Promise<void> {
    const currentTask = state.lastHeartbeat?.currentTask ?? null;

    // Mark as zombie
    state.healthStatus = 'zombie';

    // Emit zombie detected event
    void this.emitEvent('zombie_detected', state.workerId, {
      missedHeartbeats: state.missedHeartbeats,
      currentTask,
    });

    // Notify zombie handler
    if (this.onZombieDetected !== undefined) {
      try {
        await this.onZombieDetected(state.workerId, currentTask);
      } catch {
        // Log but don't throw - continue with recovery
      }
    }

    // Attempt task reassignment
    if (currentTask !== null && this.onTaskReassign !== undefined) {
      try {
        const newWorkerId = await this.onTaskReassign(currentTask, state.workerId);
        if (newWorkerId !== null) {
          void this.emitEvent('task_reassigned', state.workerId, {
            taskId: currentTask,
            newWorkerId,
          });
        }
      } catch {
        // Task reassignment failed - will be retried
      }
    }

    // Attempt worker restart
    await this.attemptWorkerRestart(state);
  }

  /**
   * Attempt to restart a zombie worker
   * @param state - Health state of the zombie worker to restart
   */
  private async attemptWorkerRestart(state: MutableWorkerHealthState): Promise<void> {
    const now = Date.now();

    // Check restart cooldown
    if (state.lastRestartAt !== null && now - state.lastRestartAt < this.config.restartCooldownMs) {
      return; // Still in cooldown
    }

    // Check max restarts
    if (state.restartCount >= this.config.maxRestarts) {
      void this.emitEvent('worker_restart_failed', state.workerId, {
        restartCount: state.restartCount,
        maxRestarts: this.config.maxRestarts,
        reason: 'max_restarts_exceeded',
      });

      // Don't throw - just log and leave worker in zombie state
      // The caller should check for this condition via getZombieWorkers()
      return;
    }

    // Mark as restarting
    state.healthStatus = 'restarting';
    state.restartCount++;
    state.lastRestartAt = now;

    void this.emitEvent('worker_restarting', state.workerId, {
      restartCount: state.restartCount,
    });

    // Trigger restart
    if (this.onWorkerRestart !== undefined) {
      try {
        await this.onWorkerRestart(state.workerId);

        // Reset state after successful restart
        state.healthStatus = 'healthy';
        state.missedHeartbeats = 0;
        state.lastHeartbeat = null;

        void this.emitEvent('worker_restarted', state.workerId, {
          restartCount: state.restartCount,
        });
      } catch (error) {
        // Restart failed
        state.healthStatus = 'zombie';

        void this.emitEvent('worker_restart_failed', state.workerId, {
          restartCount: state.restartCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get the current health status of a worker
   * @param workerId - Unique identifier of the worker to query
   * @returns Worker health info, or null if the worker is not tracked
   */
  public getWorkerHealth(workerId: string): WorkerHealthInfo | null {
    const state = this.workerStates.get(workerId);
    if (state === undefined) {
      return null;
    }

    return {
      workerId: state.workerId,
      healthStatus: state.healthStatus,
      lastHeartbeat: state.lastHeartbeat?.timestamp ?? null,
      missedHeartbeats: state.missedHeartbeats,
      memoryUsage: state.lastHeartbeat?.memoryUsage ?? 0,
      restartCount: state.restartCount,
      lastRestartAt: state.lastRestartAt,
    };
  }

  /**
   * Get the overall health monitor status
   * @returns Aggregate status with worker counts by health category
   */
  public getStatus(): HealthMonitorStatus {
    const workers: WorkerHealthInfo[] = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let zombieCount = 0;
    let restartingCount = 0;

    for (const state of this.workerStates.values()) {
      const healthInfo = this.getWorkerHealth(state.workerId);
      if (healthInfo !== null) {
        workers.push(healthInfo);

        switch (state.healthStatus) {
          case 'healthy':
            healthyCount++;
            break;
          case 'degraded':
            degradedCount++;
            break;
          case 'zombie':
            zombieCount++;
            break;
          case 'restarting':
            restartingCount++;
            break;
        }
      }
    }

    return {
      isActive: this.isRunning,
      totalWorkers: workers.length,
      healthyCount,
      degradedCount,
      zombieCount,
      restartingCount,
      workers,
    };
  }

  /**
   * Get all zombie workers
   * @returns Array of health info for workers in zombie state
   */
  public getZombieWorkers(): readonly WorkerHealthInfo[] {
    const zombies: WorkerHealthInfo[] = [];

    for (const state of this.workerStates.values()) {
      if (state.healthStatus === 'zombie') {
        const healthInfo = this.getWorkerHealth(state.workerId);
        if (healthInfo !== null) {
          zombies.push(healthInfo);
        }
      }
    }

    return zombies;
  }

  /**
   * Set zombie detection handler
   * @param handler - Async callback invoked when a worker is identified as a zombie
   */
  public onZombie(handler: ZombieWorkerHandler): void {
    this.onZombieDetected = handler;
  }

  /**
   * Set worker restart handler
   * @param handler - Async callback invoked to perform the actual worker restart
   */
  public onRestart(handler: WorkerRestartHandler): void {
    this.onWorkerRestart = handler;
  }

  /**
   * Set task reassignment handler
   * @param handler - Async callback invoked to reassign a task from a failed worker
   */
  public onReassign(handler: TaskReassignmentHandler): void {
    this.onTaskReassign = handler;
  }

  /**
   * Register an event listener
   * @param callback - Function called for every health event emitted by the monitor
   */
  public onEvent(callback: HealthEventCallback): void {
    this.eventListeners.push(callback);
  }

  /**
   * Emit an event to all listeners
   * @param type - Category of health event being emitted
   * @param workerId - Worker that triggered the event
   * @param data - Additional event-specific payload
   */
  private async emitEvent(
    type: HealthEventType,
    workerId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const event: HealthEvent = {
      type,
      timestamp: new Date().toISOString(),
      workerId,
      data,
    };

    for (const listener of this.eventListeners) {
      try {
        await listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Reset a worker's health state
   * @param workerId - Unique identifier of the worker to reset
   */
  public resetWorkerHealth(workerId: string): void {
    const state = this.workerStates.get(workerId);
    if (state !== undefined) {
      state.healthStatus = 'healthy';
      state.missedHeartbeats = 0;
      state.lastHeartbeat = null;
      // Keep restart count for tracking purposes
    }
  }

  /**
   * Reset all state
   */
  public reset(): void {
    if (this.isRunning) {
      this.stop();
    }

    this.workerStates.clear();
    this.eventListeners.length = 0;
  }

  /**
   * Get the configuration
   * @returns Copy of the resolved health check configuration with all defaults applied
   */
  public getConfig(): Required<HealthCheckConfig> {
    return { ...this.config };
  }
}
