/**
 * Utility module exports
 *
 * @module utils
 */

export {
  safeJsonParse,
  safeJsonParseFile,
  safeJsonParseFileSync,
  tryJsonParse,
  lenientSchema,
  partialSchema,
  JsonValidationError,
  JsonSyntaxError,
} from './SafeJsonParser.js';

export type { SafeJsonParseOptions, JsonFieldError } from './SafeJsonParser.js';
