import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  safeJsonParse,
  tryJsonParse,
  safeJsonParseFile,
  safeJsonParseFileSync,
  lenientSchema,
  partialSchema,
  JsonValidationError,
  JsonSyntaxError,
} from '../../src/utils/SafeJsonParser.js';

describe('SafeJsonParser', () => {
  // Test schemas
  const SimpleSchema = z.object({
    name: z.string(),
    age: z.number(),
  }).describe('SimpleSchema');

  const NestedSchema = z.object({
    user: z.object({
      id: z.number(),
      email: z.string().email(),
    }),
    items: z.array(z.string()),
  }).describe('NestedSchema');

  describe('safeJsonParse', () => {
    it('should parse valid JSON with correct schema', () => {
      const json = '{"name": "John", "age": 30}';
      const result = safeJsonParse(json, SimpleSchema);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should throw JsonSyntaxError for invalid JSON', () => {
      const invalidJson = '{"name": "John", age: 30}'; // Missing quotes around age key

      expect(() => safeJsonParse(invalidJson, SimpleSchema)).toThrow(JsonSyntaxError);
    });

    it('should throw JsonValidationError for schema mismatch', () => {
      const json = '{"name": "John", "age": "thirty"}'; // age should be number

      expect(() => safeJsonParse(json, SimpleSchema)).toThrow(JsonValidationError);
    });

    it('should include context in error message', () => {
      const json = '{"name": "John"}'; // Missing required field 'age'

      try {
        safeJsonParse(json, SimpleSchema, { context: 'test file' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonValidationError);
        expect((error as JsonValidationError).context).toBe('test file');
        expect((error as JsonValidationError).message).toContain('test file');
      }
    });

    it('should return fallback on validation failure when provided', () => {
      const json = '{"name": "John"}'; // Missing required field 'age'
      const fallback = { name: 'Default', age: 0 };

      const result = safeJsonParse(json, SimpleSchema, { fallback });

      expect(result).toEqual(fallback);
    });

    it('should log error when fallback is used with logError=true', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const json = '{"name": "John"}';
      const fallback = { name: 'Default', age: 0 };

      safeJsonParse(json, SimpleSchema, { fallback, logError: true });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should parse nested objects correctly', () => {
      const json = '{"user": {"id": 1, "email": "test@example.com"}, "items": ["a", "b"]}';
      const result = safeJsonParse(json, NestedSchema);

      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe('test@example.com');
      expect(result.items).toEqual(['a', 'b']);
    });

    it('should provide field path in error for nested validation failure', () => {
      const json = '{"user": {"id": "not-a-number", "email": "test@example.com"}, "items": []}';

      try {
        safeJsonParse(json, NestedSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonValidationError);
        const validationError = error as JsonValidationError;
        expect(validationError.fieldErrors.some(e => e.path.includes('user'))).toBe(true);
      }
    });
  });

  describe('tryJsonParse', () => {
    it('should return undefined for invalid JSON', () => {
      const result = tryJsonParse('not-json', SimpleSchema);

      expect(result).toBeUndefined();
    });

    it('should return undefined for schema mismatch', () => {
      const json = '{"name": 123, "age": 30}';
      const result = tryJsonParse(json, SimpleSchema);

      expect(result).toBeUndefined();
    });

    it('should return parsed data for valid input', () => {
      const json = '{"name": "John", "age": 30}';
      const result = tryJsonParse(json, SimpleSchema);

      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('safeJsonParseFile', () => {
    let testDir: string;
    let testFilePath: string;

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-json-test-'));
      testFilePath = path.join(testDir, 'test.json');
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should parse valid JSON file', async () => {
      fs.writeFileSync(testFilePath, '{"name": "John", "age": 30}');

      const result = await safeJsonParseFile(testFilePath, SimpleSchema);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should throw error for missing file', async () => {
      const missingPath = path.join(testDir, 'missing.json');

      await expect(safeJsonParseFile(missingPath, SimpleSchema)).rejects.toThrow();
    });

    it('should include file path in context', async () => {
      fs.writeFileSync(testFilePath, '{"name": "John"}'); // Missing age

      try {
        await safeJsonParseFile(testFilePath, SimpleSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonValidationError);
        expect((error as JsonValidationError).context).toBe(testFilePath);
      }
    });
  });

  describe('safeJsonParseFileSync', () => {
    let testDir: string;
    let testFilePath: string;

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-json-test-'));
      testFilePath = path.join(testDir, 'test.json');
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should parse valid JSON file synchronously', () => {
      fs.writeFileSync(testFilePath, '{"name": "John", "age": 30}');

      const result = safeJsonParseFileSync(testFilePath, SimpleSchema);

      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('lenientSchema', () => {
    it('should allow additional unknown fields', () => {
      const LenientSimple = lenientSchema(z.object({
        name: z.string(),
      }));

      const json = '{"name": "John", "extra": "field", "another": 123}';
      const result = safeJsonParse(json, LenientSimple);

      expect(result.name).toBe('John');
      expect((result as Record<string, unknown>)['extra']).toBe('field');
    });
  });

  describe('partialSchema', () => {
    it('should make all fields optional', () => {
      const PartialSimple = partialSchema(z.object({
        name: z.string(),
        age: z.number(),
      }));

      const json = '{"name": "John"}';
      const result = safeJsonParse(json, PartialSimple);

      expect(result.name).toBe('John');
      expect(result.age).toBeUndefined();
    });

    it('should accept empty object', () => {
      const PartialSimple = partialSchema(z.object({
        name: z.string(),
        age: z.number(),
      }));

      const json = '{}';
      const result = safeJsonParse(json, PartialSimple);

      expect(result).toEqual({});
    });
  });

  describe('JsonValidationError', () => {
    it('should format errors correctly', () => {
      const json = '{"name": 123}';

      try {
        safeJsonParse(json, SimpleSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonValidationError);
        const validationError = error as JsonValidationError;

        const formatted = validationError.formatErrors();
        expect(formatted).toContain('name');
      }
    });

    it('should store raw JSON (truncated)', () => {
      const longJson = '{"name": "' + 'a'.repeat(500) + '"}';

      try {
        safeJsonParse(longJson, SimpleSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonValidationError);
        const validationError = error as JsonValidationError;

        expect(validationError.rawJson.length).toBeLessThanOrEqual(200);
      }
    });
  });

  describe('JsonSyntaxError', () => {
    it('should store parse error details', () => {
      const invalidJson = '{not valid json';

      try {
        safeJsonParse(invalidJson, SimpleSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(JsonSyntaxError);
        const syntaxError = error as JsonSyntaxError;

        expect(syntaxError.parseError).toBeDefined();
        expect(syntaxError.rawJson).toBe(invalidJson);
      }
    });
  });
});
