import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CICircuitBreaker } from '../../src/pr-reviewer/CICircuitBreaker.js';
import { CircuitOpenError } from '../../src/pr-reviewer/errors.js';
import type { CircuitBreakerEvent } from '../../src/pr-reviewer/CICircuitBreaker.js';

describe('CICircuitBreaker', () => {
  let circuitBreaker: CICircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CICircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 1000, // 1 second for testing
      failureWindowMs: 5000,
    });
  });

  describe('constructor', () => {
    it('should use default config when not provided', () => {
      const defaultBreaker = new CICircuitBreaker();
      const config = defaultBreaker.getConfig();

      expect(config.failureThreshold).toBe(3);
      expect(config.successThreshold).toBe(2);
      expect(config.resetTimeoutMs).toBe(300000);
      expect(config.failureWindowMs).toBe(600000);
    });

    it('should use provided config values', () => {
      const config = circuitBreaker.getConfig();

      expect(config.failureThreshold).toBe(3);
      expect(config.successThreshold).toBe(2);
      expect(config.resetTimeoutMs).toBe(1000);
    });
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.isHalfOpen()).toBe(false);
    });

    it('should allow attempts when closed', () => {
      expect(circuitBreaker.canAttempt()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should pass through successful operations', async () => {
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(circuitBreaker.isClosed()).toBe(true);
    });

    it('should record failures but stay closed below threshold', async () => {
      // Record 2 failures (below threshold of 3)
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('failure 1');
        })
      ).rejects.toThrow('failure 1');

      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('failure 2');
        })
      ).rejects.toThrow('failure 2');

      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.getStatus().failures).toBe(2);
    });

    it('should open circuit after threshold failures', async () => {
      // Record 3 failures (at threshold)
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(async () => {
            throw new Error(`failure ${String(i)}`);
          })
        ).rejects.toThrow();
      }

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should throw CircuitOpenError when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      await expect(circuitBreaker.execute(async () => 'test')).rejects.toThrow(CircuitOpenError);
    });
  });

  describe('state transitions', () => {
    it('should transition from closed to open after failures', () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.isOpen()).toBe(true);
      expect(events.some((e) => e.type === 'state_change' && e.to === 'open')).toBe(true);
    });

    it('should transition from open to half-open after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be ready to attempt
      expect(circuitBreaker.canAttempt()).toBe(true);

      // Prepare for attempt should transition to half-open
      circuitBreaker.prepareForAttempt();
      expect(circuitBreaker.isHalfOpen()).toBe(true);
    });

    it('should transition from half-open to closed after success threshold', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Wait for reset timeout and transition to half-open
      await new Promise((resolve) => setTimeout(resolve, 1100));
      circuitBreaker.prepareForAttempt();
      expect(circuitBreaker.isHalfOpen()).toBe(true);

      // Record successes
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.isHalfOpen()).toBe(true); // Still half-open after 1 success

      circuitBreaker.recordSuccess();
      expect(circuitBreaker.isClosed()).toBe(true); // Closed after 2 successes
    });

    it('should transition from half-open to open on failure', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Wait for reset timeout and transition to half-open
      await new Promise((resolve) => setTimeout(resolve, 1100));
      circuitBreaker.prepareForAttempt();
      expect(circuitBreaker.isHalfOpen()).toBe(true);

      // Record failure
      circuitBreaker.recordFailure();
      expect(circuitBreaker.isOpen()).toBe(true);
    });
  });

  describe('terminal failures', () => {
    it('should immediately open circuit on terminal failure', () => {
      circuitBreaker.recordFailure('terminal');

      expect(circuitBreaker.isOpen()).toBe(true);
      expect(circuitBreaker.getStatus().failures).toBe(3); // Immediately at threshold
    });
  });

  describe('reset', () => {
    it('should reset to closed state', () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.getStatus().failures).toBe(0);
      expect(circuitBreaker.getStatus().successes).toBe(0);
    });

    it('should emit reset event', () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      circuitBreaker.reset();

      expect(events.some((e) => e.type === 'reset')).toBe(true);
    });
  });

  describe('forceOpen', () => {
    it('should force circuit to open state', () => {
      expect(circuitBreaker.isClosed()).toBe(true);

      circuitBreaker.forceOpen();

      expect(circuitBreaker.isOpen()).toBe(true);
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return 0 when circuit is closed', () => {
      expect(circuitBreaker.getTimeUntilReset()).toBe(0);
    });

    it('should return remaining time when circuit is open', () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      const timeUntilReset = circuitBreaker.getTimeUntilReset();
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(timeUntilReset).toBeLessThanOrEqual(1000);
    });
  });

  describe('event handling', () => {
    it('should emit failure_recorded events', () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      circuitBreaker.recordFailure();

      const failureEvent = events.find((e) => e.type === 'failure_recorded');
      expect(failureEvent).toBeDefined();
      expect(failureEvent?.type === 'failure_recorded' && failureEvent.failures).toBe(1);
    });

    it('should allow unregistering event listeners', () => {
      const events: CircuitBreakerEvent[] = [];
      const unsubscribe = circuitBreaker.onEvent((event) => events.push(event));

      circuitBreaker.recordFailure();
      expect(events.length).toBe(1);

      unsubscribe();

      circuitBreaker.recordFailure();
      expect(events.length).toBe(1); // No new events
    });
  });

  describe('success resets failure count', () => {
    it('should reset failure count on success in closed state', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getStatus().failures).toBe(2);

      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getStatus().failures).toBe(0);
    });
  });
});
