/**
 * CLI Command Autocompletion Generator
 *
 * Generates shell-specific completion scripts for bash, zsh, and fish.
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CompletionResult, OptionDefinition, ShellType } from './types.js';
import { SHELL_COMPLETION_PATHS } from './types.js';

/**
 * AD-SDLC CLI command definitions for autocompletion. They mirror the commands,
 * subcommands, and options that `src/cli.ts` registers with commander;
 * `tests/completion/registeredCommands.test.ts` fails when the two drift apart.
 * Descriptions are plain text: no brackets, colons, double quotes, `$`, or backslashes,
 * which the zsh option specs and the double-quoted fish arguments would interpret.
 */
const CLI_COMMANDS: readonly CommandDefinition[] = [
  {
    name: 'init',
    description: 'Initialize a new AD-SDLC project',
    options: [
      {
        short: '-T',
        long: '--template',
        description: 'Project template',
        takesValue: true,
        values: ['minimal', 'standard', 'enterprise'],
      },
      {
        short: '-q',
        long: '--quick',
        description: 'Quick setup with defaults',
        takesValue: false,
      },
      {
        long: '--skip-validation',
        description: 'Skip prerequisite validation',
        takesValue: false,
      },
    ],
  },
  {
    name: 'run',
    description: 'Execute the AD-SDLC canonical pipeline',
    options: [
      {
        short: '-m',
        long: '--mode',
        description: 'Canonical pipeline mode',
        takesValue: true,
        values: ['greenfield', 'enhancement', 'import'],
      },
      {
        long: '--project-dir',
        description: 'Target project directory',
        takesValue: true,
      },
      {
        long: '--stop-after',
        description: 'Stop after a stage',
        takesValue: true,
      },
      {
        long: '--dry-run',
        description: 'Resolve and validate without creating an SDK adapter',
        takesValue: false,
      },
      {
        long: '--format',
        description: 'Output format',
        takesValue: true,
        values: ['text', 'json'],
      },
      {
        long: '--allow-stub',
        description: 'Allow execution without detected SDK credentials',
        takesValue: false,
      },
      {
        long: '--resume',
        description: 'Resume a saved session',
        takesValue: true,
      },
      {
        short: '-L',
        long: '--local',
        description: 'Run with local agents and remove GitHub setup',
        takesValue: false,
      },
      {
        long: '--no-local',
        description: 'Explicitly disable local mode',
        takesValue: false,
      },
      {
        long: '--approval-mode',
        description: 'Approval mode (auto is the built-in default)',
        takesValue: true,
        values: ['auto', 'manual', 'critical'],
      },
      {
        long: '--non-interactive',
        description: 'Never prompt; a requested approval decision pauses the run',
        takesValue: false,
      },
      {
        long: '--max-parallel-stages',
        description: 'Maximum concurrent runnable stages',
        takesValue: true,
      },
      {
        long: '--max-attempts',
        description: 'Total stage attempts, including the first',
        takesValue: true,
      },
      {
        long: '--retry-backoff',
        description: 'Retry backoff strategy',
        takesValue: true,
        values: ['fixed', 'linear', 'exponential', 'fibonacci'],
      },
      {
        long: '--retry-base-delay-seconds',
        description: 'Retry base delay in seconds',
        takesValue: true,
      },
      {
        long: '--retry-max-delay-seconds',
        description: 'Retry delay cap in seconds',
        takesValue: true,
      },
      {
        long: '--stage-timeout-ms',
        description: 'Total budget per stage in milliseconds',
        takesValue: true,
      },
      {
        long: '--vnv-rigor',
        description: 'Verification rigor',
        takesValue: true,
        values: ['minimal', 'standard', 'strict'],
      },
      {
        long: '--vnv-profile',
        description: 'Verification policy profile',
        takesValue: true,
        values: ['advisory', 'delivery'],
      },
      {
        long: '--halt-on-verification-failure',
        description: 'Legacy flag; strict rigor plus true selects delivery',
        takesValue: true,
        values: ['true', 'false'],
      },
      {
        long: '--use-sdk-for-worker',
        description: 'Deprecated compatibility flag',
        takesValue: false,
      },
    ],
  },
  {
    name: 'validate',
    description: 'Validate AD-SDLC configuration files',
    options: [
      {
        short: '-f',
        long: '--file',
        description: 'Validate a specific file',
        takesValue: true,
      },
      {
        long: '--project-dir',
        description: 'Target project directory',
        takesValue: true,
      },
      {
        short: '-w',
        long: '--watch',
        description: 'Watch for file changes',
        takesValue: false,
      },
      {
        long: '--format',
        description: 'Output format',
        takesValue: true,
        values: ['text', 'json'],
      },
    ],
  },
  {
    name: 'status',
    description: 'Show current pipeline status',
    options: [
      {
        short: '-p',
        long: '--project',
        description: 'Show status for specific project',
        takesValue: true,
      },
      {
        long: '--project-dir',
        description: 'Project root owning saved runs',
        takesValue: true,
      },
      {
        long: '--format',
        description: 'Output format',
        takesValue: true,
        values: ['text', 'json'],
      },
      {
        short: '-v',
        long: '--verbose',
        description: 'Show verbose output',
        takesValue: false,
      },
    ],
  },
  {
    name: 'doctor',
    description: 'Check environment prerequisites',
    options: [
      {
        long: '--project-dir',
        description: 'Target project directory',
        takesValue: true,
      },
    ],
  },
  {
    name: 'audit-docs',
    description: 'Audit generated AD-SDLC documents',
    options: [
      {
        short: '-p',
        long: '--project-dir',
        description: 'Project directory that contains the generated documents',
        takesValue: true,
      },
      {
        short: '-o',
        long: '--output',
        description: 'Output directory for audit reports',
        takesValue: true,
      },
      {
        short: '-q',
        long: '--quiet',
        description: 'Suppress non-essential output',
        takesValue: false,
      },
    ],
  },
  {
    name: 'assets',
    description: 'Manage installed canonical agents and commands',
    options: [],
    subcommands: [
      {
        name: 'update',
        description: 'Plan or apply conservative asset-only updates',
        options: [
          {
            long: '--project-dir',
            description: 'Initialized project directory',
            takesValue: true,
          },
          {
            long: '--dry-run',
            description: 'Print the update plan without writing files',
            takesValue: false,
          },
        ],
      },
    ],
  },
  {
    name: 'analyze',
    description: 'Analyze a project to detect documentation-code gaps',
    options: [
      {
        short: '-p',
        long: '--project',
        description: 'Project root path',
        takesValue: true,
      },
      {
        short: '-s',
        long: '--scope',
        description: 'Analysis scope',
        takesValue: true,
        values: ['full', 'documents_only', 'code_only', 'comparison'],
      },
      {
        short: '-g',
        long: '--generate-issues',
        description: 'Generate GitHub issues from detected gaps',
        takesValue: false,
      },
      {
        short: '-i',
        long: '--project-id',
        description: 'Custom project ID',
        takesValue: true,
      },
      {
        short: '-r',
        long: '--resume',
        description: 'Resume a failed analysis',
        takesValue: true,
      },
      {
        long: '--status',
        description: 'Check status of an analysis',
        takesValue: true,
      },
      {
        long: '--no-parallel',
        description: 'Disable parallel execution',
        takesValue: false,
      },
      {
        long: '--no-continue-on-error',
        description: 'Stop on first stage failure',
        takesValue: false,
      },
      {
        short: '-o',
        long: '--output-format',
        description: 'Output format',
        takesValue: true,
        values: ['yaml', 'json'],
      },
    ],
  },
  {
    name: 'telemetry',
    description: 'Manage opt-in telemetry settings',
    options: [],
    subcommands: [
      {
        name: 'status',
        description: 'Show current telemetry status',
        options: [],
      },
      {
        name: 'enable',
        description: 'Enable telemetry (requires consent)',
        options: [
          {
            short: '-y',
            long: '--yes',
            description: 'Automatically accept privacy policy',
            takesValue: false,
          },
        ],
      },
      {
        name: 'disable',
        description: 'Disable telemetry and revoke consent',
        options: [],
      },
      {
        name: 'policy',
        description: 'Display the privacy policy',
        options: [],
      },
    ],
  },
  {
    name: 'completion',
    description: 'Generate shell completion script',
    options: [
      {
        short: '-s',
        long: '--shell',
        description: 'Shell type',
        takesValue: true,
        values: ['bash', 'zsh', 'fish'],
      },
    ],
  },
] as const;

/**
 * Global options available for all commands
 */
const GLOBAL_OPTIONS: readonly OptionDefinition[] = [
  {
    short: '-h',
    long: '--help',
    description: 'Display help',
    takesValue: false,
  },
  {
    short: '-V',
    long: '--version',
    description: 'Display version',
    takesValue: false,
  },
] as const;

/**
 * Prepare text for a single-quoted zsh word. Inside single quotes zsh takes
 * every character literally, backslashes included, so `\'` does not escape a
 * quote; a single quote is written as `'\''` (close the quote, an escaped
 * quote, reopen the quote).
 * @param text - Text to place inside single quotes
 * @returns The text with every single quote replaced by `'\''`
 */
function escapeZshSingleQuoted(text: string): string {
  return text.replace(/'/g, "'\\''");
}

/**
 * Short and long flags of an option, in that order.
 * @param option - Option definition
 * @returns The flags that the option declares
 */
function optionFlags(option: OptionDefinition): string[] {
  return option.short === undefined ? [option.long] : [option.short, option.long];
}

/**
 * Generates shell completion scripts for the AD-SDLC CLI
 */
export class CompletionGenerator {
  private readonly programName: string = 'ad-sdlc';
  private readonly commands: readonly CommandDefinition[];
  private readonly globalOptions: readonly OptionDefinition[];

  constructor() {
    this.commands = CLI_COMMANDS;
    this.globalOptions = GLOBAL_OPTIONS;
  }

  /**
   * Generate completion script for the specified shell
   * @param shell - The target shell type (bash, zsh, or fish)
   * @returns Completion result containing the script and installation instructions
   */
  generate(shell: ShellType): CompletionResult {
    try {
      let script: string;

      switch (shell) {
        case 'bash':
          script = this.generateBashCompletion();
          break;
        case 'zsh':
          script = this.generateZshCompletion();
          break;
        case 'fish':
          script = this.generateFishCompletion();
          break;
        default: {
          const exhaustiveCheck: never = shell;
          throw new Error(`Unsupported shell: ${String(exhaustiveCheck)}`);
        }
      }

      return {
        success: true,
        script,
        shell,
        instructions: this.getInstallationInstructions(shell),
      };
    } catch (error) {
      return {
        success: false,
        script: '',
        shell,
        instructions: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Options offered for a command: its own options followed by the global ones
   * @param cmd - Command definition
   * @returns Every option the command accepts
   */
  private optionsOf(cmd: CommandDefinition): readonly OptionDefinition[] {
    return [...cmd.options, ...this.globalOptions];
  }

  /**
   * Generate Bash completion script
   * @returns The generated Bash completion script string
   */
  private generateBashCompletion(): string {
    const functionName = `_${this.programName.replace(/-/g, '_')}_completions`;
    const commandNames = this.commands.map((c) => c.name).join(' ');
    const commandCases = this.commands
      .map((cmd) => this.bashCommandCase(cmd, 1, '        '))
      .join('\n');

    return `# Bash completion for ${this.programName}
# Generated by ${this.programName} completion

${functionName}()
{
    local cur prev words cword
    _init_completion || return

    local commands="${commandNames}"

    # Complete commands at first position
    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
        return 0
    fi

    # Handle command-specific completions
    case "\${words[1]}" in
${commandCases}
    esac

    return 0
}

complete -F ${functionName} ${this.programName}
`;
  }

  /**
   * Bash case arm for a command. A command with subcommands offers their names
   * right after its own word and hands later words to the subcommand's arm. A
   * command without subcommands completes the value of the preceding option
   * first, then its options.
   * @param cmd - Command definition
   * @param position - Index of the command's word in `words`
   * @param indent - Indentation of the case pattern
   * @returns The case arm, including its `;;`
   */
  private bashCommandCase(cmd: CommandDefinition, position: number, indent: string): string {
    const body = `${indent}    `;
    const options = this.optionsOf(cmd).flatMap(optionFlags).join(' ');
    const subcommands = cmd.subcommands ?? [];
    const lines = [`${indent}${cmd.name})`];

    if (subcommands.length > 0) {
      const next = String(position + 1);
      const words = [...subcommands.map((sub) => sub.name), options].join(' ');
      lines.push(
        `${body}if [[ \${cword} -eq ${next} ]]; then`,
        `${body}    COMPREPLY=($(compgen -W "${words}" -- "\${cur}"))`,
        `${body}    return 0`,
        `${body}fi`,
        `${body}case "\${words[${next}]}" in`,
        ...subcommands.map((sub) => this.bashCommandCase(sub, position + 1, `${body}    `)),
        `${body}esac`
      );
    } else {
      const valueCases = cmd.options
        .filter((opt) => opt.takesValue)
        .map((opt) => {
          const reply =
            opt.values !== undefined && opt.values.length > 0
              ? `COMPREPLY=($(compgen -W "${opt.values.join(' ')}" -- "\${cur}"))`
              : '_filedir';
          return [
            `${body}    ${optionFlags(opt).join('|')})`,
            `${body}        ${reply}`,
            `${body}        return 0`,
            `${body}        ;;`,
          ].join('\n');
        });
      if (valueCases.length > 0) {
        lines.push(`${body}case "\${prev}" in`, ...valueCases, `${body}esac`);
      }
      lines.push(`${body}COMPREPLY=($(compgen -W "${options}" -- "\${cur}"))`, `${body}return 0`);
    }

    lines.push(`${body};;`);
    return lines.join('\n');
  }

  /**
   * Generate Zsh completion script
   * @returns The generated Zsh completion script string
   */
  private generateZshCompletion(): string {
    const functionName = `_${this.programName.replace(/-/g, '_')}`;
    const commandDescriptions = this.commands
      .map((cmd) => `    '${cmd.name}:${escapeZshSingleQuoted(cmd.description)}'`)
      .join('\n');
    const commandCases = this.commands
      .map((cmd) => this.zshCommandCase(cmd, '    ', false))
      .join('\n');

    return `#compdef ${this.programName}
# Zsh completion for ${this.programName}
# Generated by ${this.programName} completion

${functionName}() {
  local curcontext="$curcontext" state line
  typeset -A opt_args

  _arguments -C \\
    '1: :->command' \\
    '*:: :->args'

  case $state in
  command)
    local -a commands
    commands=(
${commandDescriptions}
    )
    _describe -t commands 'command' commands
    ;;
  args)
    # '*::' leaves only the command and the words after it: $words[1] is the command
    case $words[1] in
${commandCases}
    esac
    ;;
  esac
}

${functionName} "$@"
`;
  }

  /**
   * Zsh case arm for a command, keyed on `$words[1]`. A subcommand's arm first
   * drops its parent's word, so `$words[1]` is the subcommand itself.
   * @param cmd - Command definition
   * @param indent - Indentation of the case pattern
   * @param nested - Whether the command is a subcommand
   * @returns The case arm, including its `;;`
   */
  private zshCommandCase(cmd: CommandDefinition, indent: string, nested: boolean): string {
    const body = `${indent}  `;
    const subcommands = cmd.subcommands ?? [];
    const lines = [`${indent}${cmd.name})`];
    if (nested) lines.push(`${body}shift words`, `${body}(( CURRENT-- ))`);

    if (subcommands.length > 0) {
      lines.push(
        `${body}if (( CURRENT == 2 )); then`,
        `${body}  local -a subcommands`,
        `${body}  subcommands=(`,
        ...subcommands.map(
          (sub) => `${body}    '${sub.name}:${escapeZshSingleQuoted(sub.description)}'`
        ),
        `${body}  )`,
        `${body}  _describe -t subcommands '${cmd.name} subcommand' subcommands`,
        `${body}else`,
        `${body}  case $words[2] in`,
        ...subcommands.map((sub) => this.zshCommandCase(sub, `${body}  `, true)),
        `${body}  esac`,
        `${body}fi`
      );
    } else {
      const specs = this.optionsOf(cmd).map((opt) => `${body}  ${this.zshOptionSpec(opt)}`);
      // Every spec but the last ends with ` \` so all of them stay arguments of _arguments.
      lines.push(`${body}_arguments -s \\`, specs.join(' \\\n'));
    }

    lines.push(`${body};;`);
    return lines.join('\n');
  }

  /**
   * Single-quoted zsh `_arguments` spec for an option
   * @param opt - Option definition
   * @returns The option spec
   */
  private zshOptionSpec(opt: OptionDefinition): string {
    const spec = `${opt.long}[${escapeZshSingleQuoted(opt.description)}]`;
    if (!opt.takesValue) return `'${spec}'`;
    const action =
      opt.values !== undefined && opt.values.length > 0 ? `(${opt.values.join(' ')})` : '_files';
    return `'${spec}:value:${action}'`;
  }

  /**
   * Generate Fish completion script
   * @returns The generated Fish completion script string
   */
  private generateFishCompletion(): string {
    const complete = `complete -c ${this.programName}`;
    const commandCompletions = this.commands
      .map(
        (cmd) => `${complete} -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description}"`
      )
      .join('\n');

    const subcommandCompletions = this.commands
      .flatMap((cmd) =>
        (cmd.subcommands ?? []).map(
          (sub) =>
            `${complete} -n "${this.fishCondition([cmd])}" -a "${sub.name}" -d "${sub.description}"`
        )
      )
      .join('\n');

    const commandPaths = this.commands.flatMap((cmd) => [
      [cmd],
      ...(cmd.subcommands ?? []).map((sub) => [cmd, sub]),
    ]);
    const optionCompletions = commandPaths
      .flatMap((path) => {
        const cmd = path[path.length - 1];
        if (cmd === undefined) return [];
        return this.optionsOf(cmd).map((opt) => {
          const parts: string[] = [complete, `-n "${this.fishCondition(path)}"`];

          parts.push(`-l "${opt.long.replace(/^--/, '')}"`);
          if (opt.short !== undefined) {
            parts.push(`-s "${opt.short.replace(/^-/, '')}"`);
          }

          parts.push(`-d "${opt.description}"`);

          if (opt.takesValue && opt.values !== undefined && opt.values.length > 0) {
            parts.push(`-xa "${opt.values.join(' ')}"`);
          } else if (opt.takesValue) {
            parts.push('-r');
          }

          return parts.join(' ');
        });
      })
      .join('\n');

    return `# Fish completion for ${this.programName}
# Generated by ${this.programName} completion

# Disable file completion by default
complete -c ${this.programName} -f

# Commands
${commandCompletions}

# Subcommands
${subcommandCompletions}

# Options
${optionCompletions}
`;
  }

  /**
   * Fish condition that holds while the command line is inside a command path.
   * A command with subcommands stops matching once one of them is given, and a
   * top-level command does not match inside a parent that has a subcommand of
   * the same name (`status` and `telemetry status`).
   * @param path - Command path from the top-level command down
   * @returns The condition for `complete -n`
   */
  private fishCondition(path: readonly CommandDefinition[]): string {
    const conditions = path.map((cmd) => `__fish_seen_subcommand_from ${cmd.name}`);
    const [top] = path;
    if (path.length === 1 && top !== undefined) {
      for (const parent of this.commands) {
        if (parent.subcommands?.some((sub) => sub.name === top.name) === true) {
          conditions.push(`not __fish_seen_subcommand_from ${parent.name}`);
        }
      }
    }
    const subcommands = path[path.length - 1]?.subcommands ?? [];
    if (subcommands.length > 0) {
      conditions.push(
        `not __fish_seen_subcommand_from ${subcommands.map((sub) => sub.name).join(' ')}`
      );
    }
    return conditions.join('; and ');
  }

  /**
   * Get installation instructions for the specified shell
   * @param shell - The target shell type to generate instructions for
   * @returns Shell-specific installation instructions string
   */
  private getInstallationInstructions(shell: ShellType): string {
    const path = SHELL_COMPLETION_PATHS[shell];

    switch (shell) {
      case 'bash':
        return `To install bash completion:

1. Save this script to a file:
   ${this.programName} completion --shell bash > ~/.${this.programName}-completion.bash

2. Add to ${path}:
   source ~/.${this.programName}-completion.bash

3. Restart your shell or run:
   source ~/.bashrc`;

      case 'zsh':
        return `To install zsh completion:

1. Save this script to a file:
   ${this.programName} completion --shell zsh > ~/.zsh/completions/_${this.programName}

2. Make sure your fpath includes completions directory in ${path}:
   fpath=(~/.zsh/completions $fpath)
   autoload -Uz compinit && compinit

3. Restart your shell or run:
   source ~/.zshrc`;

      case 'fish':
        return `To install fish completion:

1. Save this script directly to fish completions:
   ${this.programName} completion --shell fish > ${path}

2. Fish will automatically load the completion on next start`;
    }
  }

  /**
   * Get list of supported shells
   * @returns Read-only array of supported shell types
   */
  getSupportedShells(): readonly ShellType[] {
    return ['bash', 'zsh', 'fish'] as const;
  }

  /**
   * Get command definitions (for testing/inspection)
   * @returns Read-only array of CLI command definitions
   */
  getCommands(): readonly CommandDefinition[] {
    return this.commands;
  }
}

// Singleton instance
let completionGeneratorInstance: CompletionGenerator | null = null;

/**
 * Get or create the CompletionGenerator singleton
 * @returns The shared CompletionGenerator instance
 */
export function getCompletionGenerator(): CompletionGenerator {
  if (completionGeneratorInstance === null) {
    completionGeneratorInstance = new CompletionGenerator();
  }
  return completionGeneratorInstance;
}

/**
 * Reset the CompletionGenerator singleton (for testing)
 */
export function resetCompletionGenerator(): void {
  completionGeneratorInstance = null;
}
