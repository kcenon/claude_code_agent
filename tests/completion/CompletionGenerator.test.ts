/**
 * Tests for CompletionGenerator
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  CompletionGenerator,
  getCompletionGenerator,
  resetCompletionGenerator,
} from '../../src/completion/CompletionGenerator.js';
import type { ShellType } from '../../src/completion/types.js';
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
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((c) => c.name === 'init')).toBe(true);
      expect(commands.some((c) => c.name === 'validate')).toBe(true);
      expect(commands.some((c) => c.name === 'status')).toBe(true);
      expect(commands.some((c) => c.name === 'analyze')).toBe(true);
      expect(commands.some((c) => c.name === 'completion')).toBe(true);
    });

    it('should include options for each command', () => {
      const generator = new CompletionGenerator();
      const commands = generator.getCommands();
      for (const cmd of commands) {
        expect(cmd.options.length).toBeGreaterThan(0);
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

        expect(result.script).toContain('--github-repo');
        expect(result.script).toContain('--tech-stack');
        expect(result.script).toContain('--template');
      });

      it('should include value completions for options', () => {
        const generator = new CompletionGenerator();
        const result = generator.generate('bash');

        expect(result.script).toContain('typescript');
        expect(result.script).toContain('python');
        expect(result.script).toContain('minimal');
        expect(result.script).toContain('standard');
        expect(result.script).toContain('enterprise');
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

        expect(result.script).toContain('-l "github-repo"');
        expect(result.script).toContain('-s "g"');
        expect(result.script).toContain('__fish_seen_subcommand_from');
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
    });
  });
});

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
