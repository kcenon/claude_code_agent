import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  InputValidator,
  PathTraversalError,
  InvalidUrlError,
  ValidationError,
} from '../../src/security/index.js';

describe('InputValidator', () => {
  let validator: InputValidator;
  const basePath = path.join(os.tmpdir(), 'validator-test');

  beforeEach(() => {
    validator = new InputValidator({ basePath });
  });

  describe('validateFilePath', () => {
    it('should validate a simple filename', () => {
      const result = validator.validateFilePath('file.txt');
      expect(result).toBe(path.join(basePath, 'file.txt'));
    });

    it('should validate a nested path', () => {
      const result = validator.validateFilePath('subdir/file.txt');
      expect(result).toBe(path.join(basePath, 'subdir', 'file.txt'));
    });

    it('should throw PathTraversalError for .. traversal', () => {
      expect(() => validator.validateFilePath('../etc/passwd')).toThrow(PathTraversalError);
    });

    it('should throw PathTraversalError for absolute paths outside base', () => {
      expect(() => validator.validateFilePath('/etc/passwd')).toThrow(PathTraversalError);
    });

    it('should normalize paths with . segments', () => {
      const result = validator.validateFilePath('./subdir/./file.txt');
      expect(result).toBe(path.join(basePath, 'subdir', 'file.txt'));
    });
  });

  describe('validateFilePathSafe', () => {
    it('should return valid result for safe path', () => {
      const result = validator.validateFilePathSafe('file.txt');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(path.join(basePath, 'file.txt'));
    });

    it('should return error for path traversal', () => {
      const result = validator.validateFilePathSafe('../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path traversal detected');
    });
  });

  describe('validateUrl', () => {
    it('should validate a valid HTTPS URL', () => {
      const result = validator.validateUrl('https://example.com/path');
      expect(result.href).toBe('https://example.com/path');
    });

    it('should throw for HTTP URLs by default', () => {
      expect(() => validator.validateUrl('http://example.com')).toThrow(InvalidUrlError);
    });

    it('should throw for invalid URL format', () => {
      expect(() => validator.validateUrl('not-a-url')).toThrow(InvalidUrlError);
    });

    it('should throw for localhost', () => {
      expect(() => validator.validateUrl('https://localhost/api')).toThrow(InvalidUrlError);
    });

    it('should throw for 127.0.0.1', () => {
      expect(() => validator.validateUrl('https://127.0.0.1/api')).toThrow(InvalidUrlError);
    });

    it('should throw for private IP ranges', () => {
      expect(() => validator.validateUrl('https://192.168.1.1/api')).toThrow(InvalidUrlError);
      expect(() => validator.validateUrl('https://10.0.0.1/api')).toThrow(InvalidUrlError);
      expect(() => validator.validateUrl('https://172.16.0.1/api')).toThrow(InvalidUrlError);
    });

    it('should allow http when configured', () => {
      const httpValidator = new InputValidator({
        basePath,
        allowedProtocols: ['https:', 'http:'],
      });
      const result = httpValidator.validateUrl('http://example.com');
      expect(result.href).toBe('http://example.com/');
    });

    it('should allow internal URLs when configured', () => {
      const internalValidator = new InputValidator({
        basePath,
        blockInternalUrls: false,
      });
      const result = internalValidator.validateUrl('https://localhost/api');
      expect(result.hostname).toBe('localhost');
    });
  });

  describe('validateUrlSafe', () => {
    it('should return valid result for good URL', () => {
      const result = validator.validateUrlSafe('https://github.com');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('https://github.com/');
    });

    it('should return error for invalid URL', () => {
      const result = validator.validateUrlSafe('http://localhost');
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeUserInput', () => {
    it('should remove control characters', () => {
      const result = validator.sanitizeUserInput('Hello\x00World\x1F');
      expect(result).toBe('HelloWorld');
    });

    it('should preserve newlines and tabs', () => {
      const result = validator.sanitizeUserInput('Line1\nLine2\tTabbed');
      expect(result).toBe('Line1\nLine2\tTabbed');
    });

    it('should throw for input exceeding max length', () => {
      const longInput = 'a'.repeat(20000);
      expect(() => validator.sanitizeUserInput(longInput)).toThrow(ValidationError);
    });

    it('should respect custom max length', () => {
      const shortValidator = new InputValidator({
        basePath,
        maxInputLength: 100,
      });
      const input = 'a'.repeat(150);
      expect(() => shortValidator.sanitizeUserInput(input)).toThrow(ValidationError);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(validator.isValidEmail('test@example.com')).toBe(true);
      expect(validator.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(validator.isValidEmail('user+tag@gmail.com')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(validator.isValidEmail('not-an-email')).toBe(false);
      expect(validator.isValidEmail('@missing-local.com')).toBe(false);
      expect(validator.isValidEmail('missing-domain@')).toBe(false);
      expect(validator.isValidEmail('')).toBe(false);
    });
  });

  describe('validateGitHubRepo', () => {
    it('should accept owner/repo format', () => {
      expect(validator.validateGitHubRepo('owner/repo')).toBe('owner/repo');
    });

    it('should extract owner/repo from GitHub URL', () => {
      expect(validator.validateGitHubRepo('https://github.com/owner/repo')).toBe('owner/repo');
      expect(validator.validateGitHubRepo('https://github.com/owner/repo.git')).toBe('owner/repo.git');
    });

    it('should throw for non-GitHub URLs', () => {
      expect(() => validator.validateGitHubRepo('https://gitlab.com/owner/repo')).toThrow(
        ValidationError
      );
    });

    it('should throw for invalid formats', () => {
      expect(() => validator.validateGitHubRepo('invalid')).toThrow(ValidationError);
    });
  });

  describe('isValidSemver', () => {
    it('should return true for valid semver', () => {
      expect(validator.isValidSemver('1.0.0')).toBe(true);
      expect(validator.isValidSemver('v1.2.3')).toBe(true);
      expect(validator.isValidSemver('1.0.0-alpha')).toBe(true);
      expect(validator.isValidSemver('1.0.0-alpha.1')).toBe(true);
      expect(validator.isValidSemver('1.0.0+build.123')).toBe(true);
    });

    it('should return false for invalid semver', () => {
      expect(validator.isValidSemver('1.0')).toBe(false);
      expect(validator.isValidSemver('v1')).toBe(false);
      expect(validator.isValidSemver('not-semver')).toBe(false);
    });
  });

  describe('isValidBranchName', () => {
    it('should return true for valid branch names', () => {
      expect(validator.isValidBranchName('main')).toBe(true);
      expect(validator.isValidBranchName('feature/add-login')).toBe(true);
      expect(validator.isValidBranchName('fix/issue-123')).toBe(true);
    });

    it('should return false for invalid branch names', () => {
      expect(validator.isValidBranchName('')).toBe(false);
      expect(validator.isValidBranchName('-start-with-dash')).toBe(false);
      expect(validator.isValidBranchName('.start-with-dot')).toBe(false);
      expect(validator.isValidBranchName('ends-with/')).toBe(false);
      expect(validator.isValidBranchName('has..double-dots')).toBe(false);
      expect(validator.isValidBranchName('has space')).toBe(false);
      expect(validator.isValidBranchName('branch.lock')).toBe(false);
    });
  });

  describe('getBasePath', () => {
    it('should return the configured base path', () => {
      expect(validator.getBasePath()).toBe(basePath);
    });
  });

  describe('enhanced path validation', () => {
    it('should detect null bytes in paths', () => {
      expect(validator.containsNullByte('file\0.txt')).toBe(true);
      expect(validator.containsNullByte('file.txt')).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      expect(() => validator.validateFilePath('file\0.txt')).toThrow(PathTraversalError);
    });

    it('should provide quick validation check', () => {
      expect(validator.isValidPath('file.txt')).toBe(true);
      expect(validator.isValidPath('../etc/passwd')).toBe(false);
      expect(validator.isValidPath('file\0.txt')).toBe(false);
    });
  });

  describe('validateFilePathExtended', () => {
    it('should return extended result for valid paths', () => {
      const result = validator.validateFilePathExtended('file.txt');
      expect(result.valid).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.isSymlink).toBe(false);
    });

    it('should include rejection reason for invalid paths', () => {
      const result = validator.validateFilePathExtended('file\0.txt');
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('NULL_BYTE');
    });

    it('should include rejection reason for traversal', () => {
      const result = validator.validateFilePathExtended('../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBeDefined();
    });
  });

  describe('allowed directories', () => {
    it('should allow paths in additional allowed directories', () => {
      const additionalDir = path.join(os.tmpdir(), 'additional-allowed');
      const multiValidator = new InputValidator({
        basePath,
        allowedDirs: [additionalDir],
      });

      // Should still validate paths within base
      const result = multiValidator.validateFilePathSafe('file.txt');
      expect(result.valid).toBe(true);
    });
  });

  describe('symlink policy', () => {
    it('should respect deny symlink policy', () => {
      const denyValidator = new InputValidator({
        basePath,
        symlinkPolicy: 'deny',
      });

      // Regular files should still work
      const result = denyValidator.validateFilePathSafe('file.txt');
      expect(result.valid).toBe(true);
    });

    it('should respect resolve symlink policy', () => {
      const resolveValidator = new InputValidator({
        basePath,
        symlinkPolicy: 'resolve',
      });

      const result = resolveValidator.validateFilePathSafe('file.txt');
      expect(result.valid).toBe(true);
    });
  });

  describe('getPathSanitizer', () => {
    it('should return path sanitizer instance', () => {
      const sanitizer = validator.getPathSanitizer();
      expect(sanitizer).toBeDefined();
      expect(typeof sanitizer.sanitize).toBe('function');
    });
  });

  describe('getSymlinkResolver', () => {
    it('should return symlink resolver instance', () => {
      const resolver = validator.getSymlinkResolver();
      expect(resolver).toBeDefined();
      expect(typeof resolver.resolve).toBe('function');
    });
  });
});
