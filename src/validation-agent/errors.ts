/**
 * Validation Agent Error Classes
 *
 * Module-specific error class extending VnvError for validation operations.
 *
 * @module validation-agent/errors
 */

import { VnvError } from '../vnv/errors.js';
import type { AppErrorOptions } from '../errors/types.js';

/**
 * Error thrown during validation operations such as requirement validation,
 * acceptance criteria checking, traceability analysis, or report generation
 */
export class ValidationError extends VnvError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, options);
    this.name = 'ValidationError';
  }
}
