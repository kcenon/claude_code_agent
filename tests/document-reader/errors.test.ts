import { describe, it, expect } from 'vitest';
import {
  DocumentReaderError,
  DocumentNotFoundError,
  DocumentParseError,
  InvalidRequirementIdError,
  UnsupportedFormatError,
  ExtractionError,
  TraceabilityError,
  NoActiveSessionError,
  InvalidSessionStateError,
  FileSizeLimitError,
  OutputWriteError,
} from '../../src/document-reader/errors.js';

describe('DocumentReaderError', () => {
  it('should create base error with message', () => {
    const error = new DocumentReaderError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('DocumentReaderError');
    expect(error instanceof Error).toBe(true);
  });

  it('should maintain prototype chain', () => {
    const error = new DocumentReaderError('Test');
    expect(error instanceof DocumentReaderError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('DocumentNotFoundError', () => {
  it('should create error with path and document type', () => {
    const error = new DocumentNotFoundError('/docs/prd.md', 'prd');
    expect(error.message).toContain('PRD');
    expect(error.message).toContain('/docs/prd.md');
    expect(error.message).toContain('not found');
    expect(error.name).toBe('DocumentNotFoundError');
    expect(error.path).toBe('/docs/prd.md');
    expect(error.documentType).toBe('prd');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new DocumentNotFoundError('/path', 'type');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('DocumentParseError', () => {
  it('should create error with path and reason only', () => {
    const error = new DocumentParseError('/docs/prd.md', 'Invalid markdown structure');
    expect(error.message).toContain('/docs/prd.md');
    expect(error.message).toContain('Invalid markdown structure');
    expect(error.message).not.toContain('at line');
    expect(error.name).toBe('DocumentParseError');
    expect(error.path).toBe('/docs/prd.md');
    expect(error.reason).toBe('Invalid markdown structure');
    expect(error.line).toBeUndefined();
  });

  it('should create error with line number', () => {
    const error = new DocumentParseError('/docs/prd.md', 'Missing section header', 25);
    expect(error.message).toContain('at line 25');
    expect(error.line).toBe(25);
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new DocumentParseError('/path', 'reason');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('InvalidRequirementIdError', () => {
  it('should create error with ID and expected pattern', () => {
    const error = new InvalidRequirementIdError('REQ001', 'FR-XXX');
    expect(error.message).toContain('REQ001');
    expect(error.message).toContain('FR-XXX');
    expect(error.name).toBe('InvalidRequirementIdError');
    expect(error.id).toBe('REQ001');
    expect(error.expectedPattern).toBe('FR-XXX');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new InvalidRequirementIdError('id', 'pattern');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('UnsupportedFormatError', () => {
  it('should create error with format and supported formats', () => {
    const supportedFormats = ['md', 'yaml', 'json'] as const;
    const error = new UnsupportedFormatError('docx', supportedFormats);
    expect(error.message).toContain('docx');
    expect(error.message).toContain('md, yaml, json');
    expect(error.name).toBe('UnsupportedFormatError');
    expect(error.format).toBe('docx');
    expect(error.supportedFormats).toEqual(supportedFormats);
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new UnsupportedFormatError('txt', ['md']);
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('ExtractionError', () => {
  it('should create error with document path, extraction type, and reason', () => {
    const error = new ExtractionError('/docs/prd.md', 'requirements', 'Table format invalid');
    expect(error.message).toContain('/docs/prd.md');
    expect(error.message).toContain('requirements');
    expect(error.message).toContain('Table format invalid');
    expect(error.name).toBe('ExtractionError');
    expect(error.documentPath).toBe('/docs/prd.md');
    expect(error.extractionType).toBe('requirements');
    expect(error.reason).toBe('Table format invalid');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new ExtractionError('/path', 'type', 'reason');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('TraceabilityError', () => {
  it('should create error with source ID, target type, and reason', () => {
    const error = new TraceabilityError('FR-001', 'SRS', 'Missing link');
    expect(error.message).toContain('FR-001');
    expect(error.message).toContain('SRS');
    expect(error.message).toContain('Missing link');
    expect(error.name).toBe('TraceabilityError');
    expect(error.sourceId).toBe('FR-001');
    expect(error.targetType).toBe('SRS');
    expect(error.reason).toBe('Missing link');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new TraceabilityError('id', 'type', 'reason');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('NoActiveSessionError', () => {
  it('should create error with default message', () => {
    const error = new NoActiveSessionError();
    expect(error.message).toContain('No active document reading session');
    expect(error.message).toContain('startSession()');
    expect(error.name).toBe('NoActiveSessionError');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new NoActiveSessionError();
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('InvalidSessionStateError', () => {
  it('should create error with operation and status info', () => {
    const error = new InvalidSessionStateError('extract', 'idle', 'reading');
    expect(error.message).toContain('extract');
    expect(error.message).toContain('idle');
    expect(error.message).toContain('reading');
    expect(error.name).toBe('InvalidSessionStateError');
    expect(error.operation).toBe('extract');
    expect(error.currentStatus).toBe('idle');
    expect(error.expectedStatus).toBe('reading');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new InvalidSessionStateError('op', 'curr', 'exp');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('FileSizeLimitError', () => {
  it('should create error with size information', () => {
    const error = new FileSizeLimitError('/large-doc.md', 5242880, 2097152);
    expect(error.message).toContain('/large-doc.md');
    expect(error.message).toContain('5.00MB');
    expect(error.message).toContain('2.00MB');
    expect(error.name).toBe('FileSizeLimitError');
    expect(error.path).toBe('/large-doc.md');
    expect(error.size).toBe(5242880);
    expect(error.maxSize).toBe(2097152);
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new FileSizeLimitError('/path', 100, 50);
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});

describe('OutputWriteError', () => {
  it('should create error with path and reason', () => {
    const error = new OutputWriteError('/output/analysis.yaml', 'Disk full');
    expect(error.message).toContain('/output/analysis.yaml');
    expect(error.message).toContain('Disk full');
    expect(error.name).toBe('OutputWriteError');
    expect(error.path).toBe('/output/analysis.yaml');
    expect(error.reason).toBe('Disk full');
  });

  it('should inherit from DocumentReaderError', () => {
    const error = new OutputWriteError('/path', 'reason');
    expect(error instanceof DocumentReaderError).toBe(true);
  });
});
