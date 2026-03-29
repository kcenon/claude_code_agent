/**
 * ClaudeCliSubprocessBridge - Executes agents via the `claude` CLI in subprocess mode
 *
 * Used when running inside a Claude Code session where the `claude` CLI is available.
 * Invokes `claude -p --output-format json` as a subprocess, passing the agent prompt
 * via stdin-safe arguments. Suitable for subscription-based execution without an API key.
 *
 * @packageDocumentation
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentBridge, AgentRequest, AgentResponse } from '../AgentBridge.js';
import { getLogger } from '../../logging/index.js';

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Bridge that delegates agent execution to the `claude` CLI in non-interactive mode.
 *
 * The execution model:
 * 1. Build a context-rich prompt from the AgentRequest
 * 2. Invoke `claude -p --output-format json --dangerously-skip-permissions`
 * 3. Parse the JSON output into an AgentResponse
 */
export class ClaudeCliSubprocessBridge implements AgentBridge {
  private claudePath: string;
  private timeoutMs: number;

  constructor(options?: { claudePath?: string; timeoutMs?: number }) {
    this.claudePath = options?.claudePath ?? 'claude';
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   *
   * @param _agentType
   */
  supports(_agentType: string): boolean {
    return true;
  }

  /**
   *
   * @param request
   */
  execute(request: AgentRequest): Promise<AgentResponse> {
    const logger = getLogger();
    const prompt = this.buildPrompt(request);
    const args = this.buildArgs(request);

    logger.debug('Invoking claude CLI subprocess', {
      agent: request.agentType,
      claudePath: this.claudePath,
      argCount: args.length,
    });

    try {
      const result = execFileSync(this.claudePath, [...args, prompt], {
        timeout: this.timeoutMs,
        encoding: 'utf-8',
        maxBuffer: MAX_BUFFER_BYTES,
        cwd: request.projectDir,
      });
      return Promise.resolve(this.parseResponse(result));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Claude CLI subprocess failed', err, {
        agent: request.agentType,
      });
      return Promise.resolve({ output: '', artifacts: [], success: false, error: err.message });
    }
  }

  /**
   *
   */
  dispose(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Build CLI arguments for non-interactive JSON execution.
   * @param request
   */
  buildArgs(request: AgentRequest): string[] {
    const args = ['-p', '--output-format', 'json', '--dangerously-skip-permissions'];

    // Use agent definition as system prompt if available
    const agentFile = path.join(request.projectDir, '.claude', 'agents', `${request.agentType}.md`);
    if (fs.existsSync(agentFile)) {
      args.push('--system-prompt-file', agentFile);
    }

    return args;
  }

  /**
   * Build a context-rich prompt from the agent request.
   * @param request
   */
  buildPrompt(request: AgentRequest): string {
    const parts = [`You are the ${request.agentType} agent.`];
    parts.push(`Project directory: ${request.projectDir}`);
    parts.push(`Scratchpad directory: ${request.scratchpadDir}`);
    parts.push(`\nTask input:\n${request.input}`);

    const priorOutputs = request.priorStageOutputs;
    if (Object.keys(priorOutputs).length > 0) {
      parts.push(`\nPrior stage outputs:\n${JSON.stringify(priorOutputs, null, 2)}`);
    }

    parts.push(
      '\nProvide your output as a JSON object with "output" (string) and "success" (boolean) fields.'
    );
    return parts.join('\n');
  }

  /**
   * Parse the raw CLI output into an AgentResponse.
   *
   * Claude `--output-format json` wraps output as `{ "type": "result", "result": "..." }`.
   * The inner `result` string may itself be JSON containing output/success fields.
   * @param raw
   */
  parseResponse(raw: string): AgentResponse {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const resultVal = parsed['result'];
      const outputVal = parsed['output'];
      const content =
        typeof resultVal === 'string' ? resultVal : typeof outputVal === 'string' ? outputVal : raw;

      // Try to parse inner JSON if the content itself is structured
      try {
        const inner = JSON.parse(content) as Record<string, unknown>;
        const innerOutput = typeof inner['output'] === 'string' ? inner['output'] : content;
        const innerArtifacts = Array.isArray(inner['artifacts'])
          ? (inner['artifacts'] as AgentResponse['artifacts'])
          : [];
        return {
          output: innerOutput,
          artifacts: innerArtifacts,
          success: typeof inner['success'] === 'boolean' ? inner['success'] : true,
        };
      } catch {
        return { output: content, artifacts: [], success: true };
      }
    } catch {
      // Not JSON at all — treat raw output as plain text
      return { output: raw, artifacts: [], success: true };
    }
  }
}
