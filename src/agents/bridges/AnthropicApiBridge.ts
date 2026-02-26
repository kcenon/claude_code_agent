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

/** Model ID mapping from agents.yaml model_preference to Anthropic API model IDs */
const MODEL_MAP: Record<string, string> = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Bridge that invokes agents via the Anthropic Messages API.
 *
 * This is the primary bridge for standalone CLI usage where agents
 * need actual AI execution capabilities.
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

    try {
      const typedClient = client as {
        messages: {
          create: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
        };
      };
      const message = await typedClient.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = message['content'] as Array<{ type: string; text?: string }>;
      const output = content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');

      const usage = message['usage'] as { input_tokens: number; output_tokens: number } | undefined;

      const response: AgentResponse = {
        output,
        artifacts: [],
        success: message['stop_reason'] === 'end_turn',
      };

      if (usage) {
        response.tokenUsage = {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        };
      }

      if (message['stop_reason'] !== 'end_turn') {
        response.error = `Unexpected stop reason: ${String(message['stop_reason'])}`;
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: '',
        artifacts: [],
        success: false,
        error: `Anthropic API error: ${errorMessage}`,
      };
    }
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
