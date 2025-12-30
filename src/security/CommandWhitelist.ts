/**
 * CommandWhitelist - Defines allowed commands and their constraints
 *
 * This module provides a whitelist of allowed commands that can be executed
 * by the system, along with their allowed subcommands and argument patterns.
 */

/**
 * Pattern for validating command arguments
 */
export type ArgPattern = RegExp | ((arg: string) => boolean);

/**
 * Configuration for a single allowed command
 */
export interface CommandConfig {
  /** Whether this command is allowed */
  readonly allowed: boolean;
  /** Allowed subcommands (if any) */
  readonly subcommands?: readonly string[];
  /** Argument validation patterns by position or name */
  readonly argPatterns?: Record<string, ArgPattern>;
  /** Maximum number of arguments allowed */
  readonly maxArgs?: number;
  /** Whether to allow arbitrary arguments (use with caution) */
  readonly allowArbitraryArgs?: boolean;
}

/**
 * Complete command whitelist configuration
 */
export type CommandWhitelistConfig = Record<string, CommandConfig>;

/**
 * Branch name validation pattern
 * Allows: alphanumeric, underscore, hyphen, forward slash, dot
 */
export const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9_\-./]+$/;

/**
 * Safe path pattern (no shell metacharacters)
 * Allows: alphanumeric, underscore, hyphen, forward slash, dot, space
 */
export const SAFE_PATH_PATTERN = /^[a-zA-Z0-9_\-./\s]+$/;

/**
 * Package name pattern for npm packages
 */
export const PACKAGE_NAME_PATTERN = /^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_-]+(@[a-zA-Z0-9_.\-^~>=<]+)?$/;

/**
 * Default command whitelist configuration
 *
 * This whitelist defines which commands can be safely executed by the system.
 * Each command has specific constraints on subcommands and arguments.
 */
export const DEFAULT_COMMAND_WHITELIST: CommandWhitelistConfig = {
  // Git commands
  git: {
    allowed: true,
    subcommands: [
      'status',
      'add',
      'commit',
      'push',
      'pull',
      'checkout',
      'branch',
      'log',
      'diff',
      'fetch',
      'merge',
      'rebase',
      'stash',
      'tag',
      'remote',
      'config',
      'init',
      'clone',
      'reset',
      'show',
      'rev-parse',
      'ls-files',
      'symbolic-ref',
      'describe',
      'clean',
      'restore',
      'switch',
    ],
    argPatterns: {
      branch: BRANCH_NAME_PATTERN,
      path: SAFE_PATH_PATTERN,
      ref: BRANCH_NAME_PATTERN,
    },
    maxArgs: 20,
  },

  // GitHub CLI commands
  gh: {
    allowed: true,
    subcommands: ['pr', 'issue', 'repo', 'auth', 'api', 'run', 'workflow'],
    argPatterns: {
      branch: BRANCH_NAME_PATTERN,
      number: /^\d+$/,
    },
    maxArgs: 30,
  },

  // Node.js commands
  node: {
    allowed: true,
    argPatterns: {
      script: SAFE_PATH_PATTERN,
    },
    maxArgs: 20,
    allowArbitraryArgs: true,
  },

  // NPM commands
  npm: {
    allowed: true,
    subcommands: [
      'install',
      'ci',
      'run',
      'test',
      'build',
      'audit',
      'outdated',
      'ls',
      'list',
      'pack',
      'publish',
      'version',
      'init',
      'cache',
      'prune',
    ],
    argPatterns: {
      package: PACKAGE_NAME_PATTERN,
      script: /^[a-zA-Z0-9_:-]+$/,
    },
    maxArgs: 20,
  },

  // NPX commands
  npx: {
    allowed: true,
    argPatterns: {
      package: PACKAGE_NAME_PATTERN,
    },
    maxArgs: 20,
    allowArbitraryArgs: true,
  },

  // TypeScript compiler
  tsc: {
    allowed: true,
    argPatterns: {
      path: SAFE_PATH_PATTERN,
    },
    maxArgs: 30,
    allowArbitraryArgs: true,
  },

  // ESLint
  eslint: {
    allowed: true,
    argPatterns: {
      path: SAFE_PATH_PATTERN,
    },
    maxArgs: 30,
    allowArbitraryArgs: true,
  },

  // Prettier
  prettier: {
    allowed: true,
    argPatterns: {
      path: SAFE_PATH_PATTERN,
    },
    maxArgs: 30,
    allowArbitraryArgs: true,
  },

  // Vitest
  vitest: {
    allowed: true,
    argPatterns: {
      path: SAFE_PATH_PATTERN,
    },
    maxArgs: 30,
    allowArbitraryArgs: true,
  },

  // Jest
  jest: {
    allowed: true,
    argPatterns: {
      path: SAFE_PATH_PATTERN,
    },
    maxArgs: 30,
    allowArbitraryArgs: true,
  },
} as const;

/**
 * Shell metacharacters that must be escaped or rejected
 * These characters can be used for command injection attacks
 */
export const SHELL_METACHARACTERS = /[;&|`$"'<>(){}[\]!#*?\\]/g;

/**
 * Characters that need escaping in shell arguments
 */
export const ESCAPE_CHARS = ['\\', "'", '"', '`', '$', '!', ' ', '\t', '\n', '\r'];

/**
 * Check if a command is in the whitelist
 *
 * @param command - The base command to check
 * @param config - Optional custom whitelist configuration
 * @returns True if the command is allowed
 */
export function isAllowedCommand(
  command: string,
  config: CommandWhitelistConfig = DEFAULT_COMMAND_WHITELIST
): boolean {
  const commandConfig = config[command];
  return commandConfig?.allowed === true;
}

/**
 * Check if a subcommand is allowed for a given command
 *
 * @param command - The base command
 * @param subcommand - The subcommand to check
 * @param config - Optional custom whitelist configuration
 * @returns True if the subcommand is allowed
 */
export function isAllowedSubcommand(
  command: string,
  subcommand: string,
  config: CommandWhitelistConfig = DEFAULT_COMMAND_WHITELIST
): boolean {
  const commandConfig = config[command];
  if (commandConfig?.allowed !== true) {
    return false;
  }

  // If no subcommands defined, any subcommand is allowed
  if (commandConfig.subcommands === undefined) {
    return true;
  }

  return commandConfig.subcommands.includes(subcommand);
}

/**
 * Get the configuration for a specific command
 *
 * @param command - The command to get configuration for
 * @param config - Optional custom whitelist configuration
 * @returns The command configuration or undefined if not found
 */
export function getCommandConfig(
  command: string,
  config: CommandWhitelistConfig = DEFAULT_COMMAND_WHITELIST
): CommandConfig | undefined {
  return config[command];
}

/**
 * Check if an argument contains shell metacharacters
 *
 * @param arg - The argument to check
 * @returns True if the argument contains metacharacters
 */
export function containsShellMetacharacters(arg: string): boolean {
  return SHELL_METACHARACTERS.test(arg);
}
