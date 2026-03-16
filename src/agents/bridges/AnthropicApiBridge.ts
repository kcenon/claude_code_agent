/**
 * AnthropicApiBridge - Invokes agents via Anthropic Messages API
 *
 * Used in standalone CLI mode (npx ad-sdlc run). Reads the agent's
 * .claude/agents/<type>.md file to construct the system prompt, and maps
 * model_preference from agents.yaml to model IDs.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentBridge, AgentRequest, AgentResponse } from '../AgentBridge.js';
import {
  getToolDefinitions,
  executeTool,
  type ContentBlock,
  type ConversationMessage,
  type ToolResultBlock,
} from './tools.js';

/** Model ID mapping from agents.yaml model_preference to Anthropic API model IDs */
const MODEL_MAP: Record<string, string> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_TURNS = 10;

/** Default per-call API timeout: 2 minutes */
const DEFAULT_CALL_TIMEOUT_MS = 120_000;

/** Maximum retry attempts for transient API errors */
const MAX_API_RETRIES = 3;

/**
 * Rate limiter configuration for Anthropic API calls.
 */
export interface RateLimitConfig {
  /** Maximum API requests per minute (default: 50) */
  requestsPerMinute: number;
  /** Minimum delay in milliseconds between sequential calls (default: 200) */
  minDelayMs: number;
  /** Maximum concurrent in-flight API calls (default: 5) */
  maxConcurrent: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 50,
  minDelayMs: 200,
  maxConcurrent: 5,
};

/**
 * Metrics emitted by AnthropicApiBridge for observability.
 */
export interface ApiCallMetrics {
  /** Total API calls made (including retries) */
  totalCalls: number;
  /** Total retry attempts triggered by transient errors */
  totalRetries: number;
  /** Total calls that exceeded the per-call timeout */
  totalTimeouts: number;
}

/** Returns true for errors that warrant a retry (429, 529, 5xx, connection). */
function isRetryableAnthropicError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  if (status !== undefined) {
    return status === 429 || status === 529 || status >= 500;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('connection') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('service unavailable')
  );
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error as { isTimeout?: boolean }).isTimeout === true;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Bridge that invokes agents via the Anthropic Messages API.
 *
 * Supports multi-turn conversations with tool use. When the API returns
 * `stop_reason: 'tool_use'`, tools are executed locally and results
 * are sent back for the next turn. The loop continues until `end_turn`
 * or the maximum turn limit is reached.
 */
export class AnthropicApiBridge implements AgentBridge {
  private client: unknown = null;
  private apiKey: string | undefined;
  private agentDefsDir: string;

  // Rate limiter state
  private readonly rateLimitConfig: RateLimitConfig;
  private readonly baseBackoffMs: number;
  private callTimestamps: number[] = [];
  private lastCallTime = 0;
  private activeCalls = 0;

  // Observability metrics
  private readonly apiMetrics: ApiCallMetrics = {
    totalCalls: 0,
    totalRetries: 0,
    totalTimeouts: 0,
  };

  constructor(options?: {
    apiKey?: string;
    agentDefsDir?: string;
    rateLimitConfig?: Partial<RateLimitConfig>;
    /**
     * Base delay in milliseconds for exponential backoff (default: 1000).
     * Override to a small value (e.g. 1) in tests to avoid real waits.
     */
    baseBackoffMs?: number;
  }) {
    this.apiKey = options?.apiKey;
    this.agentDefsDir = options?.agentDefsDir ?? path.join('.claude', 'agents');
    this.rateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...options?.rateLimitConfig };
    this.baseBackoffMs = options?.baseBackoffMs ?? 1_000;
  }

  /** Return a snapshot of API call metrics. */
  getMetrics(): ApiCallMetrics {
    return { ...this.apiMetrics };
  }

  supports(_agentType: string): boolean {
    // Supports all agent types — universal bridge when API key is available
    return true;
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const client = await this.getClient();

    const agentDef = await this.loadAgentDefinition(request.agentType);
    const systemPrompt = this.buildSystemPrompt(agentDef, request);
    const userMessage = this.buildUserMessage(request);
    const modelId = this.resolveModel(request.modelPreference);
    const maxTokens = request.tokenBudget?.maxOutput ?? DEFAULT_MAX_TOKENS;
    const maxTurns = request.maxTurns ?? DEFAULT_MAX_TURNS;
    const enableTools = request.enableTools !== false;

    const tools = enableTools ? getToolDefinitions(request.allowedTools) : [];
    const messages: ConversationMessage[] = [{ role: 'user', content: userMessage }];
    const collectedArtifacts: AgentResponse['artifacts'] = [];
    let totalOutput = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const callTimeoutMs = request.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;

    try {
      const typedClient = client as {
        messages: {
          create: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
        };
      };

      for (let turn = 0; turn < maxTurns; turn++) {
        const createParams: Record<string, unknown> = {
          model: modelId,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        };
        if (tools.length > 0) {
          createParams['tools'] = tools;
        }

        const message = await this.callWithBackoff(
          () => typedClient.messages.create(createParams),
          callTimeoutMs
        );

        const content = message['content'] as ContentBlock[];
        const stopReason = message['stop_reason'] as string;
        const usage = message['usage'] as
          | { input_tokens: number; output_tokens: number }
          | undefined;

        // Accumulate token usage across turns
        if (usage) {
          totalInputTokens += usage.input_tokens;
          totalOutputTokens += usage.output_tokens;
        }

        // Collect text output from this turn
        for (const block of content) {
          if (block.type === 'text') {
            totalOutput += block.text;
          }
        }

        // If conversation is complete, return results
        if (stopReason === 'end_turn' || stopReason !== 'tool_use') {
          const response: AgentResponse = {
            output: totalOutput,
            artifacts: collectedArtifacts,
            success: stopReason === 'end_turn',
          };

          if (totalInputTokens > 0 || totalOutputTokens > 0) {
            response.tokenUsage = {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
            };
          }

          if (stopReason !== 'end_turn') {
            response.error = `Unexpected stop reason: ${stopReason}`;
          }

          return response;
        }

        // stop_reason === 'tool_use': execute tools and continue conversation
        messages.push({ role: 'assistant', content });

        const toolResults = await this.executeToolBlocks(content, request, collectedArtifacts);
        messages.push({ role: 'user', content: toolResults });
      }

      // Max turns reached
      return {
        output: totalOutput,
        artifacts: collectedArtifacts,
        success: totalOutput.length > 0,
        error: `Reached maximum turn limit (${String(maxTurns)})`,
        ...(totalInputTokens > 0 && {
          tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: totalOutput,
        artifacts: collectedArtifacts,
        success: false,
        error: `Anthropic API error: ${errorMessage}`,
      };
    }
  }

  /**
   * Execute tool_use blocks from an API response and return results.
   */
  private async executeToolBlocks(
    content: readonly ContentBlock[],
    request: AgentRequest,
    artifacts: AgentResponse['artifacts']
  ): Promise<ToolResultBlock[]> {
    const toolBlocks = content.filter(
      (b): b is ContentBlock & { type: 'tool_use' } => b.type === 'tool_use'
    );

    const results: ToolResultBlock[] = [];
    for (const block of toolBlocks) {
      try {
        const result = await executeTool(block.name, block.input, request.projectDir);

        // Track write_file as an artifact
        if (block.name === 'write_file' && typeof block.input['path'] === 'string') {
          artifacts.push({ path: block.input['path'], action: 'created' });
        }

        results.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      } catch (error) {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          is_error: true,
        });
      }
    }

    return results;
  }

  dispose(): Promise<void> {
    this.client = null;
    return Promise.resolve();
  }

  /**
   * Acquire a rate-limit slot before making an API call.
   * Enforces RPM, minDelayMs, and maxConcurrent limits.
   */
  private async acquireRateLimit(): Promise<void> {
    // Wait for a concurrent slot
    while (this.activeCalls >= this.rateLimitConfig.maxConcurrent) {
      await sleep(50);
    }

    // Sliding window: drop timestamps outside the 1-minute window
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => t > now - 60_000);

    // Stall until the RPM window has space
    if (this.callTimestamps.length >= this.rateLimitConfig.requestsPerMinute) {
      const oldest = this.callTimestamps[0] ?? Date.now();
      const waitMs = oldest + 60_000 - Date.now();
      if (waitMs > 0) {
        await sleep(waitMs);
        this.callTimestamps = this.callTimestamps.filter((t) => t > Date.now() - 60_000);
      }
    }

    // Enforce minimum delay between sequential calls
    const elapsed = Date.now() - this.lastCallTime;
    if (this.lastCallTime > 0 && elapsed < this.rateLimitConfig.minDelayMs) {
      await sleep(this.rateLimitConfig.minDelayMs - elapsed);
    }

    const callTime = Date.now();
    this.lastCallTime = callTime;
    this.callTimestamps.push(callTime);
    this.activeCalls++;
  }

  private releaseRateLimit(): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
  }

  /**
   * Run a single API call with a hard per-call timeout.
   * Rejects with an error flagged as `.isTimeout = true` on expiry.
   */
  private withCallTimeout(
    createFn: () => Promise<Record<string, unknown>>,
    timeoutMs: number
  ): Promise<Record<string, unknown>> {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = setTimeout(() => {
        const err = new Error(`Anthropic API call timed out after ${String(timeoutMs)}ms`);
        (err as { isTimeout?: boolean }).isTimeout = true;
        reject(err);
      }, timeoutMs);

      createFn().then(
        (result) => {
          clearTimeout(id);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(id);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
  }

  /**
   * Call the Anthropic API with rate limiting and exponential backoff.
   * Retries on 429/529/5xx errors up to MAX_API_RETRIES times.
   */
  private async callWithBackoff(
    createFn: () => Promise<Record<string, unknown>>,
    callTimeoutMs: number
  ): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
      await this.acquireRateLimit();
      this.apiMetrics.totalCalls++;
      try {
        const result = await this.withCallTimeout(createFn, callTimeoutMs);
        this.releaseRateLimit();
        return result;
      } catch (error) {
        this.releaseRateLimit();
        if (isTimeoutError(error)) {
          this.apiMetrics.totalTimeouts++;
        }
        if (!isRetryableAnthropicError(error) || attempt === MAX_API_RETRIES) {
          throw error;
        }
        this.apiMetrics.totalRetries++;
        const backoffMs =
          Math.min(this.baseBackoffMs * Math.pow(2, attempt), 30_000) +
          Math.random() * this.baseBackoffMs;
        await sleep(backoffMs);
      }
    }
    // Unreachable — loop always returns or throws above.
    throw new Error('callWithBackoff: internal error');
  }

  /**
   * Lazily initialize the Anthropic client via dynamic import.
   * This avoids requiring the SDK at module load time.
   */
  private async getClient(): Promise<unknown> {
    if (this.client !== null) {
      return this.client;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = await import('@anthropic-ai/sdk');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const AnthropicConstructor = module.default as new (opts: { apiKey?: string }) => unknown;
    this.client = new AnthropicConstructor({
      ...(this.apiKey !== undefined && { apiKey: this.apiKey }),
    });

    return this.client;
  }

  /**
   * Load agent definition from .claude/agents/<agentType>.md
   * Strips YAML frontmatter, returning only the markdown body.
   */
  private async loadAgentDefinition(agentType: string): Promise<string> {
    const defPath = path.resolve(this.agentDefsDir, `${agentType}.md`);

    try {
      const content = await fs.readFile(defPath, 'utf-8');
      return this.stripFrontmatter(content);
    } catch {
      return `You are the ${agentType} agent. Complete the requested task.`;
    }
  }

  /**
   * Strip YAML frontmatter (---\n...\n---) from markdown content.
   */
  private stripFrontmatter(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (match) {
      return content.slice(match[0].length).trim();
    }
    return content.trim();
  }

  /**
   * Build the system prompt combining agent definition with context.
   */
  private buildSystemPrompt(agentDefinition: string, request: AgentRequest): string {
    const parts = [agentDefinition];

    if (request.projectDir) {
      parts.push(`\n## Project Context\n- Project directory: ${request.projectDir}`);
    }

    if (request.scratchpadDir) {
      parts.push(`- Scratchpad directory: ${request.scratchpadDir}`);
    }

    return parts.join('\n');
  }

  /**
   * Build the user message from request input and prior stage outputs.
   */
  private buildUserMessage(request: AgentRequest): string {
    const parts = [request.input];

    const priorEntries = Object.entries(request.priorStageOutputs);
    if (priorEntries.length > 0) {
      parts.push('\n## Prior Stage Outputs\n');
      for (const [stage, output] of priorEntries) {
        // Truncate large outputs to stay within token budget
        const truncated =
          output.length > 10000 ? output.slice(0, 10000) + '\n... (truncated)' : output;
        parts.push(`### ${stage}\n\`\`\`\n${truncated}\n\`\`\`\n`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Resolve model preference string to Anthropic model ID.
   */
  private resolveModel(preference?: string): string {
    if (preference === undefined || preference === '') return DEFAULT_MODEL;
    return MODEL_MAP[preference] ?? DEFAULT_MODEL;
  }
}
