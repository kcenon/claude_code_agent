/**
 * Tests for CompletionGenerator
 */

import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CompletionGenerator,
  getCompletionGenerator,
  resetCompletionGenerator,
} from '../../src/completion/CompletionGenerator.js';
import type { CommandDefinition, ShellType } from '../../src/completion/types.js';
import { SUPPORTED_SHELLS } from '../../src/completion/types.js';

describe('CompletionGenerator', () => {
  afterEach(() => {
    resetCompletionGenerator();
  });

  describe('constructor', () => {
    it('should create a new instance', () => {
      const generator = new CompletionGenerator();
      expect(generator).toBeInstanceOf(CompletionGenerator);
    });
  });

  describe('getSupportedShells', () => {
    it('should return all supported shells', () => {
      const generator = new CompletionGenerator();
      const shells = generator.getSupportedShells();
      expect(shells).toEqual(['bash', 'zsh', 'fish']);
    });
  });

  describe('getCommands', () => {
    it('should return command definitions', () => {
      const generator = new CompletionGenerator();
      const commands = generator.getCommands();
      expect(commands.map((c) => c.name)).toEqual([
        'init',
        'run',
        'validate',
        'status',
        'doctor',
        'audit-docs',
        'assets',
        'analyze',
        'telemetry',
        'completion',
      ]);
      expect(commands.find((c) => c.name === 'telemetry')?.subcommands?.map((s) => s.name)).toEqual(
        ['status', 'enable', 'disable', 'policy', 'report']
      );
      expect(commands.find((c) => c.name === 'assets')?.subcommands?.map((s) => s.name)).toEqual([
        'update',
      ]);
    });

    it('should include options or subcommands for each command', () => {
      const generator = new CompletionGenerator();
      const commands = generator.getCommands();
      for (const cmd of commands) {
        expect(cmd.options.length + (cmd.subcommands?.length ?? 0)).toBeGreaterThan(0);
      }
    });

    // zsh option specs read [ ] and : and fish expands $ and \ inside double quotes.
    it('should use descriptions that need no shell escaping beyond single quotes', () => {
      const descriptions = (commands: readonly CommandDefinition[]): string[] =>
        commands.flatMap((cmd) => [
          cmd.description,
          ...cmd.options.map((opt) => opt.description),
          ...descriptions(cmd.subcommands ?? []),
        ]);
      for (const description of descriptions(new CompletionGenerator().getCommands())) {
        expect(description).toMatch(/^[^[\]:"$`\\]+$/);
      }
    });
  });

  describe('generate', () => {
    describe('bash completion', () => {
      it('should generate valid bash completion script', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('bash');

        expect(result.success).toBe(true);
        expect(result.shell).toBe('bash');
        expect(result.script).toContain('_ad_sdlc_completions');
        expect(result.script).toContain('complete -F');
        expect(result.script).toContain('ad-sdlc');
        expect(result.error).toBeUndefined();
      });

      it('should include command names in bash script', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('bash');

        expect(result.script).toContain('init');
        expect(result.script).toContain('validate');
        expect(result.script).toContain('status');
        expect(result.script).toContain('analyze');
        expect(result.script).toContain('completion');
      });

      it('should include option completions for commands', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('bash');

        expect(result.script).toContain('--quick');
        expect(result.script).toContain('--skip-validation');
        expect(result.script).toContain('--template');
      });

      it('should include value completions for options', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('bash');

        expect(result.script).toContain('greenfield enhancement import');
        expect(result.script).toContain('minimal');
        expect(result.script).toContain('standard');
        expect(result.script).toContain('enterprise');
      });

      // Option values are completed inside each command's arm, before its option list
      // returns, so analyze -s (scope) and completion -s (shell) do not collide.
      it('should complete option values per command before offering options', () => {
        const script = new CompletionGenerator().generate('bash').script;
        const arm = (name: string): string => {
          const start = script.indexOf(`\n        ${name})\n`);
          const end = script.indexOf('\n            ;;\n', start);
          return script.slice(start, end);
        };

        const analyze = arm('analyze');
        expect(analyze).toContain('-s|--scope)');
        expect(analyze).not.toContain('--shell');
        expect(analyze.indexOf('case "${prev}" in')).toBeLessThan(
          analyze.indexOf('COMPREPLY=($(compgen -W "-p --project')
        );
        expect(arm('completion')).toContain('-s|--shell)');
        expect(arm('completion')).toContain('compgen -W "bash zsh fish"');
        expect(arm('doctor')).toContain('--project-dir)\n                    _filedir');
      });

      it('should complete subcommands and their options', () => {
        const script = new CompletionGenerator().generate('bash').script;

        expect(script).toContain('if [[ ${cword} -eq 2 ]]; then');
        expect(script).toContain(
          'compgen -W "status enable disable policy report -h --help -V --version"'
        );
        expect(script).toContain('case "${words[2]}" in');
        expect(script).toContain('compgen -W "-y --yes -h --help -V --version"');
        expect(script).toContain('compgen -W "update -h --help -V --version"');
        expect(script).toContain('compgen -W "--project-dir --dry-run -h --help -V --version"');
      });

      it('should include installation instructions', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('bash');

        expect(result.instructions).toContain('bash');
        expect(result.instructions).toContain('source');
        expect(result.instructions).toContain('.bashrc');
      });
    });

    describe('zsh completion', () => {
      it('should generate valid zsh completion script', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('zsh');

        expect(result.success).toBe(true);
        expect(result.shell).toBe('zsh');
        expect(result.script).toContain('#compdef ad-sdlc');
        expect(result.script).toContain('_ad_sdlc');
        expect(result.script).toContain('_arguments');
        expect(result.error).toBeUndefined();
      });

      it('should include command descriptions in zsh script', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('zsh');

        expect(result.script).toContain('init:Initialize a new AD-SDLC project');
        expect(result.script).toContain('validate:Validate AD-SDLC configuration files');
      });

      it('should write each command and option spec as one single-quoted word', () => {
        const lines = new CompletionGenerator().generate('zsh').script.split('\n');

        expect(lines).toContain("    'init:Initialize a new AD-SDLC project'");
        expect(lines).toContain(
          "        '--template[Project template]:value:(minimal standard enterprise)' \\"
        );
        expect(lines).toContain("        '--file[Validate a specific file]:value:_files' \\");
        expect(lines).toContain("        '--quick[Quick setup with defaults]' \\");
        expect(lines).toContain("        '--version[Display version]'");
      });

      // Without the trailing ` \`, zsh ends _arguments after the first spec and runs
      // every later spec line as a command of its own.
      it('should continue every _arguments spec line but the last with a backslash', () => {
        const lines = new CompletionGenerator().generate('zsh').script.split('\n');
        const blocks: string[][] = [];
        lines.forEach((line, index) => {
          if (!/^\s*_arguments -[sC] \\$/.test(line)) return;
          const specs: string[] = [];
          for (const spec of lines.slice(index + 1)) {
            if (!/^\s+'/.test(spec)) break;
            specs.push(spec);
          }
          blocks.push(specs);
        });

        // One block for the command position, one per command or subcommand without subcommands.
        expect(blocks).toHaveLength(15);
        for (const specs of blocks) {
          expect(specs.length).toBeGreaterThan(1);
          for (const spec of specs.slice(0, -1)) expect(spec).toMatch(/' \\$/);
          expect(specs[specs.length - 1]).toMatch(/'$/);
        }
      });

      it('should complete subcommands and their options', () => {
        const script = new CompletionGenerator().generate('zsh').script;

        expect(script).toContain("'*:: :->args'");
        expect(script).toContain('case $words[1] in');
        expect(script).toContain('    telemetry)\n      if (( CURRENT == 2 )); then');
        expect(script).toContain("          'enable:Enable telemetry (requires consent)'");
        expect(script).toContain("_describe -t subcommands 'telemetry subcommand' subcommands");
        expect(script).toContain(
          '        enable)\n          shift words\n          (( CURRENT-- ))\n          _arguments -s \\\n'
        );
        expect(script).toContain("            '--yes[Automatically accept privacy policy]' \\");
      });

      it("should close and reopen the quotes around a single quote ('\\'')", () => {
        const generator = new CompletionGenerator();
        const commands: readonly CommandDefinition[] = [
          {
            name: 'demo',
            description: "Run the team's 'demo'",
            options: [
              { long: '--path', description: "Owner's path with \\ inside", takesValue: true },
            ],
          },
        ];
        (generator as unknown as { commands: readonly CommandDefinition[] }).commands = commands;

        const lines = generator.generate('zsh').script.split('\n');

        expect(lines).toContain("    'demo:Run the team'\\''s '\\''demo'\\'''");
        expect(lines).toContain(
          "        '--path[Owner'\\''s path with \\ inside]:value:_files' \\"
        );
      });

      it('should include installation instructions', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('zsh');

        expect(result.instructions).toContain('zsh');
        expect(result.instructions).toContain('.zshrc');
        expect(result.instructions).toContain('compinit');
      });
    });

    describe('fish completion', () => {
      it('should generate valid fish completion script', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('fish');

        expect(result.success).toBe(true);
        expect(result.shell).toBe('fish');
        expect(result.script).toContain('complete -c ad-sdlc');
        expect(result.script).toContain('__fish_use_subcommand');
        expect(result.error).toBeUndefined();
      });

      it('should include command completions in fish script', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('fish');

        expect(result.script).toContain('-a "init"');
        expect(result.script).toContain('-a "validate"');
        expect(result.script).toContain('-a "status"');
        expect(result.script).toContain('-a "analyze"');
      });

      it('should include option completions for fish', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('fish');

        expect(result.script).toContain('-l "template"');
        expect(result.script).toContain('-s "T"');
        expect(result.script).toContain('__fish_seen_subcommand_from');
      });

      it('should complete subcommands and keep them apart from top-level commands', () => {
        const lines = new CompletionGenerator().generate('fish').script.split('\n');

        expect(lines).toContain(
          'complete -c ad-sdlc -n "__fish_seen_subcommand_from telemetry; and not __fish_seen_subcommand_from status enable disable policy report" -a "enable" -d "Enable telemetry (requires consent)"'
        );
        expect(lines).toContain(
          'complete -c ad-sdlc -n "__fish_seen_subcommand_from telemetry; and __fish_seen_subcommand_from enable" -l "yes" -s "y" -d "Automatically accept privacy policy"'
        );
        // `ad-sdlc telemetry status` must not offer the options of `ad-sdlc status`.
        expect(lines).toContain(
          'complete -c ad-sdlc -n "__fish_seen_subcommand_from status; and not __fish_seen_subcommand_from telemetry" -l "verbose" -s "v" -d "Show verbose output"'
        );
      });

      it('should include installation instructions', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('fish');

        expect(result.instructions).toContain('fish');
        expect(result.instructions).toContain('.config/fish/completions');
      });
    });

    describe('all shells', () => {
      it.each(SUPPORTED_SHELLS)('should generate valid completion for %s', (shell: ShellType) => {
        const generator = new CompletionGenerator();
        const result = generator.generate(shell);

        expect(result.success).toBe(true);
        expect(result.shell).toBe(shell);
        expect(result.script.length).toBeGreaterThan(0);
        expect(result.instructions.length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      });

      it.each(SUPPORTED_SHELLS)('should include ad-sdlc in script for %s', (shell: ShellType) => {
        const generator = new CompletionGenerator();
        const result = generator.generate(shell);

        expect(result.script).toContain('ad-sdlc');
      });

      // init no longer accepts a repository URL or a tech stack; completion must not offer them.
      it.each(SUPPORTED_SHELLS)(
        'should not offer --github-repo or --tech-stack for %s',
        (shell: ShellType) => {
          const generator = new CompletionGenerator();
          const result = generator.generate(shell);

          expect(result.script).not.toContain('github-repo');
          expect(result.script).not.toContain('tech-stack');
        }
      );

      // Parse only (-n). Skipped where the shell is not installed, and on Windows,
      // where `bash` may resolve to the WSL launcher.
      for (const shell of ['bash', 'zsh'] as const) {
        it.skipIf(process.platform === 'win32' || !hasShell(shell))(
          `should be valid ${shell} syntax`,
          () => {
            const result = spawnSync(shell, ['-n'], {
              input: new CompletionGenerator().generate(shell).script,
              encoding: 'utf-8',
            });
            expect(result.status, result.stderr).toBe(0);
            expect(result.stderr).toBe('');
          }
        );
      }
    });
  });
});

function hasShell(shell: string): boolean {
  const probe = spawnSync(shell, ['-c', 'exit 0'], { encoding: 'utf-8' });
  return probe.error === undefined && probe.status === 0;
}

describe('getCompletionGenerator', () => {
  afterEach(() => {
    resetCompletionGenerator();
  });

  it('should return the same instance on multiple calls', () => {
    const generator1 = getCompletionGenerator();
    const generator2 = getCompletionGenerator();
    expect(generator1).toBe(generator2);
  });

  it('should return a new instance after reset', () => {
    const generator1 = getCompletionGenerator();
    resetCompletionGenerator();
    const generator2 = getCompletionGenerator();
    expect(generator1).not.toBe(generator2);
  });
});

describe('resetCompletionGenerator', () => {
  it('should reset the singleton instance', () => {
    const generator1 = getCompletionGenerator();
    resetCompletionGenerator();
    const generator2 = getCompletionGenerator();
    expect(generator1).not.toBe(generator2);
  });

  it('should not throw when called multiple times', () => {
    expect(() => {
      resetCompletionGenerator();
      resetCompletionGenerator();
      resetCompletionGenerator();
    }).not.toThrow();
  });
});
