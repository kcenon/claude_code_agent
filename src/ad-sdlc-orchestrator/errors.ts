/**
 * AD-SDLC Orchestrator Agent error classes
 *
 * Custom error types for pipeline orchestration operations.
 */

import type { PipelineMode, PipelineStatus, StageName } from './types.js';

/**
 * Base error class for AD-SDLC Orchestrator Agent
 */
export class OrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestratorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when there is no active orchestrator session
 */
export class NoActiveSessionError extends OrchestratorError {
  constructor() {
    super('No active orchestrator session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when a pipeline is already in progress
 */
export class PipelineInProgressError extends OrchestratorError {
  public readonly pipelineId: string;

  constructor(pipelineId: string) {
    super(
      `Pipeline already in progress: ${pipelineId}. Complete or cancel before starting a new one.`
    );
    this.name = 'PipelineInProgressError';
    this.pipelineId = pipelineId;
  }
}

/**
 * Error thrown when project directory is invalid
 */
export class InvalidProjectDirError extends OrchestratorError {
  public readonly dir: string;
  public readonly reason: string;

  constructor(dir: string, reason: string) {
    super(`Invalid project directory "${dir}": ${reason}`);
    this.name = 'InvalidProjectDirError';
    this.dir = dir;
    this.reason = reason;
  }
}

/**
 * Error thrown when a pipeline stage fails
 */
export class StageExecutionError extends OrchestratorError {
  public readonly stage: StageName;
  public readonly reason: string;
  public readonly retryCount: number;

  constructor(stage: StageName, reason: string, retryCount: number = 0) {
    super(`Stage "${stage}" failed after ${String(retryCount)} retries: ${reason}`);
    this.name = 'StageExecutionError';
    this.stage = stage;
    this.reason = reason;
    this.retryCount = retryCount;
  }
}

/**
 * Error thrown when a stage times out
 */
export class StageTimeoutError extends OrchestratorError {
  public readonly stage: StageName;
  public readonly timeoutMs: number;

  constructor(stage: StageName, timeoutMs: number) {
    super(`Stage "${stage}" timed out after ${String(timeoutMs)}ms`);
    this.name = 'StageTimeoutError';
    this.stage = stage;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when stage dependencies are not satisfied
 */
export class StageDependencyError extends OrchestratorError {
  public readonly stage: StageName;
  public readonly failedDependencies: readonly StageName[];

  constructor(stage: StageName, failedDependencies: readonly StageName[]) {
    super(
      `Cannot execute stage "${stage}": dependencies failed: ${failedDependencies.join(', ')}`
    );
    this.name = 'StageDependencyError';
    this.stage = stage;
    this.failedDependencies = failedDependencies;
  }
}

/**
 * Error thrown when an unsupported pipeline mode is requested
 */
export class UnsupportedModeError extends OrchestratorError {
  public readonly mode: string;

  constructor(mode: string) {
    super(`Unsupported pipeline mode: "${mode}". Expected: greenfield, enhancement, or import.`);
    this.name = 'UnsupportedModeError';
    this.mode = mode;
  }
}

/**
 * Error thrown when the entire pipeline fails
 */
export class PipelineFailedError extends OrchestratorError {
  public readonly pipelineId: string;
  public readonly mode: PipelineMode;
  public readonly failedStages: readonly StageName[];

  constructor(pipelineId: string, mode: PipelineMode, failedStages: readonly StageName[]) {
    super(
      `Pipeline "${pipelineId}" (${mode}) failed. Failed stages: ${failedStages.join(', ')}`
    );
    this.name = 'PipelineFailedError';
    this.pipelineId = pipelineId;
    this.mode = mode;
    this.failedStages = failedStages;
  }
}

/**
 * Error thrown when pipeline state persistence fails
 */
export class StatePersistenceError extends OrchestratorError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to persist pipeline state to "${path}": ${reason}`);
    this.name = 'StatePersistenceError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when pipeline status is invalid for the requested operation
 */
export class InvalidPipelineStatusError extends OrchestratorError {
  public readonly currentStatus: PipelineStatus;
  public readonly operation: string;

  constructor(operation: string, currentStatus: PipelineStatus) {
    super(`Cannot perform "${operation}": pipeline status is "${currentStatus}"`);
    this.name = 'InvalidPipelineStatusError';
    this.currentStatus = currentStatus;
    this.operation = operation;
  }
}
