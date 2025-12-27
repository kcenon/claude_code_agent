/**
 * Custom error types for configuration validation
 *
 * @module config/errors
 */

import type { FieldError } from './types.js';

/**
 * Error thrown when configuration file cannot be parsed
 */
export class ConfigParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigParseError';
    Object.setPrototypeOf(this, ConfigParseError.prototype);
  }
}

/**
 * Error thrown when configuration validation fails
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly errors: readonly FieldError[],
    public readonly schemaVersion: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }

  /**
   * Format errors as a readable string
   */
  public formatErrors(): string {
    if (this.errors.length === 0) {
      return '  No detailed errors available';
    }
    return this.errors
      .map((e) => {
        const suggestion = e.suggestion !== undefined && e.suggestion !== '' ? `\n     Suggestion: ${e.suggestion}` : '';
        return `  - ${e.path}: ${e.message}${suggestion}`;
      })
      .join('\n');
  }
}

/**
 * Error thrown when configuration file is not found
 */
export class ConfigNotFoundError extends Error {
  constructor(
    message: string,
    public readonly filePath: string
  ) {
    super(message);
    this.name = 'ConfigNotFoundError';
    Object.setPrototypeOf(this, ConfigNotFoundError.prototype);
  }
}

/**
 * Error thrown when file watching fails
 */
export class ConfigWatchError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigWatchError';
    Object.setPrototypeOf(this, ConfigWatchError.prototype);
  }
}
