/**
 * Doc Index Generator module
 *
 * Placeholder module for the doc-index-generator pipeline agent.
 * The actual indexing logic is defined in the agent prompt
 * (.claude/agents/doc-index-generator.md) and executed via
 * StubBridge or ClaudeCodeBridge at runtime.
 *
 * This module provides the AgentTypeMapping import target and
 * a minimal type export for integration tests.
 */

/** Agent identifier for the doc-index-generator */
export const DOC_INDEX_GENERATOR_AGENT_ID = 'doc-index-generator';

/** Agent display name */
export const DOC_INDEX_GENERATOR_NAME = 'Documentation Index Generator';
