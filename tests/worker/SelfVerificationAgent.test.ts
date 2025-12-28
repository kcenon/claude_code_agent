import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  SelfVerificationAgent,
  DEFAULT_SELF_VERIFICATION_CONFIG,
  EscalationRequiredError,
  CommandTimeoutError,
} from '../../src/worker/index.js';
import type {
  SelfVerificationConfig,
  VerificationStep,
  VerificationReport,
} from '../../src/worker/index.js';

const execAsync = promisify(exec);

describe('SelfVerificationAgent', () => {
  let agent: SelfVerificationAgent;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `self-verification-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create package.json for npm commands
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'echo "Tests passed"',
          lint: 'echo "Lint passed"',
          build: 'echo "Build passed"',
          typecheck: 'echo "Typecheck passed"',
        },
      })
    );

    agent = new SelfVerificationAgent({
      projectRoot: testDir,
      typecheckCommand: 'npm run typecheck',
    });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new SelfVerificationAgent();
      const config = defaultAgent.getConfig();

      expect(config.maxFixIterations).toBe(DEFAULT_SELF_VERIFICATION_CONFIG.maxFixIterations);
      expect(config.testCommand).toBe(DEFAULT_SELF_VERIFICATION_CONFIG.testCommand);
      expect(config.lintCommand).toBe(DEFAULT_SELF_VERIFICATION_CONFIG.lintCommand);
      expect(config.buildCommand).toBe(DEFAULT_SELF_VERIFICATION_CONFIG.buildCommand);
      expect(config.typecheckCommand).toBe(DEFAULT_SELF_VERIFICATION_CONFIG.typecheckCommand);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: SelfVerificationConfig = {
        maxFixIterations: 5,
        testCommand: 'npm run test:custom',
        autoFixLint: false,
        commandTimeout: 60000,
      };

      const customAgent = new SelfVerificationAgent(customConfig);
      const config = customAgent.getConfig();

      expect(config.maxFixIterations).toBe(5);
      expect(config.testCommand).toBe('npm run test:custom');
      expect(config.autoFixLint).toBe(false);
      expect(config.commandTimeout).toBe(60000);
    });

    it('should have empty fix attempts initially', () => {
      expect(agent.getFixAttempts()).toHaveLength(0);
    });

    it('should have empty step results initially', () => {
      expect(agent.getStepResults().size).toBe(0);
    });
  });

  describe('runStep', () => {
    it('should run test step and return passed result', async () => {
      const result = await agent.runStep('test');

      expect(result.step).toBe('test');
      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should run lint step and return passed result', async () => {
      const result = await agent.runStep('lint');

      expect(result.step).toBe('lint');
      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should run build step and return passed result', async () => {
      const result = await agent.runStep('build');

      expect(result.step).toBe('build');
      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should run typecheck step and return passed result', async () => {
      const result = await agent.runStep('typecheck');

      expect(result.step).toBe('typecheck');
      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should return failed result for failing command', async () => {
      // Update package.json to have failing test
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'exit 1',
            lint: 'echo "Lint passed"',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const result = await agent.runStep('test');

      expect(result.step).toBe('test');
      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('runVerificationPipeline', () => {
    it('should run all steps and return passed report', async () => {
      const report = await agent.runVerificationPipeline('task-001');

      expect(report.taskId).toBe('task-001');
      expect(report.finalStatus).toBe('passed');
      expect(report.results.tests?.passed).toBe(true);
      expect(report.results.lint?.passed).toBe(true);
      expect(report.results.build?.passed).toBe(true);
      expect(report.results.typecheck?.passed).toBe(true);
      expect(report.totalDurationMs).toBeGreaterThan(0);
    });

    it('should run only specified steps', async () => {
      const customAgent = new SelfVerificationAgent({
        projectRoot: testDir,
        stepsToRun: ['test', 'lint'],
      });

      const report = await customAgent.runVerificationPipeline('task-002');

      expect(report.results.tests?.passed).toBe(true);
      expect(report.results.lint?.passed).toBe(true);
      expect(report.results.build).toBeNull();
      expect(report.results.typecheck).toBeNull();
    });

    it('should stop on first failure when continueOnFailure is false', async () => {
      // Update package.json to have failing lint
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'echo "Tests passed"',
            lint: 'exit 1',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const customAgent = new SelfVerificationAgent({
        projectRoot: testDir,
        continueOnFailure: false,
        maxFixIterations: 0, // Disable fixes to fail immediately
      });

      await expect(customAgent.runVerificationPipeline('task-003')).rejects.toThrow(
        EscalationRequiredError
      );
    });

    it('should continue on failure when continueOnFailure is true', async () => {
      // Update package.json to have failing lint but passing others
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'echo "Tests passed"',
            lint: 'exit 1',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const customAgent = new SelfVerificationAgent({
        projectRoot: testDir,
        continueOnFailure: true,
        maxFixIterations: 0, // Disable fixes
      });

      await expect(customAgent.runVerificationPipeline('task-004')).rejects.toThrow(
        EscalationRequiredError
      );
    });
  });

  describe('parseErrors', () => {
    it('should parse TypeScript errors', () => {
      const output = `src/index.ts(10,5): error TS2345: Argument of type 'string' is not assignable.
src/utils.ts(25,10): error TS2304: Cannot find name 'foo'.
src/types.ts(5,1): warning TS6133: 'x' is declared but never used.`;

      const errors = agent.parseErrors('typecheck', output);

      expect(errors).toHaveLength(3);
      expect(errors[0]).toMatchObject({
        type: 'typecheck',
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'error',
        code: 'TS2345',
      });
      expect(errors[1]).toMatchObject({
        type: 'typecheck',
        filePath: 'src/utils.ts',
        line: 25,
        column: 10,
        severity: 'error',
        code: 'TS2304',
      });
      expect(errors[2]).toMatchObject({
        type: 'typecheck',
        severity: 'warning',
        code: 'TS6133',
      });
    });

    it('should parse ESLint errors', () => {
      const output = `src/index.ts:10:5: Missing semicolon (semi)
src/utils.ts:25:10: Unexpected console statement (no-console)`;

      const errors = agent.parseErrors('lint', output);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        type: 'lint',
        filePath: 'src/index.ts',
        line: 10,
        column: 5,
        code: 'semi',
        message: 'Missing semicolon',
      });
    });

    it('should parse test failures', () => {
      const output = `FAIL src/index.test.ts
AssertionError: expected 1 to equal 2
Error: Test failed`;

      const errors = agent.parseErrors('test', output);

      expect(errors).toHaveLength(3);
      expect(errors[0]).toMatchObject({
        type: 'test',
        severity: 'error',
        message: 'FAIL src/index.test.ts',
      });
    });

    it('should parse build errors', () => {
      const output = `error: Cannot find module 'missing-package'
ERROR: Build failed`;

      const errors = agent.parseErrors('build', output);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        type: 'build',
        severity: 'error',
      });
    });
  });

  describe('analyzeError', () => {
    it('should suggest lint auto-fix for fixable rules', () => {
      const output = `src/index.ts:10:5: Missing semicolon (semi)`;

      const suggestions = agent.analyzeError('lint', output);

      expect(suggestions.length).toBeGreaterThan(0);
      const autoFix = suggestions.find((s) => s.type === 'auto');
      expect(autoFix).toBeDefined();
      expect(autoFix?.command).toContain('--fix');
    });

    it('should return empty suggestions for test failures', () => {
      const output = `FAIL src/index.test.ts`;

      const suggestions = agent.analyzeError('test', output);

      // Test failures typically need manual intervention
      // We only expect auto-fix suggestions for lint
      const autoFix = suggestions.find((s) => s.type === 'auto');
      expect(autoFix).toBeUndefined();
    });
  });

  describe('allStepsPassed', () => {
    it('should return true when all steps pass', async () => {
      await agent.runVerificationPipeline('task-005');

      expect(agent.allStepsPassed()).toBe(true);
    });

    it('should return false when no steps have been run', () => {
      expect(agent.allStepsPassed()).toBe(false);
    });
  });

  describe('fix attempts', () => {
    it('should attempt fixes when step fails', async () => {
      // Create a package.json with a lint failure that can be "fixed"
      // by running lint --fix (simulated by subsequent runs passing)
      let lintCallCount = 0;

      // Create a script that fails first time, passes second time
      await writeFile(
        join(testDir, 'lint-runner.sh'),
        `#!/bin/bash
if [ -f "${testDir}/lint-ran" ]; then
  echo "Lint passed"
  exit 0
else
  touch "${testDir}/lint-ran"
  echo "1 error"
  exit 1
fi`
      );
      await execAsync(`chmod +x "${testDir}/lint-runner.sh"`);

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'echo "Tests passed"',
            lint: `bash "${testDir}/lint-runner.sh"`,
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const customAgent = new SelfVerificationAgent({
        projectRoot: testDir,
        stepsToRun: ['lint'],
        autoFixLint: true,
      });

      const report = await customAgent.runVerificationPipeline('task-006');

      // The lint should have been attempted, and fixes should have been made
      expect(report.fixAttempts.length).toBeGreaterThan(0);
    });
  });

  describe('escalation', () => {
    it('should throw EscalationRequiredError when fixes fail', async () => {
      // Create a package.json with persistent failure
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'exit 1',
            lint: 'echo "Lint passed"',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const customAgent = new SelfVerificationAgent({
        projectRoot: testDir,
        stepsToRun: ['test'],
        maxFixIterations: 2,
      });

      await expect(customAgent.runVerificationPipeline('task-007')).rejects.toThrow(
        EscalationRequiredError
      );
    });

    it('should include escalation details in error', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'echo "1 failed" && exit 1',
            lint: 'echo "Lint passed"',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const customAgent = new SelfVerificationAgent({
        projectRoot: testDir,
        stepsToRun: ['test'],
        maxFixIterations: 1,
      });

      try {
        await customAgent.runVerificationPipeline('task-008');
        expect.fail('Should have thrown EscalationRequiredError');
      } catch (error) {
        expect(error).toBeInstanceOf(EscalationRequiredError);
        const escalationError = error as EscalationRequiredError;
        expect(escalationError.taskId).toBe('task-008');
        expect(escalationError.failedSteps).toContain('test');
        expect(escalationError.analysis).toBeDefined();
      }
    });
  });

  describe('report generation', () => {
    it('should include test summary in report', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'echo "5 passed, 0 failed, 1 skipped, 85% coverage"',
            lint: 'echo "Lint passed"',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const report = await agent.runVerificationPipeline('task-009');

      expect(report.testSummary).toBeDefined();
      expect(report.testSummary?.passed).toBe(5);
      expect(report.testSummary?.failed).toBe(0);
      expect(report.testSummary?.skipped).toBe(1);
      expect(report.testSummary?.coverage).toBe(85);
    });

    it('should include lint summary in report', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'echo "Tests passed"',
            lint: 'echo "3 errors, 5 warnings"',
            build: 'echo "Build passed"',
            typecheck: 'echo "Typecheck passed"',
          },
        })
      );

      const report = await agent.runVerificationPipeline('task-010');

      expect(report.lintSummary).toBeDefined();
      expect(report.lintSummary?.errors).toBe(3);
      expect(report.lintSummary?.warnings).toBe(5);
    });

    it('should include timestamp in report', async () => {
      const beforeTime = new Date().toISOString();
      const report = await agent.runVerificationPipeline('task-011');
      const afterTime = new Date().toISOString();

      expect(report.timestamp).toBeDefined();
      expect(report.timestamp >= beforeTime).toBe(true);
      expect(report.timestamp <= afterTime).toBe(true);
    });
  });
});
