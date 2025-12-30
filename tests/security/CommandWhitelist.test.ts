import { describe, it, expect } from 'vitest';
import {
  isAllowedCommand,
  isAllowedSubcommand,
  getCommandConfig,
  containsShellMetacharacters,
  BRANCH_NAME_PATTERN,
  SAFE_PATH_PATTERN,
  PACKAGE_NAME_PATTERN,
  DEFAULT_COMMAND_WHITELIST,
} from '../../src/security/CommandWhitelist.js';

describe('CommandWhitelist', () => {
  describe('isAllowedCommand', () => {
    it('should allow whitelisted commands', () => {
      expect(isAllowedCommand('git')).toBe(true);
      expect(isAllowedCommand('gh')).toBe(true);
      expect(isAllowedCommand('npm')).toBe(true);
      expect(isAllowedCommand('npx')).toBe(true);
      expect(isAllowedCommand('node')).toBe(true);
      expect(isAllowedCommand('tsc')).toBe(true);
      expect(isAllowedCommand('eslint')).toBe(true);
      expect(isAllowedCommand('prettier')).toBe(true);
      expect(isAllowedCommand('vitest')).toBe(true);
      expect(isAllowedCommand('jest')).toBe(true);
    });

    it('should reject non-whitelisted commands', () => {
      expect(isAllowedCommand('curl')).toBe(false);
      expect(isAllowedCommand('wget')).toBe(false);
      expect(isAllowedCommand('bash')).toBe(false);
      expect(isAllowedCommand('sh')).toBe(false);
      expect(isAllowedCommand('python')).toBe(false);
      expect(isAllowedCommand('rm')).toBe(false);
    });
  });

  describe('isAllowedSubcommand', () => {
    it('should allow valid git subcommands', () => {
      expect(isAllowedSubcommand('git', 'status')).toBe(true);
      expect(isAllowedSubcommand('git', 'commit')).toBe(true);
      expect(isAllowedSubcommand('git', 'push')).toBe(true);
      expect(isAllowedSubcommand('git', 'pull')).toBe(true);
      expect(isAllowedSubcommand('git', 'checkout')).toBe(true);
      expect(isAllowedSubcommand('git', 'branch')).toBe(true);
    });

    it('should reject invalid git subcommands', () => {
      expect(isAllowedSubcommand('git', 'rm')).toBe(false);
      expect(isAllowedSubcommand('git', 'filter-branch')).toBe(false);
      expect(isAllowedSubcommand('git', 'gc')).toBe(false);
    });

    it('should allow valid gh subcommands', () => {
      expect(isAllowedSubcommand('gh', 'pr')).toBe(true);
      expect(isAllowedSubcommand('gh', 'issue')).toBe(true);
      expect(isAllowedSubcommand('gh', 'repo')).toBe(true);
      expect(isAllowedSubcommand('gh', 'auth')).toBe(true);
    });

    it('should allow valid npm subcommands', () => {
      expect(isAllowedSubcommand('npm', 'install')).toBe(true);
      expect(isAllowedSubcommand('npm', 'run')).toBe(true);
      expect(isAllowedSubcommand('npm', 'test')).toBe(true);
      expect(isAllowedSubcommand('npm', 'audit')).toBe(true);
    });

    it('should reject subcommands for non-whitelisted commands', () => {
      expect(isAllowedSubcommand('curl', 'anything')).toBe(false);
    });
  });

  describe('getCommandConfig', () => {
    it('should return config for whitelisted commands', () => {
      const gitConfig = getCommandConfig('git');
      expect(gitConfig).toBeDefined();
      expect(gitConfig?.allowed).toBe(true);
      expect(gitConfig?.subcommands).toBeDefined();
    });

    it('should return undefined for unknown commands', () => {
      const config = getCommandConfig('unknown-command');
      expect(config).toBeUndefined();
    });
  });

  describe('containsShellMetacharacters', () => {
    it('should detect semicolon', () => {
      expect(containsShellMetacharacters(';')).toBe(true);
      expect(containsShellMetacharacters('arg; rm -rf /')).toBe(true);
    });

    it('should detect pipe', () => {
      expect(containsShellMetacharacters('|')).toBe(true);
      expect(containsShellMetacharacters('arg | cat')).toBe(true);
    });

    it('should detect ampersand', () => {
      expect(containsShellMetacharacters('&')).toBe(true);
      expect(containsShellMetacharacters('arg && echo')).toBe(true);
    });

    it('should detect backticks', () => {
      expect(containsShellMetacharacters('`whoami`')).toBe(true);
    });

    it('should detect dollar sign', () => {
      expect(containsShellMetacharacters('$HOME')).toBe(true);
      expect(containsShellMetacharacters('$(cmd)')).toBe(true);
    });

    it('should not flag safe arguments', () => {
      expect(containsShellMetacharacters('feature/my-branch')).toBe(false);
      expect(containsShellMetacharacters('--porcelain')).toBe(false);
      expect(containsShellMetacharacters('file.txt')).toBe(false);
    });
  });

  describe('BRANCH_NAME_PATTERN', () => {
    it('should match valid branch names', () => {
      expect(BRANCH_NAME_PATTERN.test('main')).toBe(true);
      expect(BRANCH_NAME_PATTERN.test('feature/new-feature')).toBe(true);
      expect(BRANCH_NAME_PATTERN.test('fix/bug-123')).toBe(true);
      expect(BRANCH_NAME_PATTERN.test('release/v1.0.0')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(BRANCH_NAME_PATTERN.test('branch; rm -rf /')).toBe(false);
      expect(BRANCH_NAME_PATTERN.test('branch$(cmd)')).toBe(false);
    });
  });

  describe('SAFE_PATH_PATTERN', () => {
    it('should match valid paths', () => {
      expect(SAFE_PATH_PATTERN.test('src/index.ts')).toBe(true);
      expect(SAFE_PATH_PATTERN.test('path/to/file.txt')).toBe(true);
      expect(SAFE_PATH_PATTERN.test('file-name_123.js')).toBe(true);
    });

    it('should reject paths with shell metacharacters', () => {
      expect(SAFE_PATH_PATTERN.test('path;cmd')).toBe(false);
      expect(SAFE_PATH_PATTERN.test('path|cmd')).toBe(false);
    });
  });

  describe('PACKAGE_NAME_PATTERN', () => {
    it('should match valid package names', () => {
      expect(PACKAGE_NAME_PATTERN.test('lodash')).toBe(true);
      expect(PACKAGE_NAME_PATTERN.test('@types/node')).toBe(true);
      expect(PACKAGE_NAME_PATTERN.test('package-name')).toBe(true);
      expect(PACKAGE_NAME_PATTERN.test('package@1.0.0')).toBe(true);
      expect(PACKAGE_NAME_PATTERN.test('@scope/package@^2.0.0')).toBe(true);
    });

    it('should reject invalid package names', () => {
      expect(PACKAGE_NAME_PATTERN.test('package; rm -rf /')).toBe(false);
    });
  });

  describe('DEFAULT_COMMAND_WHITELIST', () => {
    it('should have git configuration', () => {
      expect(DEFAULT_COMMAND_WHITELIST.git).toBeDefined();
      expect(DEFAULT_COMMAND_WHITELIST.git.allowed).toBe(true);
    });

    it('should have gh configuration', () => {
      expect(DEFAULT_COMMAND_WHITELIST.gh).toBeDefined();
      expect(DEFAULT_COMMAND_WHITELIST.gh.allowed).toBe(true);
    });

    it('should have npm configuration', () => {
      expect(DEFAULT_COMMAND_WHITELIST.npm).toBeDefined();
      expect(DEFAULT_COMMAND_WHITELIST.npm.allowed).toBe(true);
    });
  });
});
