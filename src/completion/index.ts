/**
 * Completion module - CLI command autocompletion support
 *
 * Provides shell completion script generation for bash, zsh, and fish.
 *
 * @packageDocumentation
 */

// Types
export type { CommandDefinition, CompletionResult, OptionDefinition, ShellType } from './types.js';

export { SHELL_COMPLETION_PATHS, SUPPORTED_SHELLS } from './types.js';

// CompletionGenerator
export {
  CompletionGenerator,
  getCompletionGenerator,
  resetCompletionGenerator,
} from './CompletionGenerator.js';
