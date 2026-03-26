/**
 * RTM Builder Error Classes
 *
 * Module-specific error class extending VnvError for RTM build operations.
 *
 * @module rtm-builder/errors
 */

import { VnvError } from '../vnv/errors.js';
import type { AppErrorOptions } from '../errors/types.js';

/**
 * Error thrown during RTM build, report generation, or validation operations
 */
export class RtmBuildError extends VnvError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, options);
    this.name = 'RtmBuildError';
  }
}
