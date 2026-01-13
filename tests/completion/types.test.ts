/**
 * Tests for completion module types
 */

import { describe, expect, it } from 'vitest';

import { SHELL_COMPLETION_PATHS, SUPPORTED_SHELLS } from '../../src/completion/types.js';
import type { ShellType } from '../../src/completion/types.js';

describe('SUPPORTED_SHELLS', () => {
  it('should include bash, zsh, and fish', () => {
    expect(SUPPORTED_SHELLS).toContain('bash');
    expect(SUPPORTED_SHELLS).toContain('zsh');
    expect(SUPPORTED_SHELLS).toContain('fish');
  });

  it('should have exactly 3 shells', () => {
    expect(SUPPORTED_SHELLS.length).toBe(3);
  });

  it('should be an array', () => {
    expect(Array.isArray(SUPPORTED_SHELLS)).toBe(true);
  });
});

describe('SHELL_COMPLETION_PATHS', () => {
  it('should have paths for all supported shells', () => {
    for (const shell of SUPPORTED_SHELLS) {
      expect(SHELL_COMPLETION_PATHS[shell]).toBeDefined();
      expect(typeof SHELL_COMPLETION_PATHS[shell]).toBe('string');
      expect(SHELL_COMPLETION_PATHS[shell].length).toBeGreaterThan(0);
    }
  });

  it('should have bash path pointing to bashrc or bash_completion', () => {
    expect(SHELL_COMPLETION_PATHS.bash).toContain('.bashrc');
  });

  it('should have zsh path pointing to zshrc', () => {
    expect(SHELL_COMPLETION_PATHS.zsh).toContain('.zshrc');
  });

  it('should have fish path pointing to fish completions directory', () => {
    expect(SHELL_COMPLETION_PATHS.fish).toContain('.config/fish/completions');
  });
});

describe('ShellType', () => {
  it('should accept valid shell types', () => {
    const shells: ShellType[] = ['bash', 'zsh', 'fish'];
    expect(shells.length).toBe(3);
  });
});
