import { describe, it, expect } from 'vitest';
import {
  SRSUpdaterError,
  NoActiveSRSSessionError,
  SRSNotFoundError,
  FeatureNotFoundError,
  UseCaseNotFoundError,
  DuplicateFeatureError,
  DuplicateUseCaseError,
  InvalidTraceabilityError,
  InvalidSRSChangeRequestError,
  SRSDocumentParseError,
  SRSOutputWriteError,
  InvalidSRSVersionError,
  SRSFileSizeLimitError,
  SRSNotLoadedError,
} from '../../src/srs-updater/errors.js';

describe('SRSUpdaterError', () => {
  it('should create base error with message', () => {
    const error = new SRSUpdaterError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('SRSUpdaterError');
    expect(error instanceof Error).toBe(true);
  });

  it('should maintain prototype chain', () => {
    const error = new SRSUpdaterError('Test');
    expect(error instanceof SRSUpdaterError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('NoActiveSRSSessionError', () => {
  it('should create error with default message', () => {
    const error = new NoActiveSRSSessionError();
    expect(error.message).toContain('No active SRS update session');
    expect(error.message).toContain('startSession()');
    expect(error.name).toBe('NoActiveSRSSessionError');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new NoActiveSRSSessionError();
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('SRSNotFoundError', () => {
  it('should create error with path', () => {
    const error = new SRSNotFoundError('/docs/srs/srs.md');
    expect(error.message).toContain('/docs/srs/srs.md');
    expect(error.message).toContain('not found');
    expect(error.name).toBe('SRSNotFoundError');
    expect(error.path).toBe('/docs/srs/srs.md');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new SRSNotFoundError('/path');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('FeatureNotFoundError', () => {
  it('should create error with feature ID and SRS path', () => {
    const error = new FeatureNotFoundError('SF-001', '/docs/srs/srs.md');
    expect(error.message).toContain('SF-001');
    expect(error.message).toContain('/docs/srs/srs.md');
    expect(error.name).toBe('FeatureNotFoundError');
    expect(error.featureId).toBe('SF-001');
    expect(error.srsPath).toBe('/docs/srs/srs.md');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new FeatureNotFoundError('SF-001', '/path');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('UseCaseNotFoundError', () => {
  it('should create error with use case ID and SRS path', () => {
    const error = new UseCaseNotFoundError('UC-001', '/docs/srs/srs.md');
    expect(error.message).toContain('UC-001');
    expect(error.message).toContain('/docs/srs/srs.md');
    expect(error.name).toBe('UseCaseNotFoundError');
    expect(error.useCaseId).toBe('UC-001');
    expect(error.srsPath).toBe('/docs/srs/srs.md');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new UseCaseNotFoundError('UC-001', '/path');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('DuplicateFeatureError', () => {
  it('should create error with feature ID', () => {
    const error = new DuplicateFeatureError('SF-001');
    expect(error.message).toContain('SF-001');
    expect(error.message).toContain('already exists');
    expect(error.name).toBe('DuplicateFeatureError');
    expect(error.featureId).toBe('SF-001');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new DuplicateFeatureError('SF-001');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('DuplicateUseCaseError', () => {
  it('should create error with use case ID', () => {
    const error = new DuplicateUseCaseError('UC-001');
    expect(error.message).toContain('UC-001');
    expect(error.message).toContain('already exists');
    expect(error.name).toBe('DuplicateUseCaseError');
    expect(error.useCaseId).toBe('UC-001');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new DuplicateUseCaseError('UC-001');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('InvalidTraceabilityError', () => {
  it('should create error with PRD ID and reason', () => {
    const error = new InvalidTraceabilityError('FR-001', 'PRD reference not found');
    expect(error.message).toContain('FR-001');
    expect(error.message).toContain('PRD reference not found');
    expect(error.name).toBe('InvalidTraceabilityError');
    expect(error.prdId).toBe('FR-001');
    expect(error.reason).toBe('PRD reference not found');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new InvalidTraceabilityError('FR-001', 'reason');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('InvalidSRSChangeRequestError', () => {
  it('should create error with field and reason', () => {
    const error = new InvalidSRSChangeRequestError('newFeature', 'Required field missing');
    expect(error.message).toContain('newFeature');
    expect(error.message).toContain('Required field missing');
    expect(error.name).toBe('InvalidSRSChangeRequestError');
    expect(error.field).toBe('newFeature');
    expect(error.reason).toBe('Required field missing');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new InvalidSRSChangeRequestError('field', 'reason');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('SRSDocumentParseError', () => {
  it('should create error with path and reason', () => {
    const error = new SRSDocumentParseError('/docs/srs/srs.md', 'Invalid markdown format');
    expect(error.message).toContain('/docs/srs/srs.md');
    expect(error.message).toContain('Invalid markdown format');
    expect(error.name).toBe('SRSDocumentParseError');
    expect(error.path).toBe('/docs/srs/srs.md');
    expect(error.reason).toBe('Invalid markdown format');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new SRSDocumentParseError('/path', 'reason');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('SRSOutputWriteError', () => {
  it('should create error with output path and reason', () => {
    const error = new SRSOutputWriteError('/output/srs.md', 'Permission denied');
    expect(error.message).toContain('/output/srs.md');
    expect(error.message).toContain('Permission denied');
    expect(error.name).toBe('SRSOutputWriteError');
    expect(error.outputPath).toBe('/output/srs.md');
    expect(error.reason).toBe('Permission denied');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new SRSOutputWriteError('/path', 'reason');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('InvalidSRSVersionError', () => {
  it('should create error with invalid version', () => {
    const error = new InvalidSRSVersionError('invalid-version');
    expect(error.message).toContain('invalid-version');
    expect(error.message).toContain('semantic versioning');
    expect(error.name).toBe('InvalidSRSVersionError');
    expect(error.version).toBe('invalid-version');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new InvalidSRSVersionError('v1');
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('SRSFileSizeLimitError', () => {
  it('should create error with path, actual size, and max size', () => {
    const error = new SRSFileSizeLimitError('/docs/srs/srs.md', 2000000, 1000000);
    expect(error.message).toContain('/docs/srs/srs.md');
    expect(error.message).toContain('2000000');
    expect(error.message).toContain('1000000');
    expect(error.name).toBe('SRSFileSizeLimitError');
    expect(error.path).toBe('/docs/srs/srs.md');
    expect(error.actualSize).toBe(2000000);
    expect(error.maxSize).toBe(1000000);
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new SRSFileSizeLimitError('/path', 100, 50);
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});

describe('SRSNotLoadedError', () => {
  it('should create error with default message', () => {
    const error = new SRSNotLoadedError();
    expect(error.message).toContain('has not been loaded');
    expect(error.message).toContain('loadSRS()');
    expect(error.name).toBe('SRSNotLoadedError');
  });

  it('should inherit from SRSUpdaterError', () => {
    const error = new SRSNotLoadedError();
    expect(error instanceof SRSUpdaterError).toBe(true);
  });
});
