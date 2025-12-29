import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  InputParser,
  InputParseError,
  FileParseError,
  UnsupportedFileTypeError,
  UrlFetchError,
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
      expect(InputParser.isExtensionSupported('.pdf')).toBe(true);
      expect(InputParser.isExtensionSupported('.docx')).toBe(true);
      expect(InputParser.isExtensionSupported('.xyz')).toBe(false);
    });

    it('should return supported extensions', () => {
      const extensions = InputParser.getSupportedExtensions();

      expect(extensions).toContain('.md');
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.json');
      expect(extensions).toContain('.yaml');
      expect(extensions).toContain('.pdf');
      expect(extensions).toContain('.docx');
    });

    it('should identify async-only file types', () => {
      expect(InputParser.requiresAsyncParsing('.pdf')).toBe(true);
      expect(InputParser.requiresAsyncParsing('pdf')).toBe(true);
      expect(InputParser.requiresAsyncParsing('.docx')).toBe(true);
      expect(InputParser.requiresAsyncParsing('docx')).toBe(true);
      expect(InputParser.requiresAsyncParsing('.md')).toBe(false);
      expect(InputParser.requiresAsyncParsing('.txt')).toBe(false);
      expect(InputParser.requiresAsyncParsing('.json')).toBe(false);
    });
  });

  describe('PDF and DOCX file handling', () => {
    it('should return error for PDF in sync mode', () => {
      const filePath = path.join(testDir, 'test.pdf');
      fs.writeFileSync(filePath, 'fake pdf content');

      const result = parser.parseFileSync(filePath);

      expect(result.success).toBe(false);
      expect(result.fileType).toBe('pdf');
      expect(result.error).toContain('require async parsing');
    });

    it('should return error for DOCX in sync mode', () => {
      const filePath = path.join(testDir, 'test.docx');
      fs.writeFileSync(filePath, 'fake docx content');

      const result = parser.parseFileSync(filePath);

      expect(result.success).toBe(false);
      expect(result.fileType).toBe('docx');
      expect(result.error).toContain('require async parsing');
    });

    it('should handle invalid PDF file gracefully', async () => {
      const filePath = path.join(testDir, 'invalid.pdf');
      fs.writeFileSync(filePath, 'This is not a valid PDF');

      const result = await parser.parseFileContent(filePath);

      expect(result.success).toBe(false);
      expect(result.fileType).toBe('pdf');
      expect(result.error).toBeDefined();
    });

    it('should handle invalid DOCX file gracefully', async () => {
      const filePath = path.join(testDir, 'invalid.docx');
      fs.writeFileSync(filePath, 'This is not a valid DOCX');

      const result = await parser.parseFileContent(filePath);

      expect(result.success).toBe(false);
      expect(result.fileType).toBe('docx');
      expect(result.error).toBeDefined();
    });

    it('should handle non-existent PDF file', async () => {
      const filePath = path.join(testDir, 'nonexistent.pdf');

      await expect(parser.parseFile(filePath)).rejects.toThrow(FileParseError);
    });

    it('should handle non-existent DOCX file', async () => {
      const filePath = path.join(testDir, 'nonexistent.docx');

      await expect(parser.parseFile(filePath)).rejects.toThrow(FileParseError);
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

  describe('parseUrl', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    /**
     * Helper to create a mock Response object
     */
    function createMockResponse(
      body: string,
      options: { status?: number; statusText?: string; contentType?: string; url?: string } = {}
    ): Response {
      const { status = 200, statusText = 'OK', contentType = 'text/plain', url = '' } = options;
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        url,
        headers: new Headers({ 'content-type': contentType }),
        text: async () => body,
        json: async () => JSON.parse(body),
        clone: () => createMockResponse(body, options),
      } as Response;
    }

    it('should fetch and parse HTML content', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Test Heading</h1>
          <p>This is a test paragraph with requirements.</p>
        </body>
        </html>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(htmlContent, {
          contentType: 'text/html; charset=utf-8',
          url: 'https://example.com/page',
        })
      );

      const result = await parser.parseUrl('https://example.com/page');

      expect(result.type).toBe('url');
      expect(result.content).toContain('Test Heading');
      expect(result.content).toContain('test paragraph');
      expect(result.content).not.toContain('<h1>');
      expect(result.summary).toBe('Test Page');
    });

    it('should fetch and parse JSON content', async () => {
      const jsonContent = JSON.stringify({
        name: 'Test API',
        endpoints: [{ path: '/users', method: 'GET' }],
      });

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(jsonContent, {
          contentType: 'application/json',
          url: 'https://api.example.com/docs',
        })
      );

      const result = await parser.parseUrl('https://api.example.com/docs');

      expect(result.type).toBe('url');
      expect(result.content).toContain('"name"');
      expect(result.content).toContain('Test API');
    });

    it('should fetch and parse XML content', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <item>First item</item>
          <item>Second item</item>
          <!-- This is a comment -->
        </root>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(xmlContent, {
          contentType: 'application/xml',
          url: 'https://example.com/data.xml',
        })
      );

      const result = await parser.parseUrl('https://example.com/data.xml');

      expect(result.type).toBe('url');
      expect(result.content).toContain('First item');
      expect(result.content).toContain('Second item');
      expect(result.content).not.toContain('<?xml');
      expect(result.content).not.toContain('<!-- This is a comment -->');
    });

    it('should fetch and parse text/xml content', async () => {
      const xmlContent = `<data><value>Test value</value></data>`;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(xmlContent, {
          contentType: 'text/xml',
          url: 'https://example.com/data.xml',
        })
      );

      const result = await parser.parseUrl('https://example.com/data.xml');

      expect(result.content).toContain('Test value');
      expect(result.content).not.toContain('<data>');
    });

    it('should fetch plain text content', async () => {
      const textContent = 'This is plain text content.';

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(textContent, {
          contentType: 'text/plain',
          url: 'https://example.com/file.txt',
        })
      );

      const result = await parser.parseUrl('https://example.com/file.txt');

      expect(result.type).toBe('url');
      expect(result.content).toBe(textContent);
    });

    it('should throw UrlFetchError for HTTP error responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse('Not Found', { status: 404, statusText: 'Not Found' })
      );

      await expect(parser.parseUrl('https://example.com/missing')).rejects.toThrow(UrlFetchError);
    });

    it('should throw UrlFetchError for unsupported protocols', async () => {
      await expect(parser.parseUrl('ftp://example.com/file')).rejects.toThrow(UrlFetchError);
    });

    it('should throw UrlFetchError for network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(parser.parseUrl('https://example.com/page')).rejects.toThrow(UrlFetchError);
    });

    it('should handle timeout errors', async () => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      globalThis.fetch = vi.fn().mockRejectedValue(error);

      await expect(parser.parseUrl('https://example.com/slow')).rejects.toThrow(UrlFetchError);
    });

    it('should track final URL after redirects', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse('Redirected content', {
          contentType: 'text/plain',
          url: 'https://example.com/final-page',
        })
      );

      const result = await parser.parseUrl('https://example.com/redirect');

      expect(result.reference).toBe('https://example.com/final-page');
    });

    it('should extract title from HTML for summary', async () => {
      const htmlContent = `<html><head><title>API Documentation</title></head><body>Content</body></html>`;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(htmlContent, {
          contentType: 'text/html',
          url: 'https://api.example.com/docs',
        })
      );

      const result = await parser.parseUrl('https://api.example.com/docs');

      expect(result.summary).toBe('API Documentation');
    });

    it('should handle HTML without title gracefully', async () => {
      const htmlContent = `<html><body><p>Content without title</p></body></html>`;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(htmlContent, {
          contentType: 'text/html',
          url: 'https://example.com/notitle',
        })
      );

      const result = await parser.parseUrl('https://example.com/notitle');

      expect(result.summary).toBeDefined();
      expect(result.summary).toContain('Content without title');
    });

    it('should strip script and style tags from HTML', async () => {
      const htmlContent = `
        <html>
        <head>
          <style>.class { color: red; }</style>
          <script>console.log('test');</script>
        </head>
        <body>
          <p>Visible content</p>
          <script>alert('inline script');</script>
        </body>
        </html>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(htmlContent, {
          contentType: 'text/html',
          url: 'https://example.com/page',
        })
      );

      const result = await parser.parseUrl('https://example.com/page');

      expect(result.content).toContain('Visible content');
      expect(result.content).not.toContain('console.log');
      expect(result.content).not.toContain('color: red');
      expect(result.content).not.toContain('inline script');
    });

    it('should decode HTML entities', async () => {
      const htmlContent = `<html><body>&amp; &lt; &gt; &quot; &#39;</body></html>`;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(htmlContent, {
          contentType: 'text/html',
          url: 'https://example.com/entities',
        })
      );

      const result = await parser.parseUrl('https://example.com/entities');

      expect(result.content).toContain('&');
      expect(result.content).toContain('<');
      expect(result.content).toContain('>');
      expect(result.content).toContain('"');
      expect(result.content).toContain("'");
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{ invalid json }';

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(malformedJson, {
          contentType: 'application/json',
          url: 'https://api.example.com/broken',
        })
      );

      const result = await parser.parseUrl('https://api.example.com/broken');

      expect(result.content).toBe(malformedJson);
    });

    it('should use custom timeout option', async () => {
      const shortTimeoutParser = new InputParser({ urlTimeout: 100 });
      let abortSignalReceived = false;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            abortSignalReceived = true;
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        throw new Error('Should have timed out');
      });

      await expect(shortTimeoutParser.parseUrl('https://example.com/slow')).rejects.toThrow();
    });

    it('should handle CDATA sections in XML', async () => {
      const xmlContent = `<?xml version="1.0"?>
        <root><![CDATA[Special <characters> & content]]></root>
      `;

      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse(xmlContent, {
          contentType: 'application/xml',
          url: 'https://example.com/cdata.xml',
        })
      );

      const result = await parser.parseUrl('https://example.com/cdata.xml');

      expect(result.content).toContain('Special <characters> & content');
    });
  });

  describe('fetchUrlContent', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should return success false for invalid URL', async () => {
      const result = await parser.fetchUrlContent('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success false for HTTP errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: async () => 'Error',
        url: 'https://example.com/error',
      } as Response);

      const result = await parser.fetchUrlContent('https://example.com/error');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should include final URL in result', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'content',
        url: 'https://example.com/final',
      } as Response);

      const result = await parser.fetchUrlContent('https://example.com/original');

      expect(result.success).toBe(true);
      expect(result.finalUrl).toBe('https://example.com/final');
    });
  });
});
