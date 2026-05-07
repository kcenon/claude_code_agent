/**
 * Tests for V&V shared module: types, defaults, and error factories
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VNV_CONFIG,
  isDocumentStage,
  getDocTypeForStage,
  VnvError,
  stageVerificationFailedError,
  rtmBuildError,
  contentValidationError,
  traceabilityGapError,
  consistencyViolationError,
  validationFailedError,
  acceptanceCriteriaFailedError,
  reportGenerationError,
  vnvConfigError,
} from '../../src/vnv/index.js';
import { ErrorSeverity } from '../../src/errors/types.js';
import type { StageName } from '../../src/ad-sdlc-orchestrator/types.js';

// =============================================================================
// DEFAULT_VNV_CONFIG
// =============================================================================

describe('DEFAULT_VNV_CONFIG', () => {
  it('should have standard rigor by default', () => {
    expect(DEFAULT_VNV_CONFIG.rigor).toBe('standard');
  });

  it('should not halt on verification failure by default', () => {
    expect(DEFAULT_VNV_CONFIG.haltOnVerificationFailure).toBe(false);
  });

  it('should enable V&V plan generation by default', () => {
    expect(DEFAULT_VNV_CONFIG.generateVnvPlan).toBe(true);
  });

  it('should enable V&V report generation by default', () => {
    expect(DEFAULT_VNV_CONFIG.generateVnvReport).toBe(true);
  });

  it('should enable RTM generation by default', () => {
    expect(DEFAULT_VNV_CONFIG.generateRtm).toBe(true);
  });

  it('should enable cross-document consistency by default', () => {
    expect(DEFAULT_VNV_CONFIG.crossDocumentConsistency).toBe(true);
  });

  it('should enable acceptance criteria validation by default', () => {
    expect(DEFAULT_VNV_CONFIG.acceptanceCriteriaValidation).toBe(true);
  });

  it('should have all expected keys', () => {
    const keys = Object.keys(DEFAULT_VNV_CONFIG);
    expect(keys).toContain('rigor');
    expect(keys).toContain('haltOnVerificationFailure');
    expect(keys).toContain('generateVnvPlan');
    expect(keys).toContain('generateVnvReport');
    expect(keys).toContain('generateRtm');
    expect(keys).toContain('crossDocumentConsistency');
    expect(keys).toContain('acceptanceCriteriaValidation');
  });
});

// =============================================================================
// isDocumentStage
// =============================================================================

describe('isDocumentStage', () => {
  const documentStages: StageName[] = [
    'prd_generation',
    'srs_generation',
    'sds_generation',
    'prd_update',
    'srs_update',
    'sds_update',
  ];

  for (const stage of documentStages) {
    it(`should return true for '${stage}'`, () => {
      expect(isDocumentStage(stage)).toBe(true);
    });
  }

  const nonDocumentStages: StageName[] = [
    'collection',
    'implementation',
    'review',
    'issue_generation',
    'initialization',
    'mode_detection',
    'orchestration',
    'validation-agent',
  ];

  for (const stage of nonDocumentStages) {
    it(`should return false for '${stage}'`, () => {
      expect(isDocumentStage(stage)).toBe(false);
    });
  }
});

// =============================================================================
// getDocTypeForStage
// =============================================================================

describe('getDocTypeForStage', () => {
  it('should return "prd" for prd_generation', () => {
    expect(getDocTypeForStage('prd_generation')).toBe('prd');
  });

  it('should return "prd" for prd_update', () => {
    expect(getDocTypeForStage('prd_update')).toBe('prd');
  });

  it('should return "srs" for srs_generation', () => {
    expect(getDocTypeForStage('srs_generation')).toBe('srs');
  });

  it('should return "srs" for srs_update', () => {
    expect(getDocTypeForStage('srs_update')).toBe('srs');
  });

  it('should return "sds" for sds_generation', () => {
    expect(getDocTypeForStage('sds_generation')).toBe('sds');
  });

  it('should return "sds" for sds_update', () => {
    expect(getDocTypeForStage('sds_update')).toBe('sds');
  });

  it('should return null for collection', () => {
    expect(getDocTypeForStage('collection')).toBeNull();
  });

  it('should return null for implementation', () => {
    expect(getDocTypeForStage('implementation')).toBeNull();
  });

  it('should return null for review', () => {
    expect(getDocTypeForStage('review')).toBeNull();
  });

  it('should return null for issue_generation', () => {
    expect(getDocTypeForStage('issue_generation')).toBeNull();
  });

  it('should return null for orchestration', () => {
    expect(getDocTypeForStage('orchestration')).toBeNull();
  });
});

// =============================================================================
// VnvError
// =============================================================================

describe('VnvError', () => {
  it('should construct with code and message', () => {
    const error = new VnvError('VNV-001', 'Test error message');
    expect(error.code).toBe('VNV-001');
    expect(error.message).toBe('Test error message');
    expect(error.name).toBe('VnvError');
  });

  it('should be an instance of Error', () => {
    const error = new VnvError('VNV-001', 'Test error');
    expect(error).toBeInstanceOf(Error);
  });

  it('should accept options with severity and category', () => {
    const error = new VnvError('VNV-001', 'Test error', {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { key: 'value' },
    });
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.context).toEqual(expect.objectContaining({ key: 'value' }));
  });
});

// =============================================================================
// Error Factory Functions
// =============================================================================

describe('Error Factory Functions', () => {
  describe('stageVerificationFailedError', () => {
    it('should create an error with stage name and failed check count', () => {
      const error = stageVerificationFailedError('collection', 3);
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-001');
      expect(error.message).toContain('collection');
      expect(error.message).toContain('3 check(s)');
    });

    it('should include context when provided', () => {
      const error = stageVerificationFailedError('prd_generation', 1, { extra: 'data' });
      expect(error.context).toEqual(
        expect.objectContaining({ stageName: 'prd_generation', failedChecks: 1, extra: 'data' })
      );
    });
  });

  describe('rtmBuildError', () => {
    it('should create an error with reason', () => {
      const error = rtmBuildError('Missing PRD document');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-020');
      expect(error.message).toContain('Missing PRD document');
    });
  });

  describe('contentValidationError', () => {
    it('should create an error with stage name and reason', () => {
      const error = contentValidationError('srs_generation', 'Missing sections');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-002');
      expect(error.message).toContain('srs_generation');
      expect(error.message).toContain('Missing sections');
    });
  });

  describe('traceabilityGapError', () => {
    it('should create an error with affected IDs and reason', () => {
      const error = traceabilityGapError(['FR-001', 'FR-002'], 'No SRS mapping');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-003');
      expect(error.message).toContain('No SRS mapping');
      expect(error.context).toEqual(expect.objectContaining({ affectedIds: ['FR-001', 'FR-002'] }));
    });
  });

  describe('consistencyViolationError', () => {
    it('should create an error with sync point and document names', () => {
      const error = consistencyViolationError('FR-count', 'PRD', 'SRS');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-004');
      expect(error.message).toContain('FR-count');
      expect(error.message).toContain('PRD');
      expect(error.message).toContain('SRS');
    });
  });

  describe('validationFailedError', () => {
    it('should create an error with overall result and reason', () => {
      const error = validationFailedError('fail', 'Unimplemented requirements');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-030');
      expect(error.message).toContain('fail');
      expect(error.message).toContain('Unimplemented requirements');
    });
  });

  describe('acceptanceCriteriaFailedError', () => {
    it('should create an error with requirement and criterion IDs', () => {
      const error = acceptanceCriteriaFailedError('FR-001', 'AC-001');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-031');
      expect(error.message).toContain('AC-001');
      expect(error.message).toContain('FR-001');
    });
  });

  describe('reportGenerationError', () => {
    it('should create an error with report type and reason', () => {
      const error = reportGenerationError('V&V Plan', 'Disk full');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-040');
      expect(error.message).toContain('V&V Plan');
      expect(error.message).toContain('Disk full');
    });
  });

  describe('vnvConfigError', () => {
    it('should create an error with reason', () => {
      const error = vnvConfigError('Invalid rigor level');
      expect(error).toBeInstanceOf(VnvError);
      expect(error.code).toBe('VNV-050');
      expect(error.message).toContain('Invalid rigor level');
    });
  });
});
