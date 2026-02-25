/**
 * ClaudeCodeBridge - Delegates execution to Claude Code's sub-agent system
 *
 * Used when running inside a Claude Code session. Writes agent input to
 * the scratchpad and reads output after the sub-agent completes.
 * The actual invocation happens through Claude Code's Task tool — this bridge
 * prepares the scratchpad-based I/O contract.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentBridge, AgentRequest, AgentResponse } from '../AgentBridge.js';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Bridge that coordinates with Claude Code sub-agents via scratchpad I/O.
 *
 * The execution model:
 * 1. Write input (work order / collected info) to scratchpad
 * 2. Claude Code's Task tool reads the input and spawns the sub-agent
 * 3. Sub-agent writes output to scratchpad
 * 4. This bridge reads the output
 */
export class ClaudeCodeBridge implements AgentBridge {
  private pollIntervalMs: number;
  private timeoutMs: number;

  constructor(options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
  }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Check if the agent definition file exists for this type.
   */
  supports(_agentType: string): boolean {
    // All types are supported when inside a Claude Code session.
    // The actual agent definition is loaded during execute().
    return true;
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const sessionDir = this.getSessionDir(request);
    const inputPath = path.join(sessionDir, 'input', `${request.agentType}.json`);
    const outputPath = path.join(sessionDir, 'output', `${request.agentType}.json`);

    try {
      // 1. Write input to scratchpad
      await this.writeAgentInput(inputPath, request);

      // 2. Wait for output file to appear (written by Claude Code sub-agent)
      const output = await this.waitForAgentOutput(outputPath);

      // 3. Parse and return the response
      return this.parseOutput(output);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: '',
        artifacts: [],
        success: false,
        error: `Claude Code bridge error: ${errorMessage}`,
      };
    }
  }

  async dispose(): Promise<void> {
    // No persistent resources to clean up
  }

  /**
   * Determine the session-specific directory for agent I/O.
   */
  private getSessionDir(request: AgentRequest): string {
    return path.join(request.scratchpadDir, 'bridge');
  }

  /**
   * Write agent input to the scratchpad for the sub-agent to consume.
   */
  private async writeAgentInput(inputPath: string, request: AgentRequest): Promise<void> {
    await fs.mkdir(path.dirname(inputPath), { recursive: true });

    const payload = {
      agentType: request.agentType,
      input: request.input,
      projectDir: request.projectDir,
      priorStageOutputs: request.priorStageOutputs,
      modelPreference: request.modelPreference,
      tokenBudget: request.tokenBudget,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  /**
   * Poll for the output file with configurable timeout.
   */
  private async waitForAgentOutput(outputPath: string): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;

    while (Date.now() < deadline) {
      try {
        const content = await fs.readFile(outputPath, 'utf-8');
        if (content.trim().length > 0) {
          // Clean up the output file after reading
          await fs.unlink(outputPath).catch(() => {});
          return content;
        }
      } catch {
        // File doesn't exist yet — keep polling
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new Error(
      `Timeout waiting for agent output after ${this.timeoutMs}ms: ${outputPath}`
    );
  }

  /**
   * Parse the output file content into an AgentResponse.
   */
  private parseOutput(content: string): AgentResponse {
    try {
      const parsed = JSON.parse(content) as Partial<AgentResponse>;
      const response: AgentResponse = {
        output: parsed.output ?? content,
        artifacts: parsed.artifacts ?? [],
        success: parsed.success ?? true,
      };

      if (parsed.tokenUsage) {
        response.tokenUsage = parsed.tokenUsage;
      }

      if (parsed.error) {
        response.error = parsed.error;
      }

      return response;
    } catch {
      // If not JSON, treat the raw content as the output
      return {
        output: content,
        artifacts: [],
        success: true,
      };
    }
  }
}
