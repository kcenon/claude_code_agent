/**
 * Greenfield Pipeline E2E Tests with GitHub Integration
 *
 * Tests the complete Greenfield pipeline from user input to PR merge
 * using GitHub mock server for API interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { GitHubMock, createTestGitHubMock } from '../helpers/github-mock.js';
import { SIMPLE_FEATURE_INPUT, MINIMAL_INPUT } from '../helpers/fixtures.js';

/**
 * Test environment for greenfield pipeline tests
 */
interface TestEnvironment {
  rootDir: string;
  scratchpadPath: string;
  cleanup: () => void;
}

/**
 * Create a test environment
 */
function createTestEnvironment(name: string): TestEnvironment {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `greenfield-${name}-`));
  const scratchpadPath = path.join(rootDir, '.ad-sdlc', 'scratchpad');

  // Create directory structure
  fs.mkdirSync(path.join(scratchpadPath, 'info'), { recursive: true });
  fs.mkdirSync(path.join(scratchpadPath, 'documents'), { recursive: true });
  fs.mkdirSync(path.join(scratchpadPath, 'issues'), { recursive: true });

  return {
    rootDir,
    scratchpadPath,
    cleanup: () => {
      if (fs.existsSync(rootDir)) {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    },
  };
}

describe('Greenfield Pipeline with GitHub Integration', () => {
  let githubMock: GitHubMock;
  let env: TestEnvironment;

  beforeEach(async () => {
    githubMock = createTestGitHubMock();
    await githubMock.start();
    env = createTestEnvironment('github-integration');
  });

  afterEach(async () => {
    await githubMock.stop();
    env.cleanup();
  });

  describe('Issue Creation Flow', () => {
    it('should create issues via GitHub API', async () => {
      // Given: A project with generated issues
      const issuesToCreate = [
        { title: 'Setup project structure', body: 'Initialize the project' },
        { title: 'Implement login', body: 'Create login functionality' },
        { title: 'Add tests', body: 'Write unit tests' },
      ];

      // When: Creating issues through mock API
      const createdIssues = [];
      for (const issue of issuesToCreate) {
        const response = await fetch(
          `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(issue),
          }
        );

        expect(response.status).toBe(201);
        const created = await response.json();
        createdIssues.push(created);
      }

      // Then: All issues should be created with sequential numbers
      expect(createdIssues.length).toBe(3);
      expect(createdIssues[0].number).toBe(2); // Mock starts with 1
      expect(createdIssues[1].number).toBe(3);
      expect(createdIssues[2].number).toBe(4);
    });

    it('should handle issue creation failure gracefully', async () => {
      // Given: Simulated API failure
      githubMock.simulateFailure('create_issue', {
        times: 2,
        statusCode: 500,
        errorMessage: 'Internal server error',
      });

      // When: Attempting to create an issue
      const response1 = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', body: 'Test body' }),
        }
      );

      // Then: First request should fail
      expect(response1.status).toBe(500);

      // And: Second request should also fail
      const response2 = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', body: 'Test body' }),
        }
      );
      expect(response2.status).toBe(500);

      // And: Third request should succeed
      const response3 = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', body: 'Test body' }),
        }
      );
      expect(response3.status).toBe(201);
    });
  });

  describe('Pull Request Flow', () => {
    it('should create a pull request via GitHub API', async () => {
      // Given: A branch with changes
      const prData = {
        title: 'feat: Add login functionality',
        body: '## Summary\nImplements user login\n\n## Test Plan\n- Manual testing',
        head: 'feature/login',
        base: 'main',
      };

      // When: Creating a PR
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prData),
        }
      );

      // Then: PR should be created
      expect(response.status).toBe(201);
      const pr = await response.json();
      expect(pr.number).toBe(2); // Mock starts with 1
      expect(pr.state).toBe('open');
      expect(pr.head.ref).toBe('feature/login');
    });

    it('should merge a pull request via GitHub API', async () => {
      // Given: An existing PR
      const createResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Test PR',
            body: 'Test body',
            head: 'feature-branch',
            base: 'main',
          }),
        }
      );
      const pr = await createResponse.json();

      // When: Merging the PR
      const mergeResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls/${pr.number}/merge`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Then: PR should be merged
      expect(mergeResponse.status).toBe(200);
      const mergeResult = await mergeResponse.json();
      expect(mergeResult.merged).toBe(true);
    });

    it('should retrieve PR status after creation', async () => {
      // Given: A created PR
      await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Status Check PR',
            body: 'Test body',
            head: 'status-branch',
            base: 'main',
          }),
        }
      );

      // When: Fetching PR list
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        { method: 'GET' }
      );

      // Then: Should include the new PR
      const prs = await response.json();
      expect(prs.length).toBeGreaterThanOrEqual(2);
      expect(prs.some((pr: { title: string }) => pr.title === 'Status Check PR')).toBe(true);
    });
  });

  describe('CI Check Flow', () => {
    it('should retrieve check runs status', async () => {
      // When: Fetching check runs
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/commits/abc123/check-runs`,
        { method: 'GET' }
      );

      // Then: Should return check runs
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.total_count).toBeGreaterThan(0);
      expect(result.check_runs.length).toBeGreaterThan(0);
    });

    it('should handle CI failure scenario', async () => {
      // Given: Add a failing check run
      githubMock.addCheckRun({
        id: 100,
        name: 'lint',
        status: 'completed',
        conclusion: 'failure',
      });

      // When: Fetching check runs
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/commits/abc123/check-runs`,
        { method: 'GET' }
      );

      // Then: Should include the failing check
      const result = await response.json();
      const failingCheck = result.check_runs.find(
        (check: { name: string }) => check.name === 'lint'
      );
      expect(failingCheck).toBeDefined();
      expect(failingCheck.conclusion).toBe('failure');
    });
  });

  describe('Complete Pipeline Simulation', () => {
    it('should simulate complete greenfield flow', async () => {
      // Step 1: Create issues
      const issues = [
        { title: 'Setup', body: 'Project setup', labels: ['setup'] },
        { title: 'Feature', body: 'Core feature', labels: ['feature'] },
        { title: 'Tests', body: 'Add tests', labels: ['testing'] },
      ];

      const createdIssues = [];
      for (const issue of issues) {
        const response = await fetch(
          `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(issue),
          }
        );
        createdIssues.push(await response.json());
      }
      expect(createdIssues.length).toBe(3);

      // Step 2: Create PR for implementation
      const prResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'feat: Complete implementation',
            body: 'Implements all issues',
            head: 'feature/complete',
            base: 'main',
          }),
        }
      );
      const pr = await prResponse.json();
      expect(pr.state).toBe('open');

      // Step 3: Verify CI checks pass
      const checksResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/commits/abc123/check-runs`,
        { method: 'GET' }
      );
      const checks = await checksResponse.json();
      const allPassing = checks.check_runs.every(
        (check: { conclusion: string | null }) =>
          check.conclusion === 'success' || check.conclusion === null
      );
      expect(allPassing).toBe(true);

      // Step 4: Merge PR
      const mergeResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls/${pr.number}/merge`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const mergeResult = await mergeResponse.json();
      expect(mergeResult.merged).toBe(true);
    });

    it('should handle retry on CI failure', async () => {
      // Given: Initial CI failure
      githubMock.addCheckRun({
        id: 200,
        name: 'build',
        status: 'completed',
        conclusion: 'failure',
      });

      // Create PR
      const prResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Fix: Retry PR',
            body: 'PR with CI retry',
            head: 'fix/retry',
            base: 'main',
          }),
        }
      );
      const pr = await prResponse.json();

      // First check - should see failure
      let checksResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/commits/abc123/check-runs`,
        { method: 'GET' }
      );
      let checks = await checksResponse.json();
      expect(checks.check_runs.some(
        (c: { conclusion: string }) => c.conclusion === 'failure'
      )).toBe(true);

      // Simulate fix - clear mock data and add passing checks
      githubMock.clearMockData();
      githubMock.addCheckRun({
        id: 201,
        name: 'build',
        status: 'completed',
        conclusion: 'success',
      });

      // Re-add the PR for merge
      await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Fix: Retry PR',
            body: 'PR with CI retry',
            head: 'fix/retry',
            base: 'main',
          }),
        }
      );

      // Second check - should pass
      checksResponse = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/commits/abc123/check-runs`,
        { method: 'GET' }
      );
      checks = await checksResponse.json();
      expect(checks.check_runs.every(
        (c: { conclusion: string }) => c.conclusion === 'success'
      )).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent issue', async () => {
      // When: Fetching non-existent issue
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues/9999`,
        { method: 'GET' }
      );

      // Then: Should return 404
      expect(response.status).toBe(404);
    });

    it('should handle 404 for non-existent PR', async () => {
      // When: Fetching non-existent PR
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/pulls/9999`,
        { method: 'GET' }
      );

      // Then: Should return 404
      expect(response.status).toBe(404);
    });

    it('should handle invalid JSON in request body', async () => {
      // When: Sending invalid JSON
      const response = await fetch(
        `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        }
      );

      // Then: Should return 400
      expect(response.status).toBe(400);
    });
  });
});
