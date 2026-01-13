/**
 * CLI Command Autocompletion Generator
 *
 * Generates shell-specific completion scripts for bash, zsh, and fish.
 *
 * @packageDocumentation
 */

import type {
  CommandDefinition,
  CompletionResult,
  OptionDefinition,
  ShellType,
} from './types.js';
import { SHELL_COMPLETION_PATHS } from './types.js';

/**
 * AD-SDLC CLI command definitions for autocompletion
 */
const CLI_COMMANDS: readonly CommandDefinition[] = [
  {
    name: 'init',
    description: 'Initialize a new AD-SDLC project',
    options: [
      {
        short: '-g',
        long: '--github-repo',
        description: 'GitHub repository URL',
        takesValue: true,
      },
      {
        short: '-t',
        long: '--tech-stack',
        description: 'Primary technology stack',
        takesValue: true,
        values: ['typescript', 'python', 'java', 'go', 'rust', 'other'],
      },
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
   * Generate Bash completion script
   */
  private generateBashCompletion(): string {
    const commandNames = this.commands.map((c) => c.name).join(' ');

    const commandCases = this.commands
      .map((cmd) => {
        const opts = [...cmd.options, ...this.globalOptions]
          .map((o) => [o.short, o.long].filter(Boolean).join(' '))
          .join(' ');
        return `        ${cmd.name})
            COMPREPLY=($(compgen -W "${opts}" -- "\${cur}"))
            return 0
            ;;`;
      })
      .join('\n');

    const valueCases = this.commands
      .flatMap((cmd) =>
        cmd.options
          .filter((opt) => opt.values !== undefined && opt.values.length > 0)
          .map((opt) => {
            const flags = [opt.short, opt.long].filter(Boolean).join('|');
            const values = opt.values?.join(' ') ?? '';
            return `        ${flags})
            COMPREPLY=($(compgen -W "${values}" -- "\${cur}"))
            return 0
            ;;`;
          })
      )
      .join('\n');

    return `# Bash completion for ${this.programName}
# Generated by ${this.programName} completion

_${this.programName.replace(/-/g, '_')}_completions()
{
    local cur prev words cword
    _init_completion || return

    local commands="${commandNames}"

    # Handle command-specific completions
    if [[ \${cword} -ge 2 ]]; then
        local cmd="\${words[1]}"
        case "\${cmd}" in
${commandCases}
        esac

        # Handle option value completions
        case "\${prev}" in
${valueCases}
        esac
    fi

    # Complete commands at first position
    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
        return 0
    fi

    return 0
}

complete -F _${this.programName.replace(/-/g, '_')}_completions ${this.programName}
`;
  }

  /**
   * Generate Zsh completion script
   */
  private generateZshCompletion(): string {
    const commandDescriptions = this.commands
      .map((cmd) => `    '${cmd.name}:${cmd.description}'`)
      .join('\n');

    const commandCases = this.commands
      .map((cmd) => {
        const opts = [...cmd.options, ...this.globalOptions]
          .map((o) => {
            const flag = o.long;
            const desc = o.description.replace(/'/g, "\\'");
            if (o.takesValue) {
              if (o.values !== undefined && o.values.length > 0) {
                return `        '${flag}[${desc}]:value:(${o.values.join(' ')})'`;
              }
              return `        '${flag}[${desc}]:value:_files'`;
            }
            return `        '${flag}[${desc}]'`;
          })
          .join('\n');
        return `    ${cmd.name})
      _arguments -s \\
${opts}
      ;;`;
      })
      .join('\n');

    return `#compdef ${this.programName}
# Zsh completion for ${this.programName}
# Generated by ${this.programName} completion

_${this.programName.replace(/-/g, '_')}() {
  local curcontext="$curcontext" state line
  typeset -A opt_args

  _arguments -C \\
    '1: :->command' \\
    '*: :->args'

  case $state in
  command)
    local -a commands
    commands=(
${commandDescriptions}
    )
    _describe -t commands 'command' commands
    ;;
  args)
    case $words[2] in
${commandCases}
    esac
    ;;
  esac
}

_${this.programName.replace(/-/g, '_')} "$@"
`;
  }

  /**
   * Generate Fish completion script
   */
  private generateFishCompletion(): string {
    const commandCompletions = this.commands
      .map(
        (cmd) =>
          `complete -c ${this.programName} -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description}"`
      )
      .join('\n');

    const optionCompletions = this.commands
      .flatMap((cmd) =>
        [...cmd.options, ...this.globalOptions].map((opt) => {
          const parts: string[] = [
            `complete -c ${this.programName}`,
            `-n "__fish_seen_subcommand_from ${cmd.name}"`,
          ];

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
        })
      )
      .join('\n');

    return `# Fish completion for ${this.programName}
# Generated by ${this.programName} completion

# Disable file completion by default
complete -c ${this.programName} -f

# Commands
${commandCompletions}

# Options
${optionCompletions}
`;
  }

  /**
   * Get installation instructions for the specified shell
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
   */
  getSupportedShells(): readonly ShellType[] {
    return ['bash', 'zsh', 'fish'] as const;
  }

  /**
   * Get command definitions (for testing/inspection)
   */
  getCommands(): readonly CommandDefinition[] {
    return this.commands;
  }
}

// Singleton instance
let completionGeneratorInstance: CompletionGenerator | null = null;

/**
 * Get or create the CompletionGenerator singleton
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
