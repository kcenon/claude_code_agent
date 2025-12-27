/**
 * Type definitions for agent definition validation
 *
 * @module agent-validator/types
 */

/**
 * Valid tool names that can be used by agents
 */
export type AgentTool =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'LSP'
  | 'Task'
  | 'TodoWrite'
  | 'NotebookEdit';

/**
 * Valid model names
 */
export type AgentModel = 'sonnet' | 'opus' | 'haiku';

/**
 * Agent definition frontmatter structure
 */
export interface AgentFrontmatter {
  name: string;
  description: string;
  tools: AgentTool[];
  model: AgentModel;
}

/**
 * Parsed agent definition file
 */
export interface AgentDefinition {
  frontmatter: AgentFrontmatter;
  content: string;
  filePath: string;
}

/**
 * Validation error for agent definition
 */
export interface AgentValidationError {
  field: string;
  message: string;
  filePath: string;
}

/**
 * Validation result for a single agent
 */
export interface AgentValidationResult {
  filePath: string;
  valid: boolean;
  errors: AgentValidationError[];
  warnings: AgentValidationError[];
  agent?: AgentDefinition;
}

/**
 * Overall validation report
 */
export interface AgentValidationReport {
  timestamp: string;
  totalFiles: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  results: AgentValidationResult[];
}

/**
 * Options for agent validation
 */
export interface ValidateAgentOptions {
  /**
   * Check consistency with agents.yaml
   */
  checkRegistry?: boolean;

  /**
   * Include warnings in output
   */
  includeWarnings?: boolean;

  /**
   * Custom agents directory path
   */
  agentsDir?: string;

  /**
   * Custom registry file path
   */
  registryPath?: string;
}
