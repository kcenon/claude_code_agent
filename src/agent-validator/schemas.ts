/**
 * Zod schemas for agent definition validation
 *
 * @module agent-validator/schemas
 */

import { z } from 'zod';

/**
 * Schema version for agent definitions
 */
export const AGENT_SCHEMA_VERSION = '1.0.0';

/**
 * Valid tool names
 */
export const VALID_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'LSP',
  'Task',
  'TodoWrite',
  'NotebookEdit',
] as const;

/**
 * Valid model names
 */
export const VALID_MODELS = ['sonnet', 'opus', 'haiku'] as const;

/**
 * Schema for agent tool
 */
export const AgentToolSchema = z.enum(VALID_TOOLS);

/**
 * Schema for agent model
 */
export const AgentModelSchema = z.enum(VALID_MODELS);

/**
 * Schema for agent frontmatter
 */
export const AgentFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1, 'Agent name is required')
    .regex(/^[a-z][a-z0-9-]*$/, 'Agent name must be lowercase with hyphens'),

  description: z.string().min(10, 'Description must be at least 10 characters'),

  tools: z
    .array(AgentToolSchema)
    .min(1, 'At least one tool must be specified')
    .refine((tools) => new Set(tools).size === tools.length, {
      message: 'Duplicate tools are not allowed',
    }),

  model: AgentModelSchema,
});

/**
 * Expected sections in agent markdown content
 */
export const REQUIRED_SECTIONS = ['# ', '## Role', '## '];

/**
 * Recommended sections for complete agent definition
 */
export const RECOMMENDED_SECTIONS = [
  '## Role',
  '## Primary Responsibilities',
  '## Workflow',
  '## File Locations',
];
