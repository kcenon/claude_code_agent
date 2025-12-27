/**
 * Tests for Scratchpad validation module
 */

import { describe, it, expect } from 'vitest';
import {
  validateCollectedInfo,
  validateWorkOrder,
  validateImplementationResult,
  validatePRReviewResult,
  validateControllerState,
  assertCollectedInfo,
  assertWorkOrder,
  assertImplementationResult,
  assertPRReviewResult,
  assertControllerState,
  getSchemaVersion,
  isCompatibleVersion,
  ensureSchemaVersion,
  SchemaValidationError,
  SCHEMA_VERSION,
} from '../../src/scratchpad/index.js';

describe('Schema Version', () => {
  it('should return current schema version', () => {
    expect(getSchemaVersion()).toBe(SCHEMA_VERSION);
    expect(getSchemaVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should check version compatibility', () => {
    expect(isCompatibleVersion({ schemaVersion: '1.0.0' })).toBe(true);
    expect(isCompatibleVersion({ schemaVersion: '1.1.0' })).toBe(true);
    expect(isCompatibleVersion({ schemaVersion: '1.9.9' })).toBe(true);
    expect(isCompatibleVersion({ schemaVersion: '2.0.0' })).toBe(false);
    expect(isCompatibleVersion({})).toBe(true); // No version = compatible
    expect(isCompatibleVersion(null)).toBe(false);
    expect(isCompatibleVersion('string')).toBe(false);
  });

  it('should ensure schema version is present', () => {
    const data = { foo: 'bar' };
    const result = ensureSchemaVersion(data);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.foo).toBe('bar');

    // Should not modify if already present
    const withVersion = { foo: 'bar', schemaVersion: '1.0.0' };
    const result2 = ensureSchemaVersion(withVersion);
    expect(result2.schemaVersion).toBe('1.0.0');
  });
});

describe('CollectedInfo Validation', () => {
  const validCollectedInfo = {
    projectId: '001',
    status: 'collecting',
    project: {
      name: 'Test Project',
      description: 'A test project',
    },
    requirements: {
      functional: [],
      nonFunctional: [],
    },
    constraints: [],
    assumptions: [],
    dependencies: [],
    clarifications: [],
    sources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should validate correct CollectedInfo', () => {
    const result = validateCollectedInfo(validCollectedInfo);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('should add schemaVersion if missing', () => {
    const result = validateCollectedInfo(validCollectedInfo);
    expect(result.success).toBe(true);
    expect(result.data?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('should reject invalid status', () => {
    const invalid = { ...validCollectedInfo, status: 'invalid' };
    const result = validateCollectedInfo(invalid);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should reject missing required fields', () => {
    const result = validateCollectedInfo({});
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should validate functional requirements', () => {
    const withFR = {
      ...validCollectedInfo,
      requirements: {
        functional: [
          {
            id: 'FR-001',
            title: 'Test Requirement',
            description: 'A test requirement',
            priority: 'P0',
          },
        ],
        nonFunctional: [],
      },
    };
    const result = validateCollectedInfo(withFR);
    expect(result.success).toBe(true);
  });

  it('should reject invalid FR id format', () => {
    const withInvalidFR = {
      ...validCollectedInfo,
      requirements: {
        functional: [
          {
            id: 'INVALID',
            title: 'Test',
            description: 'Test',
            priority: 'P0',
          },
        ],
        nonFunctional: [],
      },
    };
    const result = validateCollectedInfo(withInvalidFR);
    expect(result.success).toBe(false);
  });
});

describe('WorkOrder Validation', () => {
  const validWorkOrder = {
    orderId: 'WO-001',
    issueId: '123',
    issueUrl: 'https://github.com/repo/issues/123',
    createdAt: new Date().toISOString(),
    priority: 0,
    context: {
      relatedFiles: [],
      dependenciesStatus: [],
    },
    acceptanceCriteria: ['Criterion 1'],
  };

  it('should validate correct WorkOrder', () => {
    const result = validateWorkOrder(validWorkOrder);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should reject invalid URL', () => {
    const invalid = { ...validWorkOrder, issueUrl: 'not-a-url' };
    const result = validateWorkOrder(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty acceptance criteria', () => {
    const invalid = { ...validWorkOrder, acceptanceCriteria: [] };
    const result = validateWorkOrder(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject priority out of range', () => {
    const invalid = { ...validWorkOrder, priority: 5 };
    const result = validateWorkOrder(invalid);
    expect(result.success).toBe(false);
  });
});

describe('ImplementationResult Validation', () => {
  const validResult = {
    orderId: 'WO-001',
    issueId: '123',
    status: 'completed',
    branchName: 'feature/test',
    changes: [],
    testsAdded: [],
    completedAt: new Date().toISOString(),
  };

  it('should validate correct ImplementationResult', () => {
    const result = validateImplementationResult(validResult);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should accept failed status with error message', () => {
    const failed = {
      ...validResult,
      status: 'failed',
      errorMessage: 'Build failed',
    };
    const result = validateImplementationResult(failed);
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const invalid = { ...validResult, status: 'pending' };
    const result = validateImplementationResult(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate file changes', () => {
    const withChanges = {
      ...validResult,
      changes: [
        {
          filePath: 'src/test.ts',
          changeType: 'create',
          linesAdded: 100,
          linesRemoved: 0,
        },
      ],
    };
    const result = validateImplementationResult(withChanges);
    expect(result.success).toBe(true);
  });
});

describe('PRReviewResult Validation', () => {
  const validReview = {
    reviewId: 'REV-001',
    prNumber: 42,
    prUrl: 'https://github.com/repo/pull/42',
    orderId: 'WO-001',
    issueId: '123',
    decision: 'approve',
    comments: [],
    reviewedAt: new Date().toISOString(),
  };

  it('should validate correct PRReviewResult', () => {
    const result = validatePRReviewResult(validReview);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should validate with comments', () => {
    const withComments = {
      ...validReview,
      comments: [
        {
          filePath: 'src/test.ts',
          line: 10,
          severity: 'warning',
          message: 'Consider renaming',
        },
      ],
    };
    const result = validatePRReviewResult(withComments);
    expect(result.success).toBe(true);
  });

  it('should reject invalid decision', () => {
    const invalid = { ...validReview, decision: 'maybe' };
    const result = validatePRReviewResult(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate quality metrics', () => {
    const withMetrics = {
      ...validReview,
      qualityMetrics: {
        testCoverage: 85.5,
        lintErrors: 0,
        lintWarnings: 2,
        securityIssues: 0,
      },
    };
    const result = validatePRReviewResult(withMetrics);
    expect(result.success).toBe(true);
  });
});

describe('ControllerState Validation', () => {
  const validState = {
    sessionId: 'session-001',
    projectId: '001',
    currentPhase: 'implementing',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    queue: {
      pending: ['issue-1'],
      inProgress: ['issue-2'],
      completed: [],
      blocked: [],
    },
    workers: [],
    totalIssues: 3,
  };

  it('should validate correct ControllerState', () => {
    const result = validateControllerState(validState);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should validate with workers', () => {
    const withWorkers = {
      ...validState,
      workers: [
        {
          id: 'worker-1',
          status: 'working',
          currentIssue: 'issue-2',
          startedAt: new Date().toISOString(),
          completedTasks: 5,
        },
      ],
    };
    const result = validateControllerState(withWorkers);
    expect(result.success).toBe(true);
  });

  it('should reject invalid worker status', () => {
    const invalid = {
      ...validState,
      workers: [
        {
          id: 'worker-1',
          status: 'sleeping',
          currentIssue: null,
          startedAt: null,
          completedTasks: 0,
        },
      ],
    };
    const result = validateControllerState(invalid);
    expect(result.success).toBe(false);
  });
});

describe('Assertion Functions', () => {
  const validCollectedInfo = {
    projectId: '001',
    status: 'collecting',
    project: { name: 'Test', description: 'Test' },
    requirements: { functional: [], nonFunctional: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('assertCollectedInfo should return data on success', () => {
    const result = assertCollectedInfo(validCollectedInfo);
    expect(result.projectId).toBe('001');
  });

  it('assertCollectedInfo should throw on failure', () => {
    expect(() => assertCollectedInfo({})).toThrow(SchemaValidationError);
  });

  it('assertWorkOrder should throw on invalid data', () => {
    expect(() => assertWorkOrder({})).toThrow(SchemaValidationError);
  });

  it('assertImplementationResult should throw on invalid data', () => {
    expect(() => assertImplementationResult({})).toThrow(SchemaValidationError);
  });

  it('assertPRReviewResult should throw on invalid data', () => {
    expect(() => assertPRReviewResult({})).toThrow(SchemaValidationError);
  });

  it('assertControllerState should throw on invalid data', () => {
    expect(() => assertControllerState({})).toThrow(SchemaValidationError);
  });
});

describe('SchemaValidationError', () => {
  it('should have name, errors, and schemaVersion', () => {
    const error = new SchemaValidationError(
      'Test error',
      [{ path: 'test.field', message: 'Invalid value' }],
      '1.0.0'
    );
    expect(error.name).toBe('SchemaValidationError');
    expect(error.message).toBe('Test error');
    expect(error.errors.length).toBe(1);
    expect(error.schemaVersion).toBe('1.0.0');
  });

  it('should format errors as string', () => {
    const error = new SchemaValidationError(
      'Test error',
      [
        { path: 'field1', message: 'Error 1' },
        { path: 'field2', message: 'Error 2' },
      ],
      '1.0.0'
    );
    const formatted = error.formatErrors();
    expect(formatted).toContain('field1');
    expect(formatted).toContain('Error 1');
    expect(formatted).toContain('field2');
    expect(formatted).toContain('Error 2');
  });
});
