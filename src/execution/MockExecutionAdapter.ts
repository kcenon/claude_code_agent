/**
 * MockExecutionAdapter — deterministic in-memory adapter for tests.
 *
 * Two modes of use:
 *
 * 1. **Default success**: with no scripted handlers, every `execute` resolves
 *    to a canned successful result. Useful for "does the pipeline call the
 *    adapter at all" tests.
 * 2. **Scripted**: pass a list of {@link MockExecutionHandler}s. Handlers are
 *    matched by predicate against the request, in registration order; the
 *    first match wins. Unmatched calls fall back to the default success.
 *
 * Every call is recorded on {@link MockExecutionAdapter.calls} so tests can
 * assert against the request payload — most importantly, that `priorOutputs`
 * was forwarded as documented in ARCH-RFC-001 §4.1.
 *
 * @packageDocumentation
 */

import type { ExecutionAdapter, StageExecutionRequest, StageExecutionResult } from './types.js';

/**
 * Predicate-driven handler. Return null to defer to the next handler.
 */
export interface MockExecutionHandler {
  readonly match: (req: StageExecutionRequest) => boolean;
  readonly respond:
    | StageExecutionResult
    | ((req: StageExecutionRequest) => StageExecutionResult | Promise<StageExecutionResult>);
}

/**
 * Configuration knobs for the mock.
 */
export interface MockExecutionAdapterOptions {
  readonly handlers?: readonly MockExecutionHandler[];
  readonly defaultResult?: StageExecutionResult;
}

const DEFAULT_RESULT: StageExecutionResult = {
  status: 'success',
  artifacts: [],
  sessionId: 'mock-session',
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy field still populated (#956)
  toolCallCount: 0,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy field still populated (#956)
  tokenUsage: { input: 0, output: 0, cache: 0 },
};

/**
 * In-memory {@link ExecutionAdapter} that answers requests from scripted
 * handlers and records every call for assertions.
 */
export class MockExecutionAdapter implements ExecutionAdapter {
  private readonly handlers: MockExecutionHandler[];
  private readonly defaultResult: StageExecutionResult;
  private disposed = false;

  /**
   * Recorded requests, in invocation order. Tests can assert against this.
   */
  readonly calls: StageExecutionRequest[] = [];

  constructor(options: MockExecutionAdapterOptions = {}) {
    this.handlers = [...(options.handlers ?? [])];
    this.defaultResult = options.defaultResult ?? DEFAULT_RESULT;
  }

  /**
   * Answer a stage execution request from the first matching handler.
   * @param req - Stage execution request; recorded on `calls` unless already aborted
   * @returns The matching handler's result, or the default result when none matches
   */
  async execute(req: StageExecutionRequest): Promise<StageExecutionResult> {
    if (this.disposed) {
      throw new Error('MockExecutionAdapter: execute called after dispose');
    }
    if (req.signal?.aborted === true) {
      return this.abortResult(req);
    }
    this.calls.push(req);
    for (const handler of this.handlers) {
      if (handler.match(req)) {
        const value = handler.respond;
        return typeof value === 'function' ? value(req) : value;
      }
    }
    return this.defaultResult;
  }

  /**
   * Add a handler at runtime. Useful when the test arranges expectations
   * after the adapter is constructed.
   * @param handler - Handler consulted after the ones registered earlier
   */
  addHandler(handler: MockExecutionHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Reset recorded calls. Handlers are preserved.
   */
  resetCalls(): void {
    this.calls.length = 0;
  }

  /**
   * Mark the adapter disposed; later `execute` calls throw.
   * @returns Promise that resolves once the flag is set
   */
  dispose(): Promise<void> {
    this.disposed = true;
    return Promise.resolve();
  }

  private abortResult(req: StageExecutionRequest): StageExecutionResult {
    return {
      status: 'aborted',
      artifacts: [],
      sessionId: req.resume ?? 'mock-session-aborted',
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy field still populated (#956)
      toolCallCount: 0,
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy field still populated (#956)
      tokenUsage: { input: 0, output: 0, cache: 0 },
    };
  }
}
