/**
 * Analysis Orchestrator Agent error classes
 *
 * Custom error types for pipeline orchestration operations.
 */

import type { PipelineStageName, PipelineStageStatus } from './types.js';

/**
 * Base error class for Analysis Orchestrator Agent
 */
export class AnalysisOrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisOrchestratorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when there's no active analysis session
 */
export class NoActiveSessionError extends AnalysisOrchestratorError {
  constructor() {
    super('No active analysis session. Call startAnalysis() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when analysis is already in progress
 */
export class AnalysisInProgressError extends AnalysisOrchestratorError {
  public readonly analysisId: string;

  constructor(analysisId: string) {
    super(
      `Analysis already in progress: ${analysisId}. Complete or cancel before starting a new one.`
    );
    this.name = 'AnalysisInProgressError';
    this.analysisId = analysisId;
  }
}

/**
 * Error thrown when project path is invalid
 */
export class InvalidProjectPathError extends AnalysisOrchestratorError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Invalid project path "${path}": ${reason}`);
    this.name = 'InvalidProjectPathError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when project structure is invalid
 */
export class InvalidProjectStructureError extends AnalysisOrchestratorError {
  public readonly path: string;
  public readonly missingItems: readonly string[];

  constructor(path: string, missingItems: readonly string[]) {
    super(`Invalid project structure at "${path}". Missing: ${missingItems.join(', ')}`);
    this.name = 'InvalidProjectStructureError';
    this.path = path;
    this.missingItems = missingItems;
  }
}

/**
 * Error thrown when a pipeline stage fails
 */
export class StageExecutionError extends AnalysisOrchestratorError {
  public readonly stage: PipelineStageName;
  public readonly reason: string;
  public readonly retryCount: number;

  constructor(stage: PipelineStageName, reason: string, retryCount: number = 0) {
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
export class StageTimeoutError extends AnalysisOrchestratorError {
  public readonly stage: PipelineStageName;
  public readonly timeoutMs: number;
  public readonly startTime: Date;

  constructor(stage: PipelineStageName, timeoutMs: number, startTime?: Date) {
    super(`Stage "${stage}" timed out after ${String(timeoutMs)}ms`);
    this.name = 'StageTimeoutError';
    this.stage = stage;
    this.timeoutMs = timeoutMs;
    this.startTime = startTime ?? new Date();
  }
}

/**
 * Error thrown when circuit breaker is open for a stage
 */
export class CircuitOpenError extends AnalysisOrchestratorError {
  public readonly stage: PipelineStageName;
  public readonly failureCount: number;
  public readonly resetTimeMs: number;

  constructor(stage: PipelineStageName, failureCount: number, resetTimeMs: number) {
    super(
      `Circuit breaker is open for stage "${stage}" after ${String(failureCount)} consecutive failures. ` +
        `Will retry after ${String(resetTimeMs)}ms.`
    );
    this.name = 'CircuitOpenError';
    this.stage = stage;
    this.failureCount = failureCount;
    this.resetTimeMs = resetTimeMs;
  }
}

/**
 * Error thrown when pipeline state is invalid
 */
export class InvalidPipelineStateError extends AnalysisOrchestratorError {
  public readonly currentStatus: PipelineStageStatus;
  public readonly expectedStatus: PipelineStageStatus;
  public readonly operation: string;

  constructor(
    operation: string,
    currentStatus: PipelineStageStatus,
    expectedStatus: PipelineStageStatus
  ) {
    super(
      `Cannot perform "${operation}": stage status is "${currentStatus}", expected "${expectedStatus}"`
    );
    this.name = 'InvalidPipelineStateError';
    this.currentStatus = currentStatus;
    this.expectedStatus = expectedStatus;
    this.operation = operation;
  }
}

/**
 * Error thrown when stage dependencies are not met
 */
export class StageDependencyError extends AnalysisOrchestratorError {
  public readonly stage: PipelineStageName;
  public readonly requiredStages: readonly PipelineStageName[];
  public readonly failedStages: readonly PipelineStageName[];

  constructor(
    stage: PipelineStageName,
    requiredStages: readonly PipelineStageName[],
    failedStages: readonly PipelineStageName[]
  ) {
    super(`Cannot execute stage "${stage}": required stages failed: ${failedStages.join(', ')}`);
    this.name = 'StageDependencyError';
    this.stage = stage;
    this.requiredStages = requiredStages;
    this.failedStages = failedStages;
  }
}

/**
 * Error thrown when output cannot be written
 */
export class OutputWriteError extends AnalysisOrchestratorError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to write output to "${path}": ${reason}`);
    this.name = 'OutputWriteError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when state file cannot be read
 */
export class StateReadError extends AnalysisOrchestratorError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to read state from "${path}": ${reason}`);
    this.name = 'StateReadError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when analysis cannot be resumed
 */
export class ResumeError extends AnalysisOrchestratorError {
  public readonly analysisId: string;
  public readonly reason: string;

  constructor(analysisId: string, reason: string) {
    super(`Cannot resume analysis "${analysisId}": ${reason}`);
    this.name = 'ResumeError';
    this.analysisId = analysisId;
    this.reason = reason;
  }
}

/**
 * Error thrown when analysis is not found
 */
export class AnalysisNotFoundError extends AnalysisOrchestratorError {
  public readonly analysisId: string;

  constructor(analysisId: string) {
    super(`Analysis not found: "${analysisId}"`);
    this.name = 'AnalysisNotFoundError';
    this.analysisId = analysisId;
  }
}

/**
 * Error thrown when all pipeline stages fail
 */
export class PipelineFailedError extends AnalysisOrchestratorError {
  public readonly analysisId: string;
  public readonly failedStages: readonly PipelineStageName[];

  constructor(analysisId: string, failedStages: readonly PipelineStageName[]) {
    super(
      `Pipeline failed for analysis "${analysisId}". Failed stages: ${failedStages.join(', ')}`
    );
    this.name = 'PipelineFailedError';
    this.analysisId = analysisId;
    this.failedStages = failedStages;
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class InvalidConfigurationError extends AnalysisOrchestratorError {
  public readonly field: string;
  public readonly value: unknown;
  public readonly reason: string;

  constructor(field: string, value: unknown, reason: string) {
    super(`Invalid configuration for "${field}": ${reason}`);
    this.name = 'InvalidConfigurationError';
    this.field = field;
    this.value = value;
    this.reason = reason;
  }
}

/**
 * Error thrown when sub-agent spawning fails
 */
export class SubAgentSpawnError extends AnalysisOrchestratorError {
  public readonly agentType: string;
  public readonly reason: string;

  constructor(agentType: string, reason: string) {
    super(`Failed to spawn sub-agent "${agentType}": ${reason}`);
    this.name = 'SubAgentSpawnError';
    this.agentType = agentType;
    this.reason = reason;
  }
}
