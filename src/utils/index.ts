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

export {
  getProjectContext,
  initializeProject,
  getProjectRoot,
  tryGetProjectRoot,
  resolveProjectPath,
  isProjectInitialized,
  isPathWithinProject,
  resetProjectContext,
  ProjectContextError,
} from './ProjectContext.js';

export type { ProjectContextOptions } from './ProjectContext.js';
