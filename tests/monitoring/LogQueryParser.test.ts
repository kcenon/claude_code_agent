import { describe, it, expect } from 'vitest';
import { LogQueryParser, createLogQueryParser } from '../../src/monitoring/index.js';
import type { LogEntry } from '../../src/monitoring/index.js';

describe('LogQueryParser', () => {
  const parser = new LogQueryParser();

  // Sample log entries for testing
  const sampleEntries: LogEntry[] = [
    {
      timestamp: '2024-01-15T10:00:00.000Z',
      level: 'INFO',
      message: 'Application started successfully',
      correlationId: 'corr-001',
      agent: 'collector',
      stage: 'initialization',
      projectId: 'proj-001',
    },
    {
      timestamp: '2024-01-15T10:05:00.000Z',
      level: 'DEBUG',
      message: 'Processing request',
      correlationId: 'corr-002',
      agent: 'worker-1',
      stage: 'processing',
      projectId: 'proj-001',
    },
    {
      timestamp: '2024-01-15T10:10:00.000Z',
      level: 'WARN',
      message: 'Connection timeout detected',
      correlationId: 'corr-003',
      agent: 'worker-1',
      stage: 'processing',
      projectId: 'proj-002',
    },
    {
      timestamp: '2024-01-15T10:15:00.000Z',
      level: 'ERROR',
      message: 'Failed to connect to database',
      correlationId: 'corr-004',
      agent: 'worker-2',
      stage: 'processing',
      projectId: 'proj-001',
    },
    {
      timestamp: '2024-01-16T08:00:00.000Z',
      level: 'INFO',
      message: 'Daily backup completed',
      correlationId: 'corr-005',
      agent: 'scheduler',
      stage: 'maintenance',
      projectId: 'proj-001',
    },
  ];

  describe('createLogQueryParser', () => {
    it('should create a new parser instance', () => {
      const instance = createLogQueryParser();
      expect(instance).toBeInstanceOf(LogQueryParser);
    });
  });

  describe('parse', () => {
    it('should parse a simple field:value condition', () => {
      const result = parser.parse('level:error');
      expect(result.success).toBe(true);
      expect(result.expression?.type).toBe('condition');
      expect(result.expression?.condition?.field).toBe('level');
      expect(result.expression?.condition?.value).toBe('error');
    });

    it('should parse quoted values with spaces', () => {
      const result = parser.parse('message:"failed to connect"');
      expect(result.success).toBe(true);
      expect(result.expression?.condition?.value).toBe('failed to connect');
    });

    it('should parse single quoted values', () => {
      const result = parser.parse("message:'error occurred'");
      expect(result.success).toBe(true);
      expect(result.expression?.condition?.value).toBe('error occurred');
    });

    it('should parse AND expressions', () => {
      const result = parser.parse('level:error AND agent:worker-1');
      expect(result.success).toBe(true);
      expect(result.expression?.type).toBe('compound');
      expect(result.expression?.operator).toBe('AND');
    });

    it('should parse OR expressions', () => {
      const result = parser.parse('level:error OR level:warn');
      expect(result.success).toBe(true);
      expect(result.expression?.type).toBe('compound');
      expect(result.expression?.operator).toBe('OR');
    });

    it('should parse NOT expressions', () => {
      const result = parser.parse('NOT level:debug');
      expect(result.success).toBe(true);
      expect(result.expression?.type).toBe('compound');
      expect(result.expression?.operator).toBe('NOT');
    });

    it('should parse time range expressions', () => {
      const result = parser.parse('time:2024-01-01..2024-01-31');
      expect(result.success).toBe(true);
      expect(result.expression?.condition?.field).toBe('time');
      expect(result.expression?.condition?.value).toBe('2024-01-01');
      expect(result.expression?.condition?.rangeEnd).toBe('2024-01-31');
    });

    it('should parse parenthesized expressions', () => {
      const result = parser.parse('(level:error OR level:warn) AND agent:worker-1');
      expect(result.success).toBe(true);
      expect(result.expression?.type).toBe('compound');
      expect(result.expression?.operator).toBe('AND');
      expect(result.expression?.left?.operator).toBe('OR');
    });

    it('should parse bare value as message search', () => {
      const result = parser.parse('timeout');
      expect(result.success).toBe(true);
      expect(result.expression?.condition?.field).toBe('message');
      expect(result.expression?.condition?.value).toBe('timeout');
    });

    it('should handle case-insensitive operators', () => {
      const result = parser.parse('level:error and agent:worker');
      expect(result.success).toBe(true);
      expect(result.expression?.operator).toBe('AND');
    });

    it('should return error for empty query', () => {
      const result = parser.parse('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty query string');
    });

    it('should return error for invalid field', () => {
      const result = parser.parse('invalid:value');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected token');
    });

    it('should return error for missing value after colon', () => {
      const result = parser.parse('level:');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected value');
    });

    it('should return error for unclosed parenthesis', () => {
      const result = parser.parse('(level:error');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Expected closing parenthesis');
    });
  });

  describe('execute', () => {
    it('should filter by level', () => {
      const parseResult = parser.parse('level:error');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.level).toBe('ERROR');
    });

    it('should filter by agent', () => {
      const parseResult = parser.parse('agent:worker-1');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.agent === 'worker-1')).toBe(true);
    });

    it('should filter by stage', () => {
      const parseResult = parser.parse('stage:processing');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(3);
    });

    it('should filter by projectId', () => {
      const parseResult = parser.parse('projectId:proj-002');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
    });

    it('should filter by correlationId', () => {
      const parseResult = parser.parse('correlationId:corr-004');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
    });

    it('should filter by message content (case-insensitive)', () => {
      const parseResult = parser.parse('message:timeout');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.message).toContain('timeout');
    });

    it('should handle AND operator', () => {
      const parseResult = parser.parse('level:warn AND agent:worker-1');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.level).toBe('WARN');
      expect(result.entries[0]?.agent).toBe('worker-1');
    });

    it('should handle OR operator', () => {
      const parseResult = parser.parse('level:error OR level:warn');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(2);
    });

    it('should handle NOT operator', () => {
      const parseResult = parser.parse('NOT level:debug');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(4);
      expect(result.entries.every((e) => e.level !== 'DEBUG')).toBe(true);
    });

    it('should handle complex expression with parentheses', () => {
      const parseResult = parser.parse('(level:error OR level:warn) AND projectId:proj-001');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.level).toBe('ERROR');
    });

    it('should filter by time range', () => {
      const parseResult = parser.parse('time:2024-01-15..2024-01-15');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(4);
    });

    it('should filter by single date', () => {
      const parseResult = parser.parse('time:2024-01-16');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
    });

    it('should support pagination with limit', () => {
      const parseResult = parser.parse('stage:processing');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries, 2);
      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should support pagination with offset', () => {
      const parseResult = parser.parse('stage:processing');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries, 2, 2);
      expect(result.entries).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should handle case-insensitive level matching', () => {
      const parseResult = parser.parse('level:ERROR');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(1);
    });

    it('should handle case-insensitive agent matching', () => {
      const parseResult = parser.parse('agent:WORKER-1');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('should parse and execute in one step', () => {
      const result = parser.search('level:error', sampleEntries);
      expect(result.query).toBe('level:error');
      expect(result.entries).toHaveLength(1);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include expression in result', () => {
      const result = parser.search('level:error AND agent:worker-2', sampleEntries);
      expect(result.expression.type).toBe('compound');
      expect(result.expression.operator).toBe('AND');
    });

    it('should return empty results for invalid query', () => {
      const result = parser.search('invalid:query', sampleEntries);
      expect(result.entries).toHaveLength(0);
    });

    it('should handle complex queries', () => {
      const result = parser.search('(level:error OR level:warn) AND NOT agent:collector', sampleEntries);
      expect(result.entries).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple NOT operators', () => {
      const result = parser.parse('NOT NOT level:debug');
      expect(result.success).toBe(true);
      expect(result.expression?.operator).toBe('NOT');
      expect(result.expression?.right?.operator).toBe('NOT');
    });

    it('should handle deeply nested parentheses', () => {
      const result = parser.parse('((level:error))');
      expect(result.success).toBe(true);
    });

    it('should handle escaped quotes in values', () => {
      const result = parser.parse('message:"test \\"quoted\\" value"');
      expect(result.success).toBe(true);
      expect(result.expression?.condition?.value).toBe('test "quoted" value');
    });

    it('should handle whitespace between tokens', () => {
      const result = parser.parse('  level:error   AND   agent:worker  ');
      expect(result.success).toBe(true);
    });

    it('should handle mixed case field names', () => {
      const result = parser.parse('LEVEL:error');
      expect(result.success).toBe(true);
      expect(result.expression?.condition?.field).toBe('level');
    });

    it('should handle entries without optional fields', () => {
      const minimalEntries: LogEntry[] = [
        {
          timestamp: '2024-01-15T10:00:00.000Z',
          level: 'INFO',
          message: 'Test message',
          correlationId: 'corr-001',
        },
      ];

      const parseResult = parser.parse('agent:worker');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, minimalEntries);
      expect(result.entries).toHaveLength(0);
    });

    it('should handle ISO timestamp with time component using quotes', () => {
      const parseResult = parser.parse('time:"2024-01-15T10:00:00.000Z".."2024-01-15T10:10:00.000Z"');
      expect(parseResult.success).toBe(true);
      const result = parser.execute(parseResult.expression!, sampleEntries);
      expect(result.entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('operator precedence', () => {
    it('should handle AND before OR', () => {
      // "a OR b AND c" should be parsed as "a OR (b AND c)"
      const result = parser.parse('level:info OR level:warn AND agent:worker-1');
      expect(result.success).toBe(true);
      // The outer operator should be OR
      expect(result.expression?.operator).toBe('OR');
      // The right side should be AND
      expect(result.expression?.right?.operator).toBe('AND');
    });

    it('should respect parentheses over precedence', () => {
      const result = parser.parse('(level:info OR level:warn) AND agent:worker-1');
      expect(result.success).toBe(true);
      // The outer operator should be AND
      expect(result.expression?.operator).toBe('AND');
      // The left side should be OR
      expect(result.expression?.left?.operator).toBe('OR');
    });

    it('should handle NOT with highest precedence', () => {
      const result = parser.parse('NOT level:debug AND agent:worker-1');
      expect(result.success).toBe(true);
      // The outer operator should be AND
      expect(result.expression?.operator).toBe('AND');
      // The left side should be NOT
      expect(result.expression?.left?.operator).toBe('NOT');
    });
  });
});
