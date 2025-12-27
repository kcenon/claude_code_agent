import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  InputParser,
  InputParseError,
  FileParseError,
  UnsupportedFileTypeError,
} from '../../src/collector/index.js';

describe('InputParser', () => {
  let parser: InputParser;
  let testDir: string;

  beforeEach(() => {
    parser = new InputParser();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('parseText', () => {
    it('should parse simple text content', () => {
      const result = parser.parseText('This is a test requirement.');

      expect(result.type).toBe('text');
      expect(result.content).toBe('This is a test requirement.');
      expect(result.id).toBeDefined();
      expect(result.extractedAt).toBeDefined();
    });

    it('should trim whitespace from text', () => {
      const result = parser.parseText('  Trimmed content  ');

      expect(result.content).toBe('Trimmed content');
    });

    it('should throw error for empty text', () => {
      expect(() => parser.parseText('')).toThrow(InputParseError);
      expect(() => parser.parseText('   ')).toThrow(InputParseError);
    });

    it('should include description in reference', () => {
      const result = parser.parseText('Content', 'User requirements');

      expect(result.reference).toBe('User requirements');
    });

    it('should generate summary for content', () => {
      const result = parser.parseText('This is a test requirement.');

      expect(result.summary).toBeDefined();
    });

    it('should truncate long summaries', () => {
      const longText = 'A'.repeat(300);
      const result = parser.parseText(longText);

      expect(result.summary?.length).toBeLessThanOrEqual(203);
      expect(result.summary?.endsWith('...')).toBe(true);
    });
  });

  describe('parseFile', () => {
    it('should parse markdown file', async () => {
      const filePath = path.join(testDir, 'test.md');
      fs.writeFileSync(filePath, '# Test Document\n\nThis is a test.');

      const result = await parser.parseFile(filePath);

      expect(result.type).toBe('file');
      expect(result.content).toContain('# Test Document');
      expect(result.reference).toBe(filePath);
    });

    it('should parse text file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(filePath, 'Plain text content');

      const result = await parser.parseFile(filePath);

      expect(result.content).toBe('Plain text content');
    });

    it('should parse JSON file', async () => {
      const filePath = path.join(testDir, 'test.json');
      fs.writeFileSync(filePath, '{"key": "value"}');

      const result = await parser.parseFile(filePath);

      expect(result.content).toContain('"key"');
      expect(result.content).toContain('"value"');
    });

    it('should parse YAML file', async () => {
      const filePath = path.join(testDir, 'test.yaml');
      fs.writeFileSync(filePath, 'key: value');

      const result = await parser.parseFile(filePath);

      expect(result.content).toContain('key');
      expect(result.content).toContain('value');
    });

    it('should throw error for unsupported file type', async () => {
      const filePath = path.join(testDir, 'test.xyz');
      fs.writeFileSync(filePath, 'content');

      await expect(parser.parseFile(filePath)).rejects.toThrow(UnsupportedFileTypeError);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.md');

      await expect(parser.parseFile(filePath)).rejects.toThrow(FileParseError);
    });
  });

  describe('parseFileSync', () => {
    it('should parse file synchronously', () => {
      const filePath = path.join(testDir, 'test.md');
      fs.writeFileSync(filePath, '# Sync Test');

      const result = parser.parseFileSync(filePath);

      expect(result.success).toBe(true);
      expect(result.content).toContain('# Sync Test');
    });

    it('should return error for missing file', () => {
      const filePath = path.join(testDir, 'missing.md');

      const result = parser.parseFileSync(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('combineInputs', () => {
    it('should combine multiple input sources', () => {
      const source1 = parser.parseText('First requirement', 'Source 1');
      const source2 = parser.parseText('Second requirement', 'Source 2');

      const result = parser.combineInputs([source1, source2]);

      expect(result.sources).toHaveLength(2);
      expect(result.combinedContent).toContain('First requirement');
      expect(result.combinedContent).toContain('Second requirement');
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should throw error for empty sources', () => {
      expect(() => parser.combineInputs([])).toThrow(InputParseError);
    });

    it('should detect language', () => {
      const source = parser.parseText('This is English text');

      const result = parser.combineInputs([source]);

      expect(result.detectedLanguage).toBe('en');
    });

    it('should detect Korean language', () => {
      // Use text with more Korean characters to ensure detection threshold is met
      const source = parser.parseText(
        '이것은 한국어 텍스트입니다. 시스템은 사용자 인증을 지원해야 합니다. 사용자는 비밀번호를 재설정할 수 있어야 합니다.'
      );

      const result = parser.combineInputs([source]);

      expect(result.detectedLanguage).toBe('ko');
    });
  });

  describe('static methods', () => {
    it('should check if extension is supported', () => {
      expect(InputParser.isExtensionSupported('.md')).toBe(true);
      expect(InputParser.isExtensionSupported('md')).toBe(true);
      expect(InputParser.isExtensionSupported('.txt')).toBe(true);
      expect(InputParser.isExtensionSupported('.json')).toBe(true);
      expect(InputParser.isExtensionSupported('.yaml')).toBe(true);
      expect(InputParser.isExtensionSupported('.xyz')).toBe(false);
    });

    it('should return supported extensions', () => {
      const extensions = InputParser.getSupportedExtensions();

      expect(extensions).toContain('.md');
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.json');
      expect(extensions).toContain('.yaml');
    });
  });

  describe('options', () => {
    it('should respect maxFileSize option', async () => {
      const smallParser = new InputParser({ maxFileSize: 10 });
      const filePath = path.join(testDir, 'large.md');
      fs.writeFileSync(filePath, 'A'.repeat(100));

      const result = await smallParser.parseFileContent(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });
  });
});
