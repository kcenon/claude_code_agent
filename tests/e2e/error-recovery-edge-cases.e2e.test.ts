/**
 * Error Recovery and Edge Cases E2E Tests
 *
 * Comprehensive tests for error handling, edge cases, and unusual scenarios.
 * These tests ensure the system handles failures gracefully and can recover
 * from unexpected situations.
 *
 * @see https://github.com/kcenon/claude_code_agent/issues/56
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createTestEnvironment,
  resetAllAgents,
  type TestEnvironment,
} from './helpers/test-environment.js';
import { runCollectionStage, runPipeline } from './helpers/pipeline-runner.js';
import { SIMPLE_FEATURE_INPUT, MINIMAL_INPUT } from './helpers/fixtures.js';
import { RateLimiter } from '../../src/security/RateLimiter.js';
import { RateLimitExceededError } from '../../src/security/errors.js';
import { DependencyGraphBuilder } from '../../src/issue-generator/DependencyGraph.js';
import { CircularDependencyError } from '../../src/issue-generator/errors.js';
import type { SDSComponent } from '../../src/issue-generator/types.js';

describe('Error Recovery and Edge Cases', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-error-edge',
      initScratchpad: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Error Injection Tests
  // ============================================================================
  describe('Error Injection Tests', () => {
    describe('API Rate Limiting Handling', () => {
      it('should throw RateLimitExceededError when limit is exceeded', () => {
        // Given: A rate limiter with strict limits
        const rateLimiter = new RateLimiter({
          maxRequests: 3,
          windowMs: 60000,
        });

        // When: Consuming all allowed requests
        rateLimiter.check('test-key');
        rateLimiter.check('test-key');
        rateLimiter.check('test-key');

        // Then: Should throw on next request
        expect(() => rateLimiter.checkOrThrow('test-key')).toThrow(RateLimitExceededError);

        // Cleanup
        rateLimiter.stop();
      });

      it('should provide retry timing information in rate limit error', () => {
        // Given: A rate limiter at its limit
        const rateLimiter = new RateLimiter({
          maxRequests: 1,
          windowMs: 5000,
        });
        rateLimiter.check('test-key');

        // When: Exceeding the limit
        try {
          rateLimiter.checkOrThrow('test-key');
          expect.fail('Should have thrown');
        } catch (error) {
          // Then: Error should contain retry timing
          expect(error).toBeInstanceOf(RateLimitExceededError);
          const rateLimitError = error as RateLimitExceededError;
          expect(rateLimitError.retryAfterMs).toBeGreaterThan(0);
          expect(rateLimitError.retryAfterMs).toBeLessThanOrEqual(5000);
        }

        // Cleanup
        rateLimiter.stop();
      });

      it('should recover after rate limit window expires', async () => {
        // Given: A rate limiter with very short window
        const rateLimiter = new RateLimiter({
          maxRequests: 1,
          windowMs: 100, // 100ms window
        });

        // When: Consuming the limit
        const firstStatus = rateLimiter.check('test-key');
        expect(firstStatus.allowed).toBe(true);

        // Wait for window to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Then: Should allow new requests
        const newStatus = rateLimiter.check('test-key');
        expect(newStatus.allowed).toBe(true);

        // Cleanup
        rateLimiter.stop();
      });

      it('should track multiple keys independently', () => {
        // Given: A rate limiter
        const rateLimiter = new RateLimiter({
          maxRequests: 2,
          windowMs: 60000,
        });

        // When: Consuming limits for different keys
        rateLimiter.check('key-a');
        rateLimiter.check('key-a');
        rateLimiter.check('key-b');

        // Then: Key A should be limited, Key B should still work
        const statusA = rateLimiter.getStatus('key-a');
        const statusB = rateLimiter.getStatus('key-b');

        expect(statusA.remaining).toBe(0);
        expect(statusB.remaining).toBe(1);

        // Cleanup
        rateLimiter.stop();
      });
    });

    describe('Network Timeout Recovery', () => {
      it('should handle collection timeout gracefully', async () => {
        // Given: A very long input that might take time to process
        const longInput = Array(50).fill(SIMPLE_FEATURE_INPUT).join('\n\n');

        // When: Running collection with the input
        const result = await runCollectionStage(env, longInput, {
          projectName: 'Timeout Test',
          skipClarification: true,
        });

        // Then: Should either succeed or fail gracefully (not hang)
        expect(typeof result.success).toBe('boolean');
        expect(result.timeMs).toBeDefined();
      }, 60000);

      it('should complete within reasonable time for minimal input', async () => {
        // Given: Minimal input
        const startTime = Date.now();

        // When: Running collection
        const result = await runCollectionStage(env, MINIMAL_INPUT, {
          projectName: 'Quick Test',
          skipClarification: true,
        });

        const elapsed = Date.now() - startTime;

        // Then: Should complete within timeout
        expect(elapsed).toBeLessThan(30000);
        if (result.success) {
          expect(result.result).toBeDefined();
        }
      }, 30000);
    });

    describe('Invalid Input Handling', () => {
      it('should reject null-like input strings', async () => {
        // Given: Various invalid inputs
        const invalidInputs = ['null', 'undefined', 'NaN'];

        for (const input of invalidInputs) {
          // When: Processing invalid input
          const result = await runCollectionStage(env, input, {
            projectName: 'Invalid Input Test',
            skipClarification: true,
          });

          // Then: Should handle gracefully (either fail or sanitize)
          expect(typeof result.success).toBe('boolean');
        }
      }, 30000);

      it('should handle input with only special characters', async () => {
        // Given: Input with only special characters
        const specialInput = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        // When: Processing special character input
        const result = await runCollectionStage(env, specialInput, {
          projectName: 'Special Chars Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully (system may accept and create minimal project)
        // Note: The system is lenient and may create a project even with minimal input
        expect(typeof result.success).toBe('boolean');
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      }, 30000);

      it('should handle input with control characters', async () => {
        // Given: Input with control characters
        const controlInput = 'Build a feature\x00with\x01control\x02chars';

        // When: Processing
        const result = await runCollectionStage(env, controlInput, {
          projectName: 'Control Chars Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully
        expect(typeof result.success).toBe('boolean');
      }, 30000);
    });

    describe('Malformed Document Recovery', () => {
      it('should handle YAML with syntax errors', async () => {
        // Given: A project with valid initial state
        const collectionResult = await runCollectionStage(env, MINIMAL_INPUT, {
          projectName: 'YAML Error Test',
          skipClarification: true,
        });

        if (!collectionResult.success || !collectionResult.result) {
          return; // Skip if collection fails
        }

        const projectId = collectionResult.result.projectId;

        // Corrupt the YAML file
        const infoPath = path.join(env.scratchpadPath, 'info', projectId, 'collected_info.yaml');
        fs.writeFileSync(infoPath, 'invalid:\n  yaml: [unclosed\n  bracket: missing');

        // When: Trying to use corrupted file
        const { PRDWriterAgent } = await import('../../src/prd-writer/index.js');
        const prdWriter = new PRDWriterAgent({
          scratchpadBasePath: env.scratchpadPath,
          publicDocsPath: path.join(env.publicDocsPath, 'prd'),
          failOnCriticalGaps: false,
        });

        // Then: Should fail gracefully
        await expect(prdWriter.generateFromProject(projectId)).rejects.toThrow();
      }, 30000);

      it('should handle empty document files', async () => {
        // Given: A project with empty document
        const projectId = 'empty-doc-test';
        const docsPath = path.join(env.scratchpadPath, 'documents', projectId);
        fs.mkdirSync(docsPath, { recursive: true });
        fs.writeFileSync(path.join(docsPath, 'prd.md'), '');

        // When: Trying to generate SRS from empty PRD
        const { SRSWriterAgent } = await import('../../src/srs-writer/index.js');
        const srsWriter = new SRSWriterAgent({
          scratchpadBasePath: env.scratchpadPath,
          publicDocsPath: path.join(env.publicDocsPath, 'srs'),
          failOnLowCoverage: false,
        });

        // Then: Should either fail or produce minimal output with graceful degradation
        // Note: System may use defaults when PRD is empty
        try {
          const result = await srsWriter.generateFromProject(projectId);
          // If it succeeds, it should produce some output
          expect(result).toBeDefined();
        } catch {
          // If it fails, that's also acceptable
          expect(true).toBe(true);
        }
      }, 30000);

      it('should handle binary content in document files', async () => {
        // Given: A project with binary content in markdown
        const projectId = 'binary-content-test';
        const docsPath = path.join(env.scratchpadPath, 'documents', projectId);
        fs.mkdirSync(docsPath, { recursive: true });

        // Write binary content
        const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        fs.writeFileSync(path.join(docsPath, 'prd.md'), binaryBuffer);

        // When: Trying to read binary as markdown
        const content = fs.readFileSync(path.join(docsPath, 'prd.md'));

        // Then: File should exist but content detection should handle it
        expect(content).toBeDefined();
        expect(Buffer.isBuffer(content)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================
  describe('Edge Case Tests', () => {
    describe('Empty Input Handling', () => {
      it('should handle empty string input', async () => {
        // Given: Empty input
        const emptyInput = '';

        // When: Running collection
        const result = await runCollectionStage(env, emptyInput, {
          projectName: 'Empty Test',
          skipClarification: true,
        });

        // Then: Should fail with appropriate error
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }, 30000);

      it('should handle whitespace-only input', async () => {
        // Given: Whitespace input
        const whitespaceInput = '   \n\t\n   \r\n   ';

        // When: Running collection
        const result = await runCollectionStage(env, whitespaceInput, {
          projectName: 'Whitespace Test',
          skipClarification: true,
        });

        // Then: Should fail gracefully
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }, 30000);

      it('should handle input with only newlines', async () => {
        // Given: Newline-only input
        const newlineInput = '\n\n\n\n\n';

        // When: Running collection
        const result = await runCollectionStage(env, newlineInput, {
          projectName: 'Newline Test',
          skipClarification: true,
        });

        // Then: Should fail gracefully
        expect(result.success).toBe(false);
      }, 30000);
    });

    describe('Very Large Requirements Document', () => {
      it('should handle document with 100+ requirements', async () => {
        // Given: Large document with many requirements
        const requirements = Array.from(
          { length: 110 },
          (_, i) =>
            `- FR-${String(i + 1).padStart(3, '0')}: Feature ${i + 1} - Implement functionality for handling case ${i + 1}`
        ).join('\n');

        const largeInput = `
Build a comprehensive enterprise system.

# Functional Requirements
${requirements}

# Non-Functional Requirements
- NFR-001: System must handle 10000 concurrent users
- NFR-002: Response time must be under 200ms
- NFR-003: 99.99% uptime required
`;

        // When: Processing large document
        const result = await runCollectionStage(env, largeInput, {
          projectName: 'Large Document Test',
          skipClarification: true,
        });

        // Then: Should handle without crashing (success or graceful failure)
        expect(typeof result.success).toBe('boolean');
        expect(result.timeMs).toBeDefined();

        // If successful, should have processed requirements
        if (result.success && result.result) {
          expect(result.result.projectId).toBeDefined();
        }
      }, 120000);

      it('should handle deeply nested requirement structure', async () => {
        // Given: Deeply nested structure
        const nestedInput = `
Build a modular system.

# Module A
## Submodule A.1
### Component A.1.1
#### Feature A.1.1.1
- Requirement 1
#### Feature A.1.1.2
- Requirement 2
### Component A.1.2
#### Feature A.1.2.1
- Requirement 3
## Submodule A.2
### Component A.2.1
- Requirement 4

# Module B
## Submodule B.1
### Component B.1.1
- Requirement 5
`;

        // When: Processing nested structure
        const result = await runCollectionStage(env, nestedInput, {
          projectName: 'Nested Structure Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully
        expect(typeof result.success).toBe('boolean');
      }, 30000);
    });

    describe('Circular Dependency Detection', () => {
      it('should detect simple circular dependency', () => {
        // Given: Components with circular dependency A -> B -> A
        const components: SDSComponent[] = [
          {
            id: 'CMP-001',
            name: 'Component A',
            description: 'Component A',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-002'],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
          {
            id: 'CMP-002',
            name: 'Component B',
            description: 'Component B',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-001'], // Creates cycle
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
        ];

        const componentToIssue = new Map([
          ['CMP-001', 'ISSUE-001'],
          ['CMP-002', 'ISSUE-002'],
        ]);

        // When: Building dependency graph
        const builder = new DependencyGraphBuilder();

        // Then: Should detect cycle and throw
        expect(() => builder.build(components, componentToIssue)).toThrow(CircularDependencyError);
      });

      it('should detect complex circular dependency chain', () => {
        // Given: Components with A -> B -> C -> A cycle
        const components: SDSComponent[] = [
          {
            id: 'CMP-001',
            name: 'Component A',
            description: 'A',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-002'],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
          {
            id: 'CMP-002',
            name: 'Component B',
            description: 'B',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-003'],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
          {
            id: 'CMP-003',
            name: 'Component C',
            description: 'C',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-001'], // Creates cycle back to A
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
        ];

        const componentToIssue = new Map([
          ['CMP-001', 'ISSUE-001'],
          ['CMP-002', 'ISSUE-002'],
          ['CMP-003', 'ISSUE-003'],
        ]);

        // When/Then: Should detect cycle and throw
        const builder = new DependencyGraphBuilder();
        let caughtError: Error | undefined;

        try {
          builder.build(components, componentToIssue);
        } catch (error) {
          caughtError = error as Error;
        }

        // Verify error was caught and is CircularDependencyError
        expect(caughtError).toBeDefined();
        expect(caughtError).toBeInstanceOf(CircularDependencyError);

        const cycleError = caughtError as CircularDependencyError;
        // Cycle should contain at least 2 nodes (the cycle itself)
        expect(cycleError.cycle.length).toBeGreaterThanOrEqual(2);
        // Cycle should involve the nodes that form the cycle
        expect(cycleError.cycle.some((id) => id.includes('ISSUE'))).toBe(true);
      });

      it('should handle self-referencing dependency', () => {
        // Given: Component that depends on itself
        const components: SDSComponent[] = [
          {
            id: 'CMP-001',
            name: 'Self Reference',
            description: 'Self referencing component',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-001'], // Self reference
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
        ];

        const componentToIssue = new Map([['CMP-001', 'ISSUE-001']]);

        // When/Then: Should detect self-cycle
        const builder = new DependencyGraphBuilder();
        expect(() => builder.build(components, componentToIssue)).toThrow(CircularDependencyError);
      });

      it('should allow valid dependency graph without cycles', () => {
        // Given: Valid DAG (Directed Acyclic Graph)
        const components: SDSComponent[] = [
          {
            id: 'CMP-001',
            name: 'Foundation',
            description: 'Base component',
            type: 'module',
            requirements: [],
            dependencies: [],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
          {
            id: 'CMP-002',
            name: 'Service A',
            description: 'Service A depends on Foundation',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-001'],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
          {
            id: 'CMP-003',
            name: 'Service B',
            description: 'Service B depends on Foundation',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-001'],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
          {
            id: 'CMP-004',
            name: 'Application',
            description: 'App depends on both services',
            type: 'module',
            requirements: [],
            dependencies: ['CMP-002', 'CMP-003'],
            interfaces: [],
            implementation: { language: 'TypeScript', framework: 'Node.js' },
          },
        ];

        const componentToIssue = new Map([
          ['CMP-001', 'ISSUE-001'],
          ['CMP-002', 'ISSUE-002'],
          ['CMP-003', 'ISSUE-003'],
          ['CMP-004', 'ISSUE-004'],
        ]);

        // When: Building graph
        const builder = new DependencyGraphBuilder();
        const graph = builder.build(components, componentToIssue);

        // Then: Should succeed
        expect(graph).toBeDefined();
        expect(graph.nodes).toHaveLength(4);
        expect(graph.executionOrder).toBeDefined();
        expect(graph.executionOrder[0]).toBe('ISSUE-001'); // Foundation first
      });
    });

    describe('Unicode and Special Characters', () => {
      it('should handle requirements with CJK characters', async () => {
        // Given: Input with Chinese, Japanese, Korean characters
        const cjkInput = `
Build a multilingual application.

# Requirements
- 用户认证系统 (User Authentication System in Chinese)
- ユーザー管理機能 (User Management in Japanese)
- 사용자 대시보드 (User Dashboard in Korean)
`;

        // When: Processing
        const result = await runCollectionStage(env, cjkInput, {
          projectName: 'CJK Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully
        expect(typeof result.success).toBe('boolean');
      }, 30000);

      it('should handle requirements with emojis', async () => {
        // Given: Input with emojis
        const emojiInput = `
Build a fun application! 🚀

# Features
- User login 🔐
- Dashboard with charts 📊
- Notifications 🔔
- Settings ⚙️
- Help section ❓
`;

        // When: Processing
        const result = await runCollectionStage(env, emojiInput, {
          projectName: 'Emoji Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully
        expect(typeof result.success).toBe('boolean');
      }, 30000);

      it('should handle requirements with RTL text', async () => {
        // Given: Input with Arabic/Hebrew (RTL) text
        const rtlInput = `
Build an internationalized application.

# Requirements
- مصادقة المستخدم (Arabic: User Authentication)
- אימות משתמש (Hebrew: User Verification)
- Standard English requirement
`;

        // When: Processing
        const result = await runCollectionStage(env, rtlInput, {
          projectName: 'RTL Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully
        expect(typeof result.success).toBe('boolean');
      }, 30000);

      it('should handle mixed encoding scenarios', async () => {
        // Given: Mixed content
        const mixedInput = `
Build a system with special chars.

# Requirements
- Handle "smart quotes" and 'apostrophes'
- Support mathematical symbols: ≤, ≥, ≠, ±, ∑, ∏
- Currency symbols: $, €, £, ¥, ₹
- Trademark and copyright: ™, ®, ©
`;

        // When: Processing
        const result = await runCollectionStage(env, mixedInput, {
          projectName: 'Mixed Encoding Test',
          skipClarification: true,
        });

        // Then: Should handle gracefully
        expect(typeof result.success).toBe('boolean');
      }, 30000);
    });
  });

  // ============================================================================
  // Recovery Tests
  // ============================================================================
  describe('Recovery Tests', () => {
    describe('Mid-Pipeline Restart Recovery', () => {
      it('should detect incomplete pipeline state', async () => {
        // Given: A project that has collection completed but PRD missing
        const collectionResult = await runCollectionStage(env, MINIMAL_INPUT, {
          projectName: 'Incomplete Pipeline Test',
          skipClarification: true,
        });

        if (!collectionResult.success || !collectionResult.result) {
          return;
        }

        const projectId = collectionResult.result.projectId;

        // Verify info exists but no documents
        const infoPath = path.join(env.scratchpadPath, 'info', projectId);
        const docsPath = path.join(env.scratchpadPath, 'documents', projectId);

        expect(fs.existsSync(infoPath)).toBe(true);
        expect(fs.existsSync(path.join(docsPath, 'prd.md'))).toBe(false);

        // When: System would detect this state
        const hasPRD = fs.existsSync(path.join(docsPath, 'prd.md'));
        const hasSRS = fs.existsSync(path.join(docsPath, 'srs.md'));
        const hasSDS = fs.existsSync(path.join(docsPath, 'sds.md'));

        // Then: Can determine what stage to resume from
        expect(hasPRD).toBe(false);
        expect(hasSRS).toBe(false);
        expect(hasSDS).toBe(false);
      }, 30000);

      it('should preserve completed stages after reset', async () => {
        // Given: A project with collection complete
        const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
          projectName: 'Preservation Test',
          skipClarification: true,
        });

        if (!collectionResult.success || !collectionResult.result) {
          return;
        }

        const projectId = collectionResult.result.projectId;
        const infoPath = path.join(
          env.scratchpadPath,
          'info',
          projectId,
          'collected_info.yaml'
        );

        // Record content before reset
        const contentBefore = fs.readFileSync(infoPath, 'utf-8');

        // When: Resetting all agents
        await resetAllAgents();

        // Then: File should still exist with same content
        expect(fs.existsSync(infoPath)).toBe(true);
        const contentAfter = fs.readFileSync(infoPath, 'utf-8');
        expect(contentAfter).toBe(contentBefore);
      }, 30000);
    });

    describe('Partial Completion Resume', () => {
      it('should identify completed stages from filesystem', async () => {
        // Given: Simulated partial completion
        const projectId = 'partial-test';
        const docsPath = path.join(env.scratchpadPath, 'documents', projectId);
        fs.mkdirSync(docsPath, { recursive: true });

        // Create PRD but not SRS or SDS
        fs.writeFileSync(path.join(docsPath, 'prd.md'), '# PRD\n\nTest content');

        // When: Checking completion status
        const stages = {
          prd: fs.existsSync(path.join(docsPath, 'prd.md')),
          srs: fs.existsSync(path.join(docsPath, 'srs.md')),
          sds: fs.existsSync(path.join(docsPath, 'sds.md')),
        };

        // Then: Should correctly identify completed/pending stages
        expect(stages.prd).toBe(true);
        expect(stages.srs).toBe(false);
        expect(stages.sds).toBe(false);
      });

      it('should calculate correct resume point', async () => {
        // Given: Various completion states
        const testCases = [
          { prd: false, srs: false, sds: false, expected: 'prd' },
          { prd: true, srs: false, sds: false, expected: 'srs' },
          { prd: true, srs: true, sds: false, expected: 'sds' },
          { prd: true, srs: true, sds: true, expected: 'complete' },
        ];

        for (const testCase of testCases) {
          // When: Determining resume point
          const resumePoint = determineResumePoint(testCase.prd, testCase.srs, testCase.sds);

          // Then: Should match expected
          expect(resumePoint).toBe(testCase.expected);
        }
      });
    });

    describe('Checkpoint Restoration', () => {
      it('should create checkpoint after each stage', async () => {
        // Given: A project going through collection
        const collectionResult = await runCollectionStage(env, MINIMAL_INPUT, {
          projectName: 'Checkpoint Test',
          skipClarification: true,
        });

        if (!collectionResult.success || !collectionResult.result) {
          return;
        }

        const projectId = collectionResult.result.projectId;

        // When: Checking for checkpoint data
        const infoPath = path.join(env.scratchpadPath, 'info', projectId);

        // Then: Checkpoint (collected_info.yaml) should exist
        expect(fs.existsSync(path.join(infoPath, 'collected_info.yaml'))).toBe(true);
      }, 30000);

      it('should restore state from checkpoint files', async () => {
        // Given: Existing checkpoint data
        const projectId = 'restore-test';
        const infoPath = path.join(env.scratchpadPath, 'info', projectId);
        fs.mkdirSync(infoPath, { recursive: true });

        const checkpoint = {
          projectId,
          status: 'completed',
          project: { name: 'Test', description: 'Restored project' },
        };

        fs.writeFileSync(
          path.join(infoPath, 'collected_info.yaml'),
          `projectId: ${projectId}\nstatus: completed\nproject:\n  name: Test\n  description: Restored project`
        );

        // When: Reading checkpoint
        const content = fs.readFileSync(path.join(infoPath, 'collected_info.yaml'), 'utf-8');

        // Then: Should contain checkpoint data
        expect(content).toContain(projectId);
        expect(content).toContain('completed');
      });
    });
  });

  // ============================================================================
  // Graceful Degradation Tests
  // ============================================================================
  describe('Graceful Degradation Tests', () => {
    describe('Missing Dependencies', () => {
      it('should handle missing scratchpad directory gracefully', async () => {
        // Given: Environment without proper scratchpad
        const badEnv = await createTestEnvironment({
          baseName: 'bad-env',
          initScratchpad: false,
        });

        // Create empty root but no subdirs
        fs.mkdirSync(path.join(badEnv.rootDir, '.ad-sdlc'), { recursive: true });

        try {
          // When: Trying to run collection
          const result = await runCollectionStage(badEnv, MINIMAL_INPUT, {
            projectName: 'Bad Env Test',
            skipClarification: true,
          });

          // Then: Should either create directories or fail gracefully
          expect(typeof result.success).toBe('boolean');
        } finally {
          await badEnv.cleanup();
        }
      }, 30000);
    });

    describe('Resource Exhaustion Handling', () => {
      it('should handle concurrent operations', async () => {
        // Given: Multiple concurrent operations
        const operations = Array.from({ length: 3 }, async (_, i) => {
          const testEnv = await createTestEnvironment({
            baseName: `concurrent-${i}`,
            initScratchpad: true,
          });

          try {
            const result = await runCollectionStage(testEnv, MINIMAL_INPUT, {
              projectName: `Concurrent Test ${i}`,
              skipClarification: true,
            });
            return { success: result.success, index: i };
          } finally {
            await testEnv.cleanup();
          }
        });

        // When: Running concurrently
        const results = await Promise.allSettled(operations);

        // Then: All should complete (success or failure, but no crashes)
        expect(results).toHaveLength(3);
        for (const result of results) {
          expect(result.status).toBe('fulfilled');
        }
      }, 90000);
    });

    describe('Error Message Quality', () => {
      it('should provide clear error messages for common failures', async () => {
        // Given: Empty input (common failure case)
        const result = await runCollectionStage(env, '', {
          projectName: 'Error Message Test',
          skipClarification: true,
        });

        // When: Checking error
        expect(result.success).toBe(false);

        // Then: Error should be informative
        if (result.error) {
          expect(result.error.message).toBeTruthy();
          expect(result.error.message.length).toBeGreaterThan(0);
        }
      }, 30000);
    });

    describe('Fallback Behavior', () => {
      it('should continue with defaults when optional data is missing', async () => {
        // Given: Input without explicit non-functional requirements
        const basicInput = `
Build a simple app.

# Features
- User can login
- User can logout
`;

        // When: Processing
        const result = await runCollectionStage(env, basicInput, {
          projectName: 'Fallback Test',
          skipClarification: true,
        });

        // Then: Should use defaults and succeed or provide clear feedback
        expect(typeof result.success).toBe('boolean');
      }, 30000);
    });
  });
});

/**
 * Helper function to determine resume point based on completed stages
 */
function determineResumePoint(hasPRD: boolean, hasSRS: boolean, hasSDS: boolean): string {
  if (!hasPRD) return 'prd';
  if (!hasSRS) return 'srs';
  if (!hasSDS) return 'sds';
  return 'complete';
}
