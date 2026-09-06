import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SdkQuery, SdkQueryOptions } from '../../../src/execution/SdkExecutionAdapter.js';
import { sdkResult } from './sdk.js';

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/**
 * SDK boundary only: never receives the public request signal. Like SDK 0.3.258,
 * close initiates shutdown synchronously and the outer return awaits cleanup.
 * The separate inner iterator cannot complete that outer cleanup for the adapter.
 */
export class ControlledQuery implements SdkQuery {
  readonly controller: AbortController;
  readonly reading = deferred<void>();
  readonly closed = deferred<void>();
  readonly returning = deferred<void>();
  readonly cleaned = deferred<void>();
  readonly cleanupGate = deferred<void>();
  readonly terminal = deferred<SDKMessage | Error | undefined>();
  readonly iterator: AsyncGenerator<SDKMessage, void>;
  closeCalls = 0;
  returnCalls = 0;
  artifactWrites = 0;
  writerActive = true;
  private readonly abort: () => void;

  constructor(
    readonly input: SdkQueryOptions,
    messages: readonly SDKMessage[] = [],
    abortMode: 'reject' | 'end' | 'ignore' = 'reject'
  ) {
    const controller = input.options?.abortController;
    if (controller === undefined) throw new Error('Missing official abortController');
    this.controller = controller;
    this.abort = () => {
      if (abortMode === 'reject') this.terminal.resolve(new Error('SDK iterator aborted'));
      if (abortMode === 'end') this.terminal.resolve(undefined);
    };
    controller.signal.addEventListener('abort', this.abort, { once: true });
    if (controller.signal.aborted) this.abort();
    this.iterator = this.messages(messages);
  }

  private async *messages(messages: readonly SDKMessage[]): AsyncGenerator<SDKMessage, void> {
    for (const message of messages) yield message;
    this.reading.resolve();
    const terminal = await this.terminal.promise;
    if (terminal instanceof Error) throw terminal;
    if (terminal !== undefined) yield terminal;
  }

  [Symbol.asyncIterator](): AsyncGenerator<SDKMessage, void> {
    return this.iterator;
  }

  close(): void {
    this.closeCalls++;
    this.closed.resolve();
  }

  async return(value: void | PromiseLike<void>): Promise<IteratorResult<SDKMessage, void>> {
    this.returnCalls++;
    this.returning.resolve();
    await this.cleanupGate.promise;
    this.writerActive = false;
    this.controller.signal.removeEventListener('abort', this.abort);
    const result = await this.iterator.return(value);
    this.cleaned.resolve();
    return result;
  }

  finish(message: SDKMessage = sdkResult()): void {
    this.terminal.resolve(message);
  }

  async writeArtifact(): Promise<boolean> {
    if (!this.writerActive) return false;
    this.artifactWrites++;
    await writeFile(
      join(this.input.options?.cwd ?? '', 'lifecycle-sentinel.txt'),
      String(this.artifactWrites)
    );
    return true;
  }
}
