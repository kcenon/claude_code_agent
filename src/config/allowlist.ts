/**
 * Canonical tool and model allowlists for the AD-SDLC agent system.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 *   - The set of tools agents may declare in their frontmatter
 *   - The set of model names agents may declare in their frontmatter
 *
 * All other modules that need these lists MUST import from here.
 * JSON schema files (schemas/*.schema.json) cannot import TypeScript,
 * so a conformance test (tests/schemas/allowlist-conformance.test.ts)
 * asserts that those JSON enums match these canonical arrays.
 *
 * @module config/allowlist
 */

// ============================================================
// Tool allowlist
// ============================================================

/**
 * Canonical list of tools that agents may use.
 *
 * Reconciliation notes (issue #871):
 *   - src/agent-validator/schemas.ts had: Read, Write, Edit, Bash, Glob, Grep,
 *     WebFetch, WebSearch, LSP, Task, TodoWrite, NotebookEdit  (12 tools)
 *   - src/config/schemas.ts had:          Read, Write, Edit, Bash, Glob, Grep,
 *     WebFetch, WebSearch                                       (8 tools)
 *   - JSON schemas matched src/config/schemas.ts               (8 tools)
 *
 * Agents in .claude/agents/ actually declare:
 *   Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Task
 *
 * Superset decision:
 *   - Task: used by orchestrator agents (ad-sdlc-orchestrator, analysis-orchestrator,
 *     collector). Legitimate — keep.
 *   - LSP: declared in agent-validator allowlist but not used by any current agent.
 *     Retained for forward compatibility; does not affect current agent files.
 *   - TodoWrite: declared in agent-validator allowlist but not used by any current agent.
 *     Retained for forward compatibility.
 *   - NotebookEdit: declared in agent-validator allowlist but not used by any current agent.
 *     Retained for forward compatibility.
 *   - All 8 tools from src/config/schemas.ts are included.
 */
export const CANONICAL_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'LSP',
  'TodoWrite',
  'NotebookEdit',
] as const;

/**
 * Type derived from the canonical tool list.
 */
export type CanonicalTool = (typeof CANONICAL_TOOLS)[number];

// ============================================================
// Model allowlist
// ============================================================

/**
 * Canonical list of model values that agents may declare.
 *
 * Reconciliation notes (issue #871):
 *   - src/agent-validator/schemas.ts had: sonnet, opus, haiku      (no inherit)
 *   - src/config/schemas.ts had:          sonnet, opus, haiku      (no inherit)
 *   - schemas/workflow.schema.json had:   sonnet, opus, haiku      (no inherit)
 *   - schemas/agents.schema.json had:     sonnet, opus, haiku      (no inherit)
 *
 *   35 of 36 agents in .claude/agents/ declare `model: inherit`.
 *   1 agent (project-initializer) declares `model: haiku`.
 *
 *   `inherit` means "use the model the parent agent is running with"
 *   and is a valid Claude Code frontmatter value.  All four prior
 *   sources omitted it, causing every real agent to fail validation.
 *   Added here to fix the contract.
 */
export const CANONICAL_MODELS = ['sonnet', 'opus', 'haiku', 'inherit'] as const;

/**
 * Type derived from the canonical model list.
 */
export type CanonicalModel = (typeof CANONICAL_MODELS)[number];

// ============================================================
// Derived sets for fast membership tests
// ============================================================

/**
 * Set of canonical tool names for O(1) membership tests.
 */
export const CANONICAL_TOOLS_SET: ReadonlySet<string> = new Set(CANONICAL_TOOLS);

/**
 * Set of canonical model names for O(1) membership tests.
 */
export const CANONICAL_MODELS_SET: ReadonlySet<string> = new Set(CANONICAL_MODELS);
