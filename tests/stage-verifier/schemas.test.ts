/**
 * Tests for Stage Verifier Zod schemas
 */

import { describe, it, expect } from 'vitest';
import {
  VerificationCheckSchema,
  StageVerificationResultSchema,
  ConsistencyViolationSchema,
  ConsistencyCheckResultSchema,
  VerificationRuleMetadataSchema,
  VerificationCategorySchema,
  CheckSeveritySchema,
  VnvRigorSchema,
  ConsistencyViolationSeveritySchema,
} from '../../src/stage-verifier/schemas.js';

// =============================================================================
// Enum Schemas
// =============================================================================

describe('VerificationCategorySchema', () => {
  it('should accept valid categories', () => {
    for (const cat of ['content', 'structure', 'traceability', 'quality', 'consistency']) {
      expect(VerificationCategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it('should reject invalid categories', () => {
    expect(VerificationCategorySchema.safeParse('unknown').success).toBe(false);
    expect(VerificationCategorySchema.safeParse('').success).toBe(false);
  });
});

describe('CheckSeveritySchema', () => {
  it('should accept error, warning, info', () => {
    for (const sev of ['error', 'warning', 'info']) {
      expect(CheckSeveritySchema.safeParse(sev).success).toBe(true);
    }
  });

  it('should reject invalid severities', () => {
    expect(CheckSeveritySchema.safeParse('critical').success).toBe(false);
  });
});

describe('VnvRigorSchema', () => {
  it('should accept strict, standard, minimal', () => {
    for (const rigor of ['strict', 'standard', 'minimal']) {
      expect(VnvRigorSchema.safeParse(rigor).success).toBe(true);
    }
  });

  it('should reject invalid rigor levels', () => {
    expect(VnvRigorSchema.safeParse('relaxed').success).toBe(false);
  });
});

describe('ConsistencyViolationSeveritySchema', () => {
  it('should accept critical, high, medium', () => {
    for (const sev of ['critical', 'high', 'medium']) {
      expect(ConsistencyViolationSeveritySchema.safeParse(sev).success).toBe(true);
    }
  });

  it('should reject low severity', () => {
    expect(ConsistencyViolationSeveritySchema.safeParse('low').success).toBe(false);
  });
});

// =============================================================================
// VerificationCheckSchema
// =============================================================================

describe('VerificationCheckSchema', () => {
  const validCheck = {
    checkId: 'VR-COL-001',
    name: 'Collected info artifact exists',
    category: 'structure',
    passed: true,
    severity: 'error',
    message: 'Collected info artifact found',
  };

  it('should parse a valid check', () => {
    const result = VerificationCheckSchema.safeParse(validCheck);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checkId).toBe('VR-COL-001');
      expect(result.data.passed).toBe(true);
    }
  });

  it('should accept optional details field', () => {
    const withDetails = { ...validCheck, details: { extra: 'info' } };
    const result = VerificationCheckSchema.safeParse(withDetails);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.details).toEqual({ extra: 'info' });
    }
  });

  it('should reject missing checkId', () => {
    const { checkId: _, ...withoutId } = validCheck;
    expect(VerificationCheckSchema.safeParse(withoutId).success).toBe(false);
  });

  it('should reject empty checkId', () => {
    const result = VerificationCheckSchema.safeParse({ ...validCheck, checkId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing name', () => {
    const { name: _, ...withoutName } = validCheck;
    expect(VerificationCheckSchema.safeParse(withoutName).success).toBe(false);
  });

  it('should reject invalid category', () => {
    const result = VerificationCheckSchema.safeParse({ ...validCheck, category: 'bogus' });
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean passed', () => {
    const result = VerificationCheckSchema.safeParse({ ...validCheck, passed: 'yes' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// StageVerificationResultSchema
// =============================================================================

describe('StageVerificationResultSchema', () => {
  const validResult = {
    stageName: 'collection',
    passed: true,
    rigor: 'standard',
    checks: [],
    warnings: [],
    errors: [],
    timestamp: '2026-01-01T00:00:00.000Z',
    durationMs: 150,
  };

  it('should parse a valid result with empty checks', () => {
    const result = StageVerificationResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stageName).toBe('collection');
      expect(result.data.passed).toBe(true);
    }
  });

  it('should parse a result with checks', () => {
    const withChecks = {
      ...validResult,
      checks: [
        {
          checkId: 'VR-COL-001',
          name: 'Test',
          category: 'structure',
          passed: true,
          severity: 'error',
          message: 'OK',
        },
      ],
    };
    const result = StageVerificationResultSchema.safeParse(withChecks);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checks).toHaveLength(1);
    }
  });

  it('should reject missing stageName', () => {
    const { stageName: _, ...without } = validResult;
    expect(StageVerificationResultSchema.safeParse(without).success).toBe(false);
  });

  it('should reject empty stageName', () => {
    expect(StageVerificationResultSchema.safeParse({ ...validResult, stageName: '' }).success).toBe(
      false
    );
  });

  it('should reject negative durationMs', () => {
    expect(
      StageVerificationResultSchema.safeParse({ ...validResult, durationMs: -1 }).success
    ).toBe(false);
  });

  it('should reject invalid rigor', () => {
    expect(
      StageVerificationResultSchema.safeParse({ ...validResult, rigor: 'relaxed' }).success
    ).toBe(false);
  });

  it('should reject missing timestamp', () => {
    const { timestamp: _, ...without } = validResult;
    expect(StageVerificationResultSchema.safeParse(without).success).toBe(false);
  });
});

// =============================================================================
// ConsistencyViolationSchema
// =============================================================================

describe('ConsistencyViolationSchema', () => {
  const validViolation = {
    syncPointName: 'FR-count',
    severity: 'medium',
    sourceDoc: 'prd',
    targetDoc: 'srs',
    description: 'FR count mismatch between PRD and SRS',
  };

  it('should parse a valid violation', () => {
    const result = ConsistencyViolationSchema.safeParse(validViolation);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.syncPointName).toBe('FR-count');
    }
  });

  it('should accept all severity levels', () => {
    for (const sev of ['critical', 'high', 'medium']) {
      const result = ConsistencyViolationSchema.safeParse({ ...validViolation, severity: sev });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing syncPointName', () => {
    const { syncPointName: _, ...without } = validViolation;
    expect(ConsistencyViolationSchema.safeParse(without).success).toBe(false);
  });

  it('should reject empty sourceDoc', () => {
    expect(ConsistencyViolationSchema.safeParse({ ...validViolation, sourceDoc: '' }).success).toBe(
      false
    );
  });

  it('should reject invalid severity', () => {
    expect(
      ConsistencyViolationSchema.safeParse({ ...validViolation, severity: 'low' }).success
    ).toBe(false);
  });
});

// =============================================================================
// ConsistencyCheckResultSchema
// =============================================================================

describe('ConsistencyCheckResultSchema', () => {
  it('should parse a passing result with no violations', () => {
    const result = ConsistencyCheckResultSchema.safeParse({
      passed: true,
      syncPointsChecked: 5,
      violations: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.passed).toBe(true);
      expect(result.data.syncPointsChecked).toBe(5);
    }
  });

  it('should parse a failing result with violations', () => {
    const result = ConsistencyCheckResultSchema.safeParse({
      passed: false,
      syncPointsChecked: 3,
      violations: [
        {
          syncPointName: 'FR-count',
          severity: 'high',
          sourceDoc: 'prd',
          targetDoc: 'srs',
          description: 'Mismatch',
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.violations).toHaveLength(1);
    }
  });

  it('should reject negative syncPointsChecked', () => {
    expect(
      ConsistencyCheckResultSchema.safeParse({
        passed: true,
        syncPointsChecked: -1,
        violations: [],
      }).success
    ).toBe(false);
  });

  it('should reject missing passed field', () => {
    expect(
      ConsistencyCheckResultSchema.safeParse({
        syncPointsChecked: 0,
        violations: [],
      }).success
    ).toBe(false);
  });
});

// =============================================================================
// VerificationRuleMetadataSchema
// =============================================================================

describe('VerificationRuleMetadataSchema', () => {
  const validMetadata = {
    checkId: 'VR-COL-001',
    name: 'Collected info artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
  };

  it('should parse valid metadata', () => {
    const result = VerificationRuleMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checkId).toBe('VR-COL-001');
      expect(result.data.minRigor).toBe('minimal');
    }
  });

  it('should reject missing checkId', () => {
    const { checkId: _, ...without } = validMetadata;
    expect(VerificationRuleMetadataSchema.safeParse(without).success).toBe(false);
  });

  it('should reject invalid minRigor', () => {
    expect(
      VerificationRuleMetadataSchema.safeParse({ ...validMetadata, minRigor: 'relaxed' }).success
    ).toBe(false);
  });

  it('should reject invalid category', () => {
    expect(
      VerificationRuleMetadataSchema.safeParse({ ...validMetadata, category: 'other' }).success
    ).toBe(false);
  });

  it('should reject invalid severity', () => {
    expect(
      VerificationRuleMetadataSchema.safeParse({ ...validMetadata, severity: 'critical' }).success
    ).toBe(false);
  });
});
