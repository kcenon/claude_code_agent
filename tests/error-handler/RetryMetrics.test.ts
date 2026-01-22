import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RetryMetrics,
  RecordBuilder,
  getGlobalRetryMetrics,
  resetGlobalRetryMetrics,
  type RetryOperationRecord,
} from '../../src/error-handler/RetryMetrics.js';

describe('RetryMetrics', () => {
  describe('RetryMetrics class', () => {
    let metrics: RetryMetrics;

    beforeEach(() => {
      metrics = new RetryMetrics();
    });

    describe('record', () => {
      it('should record an operation', () => {
        const record: RetryOperationRecord = {
          operationName: 'testOp',
          success: true,
          attempts: 1,
          totalDurationMs: 100,
          backoffStrategy: 'exponential',
          startedAt: Date.now() - 100,
          completedAt: Date.now(),
          delays: [],
        };

        metrics.record(record);
        expect(metrics.recordCount).toBe(1);
      });

      it('should trim old records when exceeding max', () => {
        const smallMetrics = new RetryMetrics(5);

        for (let i = 0; i < 10; i++) {
          smallMetrics.record({
            operationName: `op${String(i)}`,
            success: true,
            attempts: 1,
            totalDurationMs: 100,
            backoffStrategy: 'fixed',
            startedAt: Date.now(),
            completedAt: Date.now(),
            delays: [],
          });
        }

        expect(smallMetrics.recordCount).toBe(5);
      });
    });

    describe('getSnapshot', () => {
      it('should return empty snapshot when no records', () => {
        const snapshot = metrics.getSnapshot();

        expect(snapshot.totalOperations).toBe(0);
        expect(snapshot.successfulOperations).toBe(0);
        expect(snapshot.failedOperations).toBe(0);
        expect(snapshot.successRate).toBe(0);
        expect(snapshot.totalAttempts).toBe(0);
        expect(snapshot.averageAttempts).toBe(0);
      });

      it('should calculate correct metrics', () => {
        // Add 3 successful operations
        for (let i = 0; i < 3; i++) {
          metrics.record({
            operationName: 'successOp',
            success: true,
            attempts: 2,
            totalDurationMs: 200,
            backoffStrategy: 'exponential',
            startedAt: Date.now() - 200,
            completedAt: Date.now(),
            delays: [100],
          });
        }

        // Add 1 failed operation
        metrics.record({
          operationName: 'failOp',
          success: false,
          attempts: 3,
          totalDurationMs: 500,
          backoffStrategy: 'linear',
          startedAt: Date.now() - 500,
          completedAt: Date.now(),
          delays: [100, 200],
          errorMessage: 'Test error',
        });

        const snapshot = metrics.getSnapshot();

        expect(snapshot.totalOperations).toBe(4);
        expect(snapshot.successfulOperations).toBe(3);
        expect(snapshot.failedOperations).toBe(1);
        expect(snapshot.successRate).toBe(0.75);
        expect(snapshot.totalAttempts).toBe(9); // 3*2 + 3 = 9
        expect(snapshot.averageAttempts).toBeCloseTo(2.25); // 9/4
        expect(snapshot.totalRetryTimeMs).toBe(1100); // 200*3 + 500
      });

      it('should calculate byOperation metrics', () => {
        metrics.record({
          operationName: 'api',
          success: true,
          attempts: 1,
          totalDurationMs: 100,
          backoffStrategy: 'exponential',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [],
        });

        metrics.record({
          operationName: 'api',
          success: false,
          attempts: 3,
          totalDurationMs: 300,
          backoffStrategy: 'exponential',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [100, 100],
          errorMessage: 'Error',
        });

        metrics.record({
          operationName: 'db',
          success: true,
          attempts: 2,
          totalDurationMs: 150,
          backoffStrategy: 'fibonacci',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [50],
        });

        const snapshot = metrics.getSnapshot();

        expect(snapshot.byOperation['api']?.totalExecutions).toBe(2);
        expect(snapshot.byOperation['api']?.successCount).toBe(1);
        expect(snapshot.byOperation['api']?.failureCount).toBe(1);
        expect(snapshot.byOperation['api']?.successRate).toBe(0.5);
        expect(snapshot.byOperation['api']?.totalAttempts).toBe(4);

        expect(snapshot.byOperation['db']?.totalExecutions).toBe(1);
        expect(snapshot.byOperation['db']?.successRate).toBe(1);
      });

      it('should calculate byStrategy metrics', () => {
        metrics.record({
          operationName: 'op1',
          success: true,
          attempts: 2,
          totalDurationMs: 200,
          backoffStrategy: 'exponential',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [100],
        });

        metrics.record({
          operationName: 'op2',
          success: true,
          attempts: 3,
          totalDurationMs: 300,
          backoffStrategy: 'exponential',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [100, 200],
        });

        metrics.record({
          operationName: 'op3',
          success: false,
          attempts: 2,
          totalDurationMs: 150,
          backoffStrategy: 'fibonacci',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [75],
          errorMessage: 'Error',
        });

        const snapshot = metrics.getSnapshot();

        expect(snapshot.byStrategy['exponential']?.operationCount).toBe(2);
        expect(snapshot.byStrategy['exponential']?.successRate).toBe(1);
        expect(snapshot.byStrategy['exponential']?.totalRetries).toBe(3); // (2-1) + (3-1) = 3

        expect(snapshot.byStrategy['fibonacci']?.operationCount).toBe(1);
        expect(snapshot.byStrategy['fibonacci']?.successRate).toBe(0);
      });
    });

    describe('getOperationMetrics', () => {
      it('should return undefined for unknown operation', () => {
        expect(metrics.getOperationMetrics('unknown')).toBeUndefined();
      });

      it('should return metrics for known operation', () => {
        metrics.record({
          operationName: 'testOp',
          success: true,
          attempts: 2,
          totalDurationMs: 100,
          backoffStrategy: 'fixed',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [50],
        });

        const opMetrics = metrics.getOperationMetrics('testOp');
        expect(opMetrics?.name).toBe('testOp');
        expect(opMetrics?.totalExecutions).toBe(1);
      });
    });

    describe('getStrategyMetrics', () => {
      it('should return undefined for unknown strategy', () => {
        expect(metrics.getStrategyMetrics('unknown')).toBeUndefined();
      });

      it('should return metrics for known strategy', () => {
        metrics.record({
          operationName: 'testOp',
          success: true,
          attempts: 2,
          totalDurationMs: 100,
          backoffStrategy: 'linear',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [50],
        });

        const stratMetrics = metrics.getStrategyMetrics('linear');
        expect(stratMetrics?.strategy).toBe('linear');
        expect(stratMetrics?.operationCount).toBe(1);
      });
    });

    describe('getRecentRecords', () => {
      it('should return records in reverse order (newest first)', () => {
        for (let i = 0; i < 5; i++) {
          metrics.record({
            operationName: `op${String(i)}`,
            success: true,
            attempts: 1,
            totalDurationMs: 100,
            backoffStrategy: 'fixed',
            startedAt: Date.now(),
            completedAt: Date.now(),
            delays: [],
          });
        }

        const recent = metrics.getRecentRecords(3);
        expect(recent).toHaveLength(3);
        expect(recent[0]?.operationName).toBe('op4');
        expect(recent[1]?.operationName).toBe('op3');
        expect(recent[2]?.operationName).toBe('op2');
      });

      it('should respect limit parameter', () => {
        for (let i = 0; i < 10; i++) {
          metrics.record({
            operationName: `op${String(i)}`,
            success: true,
            attempts: 1,
            totalDurationMs: 100,
            backoffStrategy: 'fixed',
            startedAt: Date.now(),
            completedAt: Date.now(),
            delays: [],
          });
        }

        expect(metrics.getRecentRecords(5)).toHaveLength(5);
        expect(metrics.getRecentRecords(100)).toHaveLength(10);
      });
    });

    describe('clear', () => {
      it('should clear all records', () => {
        metrics.record({
          operationName: 'testOp',
          success: true,
          attempts: 1,
          totalDurationMs: 100,
          backoffStrategy: 'fixed',
          startedAt: Date.now(),
          completedAt: Date.now(),
          delays: [],
        });

        expect(metrics.recordCount).toBe(1);
        metrics.clear();
        expect(metrics.recordCount).toBe(0);
      });
    });
  });

  describe('RecordBuilder', () => {
    let metrics: RetryMetrics;

    beforeEach(() => {
      metrics = new RetryMetrics();
    });

    it('should build and record successful operation', () => {
      const builder = metrics.createRecordBuilder('testOp', 'exponential');
      builder.recordAttempt(0);
      builder.recordAttempt(100);
      builder.success();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.successfulOperations).toBe(1);
    });

    it('should build and record failed operation', () => {
      const builder = metrics.createRecordBuilder('testOp', 'linear');
      builder.recordAttempt(0);
      builder.recordAttempt(100);
      builder.recordAttempt(200);
      builder.failure('Connection timeout');

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.failedOperations).toBe(1);

      const records = metrics.getRecentRecords(1);
      expect(records[0]?.errorMessage).toBe('Connection timeout');
    });

    it('should track delays correctly', () => {
      const builder = metrics.createRecordBuilder('testOp', 'fibonacci');
      builder.recordAttempt(0); // First attempt, no delay
      builder.recordAttempt(1000);
      builder.recordAttempt(2000);
      builder.success();

      const records = metrics.getRecentRecords(1);
      expect(records[0]?.delays).toEqual([1000, 2000]);
      expect(records[0]?.attempts).toBe(3);
    });
  });

  describe('Global metrics', () => {
    afterEach(() => {
      resetGlobalRetryMetrics();
    });

    it('should return same instance on multiple calls', () => {
      const metrics1 = getGlobalRetryMetrics();
      const metrics2 = getGlobalRetryMetrics();
      expect(metrics1).toBe(metrics2);
    });

    it('should reset global metrics', () => {
      const metrics = getGlobalRetryMetrics();
      metrics.record({
        operationName: 'test',
        success: true,
        attempts: 1,
        totalDurationMs: 100,
        backoffStrategy: 'fixed',
        startedAt: Date.now(),
        completedAt: Date.now(),
        delays: [],
      });

      expect(getGlobalRetryMetrics().recordCount).toBe(1);

      resetGlobalRetryMetrics();
      expect(getGlobalRetryMetrics().recordCount).toBe(0);
    });
  });
});
