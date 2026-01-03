import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  IntelligentCIPoller,
  createStatusChecker,
} from '../../src/pr-reviewer/IntelligentCIPoller.js';
import { CICircuitBreaker } from '../../src/pr-reviewer/CICircuitBreaker.js';
import type { CIStatusChecker, PollerEvent } from '../../src/pr-reviewer/IntelligentCIPoller.js';
import type { GitHubStatusCheck, CICheckFailure } from '../../src/pr-reviewer/types.js';

describe('IntelligentCIPoller', () => {
  let poller: IntelligentCIPoller;
  let circuitBreaker: CICircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CICircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 1000,
    });

    poller = new IntelligentCIPoller(
      {
        initialIntervalMs: 100, // Short intervals for testing
        maxIntervalMs: 500,
        backoffMultiplier: 1.5,
        maxJitterMs: 50,
        maxPolls: 10,
        failFastOnTerminal: true,
      },
      circuitBreaker
    );
  });

  describe('constructor', () => {
    it('should use default config when not provided', () => {
      const defaultPoller = new IntelligentCIPoller();
      const config = defaultPoller.getConfig();

      expect(config.initialIntervalMs).toBe(10000);
      expect(config.maxIntervalMs).toBe(60000);
      expect(config.backoffMultiplier).toBe(1.5);
      expect(config.maxPolls).toBe(60);
    });

    it('should create its own circuit breaker if not provided', () => {
      const defaultPoller = new IntelligentCIPoller();
      expect(defaultPoller.getCircuitBreaker()).toBeDefined();
    });
  });

  describe('pollUntilComplete', () => {
    it('should return success when CI passes', async () => {
      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'success',
        checks: [{ name: 'test', status: 'passed' }],
        failedChecks: [],
      });

      const result = await poller.pollUntilComplete(1, statusChecker);

      expect(result.success).toBe(true);
      expect(result.pollCount).toBe(1);
      expect(statusChecker).toHaveBeenCalledTimes(1);
    });

    it('should poll multiple times for pending CI', async () => {
      let callCount = 0;
      const statusChecker: CIStatusChecker = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            state: 'pending',
            checks: [{ name: 'test', status: 'pending' }],
            failedChecks: [],
          };
        }
        return {
          state: 'success',
          checks: [{ name: 'test', status: 'passed' }],
          failedChecks: [],
        };
      });

      const result = await poller.pollUntilComplete(1, statusChecker);

      expect(result.success).toBe(true);
      expect(result.pollCount).toBe(3);
    });

    it('should respect maxPolls limit', async () => {
      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'pending',
        checks: [{ name: 'test', status: 'pending' }],
        failedChecks: [],
      });

      const result = await poller.pollUntilComplete(1, statusChecker);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('max_polls_exceeded');
      expect(result.pollCount).toBe(10); // maxPolls
    });

    it('should fail fast on terminal failures when enabled', async () => {
      const terminalFailure: CICheckFailure = {
        name: 'configuration',
        failureType: 'terminal',
        recoverable: false,
        errorMessage: 'Invalid configuration',
      };

      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'failure',
        checks: [{ name: 'configuration', status: 'failed' }],
        failedChecks: [terminalFailure],
      });

      const result = await poller.pollUntilComplete(1, statusChecker);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('terminal_failure');
      expect(result.failureDetails?.name).toBe('configuration');
      expect(result.pollCount).toBe(1);
    });

    it('should return circuit_open when circuit breaker is open', async () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'success',
        checks: [],
        failedChecks: [],
      });

      const result = await poller.pollUntilComplete(1, statusChecker);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('circuit_open');
      expect(statusChecker).not.toHaveBeenCalled();
    });
  });

  describe('classifyFailure', () => {
    it('should classify test failures as transient', () => {
      const check: GitHubStatusCheck = { name: 'unit-tests', status: 'failed' };
      const result = poller.classifyFailure(check);

      expect(result.failureType).toBe('transient');
      expect(result.recoverable).toBe(true);
    });

    it('should classify build failures as transient', () => {
      const check: GitHubStatusCheck = { name: 'build', status: 'failed' };
      const result = poller.classifyFailure(check);

      expect(result.failureType).toBe('transient');
      expect(result.recoverable).toBe(true);
    });

    it('should classify configuration errors as terminal', () => {
      const check: GitHubStatusCheck = { name: 'some-check', status: 'failed' };
      const result = poller.classifyFailure(check, 'Configuration error');

      expect(result.failureType).toBe('terminal');
      expect(result.recoverable).toBe(false);
    });

    it('should classify unauthorized errors as terminal', () => {
      const check: GitHubStatusCheck = { name: 'deploy', status: 'failed' };
      const result = poller.classifyFailure(check, 'Unauthorized access');

      expect(result.failureType).toBe('terminal');
      expect(result.recoverable).toBe(false);
    });

    it('should classify unknown failures as persistent', () => {
      const check: GitHubStatusCheck = { name: 'unknown-check', status: 'failed' };
      const result = poller.classifyFailure(check);

      expect(result.failureType).toBe('persistent');
    });
  });

  describe('determineFailureType', () => {
    it('should detect terminal failures from check name', () => {
      expect(poller.determineFailureType('config-validation')).toBe('terminal');
      expect(poller.determineFailureType('syntax-check')).toBe('terminal');
    });

    it('should detect terminal failures from error message', () => {
      expect(poller.determineFailureType('deploy', 'permission denied')).toBe('terminal');
      expect(poller.determineFailureType('release', 'invalid token')).toBe('terminal');
    });

    it('should detect transient failures from check name', () => {
      expect(poller.determineFailureType('unit-test')).toBe('transient');
      expect(poller.determineFailureType('lint-check')).toBe('transient');
      expect(poller.determineFailureType('build-and-deploy')).toBe('transient');
    });

    it('should detect transient failures from error message', () => {
      expect(poller.determineFailureType('check', 'rate limit exceeded')).toBe('transient');
      expect(poller.determineFailureType('check', 'connection timeout')).toBe('transient');
    });
  });

  describe('event handling', () => {
    it('should emit poll_start events', async () => {
      const events: PollerEvent[] = [];
      poller.onEvent((event) => events.push(event));

      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'success',
        checks: [],
        failedChecks: [],
      });

      await poller.pollUntilComplete(42, statusChecker);

      const pollStartEvent = events.find((e) => e.type === 'poll_start');
      expect(pollStartEvent).toBeDefined();
      expect(pollStartEvent?.type === 'poll_start' && pollStartEvent.prNumber).toBe(42);
    });

    it('should emit backoff events when polling continues', async () => {
      const events: PollerEvent[] = [];
      poller.onEvent((event) => events.push(event));

      let callCount = 0;
      const statusChecker: CIStatusChecker = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return {
            state: 'pending',
            checks: [],
            failedChecks: [],
          };
        }
        return {
          state: 'success',
          checks: [],
          failedChecks: [],
        };
      });

      await poller.pollUntilComplete(1, statusChecker);

      const backoffEvents = events.filter((e) => e.type === 'backoff');
      expect(backoffEvents.length).toBeGreaterThan(0);
    });

    it('should emit terminal_failure events', async () => {
      const events: PollerEvent[] = [];
      poller.onEvent((event) => events.push(event));

      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'failure',
        checks: [{ name: 'config', status: 'failed' }],
        failedChecks: [
          {
            name: 'config',
            failureType: 'terminal',
            recoverable: false,
            errorMessage: 'Invalid configuration',
          },
        ],
      });

      await poller.pollUntilComplete(1, statusChecker);

      const terminalEvent = events.find((e) => e.type === 'terminal_failure');
      expect(terminalEvent).toBeDefined();
    });

    it('should allow unregistering event listeners', async () => {
      const events: PollerEvent[] = [];
      const unsubscribe = poller.onEvent((event) => events.push(event));

      const statusChecker: CIStatusChecker = vi.fn().mockResolvedValue({
        state: 'success',
        checks: [],
        failedChecks: [],
      });

      await poller.pollUntilComplete(1, statusChecker);
      const countBefore = events.length;

      unsubscribe();

      await poller.pollUntilComplete(1, statusChecker);
      expect(events.length).toBe(countBefore); // No new events
    });
  });

  describe('reset', () => {
    it('should reset the circuit breaker', () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      poller.reset();

      expect(circuitBreaker.isClosed()).toBe(true);
    });
  });
});

describe('createStatusChecker', () => {
  it('should create a status checker from getPRInfo function', async () => {
    const mockGetPRInfo = vi.fn().mockResolvedValue({
      statusCheckRollup: [
        { name: 'test', status: 'passed', conclusion: 'success' },
        { name: 'build', status: 'passed', conclusion: 'success' },
      ],
    });

    const statusChecker = createStatusChecker(mockGetPRInfo);
    const result = await statusChecker(42);

    expect(result.state).toBe('success');
    expect(result.checks.length).toBe(2);
    expect(result.failedChecks.length).toBe(0);
    expect(mockGetPRInfo).toHaveBeenCalledWith(42);
  });

  it('should detect pending state', async () => {
    const mockGetPRInfo = vi.fn().mockResolvedValue({
      statusCheckRollup: [
        { name: 'test', status: 'pending' },
        { name: 'build', status: 'passed', conclusion: 'success' },
      ],
    });

    const statusChecker = createStatusChecker(mockGetPRInfo);
    const result = await statusChecker(1);

    expect(result.state).toBe('pending');
  });

  it('should detect failure state', async () => {
    const mockGetPRInfo = vi.fn().mockResolvedValue({
      statusCheckRollup: [
        { name: 'test', status: 'failed', conclusion: 'failure' },
        { name: 'build', status: 'passed', conclusion: 'success' },
      ],
    });

    const statusChecker = createStatusChecker(mockGetPRInfo);
    const result = await statusChecker(1);

    expect(result.state).toBe('failure');
    expect(result.failedChecks.length).toBe(1);
    expect(result.failedChecks[0].name).toBe('test');
  });
});
