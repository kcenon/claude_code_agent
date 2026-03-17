/**
 * Tests for common Zod schema definitions
 *
 * Validates runtime parsing behavior for package.json, file locks,
 * dependency graphs, progress tracking, controller state, and log entries.
 */

import { describe, it, expect } from 'vitest';

import {
  PackageJsonPartialSchema,
  PackageJsonVersionSchema,
  FileLockSchema,
  DependencyNodeSchema,
  DependencyGraphSchema,
  ProgressCheckpointSchema,
  ProgressReportSchema,
  IssueQueueSchema,
  WorkerStatusSchema,
  ControllerStateSchema,
  LogEntrySchema,
  AuditLogEntrySchema,
  PriorityAnalysisSchema,
} from '../../src/schemas/common.js';

describe('PackageJsonPartialSchema', () => {
  it('should accept a full package.json', () => {
    const data = {
      name: 'my-package',
      version: '1.0.0',
      description: 'A test package',
      main: 'index.js',
      scripts: { build: 'tsc', test: 'vitest' },
      dependencies: { zod: '^3.0.0' },
      devDependencies: { vitest: '^1.0.0' },
      peerDependencies: { react: '>=18' },
      engines: { node: '>=20' },
      type: 'module',
    };

    const result = PackageJsonPartialSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('my-package');
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.type).toBe('module');
    }
  });

  it('should accept an empty object', () => {
    const result = PackageJsonPartialSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept object with only name', () => {
    const result = PackageJsonPartialSchema.safeParse({ name: 'test' });
    expect(result.success).toBe(true);
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = {
      name: 'test',
      customField: 'custom-value',
      eslintConfig: { rules: {} },
    };

    const result = PackageJsonPartialSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject type values other than module or commonjs', () => {
    const data = { type: 'invalid' };

    const result = PackageJsonPartialSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should accept commonjs type', () => {
    const result = PackageJsonPartialSchema.safeParse({ type: 'commonjs' });
    expect(result.success).toBe(true);
  });

  it('should reject non-object input', () => {
    expect(PackageJsonPartialSchema.safeParse(null).success).toBe(false);
    expect(PackageJsonPartialSchema.safeParse(undefined).success).toBe(false);
    expect(PackageJsonPartialSchema.safeParse('string').success).toBe(false);
    expect(PackageJsonPartialSchema.safeParse(42).success).toBe(false);
  });

  it('should reject scripts with non-string values', () => {
    const data = { scripts: { build: 123 } };
    const result = PackageJsonPartialSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('PackageJsonVersionSchema', () => {
  it('should accept version string', () => {
    const result = PackageJsonVersionSchema.safeParse({ version: '2.1.0' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('2.1.0');
    }
  });

  it('should accept empty object', () => {
    const result = PackageJsonVersionSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBeUndefined();
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const result = PackageJsonVersionSchema.safeParse({ version: '1.0.0', name: 'test' });
    expect(result.success).toBe(true);
  });

  it('should reject non-string version', () => {
    const result = PackageJsonVersionSchema.safeParse({ version: 123 });
    expect(result.success).toBe(false);
  });
});

describe('FileLockSchema', () => {
  it('should accept valid file lock', () => {
    const data = {
      lockedBy: 'agent-1',
      lockedAt: '2026-01-01T00:00:00Z',
      operation: 'write',
    };

    const result = FileLockSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lockedBy).toBe('agent-1');
      expect(result.data.operation).toBe('write');
    }
  });

  it('should accept file lock with expiresAt', () => {
    const data = {
      lockedBy: 'agent-1',
      lockedAt: '2026-01-01T00:00:00Z',
      operation: 'write',
      expiresAt: '2026-01-01T00:05:00Z',
    };

    const result = FileLockSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(FileLockSchema.safeParse({}).success).toBe(false);
    expect(FileLockSchema.safeParse({ lockedBy: 'agent' }).success).toBe(false);
    expect(FileLockSchema.safeParse({ lockedBy: 'agent', lockedAt: 'now' }).success).toBe(false);
  });

  it('should reject non-string field values', () => {
    const data = {
      lockedBy: 123,
      lockedAt: '2026-01-01T00:00:00Z',
      operation: 'write',
    };
    expect(FileLockSchema.safeParse(data).success).toBe(false);
  });
});

describe('DependencyNodeSchema', () => {
  it('should accept minimal node', () => {
    const result = DependencyNodeSchema.safeParse({ name: 'my-module' });
    expect(result.success).toBe(true);
  });

  it('should accept full node', () => {
    const data = {
      name: 'my-module',
      version: '1.0.0',
      dependencies: ['dep-a', 'dep-b'],
    };

    const result = DependencyNodeSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dependencies).toEqual(['dep-a', 'dep-b']);
    }
  });

  it('should reject missing name', () => {
    const result = DependencyNodeSchema.safeParse({ version: '1.0.0' });
    expect(result.success).toBe(false);
  });

  it('should reject non-string dependencies', () => {
    const result = DependencyNodeSchema.safeParse({
      name: 'test',
      dependencies: [123],
    });
    expect(result.success).toBe(false);
  });
});

describe('DependencyGraphSchema', () => {
  it('should accept empty graph', () => {
    const result = DependencyGraphSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept full graph', () => {
    const data = {
      nodes: {
        'module-a': { name: 'module-a', version: '1.0.0', dependencies: ['module-b'] },
        'module-b': { name: 'module-b', version: '2.0.0' },
      },
      edges: [{ from: 'module-a', to: 'module-b' }],
      root: 'module-a',
    };

    const result = DependencyGraphSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.root).toBe('module-a');
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const result = DependencyGraphSchema.safeParse({ customField: true });
    expect(result.success).toBe(true);
  });

  it('should reject invalid edge structure', () => {
    const data = {
      edges: [{ source: 'a', target: 'b' }],
    };
    const result = DependencyGraphSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('ProgressCheckpointSchema', () => {
  it('should accept minimal checkpoint', () => {
    const data = {
      orderId: 'WO-001',
      issueId: 'ISS-001',
      step: 'implementation',
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    const result = ProgressCheckpointSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept full checkpoint', () => {
    const data = {
      orderId: 'WO-001',
      issueId: 'ISS-001',
      step: 'testing',
      completedSteps: ['implementation', 'lint'],
      lastUpdated: '2026-01-01T00:00:00Z',
      retryCount: 2,
      error: 'Test failed',
    };

    const result = ProgressCheckpointSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retryCount).toBe(2);
    }
  });

  it('should reject missing required fields', () => {
    const result = ProgressCheckpointSchema.safeParse({ orderId: 'WO-001' });
    expect(result.success).toBe(false);
  });
});

describe('ProgressReportSchema', () => {
  it('should accept empty report', () => {
    const result = ProgressReportSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept full report', () => {
    const data = {
      sessionId: 'session-123',
      projectId: 'project-1',
      currentPhase: 'implementation',
      progress: 0.75,
      completedTasks: 3,
      totalTasks: 4,
      errors: ['warning: flaky test'],
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    const result = ProgressReportSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.progress).toBe(0.75);
    }
  });

  it('should reject non-number progress', () => {
    const result = ProgressReportSchema.safeParse({ progress: 'high' });
    expect(result.success).toBe(false);
  });
});

describe('IssueQueueSchema', () => {
  it('should accept empty queue with defaults', () => {
    const result = IssueQueueSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pending).toEqual([]);
      expect(result.data.inProgress).toEqual([]);
      expect(result.data.completed).toEqual([]);
      expect(result.data.blocked).toEqual([]);
    }
  });

  it('should accept populated queue', () => {
    const data = {
      pending: ['ISS-001', 'ISS-002'],
      inProgress: ['ISS-003'],
      completed: ['ISS-004'],
      blocked: [],
    };

    const result = IssueQueueSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pending).toEqual(['ISS-001', 'ISS-002']);
    }
  });

  it('should reject non-string array elements', () => {
    const result = IssueQueueSchema.safeParse({ pending: [123] });
    expect(result.success).toBe(false);
  });
});

describe('WorkerStatusSchema', () => {
  it('should accept valid worker status', () => {
    const data = {
      id: 'worker-1',
      status: 'idle' as const,
      currentIssue: null,
      startedAt: null,
    };

    const result = WorkerStatusSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.completedTasks).toBe(0);
    }
  });

  it('should accept working worker with issue', () => {
    const data = {
      id: 'worker-2',
      status: 'working' as const,
      currentIssue: 'ISS-001',
      startedAt: '2026-01-01T00:00:00Z',
      completedTasks: 5,
    };

    const result = WorkerStatusSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept error status', () => {
    const data = {
      id: 'worker-3',
      status: 'error' as const,
      currentIssue: null,
      startedAt: null,
    };

    const result = WorkerStatusSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject invalid status value', () => {
    const data = {
      id: 'worker-1',
      status: 'running',
      currentIssue: null,
      startedAt: null,
    };
    const result = WorkerStatusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = WorkerStatusSchema.safeParse({ id: 'worker-1' });
    expect(result.success).toBe(false);
  });
});

describe('ControllerStateSchema', () => {
  it('should accept valid controller state', () => {
    const data = {
      sessionId: 'session-1',
      projectId: 'project-1',
      currentPhase: 'implementation',
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T01:00:00Z',
      queue: {},
      totalIssues: 10,
    };

    const result = ControllerStateSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.completedIssues).toBe(0);
      expect(result.data.failedIssues).toBe(0);
      expect(result.data.workers).toEqual([]);
    }
  });

  it('should accept full controller state', () => {
    const data = {
      schemaVersion: '1.0.0',
      sessionId: 'session-1',
      projectId: 'project-1',
      currentPhase: 'review',
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T01:00:00Z',
      queue: {
        pending: ['ISS-001'],
        inProgress: ['ISS-002'],
        completed: ['ISS-003'],
        blocked: [],
      },
      workers: [
        {
          id: 'worker-1',
          status: 'working' as const,
          currentIssue: 'ISS-002',
          startedAt: '2026-01-01T00:30:00Z',
          completedTasks: 1,
        },
      ],
      totalIssues: 3,
      completedIssues: 1,
      failedIssues: 0,
    };

    const result = ControllerStateSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const result = ControllerStateSchema.safeParse({
      sessionId: 'session-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('LogEntrySchema', () => {
  it('should accept minimal log entry', () => {
    const data = {
      timestamp: '2026-01-01T00:00:00Z',
      level: 'INFO' as const,
      message: 'Operation completed',
      correlationId: 'corr-123',
    };

    const result = LogEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept full log entry', () => {
    const data = {
      timestamp: '2026-01-01T00:00:00Z',
      level: 'ERROR' as const,
      message: 'Operation failed',
      correlationId: 'corr-123',
      agent: 'worker-agent',
      stage: 'implementation',
      projectId: 'project-1',
      durationMs: 1500,
      context: { file: 'test.ts', line: 42 },
      error: {
        name: 'TypeError',
        message: 'Cannot read property',
        stack: 'TypeError: Cannot read property...',
      },
    };

    const result = LogEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept all log levels', () => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

    for (const level of levels) {
      const result = LogEntrySchema.safeParse({
        timestamp: '2026-01-01T00:00:00Z',
        level,
        message: 'test',
        correlationId: 'corr',
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid log level', () => {
    const result = LogEntrySchema.safeParse({
      timestamp: '2026-01-01T00:00:00Z',
      level: 'TRACE',
      message: 'test',
      correlationId: 'corr',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    expect(LogEntrySchema.safeParse({}).success).toBe(false);
    expect(LogEntrySchema.safeParse({ timestamp: 'now' }).success).toBe(false);
  });
});

describe('AuditLogEntrySchema', () => {
  it('should accept valid audit entry', () => {
    const data = {
      type: 'file_created' as const,
      actor: 'worker-agent',
      resource: '/src/component.ts',
      action: 'create',
      result: 'success' as const,
      timestamp: '2026-01-01T00:00:00Z',
      correlationId: 'corr-123',
    };

    const result = AuditLogEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept all audit types', () => {
    const types = [
      'api_key_used',
      'github_issue_created',
      'github_pr_created',
      'github_pr_merged',
      'file_created',
      'file_deleted',
      'file_modified',
      'secret_accessed',
      'validation_failed',
      'security_violation',
    ] as const;

    for (const type of types) {
      const data = {
        type,
        actor: 'system',
        resource: '/test',
        action: 'test',
        result: 'success' as const,
        timestamp: '2026-01-01T00:00:00Z',
        correlationId: 'corr',
      };
      expect(AuditLogEntrySchema.safeParse(data).success).toBe(true);
    }
  });

  it('should accept all result values', () => {
    const results = ['success', 'failure', 'blocked'] as const;

    for (const result of results) {
      const data = {
        type: 'file_created' as const,
        actor: 'system',
        resource: '/test',
        action: 'test',
        result,
        timestamp: '2026-01-01T00:00:00Z',
        correlationId: 'corr',
      };
      expect(AuditLogEntrySchema.safeParse(data).success).toBe(true);
    }
  });

  it('should accept optional details and sessionId', () => {
    const data = {
      type: 'secret_accessed' as const,
      actor: 'admin',
      resource: 'API_KEY',
      action: 'read',
      result: 'success' as const,
      details: { ip: '127.0.0.1', userAgent: 'cli' },
      timestamp: '2026-01-01T00:00:00Z',
      correlationId: 'corr-123',
      sessionId: 'session-456',
    };

    const result = AuditLogEntrySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject invalid type', () => {
    const data = {
      type: 'unknown_event',
      actor: 'system',
      resource: '/test',
      action: 'test',
      result: 'success',
      timestamp: '2026-01-01T00:00:00Z',
      correlationId: 'corr',
    };
    expect(AuditLogEntrySchema.safeParse(data).success).toBe(false);
  });

  it('should reject invalid result', () => {
    const data = {
      type: 'file_created',
      actor: 'system',
      resource: '/test',
      action: 'test',
      result: 'partial',
      timestamp: '2026-01-01T00:00:00Z',
      correlationId: 'corr',
    };
    expect(AuditLogEntrySchema.safeParse(data).success).toBe(false);
  });
});

describe('PriorityAnalysisSchema', () => {
  it('should accept empty analysis', () => {
    const result = PriorityAnalysisSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept full analysis', () => {
    const data = {
      issueId: 'ISS-001',
      priority: 1,
      score: 95.5,
      factors: { complexity: 0.8, dependencies: 0.6 },
      dependencies: ['ISS-002', 'ISS-003'],
    };

    const result = PriorityAnalysisSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.score).toBe(95.5);
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const result = PriorityAnalysisSchema.safeParse({
      issueId: 'ISS-001',
      customMetric: 42,
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-number priority', () => {
    const result = PriorityAnalysisSchema.safeParse({ priority: 'high' });
    expect(result.success).toBe(false);
  });
});
