#!/usr/bin/env node

/**
 * Worker child process entry point
 *
 * Spawned by WorkerProcessManager via child_process.fork().
 * Receives WorkOrder via IPC, runs WorkerAgent.implement(), sends result back.
 * Sends periodic heartbeats to the parent process.
 */

import type { WorkerIPCMessage } from '../controller/types.js';
import type { WorkerHeartbeat } from '../controller/types.js';
import type { WorkOrder } from '../controller/types.js';
import { WorkerAgent } from './WorkerAgent.js';

const workerId = process.env['WORKER_ID'] ?? 'unknown';
const heartbeatIntervalMs = parseInt(process.env['HEARTBEAT_INTERVAL_MS'] ?? '5000', 10);

let currentWorkOrderId: string | null = null;
let isWorking = false;

/**
 * Send an IPC message to the parent controller process
 * @param msg
 */
function sendToParent(msg: WorkerIPCMessage): void {
  if (typeof process.send === 'function') {
    process.send(msg);
  }
}

/**
 * Send periodic heartbeats
 */
const heartbeatTimer = setInterval(() => {
  const heartbeat: WorkerHeartbeat = {
    workerId,
    timestamp: Date.now(),
    ...(currentWorkOrderId !== null ? { currentTask: currentWorkOrderId } : {}),
    progress: 0,
    memoryUsage: process.memoryUsage().heapUsed,
    status: isWorking ? 'busy' : 'idle',
  };
  sendToParent({
    type: 'heartbeat',
    workerId,
    timestamp: Date.now(),
    payload: heartbeat,
  });
}, heartbeatIntervalMs);

/**
 * Handle incoming IPC messages from the controller
 */
process.on('message', (raw: unknown) => {
  const message = raw as WorkerIPCMessage;

  switch (message.type) {
    case 'work_order':
      void handleWorkOrder(message.payload as WorkOrder);
      break;
    case 'shutdown':
      handleShutdown();
      break;
    default:
      break;
  }
});

/**
 * Execute a work order using WorkerAgent
 * @param workOrder
 */
async function handleWorkOrder(workOrder: WorkOrder): Promise<void> {
  currentWorkOrderId = workOrder.issueId;
  isWorking = true;

  const agent = new WorkerAgent({
    projectRoot: process.env['PROJECT_DIR'] ?? process.cwd(),
  });

  try {
    await agent.initialize();
    const result = await agent.implement(workOrder);

    sendToParent({
      type: 'result',
      workerId,
      timestamp: Date.now(),
      payload: {
        success: true,
        workOrderId: workOrder.issueId,
        result,
      },
    });
  } catch (error) {
    sendToParent({
      type: 'error',
      workerId,
      timestamp: Date.now(),
      payload: {
        success: false,
        workOrderId: workOrder.issueId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  } finally {
    currentWorkOrderId = null;
    isWorking = false;
    try {
      await agent.dispose();
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Handle graceful shutdown request from controller
 */
function handleShutdown(): void {
  clearInterval(heartbeatTimer);
  sendToParent({
    type: 'heartbeat',
    workerId,
    timestamp: Date.now(),
    payload: { workerId, timestamp: Date.now(), status: 'idle', progress: 0 },
  });
  process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  sendToParent({
    type: 'error',
    workerId,
    timestamp: Date.now(),
    payload: { error: `Uncaught exception: ${error.message}`, fatal: true },
  });
  clearInterval(heartbeatTimer);
  process.exit(1);
});
