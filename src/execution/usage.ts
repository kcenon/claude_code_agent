/**
 * SDK usage observation for one execution (#956).
 *
 * Reduces the installed SDK's message stream into {@link ExecutionMetrics}:
 * token usage that keeps unknown (`null`) apart from 0, the SDK turn count,
 * and tool invocations counted from `tool_use` content blocks. The legacy
 * `toolCallCount` and `tokenUsage` values are derived here too, so the adapter
 * keeps one reduction of the stream. See docs/guides/delivery-metrics.md.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ExecutionMetrics, TokenUsage, UsageMetrics, UsageSource } from './types.js';

/** Content block types that invoke a tool. */
const TOOL_USE_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'tool_use',
  'server_tool_use',
  'mcp_tool_use',
]);

/** Tool-name bucket for names that are not plain identifiers. */
export const OTHER_TOOL_NAME = 'other';

/** Plain identifier: built-in tools (`Read`), MCP tools (`mcp__github__create_issue`). */
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/u;
/** Model identifiers, including provider prefixes and context suffixes (`[1m]`). */
const MODEL_ID = /^[A-Za-z0-9_.:@/[\]-]{1,128}$/u;
/** Version strings such as `0.3.301` or `2.1.0-beta.1`. */
const VERSION = /^[0-9A-Za-z.+-]{1,64}$/u;

/** Usage fields read from SDK `usage` objects (`input_tokens`, ...). */
interface RawUsage {
  readonly input_tokens?: unknown;
  readonly output_tokens?: unknown;
  readonly cache_read_input_tokens?: unknown;
  readonly cache_creation_input_tokens?: unknown;
}

/** Usage fields read from SDK `modelUsage` entries (`inputTokens`, ...). */
interface RawModelUsage {
  readonly inputTokens?: unknown;
  readonly outputTokens?: unknown;
  readonly cacheReadInputTokens?: unknown;
  readonly cacheCreationInputTokens?: unknown;
}

/** Result fields read defensively: recorded or older producers may omit them. */
interface ObservedResult {
  readonly isError: boolean;
  readonly numTurns: number | null;
  readonly usage: RawUsage | undefined;
  readonly modelUsage: Readonly<Record<string, RawModelUsage>> | undefined;
}

type Tokens = Omit<UsageMetrics, 'source'>;

const NO_TOKENS: Tokens = {
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
};

/**
 * A non-negative token count, or `null` when the value is absent or invalid.
 * @param value - Raw SDK value
 * @returns Count or null
 */
function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

/**
 * Add two nullable counts: unknown stays unknown only when both are unknown.
 * @param a - First count
 * @param b - Second count
 * @returns Sum, or null when neither is known
 */
export function addCounts(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

/**
 * Map an SDK `usage` object.
 * @param usage - Raw usage
 * @returns Token counts
 */
function fromUsage(usage: RawUsage): Tokens {
  return {
    inputTokens: tokenCount(usage.input_tokens),
    outputTokens: tokenCount(usage.output_tokens),
    cacheReadInputTokens: tokenCount(usage.cache_read_input_tokens),
    cacheCreationInputTokens: tokenCount(usage.cache_creation_input_tokens),
  };
}

/**
 * Sum token counts field by field.
 * @param values - Token counts
 * @returns Field-wise sums; a field is null when no value reported it
 */
function sumTokens(values: readonly Tokens[]): Tokens {
  return values.reduce<Tokens>(
    (sum, value) => ({
      inputTokens: addCounts(sum.inputTokens, value.inputTokens),
      outputTokens: addCounts(sum.outputTokens, value.outputTokens),
      cacheReadInputTokens: addCounts(sum.cacheReadInputTokens, value.cacheReadInputTokens),
      cacheCreationInputTokens: addCounts(
        sum.cacheCreationInputTokens,
        value.cacheCreationInputTokens
      ),
    }),
    NO_TOKENS
  );
}

/**
 * Whether every reported field is zero (or unreported).
 * @param tokens - Token counts
 * @returns True for zeroed usage
 */
function isZeroed(tokens: Tokens): boolean {
  return Object.values(tokens).every((value) => value === null || value === 0);
}

/**
 * Whether any field is reported.
 * @param tokens - Token counts
 * @returns True when at least one field is known
 */
function hasTokens(tokens: Tokens): boolean {
  return Object.values(tokens).some((value) => value !== null);
}

/**
 * Keep a model identifier only when it is a plain identifier.
 * @param value - Raw model string
 * @returns Model identifier or undefined
 */
function modelId(value: unknown): string | undefined {
  return typeof value === 'string' && MODEL_ID.test(value) ? value : undefined;
}

/**
 * Narrow an unknown value to a record.
 * @param value - Candidate
 * @returns Whether it is a non-null object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Observes one execution's SDK messages. Feed every message to
 * {@link SdkUsageObserver.observe}, then read {@link SdkUsageObserver.metrics}
 * on any outcome.
 *
 * Counting rules:
 * - While a response streams, the SDK emits one assistant message per content
 *   block, and several messages share `message.id`. Usage is kept per message
 *   id (the latest wins), and tool invocations are deduplicated by the
 *   `tool_use` block id, so a re-emitted block is counted once.
 * - Assistant messages of subagents (`parent_tool_use_id` set) are included:
 *   their tool invocations and tokens belong to this execution.
 * - `stream_event` partial messages are not counted; the complete assistant
 *   message that follows carries the same blocks.
 */
export class SdkUsageObserver {
  private observed = false;
  private readonly assistantIds = new Set<string>();
  private readonly assistantUsage = new Map<string, Tokens>();
  private readonly toolUseIds = new Set<string>();
  private readonly toolUses = new Map<string, number>();
  private readonly models = new Set<string>();
  private initModel: string | undefined;
  private claudeCodeVersion: string | null = null;
  private result: ObservedResult | undefined;

  /**
   * Observe one SDK message.
   * @param message - Message from the SDK query
   */
  observe(message: SDKMessage): void {
    this.observed = true;
    if (message.type === 'system' && message.subtype === 'init') {
      this.initModel = modelId(message.model) ?? this.initModel;
      if (this.initModel !== undefined) this.models.add(this.initModel);
      const version: unknown = message.claude_code_version;
      if (typeof version === 'string' && VERSION.test(version)) this.claudeCodeVersion = version;
      return;
    }
    if (message.type === 'assistant') {
      this.observeAssistant(message.message);
      return;
    }
    if (message.type === 'result') {
      const raw = message as unknown as Record<string, unknown>;
      const usage = raw['usage'];
      const modelUsage = raw['modelUsage'];
      this.result = {
        isError: message.subtype !== 'success' || raw['is_error'] === true,
        numTurns: tokenCount(raw['num_turns']),
        usage: isRecord(usage) ? usage : undefined,
        modelUsage: isRecord(modelUsage)
          ? (modelUsage as Record<string, RawModelUsage>)
          : undefined,
      };
      for (const model of Object.keys(this.result.modelUsage ?? {})) {
        const id = modelId(model);
        if (id !== undefined) this.models.add(id);
      }
    }
  }

  /**
   * Record one assistant API message (or one streamed block of it).
   * @param message - `SDKAssistantMessage.message`
   */
  private observeAssistant(message: unknown): void {
    if (!isRecord(message)) return;
    const id = typeof message['id'] === 'string' ? message['id'] : undefined;
    if (id !== undefined) this.assistantIds.add(id);
    const model = modelId(message['model']);
    if (model !== undefined) this.models.add(model);
    const usage = message['usage'];
    if (id !== undefined && isRecord(usage)) this.assistantUsage.set(id, fromUsage(usage));
    const content = message['content'];
    if (!Array.isArray(content)) return;
    for (const block of content as unknown[]) {
      if (!isRecord(block) || typeof block['type'] !== 'string') continue;
      if (!TOOL_USE_BLOCK_TYPES.has(block['type'])) continue;
      const blockId = block['id'];
      if (typeof blockId !== 'string' || blockId === '' || this.toolUseIds.has(blockId)) continue;
      this.toolUseIds.add(blockId);
      const rawName = block['name'];
      const name =
        typeof rawName === 'string' && TOOL_NAME.test(rawName) ? rawName : OTHER_TOOL_NAME;
      this.toolUses.set(name, (this.toolUses.get(name) ?? 0) + 1);
    }
  }

  /**
   * Token usage reported by the result message, if any.
   * @returns Counts from `modelUsage` (every model call), else from `usage`
   */
  private resultTokens(): Tokens | undefined {
    const result = this.result;
    if (result === undefined) return undefined;
    const models = Object.values(result.modelUsage ?? {}).filter(isRecord);
    if (models.length > 0)
      return sumTokens(
        models.map((entry) => ({
          inputTokens: tokenCount(entry.inputTokens),
          outputTokens: tokenCount(entry.outputTokens),
          cacheReadInputTokens: tokenCount(entry.cacheReadInputTokens),
          cacheCreationInputTokens: tokenCount(entry.cacheCreationInputTokens),
        }))
      );
    if (result.usage === undefined) return undefined;
    const tokens = fromUsage(result.usage);
    return hasTokens(tokens) ? tokens : undefined;
  }

  /**
   * Whether the result usage is authoritative. The SDK writes zeroed usage on
   * crash and startup-error results, so a zeroed error result is not a
   * measurement.
   * @param tokens - Result token counts
   * @returns True when the result usage is a measurement
   */
  private resultIsMeasured(tokens: Tokens): boolean {
    return this.result?.isError !== true || !isZeroed(tokens);
  }

  /**
   * Usage of the execution on any outcome.
   * @returns Usage with its source
   */
  usage(): UsageMetrics {
    const fromResult = this.resultTokens();
    if (fromResult !== undefined && this.resultIsMeasured(fromResult))
      return { ...fromResult, source: 'result' };
    if (this.assistantUsage.size > 0)
      return { ...sumTokens([...this.assistantUsage.values()]), source: 'partial' };
    return { ...NO_TOKENS, source: 'none' };
  }

  /**
   * Observations of the execution on any outcome.
   * @param sdkVersion - Installed SDK package version
   * @returns Execution metrics
   */
  metrics(sdkVersion: string | null = installedSdkVersion()): ExecutionMetrics {
    const models = [...this.models].sort();
    return {
      usage: this.usage(),
      turnCount: this.result?.numTurns ?? null,
      toolUseCount: this.observed ? this.toolUseIds.size : null,
      toolUses: Object.fromEntries([...this.toolUses].sort(([a], [b]) => a.localeCompare(b))),
      modelId: this.initModel ?? models[0] ?? null,
      models,
      sdkVersion,
      claudeCodeVersion: this.claudeCodeVersion,
    };
  }

  /**
   * Legacy `toolCallCount`: the larger of the distinct assistant messages and
   * the SDK turn count (unchanged semantics).
   * @returns Legacy count
   */
  legacyToolCallCount(): number {
    return Math.max(this.assistantIds.size, this.result?.numTurns ?? 0);
  }

  /**
   * Legacy `tokenUsage`: the result's main-loop `usage` when it is a
   * measurement, else the partial sum of assistant messages, with unknown as 0
   * and cache read plus creation merged.
   * @returns Legacy totals
   */
  legacyTokenUsage(): TokenUsage {
    const usage = this.result?.usage;
    const fromResult = usage === undefined ? undefined : fromUsage(usage);
    const tokens =
      fromResult !== undefined && hasTokens(fromResult) && this.resultIsMeasured(fromResult)
        ? fromResult
        : sumTokens([...this.assistantUsage.values()]);
    return {
      input: tokens.inputTokens ?? 0,
      output: tokens.outputTokens ?? 0,
      cache: (tokens.cacheReadInputTokens ?? 0) + (tokens.cacheCreationInputTokens ?? 0),
    };
  }
}

/**
 * Metrics of an execution without SDK observations.
 * @param source - `recovered` when resume reused a committed manifest (no SDK
 *   call, so counts are a measured 0); `none` when nothing was observed (counts
 *   are unknown)
 * @returns Metrics with zero (recovered) or unknown (`null`) counts
 */
export function unobservedExecutionMetrics(
  source: Extract<UsageSource, 'recovered' | 'none'>
): ExecutionMetrics {
  const value = source === 'recovered' ? 0 : null;
  return {
    usage: {
      inputTokens: value,
      outputTokens: value,
      cacheReadInputTokens: value,
      cacheCreationInputTokens: value,
      source,
    },
    turnCount: value,
    toolUseCount: value,
    toolUses: {},
    modelId: null,
    models: [],
    sdkVersion: null,
    claudeCodeVersion: null,
  };
}

let sdkVersionCache: string | null | undefined;

/**
 * Version of the installed `@anthropic-ai/claude-agent-sdk` package, read
 * once from its `package.json`.
 * @returns Version, or null when the package cannot be resolved
 */
export function installedSdkVersion(): string | null {
  if (sdkVersionCache !== undefined) return sdkVersionCache;
  try {
    const entry = createRequire(import.meta.url).resolve('@anthropic-ai/claude-agent-sdk');
    const raw: unknown = JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8'));
    const version = isRecord(raw) ? raw['version'] : undefined;
    sdkVersionCache = typeof version === 'string' && VERSION.test(version) ? version : null;
  } catch {
    sdkVersionCache = null;
  }
  return sdkVersionCache;
}
