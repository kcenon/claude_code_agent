/**
 * PRCreator unit tests
 *
 * Tests for UC-014: PR Creation from Completed Work
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PRCreator, DEFAULT_PR_CREATOR_CONFIG } from '../../src/pr-reviewer/PRCreator.js';
import type { ImplementationResult, FileChange } from '../../src/pr-reviewer/types.js';

describe('PRCreator', () => {
  const createMinimalImplementationResult = (
    overrides: Partial<ImplementationResult> = {}
  ): ImplementationResult => ({
    workOrderId: 'WO-001',
    issueId: 'ISS-001-feature',
    githubIssue: 123,
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    changes: [
      {
        filePath: 'src/feature.ts',
        changeType: 'create',
        description: 'New feature implementation',
        linesAdded: 100,
        linesRemoved: 0,
      },
    ],
    tests: {
      filesCreated: ['tests/feature.test.ts'],
      totalTests: 10,
      coveragePercentage: 85,
    },
    verification: {
      testsPassed: true,
      testsOutput: 'All tests passed',
      lintPassed: true,
      lintOutput: 'No lint errors',
      buildPassed: true,
      buildOutput: 'Build successful',
    },
    branch: {
      name: 'feature/ISS-001-feature',
      commits: [{ hash: 'abc123', message: 'feat: implement feature' }],
    },
    ...overrides,
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const creator = new PRCreator();
      const config = creator.getConfig();

      expect(config.projectRoot).toBe(process.cwd());
      expect(config.baseBranch).toBe('main');
      expect(config.enableDraftPR).toBe(true);
      expect(config.draftThreshold).toBe(70);
      expect(config.autoAssignLabels).toBe(true);
    });

    it('should accept custom configuration', () => {
      const creator = new PRCreator({
        projectRoot: '/custom/path',
        baseBranch: 'develop',
        draftThreshold: 90,
      });
      const config = creator.getConfig();

      expect(config.projectRoot).toBe('/custom/path');
      expect(config.baseBranch).toBe('develop');
      expect(config.draftThreshold).toBe(90);
    });

    it('should merge custom config with defaults', () => {
      const creator = new PRCreator({
        enableDraftPR: false,
      });
      const config = creator.getConfig();

      expect(config.enableDraftPR).toBe(false);
      expect(config.baseBranch).toBe('main'); // Default
      expect(config.autoAssignLabels).toBe(true); // Default
    });
  });

  describe('validateBranchNaming', () => {
    let creator: PRCreator;

    beforeEach(() => {
      creator = new PRCreator();
    });

    it('should validate feature branch with issue number', () => {
      const result = creator.validateBranchNaming('feature/ISS-001-implement-login');

      expect(result.valid).toBe(true);
      expect(result.prefix).toBe('feature');
      expect(result.issueNumber).toBe('ISS-001');
      expect(result.description).toBe('implement-login');
    });

    it('should validate fix branch with numeric issue', () => {
      const result = creator.validateBranchNaming('fix/123-fix-null-pointer');

      expect(result.valid).toBe(true);
      expect(result.prefix).toBe('fix');
      expect(result.issueNumber).toBe('123');
      expect(result.description).toBe('fix-null-pointer');
    });

    it('should validate refactor branch', () => {
      const result = creator.validateBranchNaming('refactor/CMP-005-extract-utils');

      expect(result.valid).toBe(true);
      expect(result.prefix).toBe('refactor');
      expect(result.issueNumber).toBe('CMP-005');
    });

    it('should validate branch without issue number', () => {
      const result = creator.validateBranchNaming('docs/update-readme');

      expect(result.valid).toBe(true);
      expect(result.prefix).toBe('docs');
      expect(result.issueNumber).toBeUndefined();
      expect(result.description).toBe('update-readme');
    });

    it('should reject invalid prefix', () => {
      const result = creator.validateBranchNaming('invalid/ISS-001-something');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid prefix');
    });

    it('should reject branch without prefix', () => {
      const result = creator.validateBranchNaming('no-prefix-branch');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must start with a valid prefix');
    });

    it('should validate all valid prefixes', () => {
      const validPrefixes = ['feature', 'fix', 'docs', 'test', 'refactor', 'chore', 'hotfix'];

      for (const prefix of validPrefixes) {
        const result = creator.validateBranchNaming(`${prefix}/some-description`);
        expect(result.valid).toBe(true);
        expect(result.prefix).toBe(prefix);
      }
    });
  });

  describe('inferLabels', () => {
    let creator: PRCreator;

    beforeEach(() => {
      creator = new PRCreator();
    });

    it('should infer labels from branch prefix', () => {
      const changes: FileChange[] = [
        { filePath: 'src/feature.ts', changeType: 'create', description: '', linesAdded: 10, linesRemoved: 0 },
      ];

      const result = creator.inferLabels(changes, 'feature/ISS-001-something');

      expect(result.labels).toContain('enhancement');
      expect(result.reasons.some((r) => r.includes('branch prefix'))).toBe(true);
    });

    it('should infer labels from fix branch', () => {
      const changes: FileChange[] = [
        { filePath: 'src/bugfix.ts', changeType: 'modify', description: '', linesAdded: 5, linesRemoved: 3 },
      ];

      const result = creator.inferLabels(changes, 'fix/ISS-002-null-check');

      expect(result.labels).toContain('bug');
    });

    it('should infer testing label from test files', () => {
      const changes: FileChange[] = [
        { filePath: 'tests/feature.test.ts', changeType: 'create', description: '', linesAdded: 50, linesRemoved: 0 },
      ];

      const result = creator.inferLabels(changes, 'test/ISS-003-add-tests');

      expect(result.labels).toContain('testing');
    });

    it('should infer documentation label from docs files', () => {
      const changes: FileChange[] = [
        { filePath: 'docs/README.md', changeType: 'modify', description: '', linesAdded: 20, linesRemoved: 5 },
      ];

      const result = creator.inferLabels(changes, 'docs/update-docs');

      expect(result.labels).toContain('documentation');
    });

    it('should infer security label from security files', () => {
      const changes: FileChange[] = [
        { filePath: 'src/auth/security.ts', changeType: 'modify', description: '', linesAdded: 30, linesRemoved: 10 },
      ];

      const result = creator.inferLabels(changes, 'feature/ISS-004-auth');

      expect(result.labels).toContain('security');
    });

    it('should infer ci label from workflow files', () => {
      const changes: FileChange[] = [
        { filePath: '.github/workflows/ci.yml', changeType: 'modify', description: '', linesAdded: 10, linesRemoved: 5 },
      ];

      const result = creator.inferLabels(changes, 'chore/update-ci');

      expect(result.labels).toContain('ci');
    });

    it('should infer new-feature label from file creations', () => {
      const changes: FileChange[] = [
        { filePath: 'src/new.ts', changeType: 'create', description: '', linesAdded: 100, linesRemoved: 0 },
        { filePath: 'src/another.ts', changeType: 'create', description: '', linesAdded: 50, linesRemoved: 0 },
      ];

      const result = creator.inferLabels(changes, 'feature/ISS-005-new-feature');

      expect(result.labels).toContain('new-feature');
    });

    it('should infer cleanup label from deletion-only changes', () => {
      const changes: FileChange[] = [
        { filePath: 'src/old.ts', changeType: 'delete', description: '', linesAdded: 0, linesRemoved: 100 },
        { filePath: 'src/deprecated.ts', changeType: 'delete', description: '', linesAdded: 0, linesRemoved: 50 },
      ];

      const result = creator.inferLabels(changes, 'chore/cleanup');

      expect(result.labels).toContain('cleanup');
    });
  });

  describe('shouldBeDraft', () => {
    let creator: PRCreator;

    beforeEach(() => {
      creator = new PRCreator({ draftThreshold: 70 });
    });

    it('should return false when all checks pass and coverage is above threshold', () => {
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 85 },
        verification: { testsPassed: true, testsOutput: '', lintPassed: true, lintOutput: '', buildPassed: true, buildOutput: '' },
      });

      expect(creator.shouldBeDraft(implResult)).toBe(false);
    });

    it('should return true when coverage is below threshold', () => {
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 60 },
        verification: { testsPassed: true, testsOutput: '', lintPassed: true, lintOutput: '', buildPassed: true, buildOutput: '' },
      });

      expect(creator.shouldBeDraft(implResult)).toBe(true);
    });

    it('should return true when tests fail', () => {
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 85 },
        verification: { testsPassed: false, testsOutput: '', lintPassed: true, lintOutput: '', buildPassed: true, buildOutput: '' },
      });

      expect(creator.shouldBeDraft(implResult)).toBe(true);
    });

    it('should return true when lint fails', () => {
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 85 },
        verification: { testsPassed: true, testsOutput: '', lintPassed: false, lintOutput: '', buildPassed: true, buildOutput: '' },
      });

      expect(creator.shouldBeDraft(implResult)).toBe(true);
    });

    it('should return true when build fails', () => {
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 85 },
        verification: { testsPassed: true, testsOutput: '', lintPassed: true, lintOutput: '', buildPassed: false, buildOutput: '' },
      });

      expect(creator.shouldBeDraft(implResult)).toBe(true);
    });

    it('should return true when status is blocked', () => {
      const implResult = createMinimalImplementationResult({
        status: 'blocked',
        blockers: ['API unavailable'],
      });

      expect(creator.shouldBeDraft(implResult)).toBe(true);
    });

    it('should return false when draft PR is disabled', () => {
      const creatorNoDraft = new PRCreator({ enableDraftPR: false });
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 50 }, // Below threshold
      });

      expect(creatorNoDraft.shouldBeDraft(implResult)).toBe(false);
    });
  });

  describe('generatePRContent', () => {
    let creator: PRCreator;

    beforeEach(() => {
      creator = new PRCreator();
    });

    it('should generate PR title with conventional commit format', () => {
      const implResult = createMinimalImplementationResult({
        branch: { name: 'feature/ISS-001-login', commits: [{ hash: 'abc', message: 'feat: add login' }] },
      });

      const content = creator.generatePRContent(implResult, ['enhancement'], false);

      expect(content.title).toMatch(/^feat\([^)]+\):/);
    });

    it('should include issue reference in body', () => {
      const implResult = createMinimalImplementationResult({ githubIssue: 42 });

      const content = creator.generatePRContent(implResult, [], false);

      expect(content.body).toContain('#42');
    });

    it('should include changes in body', () => {
      const implResult = createMinimalImplementationResult({
        changes: [
          { filePath: 'src/feature.ts', changeType: 'create', description: 'New feature', linesAdded: 100, linesRemoved: 0 },
        ],
      });

      const content = creator.generatePRContent(implResult, [], false);

      expect(content.body).toContain('src/feature.ts');
      expect(content.body).toContain('New feature');
    });

    it('should include verification status', () => {
      const implResult = createMinimalImplementationResult({
        verification: { testsPassed: true, testsOutput: '', lintPassed: true, lintOutput: '', buildPassed: false, buildOutput: '' },
      });

      const content = creator.generatePRContent(implResult, [], false);

      expect(content.body).toContain('✅ Passed'); // Tests
      expect(content.body).toContain('❌ Failed'); // Build
    });

    it('should include draft warning when isDraft is true', () => {
      const implResult = createMinimalImplementationResult({
        tests: { filesCreated: [], totalTests: 10, coveragePercentage: 50 },
      });

      const content = creator.generatePRContent(implResult, [], true);

      expect(content.body).toContain('⚠️ **Draft PR**');
    });

    it('should include traceability section', () => {
      const implResult = createMinimalImplementationResult({
        workOrderId: 'WO-123',
        branch: {
          name: 'feature/ISS-001-feature',
          commits: [
            { hash: 'abc1234', message: 'feat: first commit' },
            { hash: 'def5678', message: 'feat: second commit' },
          ],
        },
      });

      const content = creator.generatePRContent(implResult, [], false);

      expect(content.body).toContain('## Traceability');
      expect(content.body).toContain('WO-123');
      expect(content.body).toContain('abc1234'.slice(0, 7));
    });

    it('should include labels section when labels provided', () => {
      const implResult = createMinimalImplementationResult();

      const content = creator.generatePRContent(implResult, ['enhancement', 'testing'], false);

      expect(content.body).toContain('## Labels');
      expect(content.body).toContain('`enhancement`');
      expect(content.body).toContain('`testing`');
    });

    it('should include notes when present', () => {
      const implResult = createMinimalImplementationResult({
        notes: 'Some important implementation notes',
      });

      const content = creator.generatePRContent(implResult, [], false);

      expect(content.body).toContain('## Notes');
      expect(content.body).toContain('Some important implementation notes');
    });

    it('should set draft flag in options when isDraft is true', () => {
      const implResult = createMinimalImplementationResult();

      const content = creator.generatePRContent(implResult, [], true);

      expect(content.draft).toBe(true);
    });

    it('should set correct base and head branches', () => {
      const implResult = createMinimalImplementationResult({
        branch: { name: 'feature/custom-branch', commits: [] },
      });

      const content = creator.generatePRContent(implResult, [], false);

      expect(content.base).toBe('main');
      expect(content.head).toBe('feature/custom-branch');
    });
  });

  describe('getConfig', () => {
    it('should return copy of configuration', () => {
      const creator = new PRCreator();

      const config1 = creator.getConfig();
      const config2 = creator.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it('should include all configuration options', () => {
      const creator = new PRCreator();
      const config = creator.getConfig();

      expect(config).toHaveProperty('projectRoot');
      expect(config).toHaveProperty('baseBranch');
      expect(config).toHaveProperty('enableDraftPR');
      expect(config).toHaveProperty('draftThreshold');
      expect(config).toHaveProperty('autoAssignLabels');
      expect(config).toHaveProperty('labelMapping');
      expect(config).toHaveProperty('prTemplate');
    });
  });

  describe('DEFAULT_PR_CREATOR_CONFIG', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_PR_CREATOR_CONFIG.projectRoot).toBe(process.cwd());
      expect(DEFAULT_PR_CREATOR_CONFIG.baseBranch).toBe('main');
      expect(DEFAULT_PR_CREATOR_CONFIG.enableDraftPR).toBe(true);
      expect(DEFAULT_PR_CREATOR_CONFIG.draftThreshold).toBe(70);
      expect(DEFAULT_PR_CREATOR_CONFIG.autoAssignLabels).toBe(true);
    });

    it('should have label mapping for common prefixes', () => {
      expect(DEFAULT_PR_CREATOR_CONFIG.labelMapping.feature).toContain('enhancement');
      expect(DEFAULT_PR_CREATOR_CONFIG.labelMapping.fix).toContain('bug');
      expect(DEFAULT_PR_CREATOR_CONFIG.labelMapping.docs).toContain('documentation');
      expect(DEFAULT_PR_CREATOR_CONFIG.labelMapping.test).toContain('testing');
      expect(DEFAULT_PR_CREATOR_CONFIG.labelMapping.refactor).toContain('refactoring');
    });
  });

  describe('integration scenarios', () => {
    let creator: PRCreator;

    beforeEach(() => {
      creator = new PRCreator();
    });

    it('should handle complete implementation result flow', () => {
      const implResult = createMinimalImplementationResult({
        issueId: 'ISS-042-implement-auth',
        githubIssue: 42,
        changes: [
          { filePath: 'src/auth/login.ts', changeType: 'create', description: 'Login service', linesAdded: 150, linesRemoved: 0 },
          { filePath: 'src/auth/security.ts', changeType: 'create', description: 'Security utils', linesAdded: 80, linesRemoved: 0 },
          { filePath: 'tests/auth/login.test.ts', changeType: 'create', description: 'Login tests', linesAdded: 100, linesRemoved: 0 },
        ],
        tests: { filesCreated: ['tests/auth/login.test.ts'], totalTests: 15, coveragePercentage: 92 },
        branch: {
          name: 'feature/ISS-042-implement-auth',
          commits: [
            { hash: 'abc1234', message: 'feat(auth): add login service' },
            { hash: 'def5678', message: 'test(auth): add login tests' },
          ],
        },
      });

      // Validate branch
      const branchResult = creator.validateBranchNaming(implResult.branch.name);
      expect(branchResult.valid).toBe(true);
      expect(branchResult.prefix).toBe('feature');

      // Infer labels
      const labelResult = creator.inferLabels(implResult.changes, implResult.branch.name);
      expect(labelResult.labels).toContain('enhancement');
      expect(labelResult.labels).toContain('security');
      expect(labelResult.labels).toContain('testing');
      expect(labelResult.labels).toContain('new-feature');

      // Check draft status
      expect(creator.shouldBeDraft(implResult)).toBe(false);

      // Generate PR content
      const content = creator.generatePRContent(implResult, labelResult.labels, false);
      expect(content.title).toContain('feat');
      expect(content.body).toContain('#42');
      expect(content.body).toContain('Login service');
      expect(content.body).toContain('Security utils');
      expect(content.draft).toBe(false);
    });

    it('should handle failed implementation result', () => {
      const implResult = createMinimalImplementationResult({
        status: 'failed',
        tests: { filesCreated: [], totalTests: 5, coveragePercentage: 45 },
        verification: {
          testsPassed: false,
          testsOutput: '3 tests failed',
          lintPassed: false,
          lintOutput: '10 errors',
          buildPassed: true,
          buildOutput: '',
        },
      });

      // Should be draft
      expect(creator.shouldBeDraft(implResult)).toBe(true);

      // Generate PR content with draft
      const content = creator.generatePRContent(implResult, [], true);
      expect(content.body).toContain('⚠️ **Draft PR**');
      expect(content.body).toContain('❌ Failed');
      expect(content.draft).toBe(true);
    });

    it('should handle blocked implementation', () => {
      const implResult = createMinimalImplementationResult({
        status: 'blocked',
        blockers: ['External API unavailable', 'Waiting for dependency'],
      });

      expect(creator.shouldBeDraft(implResult)).toBe(true);
    });
  });
});
