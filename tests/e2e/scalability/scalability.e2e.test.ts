/**
 * Scalability End-to-End Tests
 *
 * Tests system behavior under scale conditions including:
 * - Large project handling (100+ issues)
 * - Parallel worker execution
 * - Memory usage under load
 * - Token budget limits
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  generateLargeIssueSet,
  createLargeProject,
  SCALABILITY_EXPECTATIONS,
  type SimulatedIssue,
} from '../fixtures/scalability-fixtures.js';
import { GitHubMock, createTestGitHubMock } from '../helpers/github-mock.js';

/**
 * Create a temporary test directory
 */
function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

/**
 * Clean up a directory
 */
function cleanupDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('Scalability E2E Tests', () => {
  describe('Large Issue Set Handling', () => {
    it('should generate 100+ issues without memory issues', () => {
      // Given: A request for a large issue set
      const issueCount = SCALABILITY_EXPECTATIONS.largeProject.issueCount;

      // When: Generating the issue set
      const startMemory = process.memoryUsage().heapUsed;
      const issues = generateLargeIssueSet(issueCount);
      const endMemory = process.memoryUsage().heapUsed;

      // Then: Should generate correct number of issues
      expect(issues.length).toBe(issueCount);

      // And: Memory usage should be reasonable
      const memoryUsedMB = (endMemory - startMemory) / (1024 * 1024);
      expect(memoryUsedMB).toBeLessThan(SCALABILITY_EXPECTATIONS.largeProject.memoryLimitMB);
    });

    it('should maintain valid dependency graph in large issue set', () => {
      // Given: A large issue set
      const issues = generateLargeIssueSet(100);

      // When: Checking dependencies
      for (const issue of issues) {
        for (const depNum of issue.dependencies) {
          // Then: All dependencies should reference valid issues
          expect(depNum).toBeGreaterThan(0);
          expect(depNum).toBeLessThan(issue.number);
        }
      }
    });

    it('should distribute priorities evenly in large set', () => {
      // Given: A large issue set
      const issues = generateLargeIssueSet(100);

      // When: Counting priorities
      const priorityCounts = new Map<string, number>();
      for (const issue of issues) {
        const count = priorityCounts.get(issue.priority) ?? 0;
        priorityCounts.set(issue.priority, count + 1);
      }

      // Then: Each priority should have some issues (random distribution)
      expect(priorityCounts.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Large Project Structure', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = createTempDir('scalability-project');
    });

    afterEach(() => {
      cleanupDir(testDir);
    });

    it('should create large project structure efficiently', async () => {
      // Given: Configuration for a large project
      const config = {
        baseDir: testDir,
        issueCount: 100,
        componentCount: 10,
        sourceFileCount: 50,
      };

      // When: Creating the project
      const startTime = Date.now();
      await createLargeProject(config);
      const duration = Date.now() - startTime;

      // Then: Project should be created within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds

      // And: Directory structure should exist
      expect(fs.existsSync(path.join(testDir, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'tests'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'package.json'))).toBe(true);
    });

    it('should create expected number of source files', async () => {
      // Given: Configuration with specific file count
      const config = {
        baseDir: testDir,
        issueCount: 50,
        componentCount: 5,
        sourceFileCount: 25,
      };

      // When: Creating the project
      await createLargeProject(config);

      // Then: Count source files
      let fileCount = 0;
      for (let c = 0; c < config.componentCount; c++) {
        const componentDir = path.join(testDir, 'src', `component-${c}`);
        if (fs.existsSync(componentDir)) {
          const files = fs.readdirSync(componentDir);
          fileCount += files.filter((f) => f.endsWith('.ts')).length;
        }
      }

      // Should have approximately the expected file count
      expect(fileCount).toBeGreaterThanOrEqual(config.sourceFileCount);
    });
  });

  describe('GitHub Mock Under Load', () => {
    let githubMock: GitHubMock;

    beforeEach(async () => {
      githubMock = createTestGitHubMock();
      await githubMock.start();
    });

    afterEach(async () => {
      await githubMock.stop();
    });

    it('should handle multiple rapid requests', async () => {
      // Given: Multiple issues to create
      const issueCount = 50;
      const results: boolean[] = [];

      // When: Creating issues rapidly
      const promises = Array.from({ length: issueCount }, async (_, i) => {
        const response = await fetch(
          `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Issue ${i + 1}`,
              body: `Body for issue ${i + 1}`,
            }),
          }
        );
        return response.status === 201;
      });

      const allResults = await Promise.all(promises);

      // Then: All requests should succeed
      expect(allResults.every((r) => r)).toBe(true);
    });

    it('should handle failure simulation during high load', async () => {
      // Given: Simulated failures for first 5 requests
      githubMock.simulateFailure('create_issue', {
        times: 5,
        statusCode: 503,
        errorMessage: 'Service temporarily unavailable',
      });

      // When: Making requests
      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        const response = await fetch(
          `${githubMock.getBaseUrl()}/repos/test/repo/issues`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Issue ${i + 1}`,
              body: `Body for issue ${i + 1}`,
            }),
          }
        );
        results.push(response.status);
      }

      // Then: First 5 should fail, rest should succeed
      expect(results.slice(0, 5).every((s) => s === 503)).toBe(true);
      expect(results.slice(5).every((s) => s === 201)).toBe(true);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should track memory during issue processing', () => {
      // Given: Initial memory state
      const initialMemory = process.memoryUsage();

      // When: Processing large data sets
      const largeIssues: SimulatedIssue[] = [];
      for (let batch = 0; batch < 10; batch++) {
        const batchIssues = generateLargeIssueSet(50);
        largeIssues.push(...batchIssues);
      }

      // Then: Memory should be within limits
      const finalMemory = process.memoryUsage();
      const heapGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      // Allow reasonable memory growth for 500 issues
      expect(heapGrowthMB).toBeLessThan(100);

      // Clean up
      largeIssues.length = 0;
    });

    it('should not leak memory in repeated operations', () => {
      // Given: Memory baseline after warmup
      generateLargeIssueSet(10); // Warmup
      global.gc?.(); // Trigger GC if available
      const baselineMemory = process.memoryUsage().heapUsed;

      // When: Performing repeated operations
      for (let i = 0; i < 5; i++) {
        const issues = generateLargeIssueSet(50);
        // Process and discard
        const _processed = issues.map((issue) => ({
          ...issue,
          processed: true,
        }));
      }

      global.gc?.(); // Trigger GC if available

      // Then: Memory should return near baseline
      const finalMemory = process.memoryUsage().heapUsed;
      const growthMB = (finalMemory - baselineMemory) / (1024 * 1024);

      // Allow some growth but not unbounded
      expect(growthMB).toBeLessThan(50);
    });
  });

  describe('Concurrent Operation Handling', () => {
    it('should handle concurrent issue generation', async () => {
      // Given: Multiple concurrent generation requests
      const concurrentCount = 5;
      const issuesPerRequest = 20;

      // When: Generating concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        Array.from({ length: concurrentCount }, () =>
          Promise.resolve(generateLargeIssueSet(issuesPerRequest))
        )
      );
      const duration = Date.now() - startTime;

      // Then: All should complete successfully
      expect(results.length).toBe(concurrentCount);
      expect(results.every((r) => r.length === issuesPerRequest)).toBe(true);

      // And: Should complete quickly (parallel benefit)
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain data isolation between concurrent operations', async () => {
      // Given: Two concurrent large issue generations
      const [issues1, issues2] = await Promise.all([
        Promise.resolve(generateLargeIssueSet(50)),
        Promise.resolve(generateLargeIssueSet(50)),
      ]);

      // Then: Each should have unique data
      expect(issues1.length).toBe(50);
      expect(issues2.length).toBe(50);

      // Issue numbers should be sequential within each set
      expect(issues1[0].number).toBe(1);
      expect(issues2[0].number).toBe(1);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should generate 100 issues within 1 second', () => {
      const startTime = Date.now();
      const issues = generateLargeIssueSet(100);
      const duration = Date.now() - startTime;

      expect(issues.length).toBe(100);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle dependency graph traversal efficiently', () => {
      // Given: A large issue set with dependencies
      const issues = generateLargeIssueSet(100);

      // When: Building dependency graph
      const startTime = Date.now();
      const dependencyMap = new Map<number, Set<number>>();

      for (const issue of issues) {
        dependencyMap.set(issue.number, new Set(issue.dependencies));
      }

      // Traverse graph to find root issues (no dependencies)
      const rootIssues = issues.filter(
        (issue) => issue.dependencies.length === 0
      );

      // Find leaf issues (nothing depends on them)
      const dependedOn = new Set<number>();
      for (const deps of dependencyMap.values()) {
        for (const dep of deps) {
          dependedOn.add(dep);
        }
      }
      const leafIssues = issues.filter(
        (issue) => !dependedOn.has(issue.number)
      );

      const duration = Date.now() - startTime;

      // Then: Should complete quickly
      expect(duration).toBeLessThan(100);
      expect(rootIssues.length).toBeGreaterThan(0);
      expect(leafIssues.length).toBeGreaterThan(0);
    });

    it('should filter issues by priority efficiently', () => {
      // Given: A large issue set
      const issues = generateLargeIssueSet(500);

      // When: Filtering by priority
      const startTime = Date.now();
      const p0Issues = issues.filter((i) => i.priority === 'P0');
      const p1Issues = issues.filter((i) => i.priority === 'P1');
      const p2Issues = issues.filter((i) => i.priority === 'P2');
      const p3Issues = issues.filter((i) => i.priority === 'P3');
      const duration = Date.now() - startTime;

      // Then: Should complete quickly
      expect(duration).toBeLessThan(50);
      expect(p0Issues.length + p1Issues.length + p2Issues.length + p3Issues.length).toBe(500);
    });
  });
});
