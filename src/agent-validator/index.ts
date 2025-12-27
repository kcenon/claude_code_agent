/**
 * Agent definition validator module
 *
 * Provides validation for agent definition files (.claude/agents/*.md)
 * against the expected schema and agents.yaml registry.
 *
 * @module agent-validator
 */

// ============================================================
// Re-exports
// ============================================================

// Schemas
export { AGENT_SCHEMA_VERSION, VALID_TOOLS, VALID_MODELS, AgentFrontmatterSchema, AgentToolSchema, AgentModelSchema, RECOMMENDED_SECTIONS } from './schemas.js';

// Types
export type {
  AgentTool,
  AgentModel,
  AgentFrontmatter,
  AgentDefinition,
  AgentValidationError,
  AgentValidationResult,
  AgentValidationReport,
  ValidateAgentOptions,
} from './types.js';

// Errors
export {
  AgentValidationException,
  AgentNotFoundError,
  FrontmatterParseError,
  FrontmatterValidationError,
  AgentNotRegisteredError,
} from './errors.js';

// Validation
export { validateAgentFile, validateAllAgents, formatValidationReport } from './validator.js';
