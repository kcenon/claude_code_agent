/**
 * InputParser - Parses various input sources for information collection
 *
 * Handles parsing of text, files (md, txt, json, yaml), and URLs
 * to extract content for information extraction.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as yaml from 'js-yaml';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import type {
  InputSource,
  ParsedInput,
  SupportedFileType,
  FileParseResult,
  UrlFetchResult,
} from './types.js';
import {
  FileParseError,
  UnsupportedFileTypeError,
  UrlFetchError,
  InputParseError,
} from './errors.js';

/**
 * Supported file extensions and their types
 */
const FILE_TYPE_MAP: Record<string, SupportedFileType> = {
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
  '.text': 'txt',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.pdf': 'pdf',
  '.docx': 'docx',
};

/**
 * All supported file extensions
 */
const SUPPORTED_EXTENSIONS = Object.keys(FILE_TYPE_MAP);

/**
 * InputParser options
 */
export interface InputParserOptions {
  /** Maximum file size in bytes (default: 10MB) */
  readonly maxFileSize?: number;
  /** URL fetch timeout in milliseconds (default: 30000) */
  readonly urlTimeout?: number;
  /** Whether to follow redirects (default: true) */
  readonly followRedirects?: boolean;
}

/**
 * Default options for InputParser
 */
const DEFAULT_OPTIONS: Required<InputParserOptions> = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  urlTimeout: 30000,
  followRedirects: true,
};

/**
 * InputParser class for processing various input sources
 */
export class InputParser {
  private readonly options: Required<InputParserOptions>;

  constructor(options: InputParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse text content as an input source
   *
   * @param text - The text content to parse
   * @param description - Optional description of the text source
   * @returns InputSource representing the text
   */
  public parseText(text: string, description?: string): InputSource {
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new InputParseError('text', 'text', 'Empty text content');
    }

    return {
      id: randomUUID(),
      type: 'text',
      reference: description ?? 'User provided text',
      content: trimmedText,
      extractedAt: new Date().toISOString(),
      summary: this.generateSummary(trimmedText),
    };
  }

  /**
   * Parse a file and extract its content
   *
   * @param filePath - Path to the file
   * @returns Promise resolving to InputSource
   */
  public async parseFile(filePath: string): Promise<InputSource> {
    const result = await this.parseFileContent(filePath);

    if (!result.success) {
      throw new FileParseError(filePath, result.fileType, result.error ?? 'Unknown error');
    }

    return {
      id: randomUUID(),
      type: 'file',
      reference: filePath,
      content: result.content,
      extractedAt: new Date().toISOString(),
      summary: this.generateSummary(result.content),
    };
  }

  /**
   * Parse file content based on file type
   *
   * @param filePath - Path to the file
   * @returns FileParseResult with parsed content
   */
  public async parseFileContent(filePath: string): Promise<FileParseResult> {
    const extension = path.extname(filePath).toLowerCase();
    const fileType = FILE_TYPE_MAP[extension];

    if (fileType === undefined) {
      throw new UnsupportedFileTypeError(
        extension.slice(1),
        SUPPORTED_EXTENSIONS.map((e) => e.slice(1))
      );
    }

    try {
      // Check file exists and size
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.options.maxFileSize) {
        return {
          success: false,
          content: '',
          fileType,
          error: `File size (${String(stats.size)} bytes) exceeds maximum allowed (${String(this.options.maxFileSize)} bytes)`,
        };
      }

      // Handle binary files (PDF, DOCX) differently
      if (fileType === 'pdf') {
        return this.parsePdfFile(filePath, stats);
      }

      if (fileType === 'docx') {
        return this.parseDocxFile(filePath, stats);
      }

      // Handle text-based files
      const rawContent = await fs.promises.readFile(filePath, 'utf8');
      const content = this.processFileContent(rawContent, fileType);

      return {
        success: true,
        content,
        fileType,
        metadata: {
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          success: false,
          content: '',
          fileType,
          error: 'File not found',
        };
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        return {
          success: false,
          content: '',
          fileType,
          error: 'Permission denied',
        };
      }
      throw error;
    }
  }

  /**
   * Parse PDF file and extract text content
   *
   * @param filePath - Path to the PDF file
   * @param stats - File stats
   * @returns FileParseResult with extracted text
   */
  private async parsePdfFile(filePath: string, stats: fs.Stats): Promise<FileParseResult> {
    let pdfParser: PDFParse | null = null;
    try {
      const dataBuffer = await fs.promises.readFile(filePath);
      pdfParser = new PDFParse({ data: dataBuffer });
      const textResult = await pdfParser.getText();

      const content = textResult.text.trim();
      if (content.length === 0) {
        return {
          success: false,
          content: '',
          fileType: 'pdf',
          error: 'PDF file contains no extractable text (may be image-based)',
        };
      }

      // Get document info for metadata
      const infoResult = await pdfParser.getInfo();

      return {
        success: true,
        content,
        fileType: 'pdf',
        metadata: {
          size: stats.size,
          modified: stats.mtime.toISOString(),
          pages: textResult.pages.length,
          info: infoResult.info,
        },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        fileType: 'pdf',
        error: error instanceof Error ? error.message : 'Failed to parse PDF file',
      };
    } finally {
      if (pdfParser !== null) {
        await pdfParser.destroy().catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  }

  /**
   * Parse DOCX file and extract text content
   *
   * @param filePath - Path to the DOCX file
   * @param stats - File stats
   * @returns FileParseResult with extracted text
   */
  private async parseDocxFile(filePath: string, stats: fs.Stats): Promise<FileParseResult> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });

      const content = result.value.trim();
      if (content.length === 0) {
        return {
          success: false,
          content: '',
          fileType: 'docx',
          error: 'DOCX file contains no extractable text',
        };
      }

      // Collect any warnings from mammoth
      const warnings = result.messages
        .filter((msg) => msg.type === 'warning')
        .map((msg) => msg.message);

      return {
        success: true,
        content,
        fileType: 'docx',
        metadata: {
          size: stats.size,
          modified: stats.mtime.toISOString(),
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        fileType: 'docx',
        error: error instanceof Error ? error.message : 'Failed to parse DOCX file',
      };
    }
  }

  /**
   * Process file content based on type
   *
   * @param content - Raw file content
   * @param fileType - Type of file
   * @returns Processed content as text
   */
  private processFileContent(content: string, fileType: SupportedFileType): string {
    switch (fileType) {
      case 'md':
      case 'txt':
        return content;

      case 'json': {
        const parsed: unknown = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      }

      case 'yaml': {
        const parsed = yaml.load(content);
        return yaml.dump(parsed, { indent: 2 });
      }

      default:
        return content;
    }
  }

  /**
   * Fetch and parse URL content
   *
   * @param url - URL to fetch
   * @returns Promise resolving to InputSource
   */
  public async parseUrl(url: string): Promise<InputSource> {
    const result = await this.fetchUrlContent(url);

    if (!result.success) {
      throw new UrlFetchError(url, result.error ?? 'Unknown error');
    }

    return {
      id: randomUUID(),
      type: 'url',
      reference: result.finalUrl ?? url,
      content: result.content,
      extractedAt: new Date().toISOString(),
      summary: result.title ?? this.generateSummary(result.content),
    };
  }

  /**
   * Fetch URL content
   *
   * @param url - URL to fetch
   * @returns UrlFetchResult with fetched content
   */
  public async fetchUrlContent(url: string): Promise<UrlFetchResult> {
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          success: false,
          content: '',
          url,
          error: `Unsupported protocol: ${parsedUrl.protocol}`,
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.options.urlTimeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: this.options.followRedirects ? 'follow' : 'manual',
          headers: {
            'User-Agent': 'AD-SDLC-Collector/1.0',
            Accept: 'text/html,text/plain,application/json,*/*',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            success: false,
            content: '',
            url,
            error: `HTTP ${String(response.status)}: ${response.statusText}`,
          };
        }

        const contentType = response.headers.get('content-type') ?? '';
        const text = await response.text();
        const content = this.processUrlContent(text, contentType);
        const title = this.extractTitle(text, contentType);

        return {
          success: true,
          content,
          url,
          finalUrl: response.url,
          title,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            content: '',
            url,
            error: 'Request timeout',
          };
        }
        return {
          success: false,
          content: '',
          url,
          error: error.message,
        };
      }
      throw error;
    }
  }

  /**
   * Process URL content based on content type
   *
   * @param content - Raw content
   * @param contentType - Content-Type header value
   * @returns Processed text content
   */
  private processUrlContent(content: string, contentType: string): string {
    if (contentType.includes('application/json')) {
      try {
        const parsed: unknown = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    }

    if (contentType.includes('text/html')) {
      return this.stripHtml(content);
    }

    return content;
  }

  /**
   * Extract title from HTML content
   *
   * @param content - HTML content
   * @param contentType - Content-Type header
   * @returns Title if found
   */
  private extractTitle(content: string, contentType: string): string | undefined {
    if (!contentType.includes('text/html')) {
      return undefined;
    }

    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch?.[1]?.trim();
  }

  /**
   * Strip HTML tags from content
   *
   * @param html - HTML content
   * @returns Plain text content
   */
  private stripHtml(html: string): string {
    // Remove script and style elements
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Combine multiple input sources into a ParsedInput
   *
   * @param sources - Array of input sources
   * @returns ParsedInput with combined content
   */
  public combineInputs(sources: readonly InputSource[]): ParsedInput {
    if (sources.length === 0) {
      throw new InputParseError('sources', 'combined', 'No input sources provided');
    }

    const combinedContent = sources
      .map((source) => {
        const header = `--- Source: ${source.reference} (${source.type}) ---`;
        return `${header}\n\n${source.content}`;
      })
      .join('\n\n');

    return {
      sources,
      combinedContent,
      detectedLanguage: this.detectLanguage(combinedContent),
      wordCount: this.countWords(combinedContent),
    };
  }

  /**
   * Generate a summary of the content
   *
   * @param content - Content to summarize
   * @param maxLength - Maximum summary length (default: 200)
   * @returns Summary text
   */
  private generateSummary(content: string, maxLength: number = 200): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.slice(0, maxLength - 3) + '...';
  }

  /**
   * Simple language detection based on common patterns
   *
   * @param text - Text to analyze
   * @returns Detected language code (e.g., 'en', 'ko')
   */
  private detectLanguage(text: string): string {
    // Korean detection (presence of Hangul characters)
    const koreanPattern = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
    const koreanMatches = text.match(koreanPattern);
    if (koreanMatches !== null && koreanMatches.length > 0) {
      // Check if Korean is predominant
      const koreanChars = koreanMatches.length;
      const totalChars = text.replace(/\s/g, '').length;
      if (koreanChars / totalChars > 0.3) {
        return 'ko';
      }
    }

    // Default to English
    return 'en';
  }

  /**
   * Count words in text
   *
   * @param text - Text to count words in
   * @returns Word count
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Check if a file extension is supported
   *
   * @param extension - File extension (with or without dot)
   * @returns True if supported
   */
  public static isExtensionSupported(extension: string): boolean {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    return ext in FILE_TYPE_MAP;
  }

  /**
   * Get all supported file extensions
   *
   * @returns Array of supported extensions
   */
  public static getSupportedExtensions(): readonly string[] {
    return SUPPORTED_EXTENSIONS;
  }

  /**
   * Parse file content synchronously
   *
   * @param filePath - Path to the file
   * @returns FileParseResult with parsed content
   * @note PDF and DOCX files require async parsing - use parseFile() instead
   */
  public parseFileSync(filePath: string): FileParseResult {
    const extension = path.extname(filePath).toLowerCase();
    const fileType = FILE_TYPE_MAP[extension];

    if (fileType === undefined) {
      throw new UnsupportedFileTypeError(
        extension.slice(1),
        SUPPORTED_EXTENSIONS.map((e) => e.slice(1))
      );
    }

    // PDF and DOCX require async parsing
    if (fileType === 'pdf' || fileType === 'docx') {
      return {
        success: false,
        content: '',
        fileType,
        error: `${fileType.toUpperCase()} files require async parsing. Use parseFile() instead of parseFileSync().`,
      };
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.options.maxFileSize) {
        return {
          success: false,
          content: '',
          fileType,
          error: `File size (${String(stats.size)} bytes) exceeds maximum allowed (${String(this.options.maxFileSize)} bytes)`,
        };
      }

      const rawContent = fs.readFileSync(filePath, 'utf8');
      const content = this.processFileContent(rawContent, fileType);

      return {
        success: true,
        content,
        fileType,
        metadata: {
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          success: false,
          content: '',
          fileType,
          error: 'File not found',
        };
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        return {
          success: false,
          content: '',
          fileType,
          error: 'Permission denied',
        };
      }
      throw error;
    }
  }

  /**
   * Check if a file type requires async parsing
   *
   * @param extension - File extension
   * @returns True if the file type requires async parsing
   */
  public static requiresAsyncParsing(extension: string): boolean {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    const fileType = FILE_TYPE_MAP[ext];
    return fileType === 'pdf' || fileType === 'docx';
  }
}
