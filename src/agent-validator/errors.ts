/**
 * Error classes for agent validation
 *
 * @module agent-validator/errors
 */

import type { AgentValidationError } from './types.js';

/**
 * Base error class for agent validation
 */
export class AgentValidationException extends Error {
  readonly code: string;
  readonly filePath: string;

  constructor(message: string, code: string, filePath: string) {
    super(message);
    this.name = 'AgentValidationException';
    this.code = code;
    this.filePath = filePath;
    Object.setPrototypeOf(this, AgentValidationException.prototype);
  }
}

/**
 * Error when agent definition file is not found
 */
export class AgentNotFoundError extends AgentValidationException {
  constructor(filePath: string) {
    super(`Agent definition file not found: ${filePath}`, 'AGENT_NOT_FOUND', filePath);
    this.name = 'AgentNotFoundError';
    Object.setPrototypeOf(this, AgentNotFoundError.prototype);
  }
}

/**
 * Error when frontmatter parsing fails
 */
export class FrontmatterParseError extends AgentValidationException {
  readonly parseError: string;

  constructor(filePath: string, parseError: string) {
    super(`Failed to parse frontmatter in ${filePath}: ${parseError}`, 'FRONTMATTER_PARSE_ERROR', filePath);
    this.name = 'FrontmatterParseError';
    this.parseError = parseError;
    Object.setPrototypeOf(this, FrontmatterParseError.prototype);
  }
}

/**
 * Error when frontmatter validation fails
 */
export class FrontmatterValidationError extends AgentValidationException {
  readonly errors: AgentValidationError[];

  constructor(filePath: string, errors: AgentValidationError[]) {
    const errorMessages = errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
    super(`Frontmatter validation failed in ${filePath}:\n${errorMessages}`, 'FRONTMATTER_VALIDATION_ERROR', filePath);
    this.name = 'FrontmatterValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, FrontmatterValidationError.prototype);
  }
}

/**
 * Error when agent is not registered in agents.yaml
 */
export class AgentNotRegisteredError extends AgentValidationException {
  readonly agentName: string;

  constructor(filePath: string, agentName: string) {
    super(`Agent "${agentName}" in ${filePath} is not registered in agents.yaml`, 'AGENT_NOT_REGISTERED', filePath);
    this.name = 'AgentNotRegisteredError';
    this.agentName = agentName;
    Object.setPrototypeOf(this, AgentNotRegisteredError.prototype);
  }
}
