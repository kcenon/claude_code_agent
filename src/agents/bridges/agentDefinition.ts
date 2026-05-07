/**
 * Shared agent-definition loader.
 *
 * Both {@link AnthropicApiBridge} (legacy path) and the new
 * `executeViaAdapter()` path in `AdsdlcOrchestratorAgent` need to load an
 * agent's markdown definition from `.claude/agents/<agentType>.md`, strip
 * the YAML frontmatter, and use the body as the system prompt. Keeping the
 * logic in a single module guarantees both paths produce a byte-identical
 * system prompt — a precondition for the artifact-equivalence acceptance
 * criterion of issue #793.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { getLogger } from '../../logging/index.js';

/**
 * Default location of agent definition markdown files relative to the
 * project root. Mirrors the value embedded in {@link AnthropicApiBridge}
 * before the helper was extracted.
 */
export const DEFAULT_AGENT_DEFS_DIR = path.join('.claude', 'agents');

/**
 * Strip a leading `---\n...\n---\n` YAML frontmatter block from markdown
 * content. If no frontmatter is present, the content is returned verbatim
 * (with surrounding whitespace trimmed).
 *
 * @param content - Raw markdown file contents.
 * @returns Body without frontmatter, trimmed.
 */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

/**
 * Load the markdown body of an agent definition, returning a fallback
 * string when the file is missing or unreadable. The fallback matches
 * what {@link AnthropicApiBridge} produced before the extraction so that
 * behaviour is preserved.
 *
 * @param agentType - Pipeline agent type (e.g., `'worker'`). Used to
 *   build the file name `<agentType>.md` under {@link agentDefsDir}.
 * @param agentDefsDir - Directory containing the markdown files. Defaults
 *   to {@link DEFAULT_AGENT_DEFS_DIR}.
 * @returns Markdown body with frontmatter stripped, or a fallback prompt.
 */
export async function loadAgentDefinition(
  agentType: string,
  agentDefsDir: string = DEFAULT_AGENT_DEFS_DIR
): Promise<string> {
  const defPath = path.resolve(agentDefsDir, `${agentType}.md`);

  try {
    const content = await fs.readFile(defPath, 'utf-8');
    return stripFrontmatter(content);
  } catch (error) {
    getLogger().debug(`Agent definition not found at ${defPath}, using fallback prompt`, {
      agent: 'loadAgentDefinition',
      agentType,
      error: error instanceof Error ? error.message : String(error),
    });
    return `You are the ${agentType} agent. Complete the requested task.`;
  }
}
