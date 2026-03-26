/**
 * Stage Verifier Error Classes
 *
 * Module-specific error class for stage verification operations.
 *
 * @module stage-verifier/errors
 */

import { VnvError } from '../vnv/errors.js';
import type { AppErrorOptions } from '../errors/types.js';

/**
 * Error class for stage verification failures.
 *
 * Extends VnvError with stage-verifier-specific naming for
 * clearer error identification in logs and error boundaries.
 */
export class StageVerificationError extends VnvError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, options);
    this.name = 'StageVerificationError';
  }
}
