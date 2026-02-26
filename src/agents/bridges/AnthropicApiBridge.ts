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

  constructor(options?: { apiKey?: string; agentDefsDir?: string }) {
    this.apiKey = options?.apiKey;
    this.agentDefsDir = options?.agentDefsDir ?? path.join('.claude', 'agents');
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

        const message = await typedClient.messages.create(createParams);

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
