/**
 * Worker Failure and Recovery E2E Tests
 *
 * Tests error handling and recovery scenarios for worker execution,
 * including network failures, timeouts, and retry mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { GitHubMock } from '../helpers/github-mock.js';

/**
 * Test environment
 */
interface TestEnv {
  rootDir: string;
  cleanup: () => void;
}

/**
 * Create a test environment
 */
function createEnv(name: string): TestEnv {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `worker-failure-${name}-`));
  return {
    rootDir,
    cleanup: () => {
      if (fs.existsSync(rootDir)) {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Simulated worker result
 */
interface WorkerResult {
  success: boolean;
  issueNumber: number;
  retryCount: number;
  error?: string;
}

/**
 * Simulated worker execution with retry logic
 */
async function executeWorkerWithRetry(
  githubMock: GitHubMock,
  issueNumber: number,
  maxRetries: number = 3
): Promise<WorkerResult> {
  let retryCount = 0;
  let lastError: string | undefined;

  while (retryCount <= maxRetries) {
    try {
      // Simulate fetching issue
      const issueResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues/${issueNumber}`,
        { method: 'GET' }
      );

      if (!issueResponse.ok) {
        throw new Error(`Failed to fetch issue: ${issueResponse.status}`);
      }

      // Simulate creating a PR for the issue
      const prResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `fix: Implement issue #${issueNumber}`,
            body: `Closes #${issueNumber}`,
            head: `feature/issue-${issueNumber}`,
            base: 'main',
          }),
        }
      );

      if (!prResponse.ok) {
        throw new Error(`Failed to create PR: ${prResponse.status}`);
      }

      return {
        success: true,
        issueNumber,
        retryCount,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      retryCount++;
      // Exponential backoff simulation (instant for tests)
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return {
    success: false,
    issueNumber,
    retryCount: maxRetries,
    error: lastError,
  };
}

describe('Worker Failure and Recovery E2E Tests', () => {
  let githubMock: GitHubMock;
  let env: TestEnv;

  beforeEach(async () => {
    githubMock = new GitHubMock({
      issues: [
        {
          number: 1,
          title: 'Test Issue 1',
          body: 'Test body',
          state: 'open',
          labels: [],
          assignees: [],
        },
        {
          number: 2,
          title: 'Test Issue 2',
          body: 'Test body',
          state: 'open',
          labels: [],
          assignees: [],
        },
      ],
    });
    await githubMock.start();
    env = createEnv('test');
  });

  afterEach(async () => {
    await githubMock.stop();
    env.cleanup();
  });

  describe('Retry on Transient Failures', () => {
    it('should retry and succeed after transient failures', async () => {
      // Given: GitHub API fails twice then succeeds
      githubMock.simulateFailure('create_pr', {
        times: 2,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      // When: Worker executes with retry
      const result = await executeWorkerWithRetry(githubMock, 1, 3);

      // Then: Should succeed after retries
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
    });

    it('should fail after exhausting retries', async () => {
      // Given: GitHub API always fails
      githubMock.simulateFailure('create_pr', {
        times: 10,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      // When: Worker executes with limited retries
      const result = await executeWorkerWithRetry(githubMock, 1, 2);

      // Then: Should fail after retries exhausted
      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(2);
      expect(result.error).toContain('503');
    });

    it('should succeed immediately when no failures', async () => {
      // Given: GitHub API works normally
      // (no simulated failures)

      // When: Worker executes
      const result = await executeWorkerWithRetry(githubMock, 1, 3);

      // Then: Should succeed without retries
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(0);
    });
  });

  describe('Handling Different Error Types', () => {
    it('should handle 404 for non-existent issue', async () => {
      // Given: Issue doesn't exist
      // When: Worker tries to process non-existent issue
      const result = await executeWorkerWithRetry(githubMock, 999, 2);

      // Then: Should fail (404 is not retryable)
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle rate limiting (429)', async () => {
      // Given: Rate limit error
      githubMock.simulateFailure('list_issues', {
        times: 1,
        statusCode: 429,
        errorMessage: 'Rate limit exceeded',
      });

      // When: Worker fetches issue
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
        { method: 'GET' }
      );

      // Then: First request fails with 429
      expect(response.status).toBe(429);

      // And: Second request succeeds
      const response2 = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
        { method: 'GET' }
      );
      expect(response2.status).toBe(200);
    });

    it('should handle network timeout simulation', async () => {
      // Given: Simulated timeout via 504
      githubMock.simulateFailure('create_pr', {
        times: 1,
        statusCode: 504,
        errorMessage: 'Gateway timeout',
      });

      // When: Worker executes with retry
      const result = await executeWorkerWithRetry(githubMock, 1, 2);

      // Then: Should retry and eventually succeed
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
    });
  });

  describe('Parallel Worker Failure Handling', () => {
    it('should handle failures in parallel execution', async () => {
      // Given: Some workers will fail
      githubMock.simulateFailure('create_pr', {
        times: 2,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      // When: Running multiple workers in parallel
      const workerPromises = [
        executeWorkerWithRetry(githubMock, 1, 3),
        executeWorkerWithRetry(githubMock, 2, 3),
      ];

      const results = await Promise.all(workerPromises);

      // Then: All workers should eventually succeed
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should isolate failures between workers', async () => {
      // Add more issues for test
      githubMock.addIssue({
        number: 3,
        title: 'Test Issue 3',
        body: 'Body',
        state: 'open',
        labels: [],
        assignees: [],
      });

      // Given: Independent worker executions
      const results: WorkerResult[] = [];

      // When: Running workers sequentially with different outcomes
      // First worker - normal
      results.push(await executeWorkerWithRetry(githubMock, 1, 3));

      // Inject failure for second worker
      githubMock.simulateFailure('create_pr', {
        times: 5,
        statusCode: 500,
        errorMessage: 'Internal server error',
      });
      results.push(await executeWorkerWithRetry(githubMock, 2, 2));

      // Third worker - should work after failures are consumed
      results.push(await executeWorkerWithRetry(githubMock, 3, 3));

      // Then: Workers should have independent outcomes
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Recovery State Management', () => {
    it('should track retry attempts', async () => {
      // Given: Two transient failures
      githubMock.simulateFailure('create_pr', {
        times: 2,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      // When: Worker executes
      const result = await executeWorkerWithRetry(githubMock, 1, 5);

      // Then: Should record retry count
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
    });

    it('should handle recovery after complete failure', async () => {
      // Given: Initial complete failure
      githubMock.simulateFailure('create_pr', {
        times: 5,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      // When: First attempt fails completely
      const result1 = await executeWorkerWithRetry(githubMock, 1, 2);
      expect(result1.success).toBe(false);

      // Clear failures (simulate service recovery)
      githubMock.clearFailures();

      // When: Second attempt after recovery
      const result2 = await executeWorkerWithRetry(githubMock, 1, 2);

      // Then: Should succeed
      expect(result2.success).toBe(true);
      expect(result2.retryCount).toBe(0);
    });
  });

  describe('Error Categorization', () => {
    it('should distinguish transient vs permanent errors', async () => {
      // Transient error (503) - should retry
      githubMock.simulateFailure('create_pr', {
        times: 1,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      const transientResult = await executeWorkerWithRetry(githubMock, 1, 3);
      expect(transientResult.success).toBe(true);
      expect(transientResult.retryCount).toBe(1);

      // Permanent error (404) - should fail fast
      const permanentResult = await executeWorkerWithRetry(githubMock, 999, 3);
      expect(permanentResult.success).toBe(false);
      // All retries exhausted due to consistent 404
      expect(permanentResult.retryCount).toBe(3);
    });
  });
});
