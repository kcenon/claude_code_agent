import { describe, it, expect } from 'vitest';
import {
  SDSUpdaterError,
  NoActiveSDSSessionError,
  SDSNotFoundError,
  ComponentNotFoundError,
  APINotFoundError,
  DuplicateComponentError,
  DuplicateAPIError,
  InvalidSDSTraceabilityError,
  InvalidSDSChangeRequestError,
  SDSDocumentParseError,
  SDSOutputWriteError,
  InvalidSDSVersionError,
  SDSFileSizeLimitError,
  SDSNotLoadedError,
  InterfaceIncompatibilityError,
  ArchitecturalConflictError,
} from '../../src/sds-updater/errors.js';

describe('SDSUpdaterError', () => {
  it('should create base error with message', () => {
    const error = new SDSUpdaterError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('SDSUpdaterError');
    expect(error instanceof Error).toBe(true);
  });

  it('should maintain prototype chain', () => {
    const error = new SDSUpdaterError('Test');
    expect(error instanceof SDSUpdaterError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('NoActiveSDSSessionError', () => {
  it('should create error with default message', () => {
    const error = new NoActiveSDSSessionError();
    expect(error.message).toContain('No active SDS update session');
    expect(error.message).toContain('startSession()');
    expect(error.name).toBe('NoActiveSDSSessionError');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new NoActiveSDSSessionError();
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('SDSNotFoundError', () => {
  it('should create error with path', () => {
    const error = new SDSNotFoundError('/docs/sds/sds.md');
    expect(error.message).toContain('/docs/sds/sds.md');
    expect(error.message).toContain('not found');
    expect(error.name).toBe('SDSNotFoundError');
    expect(error.path).toBe('/docs/sds/sds.md');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new SDSNotFoundError('/path');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('ComponentNotFoundError', () => {
  it('should create error with component ID and SDS path', () => {
    const error = new ComponentNotFoundError('CMP-001', '/docs/sds/sds.md');
    expect(error.message).toContain('CMP-001');
    expect(error.message).toContain('/docs/sds/sds.md');
    expect(error.name).toBe('ComponentNotFoundError');
    expect(error.componentId).toBe('CMP-001');
    expect(error.sdsPath).toBe('/docs/sds/sds.md');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new ComponentNotFoundError('CMP-001', '/path');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('APINotFoundError', () => {
  it('should create error with endpoint and SDS path', () => {
    const error = new APINotFoundError('POST /api/v1/users', '/docs/sds/sds.md');
    expect(error.message).toContain('POST /api/v1/users');
    expect(error.message).toContain('/docs/sds/sds.md');
    expect(error.name).toBe('APINotFoundError');
    expect(error.endpoint).toBe('POST /api/v1/users');
    expect(error.sdsPath).toBe('/docs/sds/sds.md');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new APINotFoundError('/api/v1/users', '/path');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('DuplicateComponentError', () => {
  it('should create error with component ID', () => {
    const error = new DuplicateComponentError('CMP-001');
    expect(error.message).toContain('CMP-001');
    expect(error.message).toContain('already exists');
    expect(error.name).toBe('DuplicateComponentError');
    expect(error.componentId).toBe('CMP-001');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new DuplicateComponentError('CMP-001');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('DuplicateAPIError', () => {
  it('should create error with endpoint', () => {
    const error = new DuplicateAPIError('POST /api/v1/users');
    expect(error.message).toContain('POST /api/v1/users');
    expect(error.message).toContain('already exists');
    expect(error.name).toBe('DuplicateAPIError');
    expect(error.endpoint).toBe('POST /api/v1/users');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new DuplicateAPIError('/api/v1/users');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('InvalidSDSTraceabilityError', () => {
  it('should create error with SRS ID and reason', () => {
    const error = new InvalidSDSTraceabilityError('SF-001', 'SRS reference not found');
    expect(error.message).toContain('SF-001');
    expect(error.message).toContain('SRS reference not found');
    expect(error.name).toBe('InvalidSDSTraceabilityError');
    expect(error.srsId).toBe('SF-001');
    expect(error.reason).toBe('SRS reference not found');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new InvalidSDSTraceabilityError('SF-001', 'reason');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('InvalidSDSChangeRequestError', () => {
  it('should create error with field and reason', () => {
    const error = new InvalidSDSChangeRequestError('newComponent', 'Required field missing');
    expect(error.message).toContain('newComponent');
    expect(error.message).toContain('Required field missing');
    expect(error.name).toBe('InvalidSDSChangeRequestError');
    expect(error.field).toBe('newComponent');
    expect(error.reason).toBe('Required field missing');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new InvalidSDSChangeRequestError('field', 'reason');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('SDSDocumentParseError', () => {
  it('should create error with path and reason', () => {
    const error = new SDSDocumentParseError('/docs/sds/sds.md', 'Invalid markdown format');
    expect(error.message).toContain('/docs/sds/sds.md');
    expect(error.message).toContain('Invalid markdown format');
    expect(error.name).toBe('SDSDocumentParseError');
    expect(error.path).toBe('/docs/sds/sds.md');
    expect(error.reason).toBe('Invalid markdown format');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new SDSDocumentParseError('/path', 'reason');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('SDSOutputWriteError', () => {
  it('should create error with output path and reason', () => {
    const error = new SDSOutputWriteError('/output/sds.md', 'Permission denied');
    expect(error.message).toContain('/output/sds.md');
    expect(error.message).toContain('Permission denied');
    expect(error.name).toBe('SDSOutputWriteError');
    expect(error.outputPath).toBe('/output/sds.md');
    expect(error.reason).toBe('Permission denied');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new SDSOutputWriteError('/path', 'reason');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('InvalidSDSVersionError', () => {
  it('should create error with invalid version', () => {
    const error = new InvalidSDSVersionError('invalid-version');
    expect(error.message).toContain('invalid-version');
    expect(error.message).toContain('semantic versioning');
    expect(error.name).toBe('InvalidSDSVersionError');
    expect(error.version).toBe('invalid-version');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new InvalidSDSVersionError('v1');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('SDSFileSizeLimitError', () => {
  it('should create error with path, actual size, and max size', () => {
    const error = new SDSFileSizeLimitError('/docs/sds/sds.md', 2000000, 1000000);
    expect(error.message).toContain('/docs/sds/sds.md');
    expect(error.message).toContain('2000000');
    expect(error.message).toContain('1000000');
    expect(error.name).toBe('SDSFileSizeLimitError');
    expect(error.path).toBe('/docs/sds/sds.md');
    expect(error.actualSize).toBe(2000000);
    expect(error.maxSize).toBe(1000000);
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new SDSFileSizeLimitError('/path', 100, 50);
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('SDSNotLoadedError', () => {
  it('should create error with default message', () => {
    const error = new SDSNotLoadedError();
    expect(error.message).toContain('has not been loaded');
    expect(error.message).toContain('loadSDS()');
    expect(error.name).toBe('SDSNotLoadedError');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new SDSNotLoadedError();
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('InterfaceIncompatibilityError', () => {
  it('should create error with component ID and reason', () => {
    const error = new InterfaceIncompatibilityError('CMP-001', 'Method signature changed');
    expect(error.message).toContain('CMP-001');
    expect(error.message).toContain('Method signature changed');
    expect(error.name).toBe('InterfaceIncompatibilityError');
    expect(error.componentId).toBe('CMP-001');
    expect(error.reason).toBe('Method signature changed');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new InterfaceIncompatibilityError('CMP-001', 'reason');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});

describe('ArchitecturalConflictError', () => {
  it('should create error with change type and reason', () => {
    const error = new ArchitecturalConflictError('add_pattern', 'Conflicts with existing pattern');
    expect(error.message).toContain('add_pattern');
    expect(error.message).toContain('Conflicts with existing pattern');
    expect(error.name).toBe('ArchitecturalConflictError');
    expect(error.changeType).toBe('add_pattern');
    expect(error.reason).toBe('Conflicts with existing pattern');
  });

  it('should inherit from SDSUpdaterError', () => {
    const error = new ArchitecturalConflictError('type', 'reason');
    expect(error instanceof SDSUpdaterError).toBe(true);
  });
});
