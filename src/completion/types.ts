/**
 * Types for CLI command autocompletion
 *
 * @packageDocumentation
 */

/**
 * Supported shell types for autocompletion
 */
export type ShellType = 'bash' | 'zsh' | 'fish';

/**
 * Command definition for autocompletion
 */
export interface CommandDefinition {
  /** Command name */
  readonly name: string;
  /** Command description */
  readonly description: string;
  /** Command options */
  readonly options: readonly OptionDefinition[];
  /** Subcommands */
  readonly subcommands?: readonly CommandDefinition[];
}

/**
 * Option definition for autocompletion
 */
export interface OptionDefinition {
  /** Short flag (e.g., '-h') */
  readonly short?: string;
  /** Long flag (e.g., '--help') */
  readonly long: string;
  /** Option description */
  readonly description: string;
  /** Whether the option takes a value */
  readonly takesValue: boolean;
  /** Possible values for completion */
  readonly values?: readonly string[];
}

/**
 * Completion script generation result
 */
export interface CompletionResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Generated script content */
  readonly script: string;
  /** Shell type */
  readonly shell: ShellType;
  /** Installation instructions */
  readonly instructions: string;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * All supported shells with their configuration
 */
export const SUPPORTED_SHELLS: readonly ShellType[] = ['bash', 'zsh', 'fish'] as const;

/**
 * Shell-specific file paths for completion scripts
 */
export const SHELL_COMPLETION_PATHS: Readonly<Record<ShellType, string>> = {
  bash: '~/.bashrc or ~/.bash_completion',
  zsh: '~/.zshrc',
  fish: '~/.config/fish/completions/ad-sdlc.fish',
} as const;
