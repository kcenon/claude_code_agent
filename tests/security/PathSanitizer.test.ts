import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import { PathSanitizer } from '../../src/security/PathSanitizer.js';

describe('PathSanitizer', () => {
  let sanitizer: PathSanitizer;
  const baseDir = path.join(os.tmpdir(), 'sanitizer-test');

  beforeEach(() => {
    sanitizer = new PathSanitizer({ baseDir });
  });

  describe('sanitize', () => {
    it('should accept valid simple paths', () => {
      const result = sanitizer.sanitize('file.txt');
      expect(result.valid).toBe(true);
      expect(result.sanitizedPath).toBe(path.join(baseDir, 'file.txt'));
    });

    it('should accept valid nested paths', () => {
      const result = sanitizer.sanitize('subdir/file.txt');
      expect(result.valid).toBe(true);
      expect(result.sanitizedPath).toContain('subdir');
    });

    it('should reject empty paths', () => {
      const result = sanitizer.sanitize('');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('EMPTY_PATH');
    });

    it('should reject whitespace-only paths', () => {
      const result = sanitizer.sanitize('   ');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('EMPTY_PATH');
    });
  });

  describe('null byte detection', () => {
    it('should reject paths with null bytes', () => {
      const result = sanitizer.sanitize('file\0.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('NULL_BYTE');
    });

    it('should reject paths with embedded null bytes', () => {
      const result = sanitizer.sanitize('subdir/file\0name.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('NULL_BYTE');
    });

    it('should detect null bytes using containsNullByte', () => {
      expect(sanitizer.containsNullByte('file\0.txt')).toBe(true);
      expect(sanitizer.containsNullByte('file.txt')).toBe(false);
    });
  });

  describe('path traversal detection', () => {
    it('should reject .. at the start', () => {
      const result = sanitizer.sanitize('../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('TRAVERSAL_ATTEMPT');
    });

    it('should reject embedded ../', () => {
      const result = sanitizer.sanitize('subdir/../../../etc/passwd');
      expect(result.valid).toBe(false);
      // Can be TRAVERSAL_ATTEMPT or OUTSIDE_BOUNDARY depending on detection order
      expect(['TRAVERSAL_ATTEMPT', 'OUTSIDE_BOUNDARY']).toContain(result.reasonCode);
    });

    it('should reject backslash traversal on Windows-style paths', () => {
      const result = sanitizer.sanitize('..\\etc\\passwd');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('TRAVERSAL_ATTEMPT');
    });
  });

  describe('path length validation', () => {
    it('should reject paths exceeding max length', () => {
      const longPath = 'a'.repeat(5000);
      const result = sanitizer.sanitize(longPath);
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('PATH_TOO_LONG');
    });

    it('should accept paths within max length', () => {
      const result = sanitizer.sanitize('a'.repeat(100));
      expect(result.valid).toBe(true);
    });

    it('should respect custom max path length', () => {
      const shortSanitizer = new PathSanitizer({
        baseDir,
        maxPathLength: 50,
      });
      const result = shortSanitizer.sanitize('a'.repeat(100));
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('PATH_TOO_LONG');
    });
  });

  describe('invalid character detection', () => {
    it('should reject paths with control characters', () => {
      const result = sanitizer.sanitize('file\x01name.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_CHARACTERS');
    });

    it('should reject paths with special characters', () => {
      const result = sanitizer.sanitize('file<name>.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_CHARACTERS');
    });

    it('should reject paths with question marks', () => {
      const result = sanitizer.sanitize('file?.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_CHARACTERS');
    });

    it('should reject paths with asterisks', () => {
      const result = sanitizer.sanitize('file*.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_CHARACTERS');
    });
  });

  describe('Windows reserved names', () => {
    it('should reject CON', () => {
      const result = sanitizer.sanitize('CON');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_COMPONENT');
    });

    it('should reject NUL', () => {
      const result = sanitizer.sanitize('NUL');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_COMPONENT');
    });

    it('should reject COM1', () => {
      const result = sanitizer.sanitize('COM1');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_COMPONENT');
    });

    it('should reject LPT1', () => {
      const result = sanitizer.sanitize('LPT1');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_COMPONENT');
    });

    it('should reject reserved names in subdirectory', () => {
      const result = sanitizer.sanitize('subdir/CON/file.txt');
      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_COMPONENT');
    });
  });

  describe('sanitizeOrThrow', () => {
    it('should return sanitized path for valid input', () => {
      const result = sanitizer.sanitizeOrThrow('file.txt');
      expect(result).toBe(path.join(baseDir, 'file.txt'));
    });

    it('should throw for invalid input', () => {
      expect(() => sanitizer.sanitizeOrThrow('../etc/passwd')).toThrow();
    });

    it('should throw for null byte input', () => {
      expect(() => sanitizer.sanitizeOrThrow('file\0.txt')).toThrow();
    });
  });

  describe('isValid', () => {
    it('should return true for valid paths', () => {
      expect(sanitizer.isValid('file.txt')).toBe(true);
      expect(sanitizer.isValid('subdir/file.txt')).toBe(true);
    });

    it('should return false for invalid paths', () => {
      expect(sanitizer.isValid('')).toBe(false);
      expect(sanitizer.isValid('../etc/passwd')).toBe(false);
      expect(sanitizer.isValid('file\0.txt')).toBe(false);
    });
  });

  describe('sanitizeMany', () => {
    it('should validate multiple paths', () => {
      const paths = ['file1.txt', 'file2.txt', '../etc/passwd'];
      const results = sanitizer.sanitizeMany(paths);

      expect(results.get('file1.txt')?.valid).toBe(true);
      expect(results.get('file2.txt')?.valid).toBe(true);
      expect(results.get('../etc/passwd')?.valid).toBe(false);
    });
  });

  describe('allowed external directories', () => {
    it('should allow paths in allowed directories', () => {
      const tmpAllowed = path.join(os.tmpdir(), 'allowed-test');
      const multiDirSanitizer = new PathSanitizer({
        baseDir,
        allowedDirs: [tmpAllowed],
      });

      // Paths within base dir should be valid
      const result1 = multiDirSanitizer.sanitize('file.txt');
      expect(result1.valid).toBe(true);
    });
  });

  describe('case sensitivity', () => {
    it('should respect caseInsensitive option', () => {
      const caseSensitiveSanitizer = new PathSanitizer({
        baseDir,
        caseInsensitive: true,
      });
      expect(caseSensitiveSanitizer.isCaseInsensitive()).toBe(true);

      const caseInsensitiveSanitizer = new PathSanitizer({
        baseDir,
        caseInsensitive: false,
      });
      expect(caseInsensitiveSanitizer.isCaseInsensitive()).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return correct base directory', () => {
      expect(sanitizer.getBaseDir()).toBe(baseDir);
    });

    it('should return correct max path length', () => {
      expect(sanitizer.getMaxPathLength()).toBe(4096);
    });

    it('should return allowed directories', () => {
      const dirs = sanitizer.getAllowedDirs();
      expect(Array.isArray(dirs)).toBe(true);
    });
  });
});
