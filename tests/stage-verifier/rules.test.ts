/**
 * Tests for Stage Verifier rules and shouldRunRule
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import type { StageName } from '../../src/ad-sdlc-orchestrator/types.js';
import { VERIFICATION_RULES, shouldRunRule } from '../../src/stage-verifier/rules.js';
import type { VerificationRule } from '../../src/stage-verifier/types.js';
import { locateDocuments } from '../../src/vnv/traceability.js';

// Mock node:fs/promises so rules that read files can be tested
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
const mockReadFile = vi.mocked(readFile);

// =============================================================================
// shouldRunRule
// =============================================================================

describe('shouldRunRule', () => {
  it('should run a minimal rule at minimal rigor', () => {
    expect(shouldRunRule('minimal', 'minimal')).toBe(true);
  });

  it('should run a minimal rule at standard rigor', () => {
    expect(shouldRunRule('minimal', 'standard')).toBe(true);
  });

  it('should run a minimal rule at strict rigor', () => {
    expect(shouldRunRule('minimal', 'strict')).toBe(true);
  });

  it('should NOT run a standard rule at minimal rigor', () => {
    expect(shouldRunRule('standard', 'minimal')).toBe(false);
  });

  it('should run a standard rule at standard rigor', () => {
    expect(shouldRunRule('standard', 'standard')).toBe(true);
  });

  it('should run a standard rule at strict rigor', () => {
    expect(shouldRunRule('standard', 'strict')).toBe(true);
  });

  it('should NOT run a strict rule at minimal rigor', () => {
    expect(shouldRunRule('strict', 'minimal')).toBe(false);
  });

  it('should NOT run a strict rule at standard rigor', () => {
    expect(shouldRunRule('strict', 'standard')).toBe(false);
  });

  it('should run a strict rule at strict rigor', () => {
    expect(shouldRunRule('strict', 'strict')).toBe(true);
  });
});

// =============================================================================
// VERIFICATION_RULES map
// =============================================================================

describe('VERIFICATION_RULES', () => {
  it('should have entries for collection', () => {
    expect(VERIFICATION_RULES.has('collection')).toBe(true);
    const rules = VERIFICATION_RULES.get('collection');
    expect(rules).toBeDefined();
    expect(rules!.length).toBeGreaterThanOrEqual(2);
  });

  it('should have entries for prd_generation and prd_update', () => {
    expect(VERIFICATION_RULES.has('prd_generation')).toBe(true);
    expect(VERIFICATION_RULES.has('prd_update')).toBe(true);
    // Both should share the same rule set
    expect(VERIFICATION_RULES.get('prd_generation')).toBe(VERIFICATION_RULES.get('prd_update'));
  });

  it('should have entries for srs_generation and srs_update', () => {
    expect(VERIFICATION_RULES.has('srs_generation')).toBe(true);
    expect(VERIFICATION_RULES.has('srs_update')).toBe(true);
    expect(VERIFICATION_RULES.get('srs_generation')).toBe(VERIFICATION_RULES.get('srs_update'));
  });

  it('should have entries for sds_generation and sds_update', () => {
    expect(VERIFICATION_RULES.has('sds_generation')).toBe(true);
    expect(VERIFICATION_RULES.has('sds_update')).toBe(true);
    expect(VERIFICATION_RULES.get('sds_generation')).toBe(VERIFICATION_RULES.get('sds_update'));
  });

  it('should have entries for issue_generation', () => {
    expect(VERIFICATION_RULES.has('issue_generation')).toBe(true);
  });

  it('should have entries for implementation', () => {
    expect(VERIFICATION_RULES.has('implementation')).toBe(true);
  });

  it('should have entries for review', () => {
    expect(VERIFICATION_RULES.has('review')).toBe(true);
  });

  it('should NOT have entries for initialization or mode_detection', () => {
    expect(VERIFICATION_RULES.has('initialization')).toBe(false);
    expect(VERIFICATION_RULES.has('mode_detection')).toBe(false);
  });

  it('should have unique checkIds across all rules for each stage', () => {
    for (const [stageName, rules] of VERIFICATION_RULES.entries()) {
      const ids = rules.map((r) => r.checkId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});

// =============================================================================
// Collection rules
// =============================================================================

describe('Collection rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-COL-001: should pass when collected_info artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-001')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.checkId).toBe('VR-COL-001');
  });

  it('VR-COL-001: should fail when no collected_info artifact', async () => {
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-001')!;

    const result = await rule.check(['other_file.txt'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No collected_info');
  });

  it('VR-COL-002: should pass when collected_info is valid YAML', async () => {
    mockReadFile.mockResolvedValue('project_name: test\nrequirements:\n  functional: []');
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
  });

  it('VR-COL-002: should fail when collected_info is not valid YAML', async () => {
    mockReadFile.mockResolvedValue('{ invalid yaml: [');
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('not valid YAML');
  });

  it('VR-COL-003: should pass when functional requirements are present', async () => {
    const yamlContent =
      'requirements:\n  functional:\n    - id: FR-001\n      title: Test\n    - id: FR-002\n      title: Test2';
    mockReadFile.mockResolvedValue(yamlContent);
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.details?.requirementsFound).toBe(2);
  });

  it('VR-COL-003: should fail when no functional requirements exist', async () => {
    const yamlContent = 'requirements:\n  functional: []';
    mockReadFile.mockResolvedValue(yamlContent);
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No functional requirements');
  });
});

// =============================================================================
// PRD rules
// =============================================================================

describe('PRD rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-PRD-001: should pass when PRD artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-001')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-PRD-001: should fail when no PRD artifact', async () => {
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-001')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No PRD artifact');
  });

  it('VR-PRD-002: should pass when PRD has all required sections', async () => {
    const prdContent = [
      '# Product Requirements Document',
      '## Introduction',
      'This is the introduction.',
      '## Functional Requirements',
      '### FR-001: Login',
      '## Non-Functional Requirements',
      '### Performance',
    ].join('\n');
    mockReadFile.mockResolvedValue(prdContent);

    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('all required sections');
  });

  it('VR-PRD-002: accepts the Executive Summary of the writer template instead of an Introduction', async () => {
    const rule = VERIFICATION_RULES.get('prd_generation')!.find((r) => r.checkId === 'VR-PRD-002')!;
    mockReadFile.mockResolvedValue(
      '# PRD: X\n## 1. Executive Summary\n## 5. Functional Requirements\n## 6. Non-Functional Requirements\n'
    );
    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.requiredSections).toEqual([
      'Executive Summary or Introduction',
      'Functional Requirements',
      'Non-Functional Requirements',
    ]);
  });

  it('VR-PRD-002: names both alternatives when neither is present', async () => {
    const rule = VERIFICATION_RULES.get('prd_generation')!.find((r) => r.checkId === 'VR-PRD-002')!;
    mockReadFile.mockResolvedValue(
      '# PRD: X\n## Functional Requirements\n## Non-Functional Requirements\n'
    );
    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain(
      'PRD missing required sections in docs/PRD.md: Executive Summary or Introduction'
    );
    expect(result.details?.missingSections).toEqual(['Executive Summary or Introduction']);
  });

  it('VR-PRD-002: should fail when PRD is missing required sections', async () => {
    const prdContent = [
      '# Product Requirements Document',
      '## Introduction',
      'Only introduction here.',
    ].join('\n');
    mockReadFile.mockResolvedValue(prdContent);

    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('missing required sections');
    expect(result.details?.missingSections).toContain('Functional Requirements');
    expect(result.details?.missingSections).toContain('Non-Functional Requirements');
  });

  it('VR-PRD-003: should pass when PRD has FR-XXX identifiers', async () => {
    const prdContent = '## Functional Requirements\n### FR-001: Login\n### FR-002: Logout';
    mockReadFile.mockResolvedValue(prdContent);

    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.frCount).toBe(2);
  });

  it('VR-PRD-003: should fail when PRD has no FR identifiers', async () => {
    const prdContent = '## Functional Requirements\nSome text without IDs';
    mockReadFile.mockResolvedValue(prdContent);

    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No FR-XXX');
  });
});

// =============================================================================
// Implementation rules
// =============================================================================

describe('Implementation rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-IMP-001: should pass when implementation_result artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-001')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
  });

  it('VR-IMP-001: should fail when no implementation_result artifact', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-001')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-IMP-003: should pass when tests passed', async () => {
    mockReadFile.mockResolvedValue('testsPassed: true\nbuildPassed: true');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('tests passed');
  });

  it('VR-IMP-003: should fail when tests did not pass', async () => {
    mockReadFile.mockResolvedValue('testsPassed: false\nbuildPassed: true');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('tests did not pass');
  });

  it('VR-IMP-003: should pass when testsPassed field is absent', async () => {
    mockReadFile.mockResolvedValue('buildPassed: true\nstatus: completed');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipping');
  });

  it('VR-IMP-002: should pass when implementation result is valid YAML', async () => {
    mockReadFile.mockResolvedValue('testsPassed: true\nbuildPassed: true');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid data file');
  });

  it('VR-IMP-002: should fail when no artifact to validate', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No implementation result artifact to validate');
  });

  it('VR-IMP-002: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-IMP-002: should fail when content is neither valid YAML nor JSON object', async () => {
    // "null" parses to null in both YAML and JSON, which safeParseYaml rejects (not an object)
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('neither valid YAML nor JSON');
  });

  it('VR-IMP-002: should pass when content is valid JSON', async () => {
    mockReadFile.mockResolvedValue('{"testsPassed": true}');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation-result.json'],
      '/project'
    );
    expect(result.passed).toBe(true);
  });

  it('VR-IMP-003: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-IMP-003: should fail when content is not parseable as object', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });

  it('VR-IMP-003: should fail when no artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No implementation result');
  });

  it('VR-IMP-004: should pass when build passed', async () => {
    mockReadFile.mockResolvedValue('testsPassed: true\nbuildPassed: true');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('build passed');
  });

  it('VR-IMP-004: should fail when build did not pass', async () => {
    mockReadFile.mockResolvedValue('testsPassed: true\nbuildPassed: false');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('build did not pass');
  });

  it('VR-IMP-004: should pass when buildPassed field is absent', async () => {
    mockReadFile.mockResolvedValue('testsPassed: true\nstatus: done');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipping');
  });

  it('VR-IMP-004: should fail when no artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-004')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-IMP-004: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-IMP-004: should fail when content cannot be parsed as object', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });

  it('VR-IMP-005: should pass when lint passed', async () => {
    mockReadFile.mockResolvedValue('lintPassed: true');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-005')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('lint passed');
  });

  it('VR-IMP-005: should fail when lint did not pass', async () => {
    mockReadFile.mockResolvedValue('lintPassed: false');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-005')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('lint did not pass');
  });

  it('VR-IMP-005: should pass when lintPassed field is absent', async () => {
    mockReadFile.mockResolvedValue('testsPassed: true');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-005')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipping');
  });

  it('VR-IMP-005: should fail when no artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-005')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-IMP-005: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-005')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-IMP-005: should fail when content cannot be parsed as object', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-005')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation_result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });

  it('VR-IMP-001: should find implementation-result variant', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-001')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/implementation-result.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
  });

  it('VR-IMP-001: should find ImplementationResult variant', async () => {
    const rules = VERIFICATION_RULES.get('implementation')!;
    const rule = rules.find((r) => r.checkId === 'VR-IMP-001')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/impl/ImplementationResult.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
  });
});

// =============================================================================
// SRS rules
// =============================================================================

describe('SRS rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-SRS-001: should pass when SRS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-001')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-SRS-001: should pass when lowercase srs artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-001')!;

    const result = await rule.check(['docs/srs.md'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-SRS-001: should fail when no SRS artifact', async () => {
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-001')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No SRS artifact');
  });

  it('VR-SRS-002: should pass when SRS has all required sections', async () => {
    const srsContent = [
      '# Software Requirements Specification',
      '## Introduction',
      'This is the introduction.',
      '## Software Features',
      '### SF-001: User Login',
    ].join('\n');
    mockReadFile.mockResolvedValue(srsContent);

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-002')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('all required sections');
  });

  it('VR-SRS-002: accepts the System Features of the writer template', async () => {
    const rule = VERIFICATION_RULES.get('srs_generation')!.find((r) => r.checkId === 'VR-SRS-002')!;
    mockReadFile.mockResolvedValue('# SRS: X\n## 1. Introduction\n## 3. System Features\n');
    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.requiredSections).toEqual([
      'Introduction',
      'System Features or Software Features',
    ]);
  });

  it('VR-SRS-002: should fail when SRS is missing required sections', async () => {
    const srsContent = '# SRS\n## Introduction\nOnly intro here.';
    mockReadFile.mockResolvedValue(srsContent);

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-002')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('missing required sections');
    expect(result.details?.missingSections).toEqual(['System Features or Software Features']);
    expect(result.message).toContain('System Features or Software Features');
  });

  it('VR-SRS-002: should fail when no SRS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No SRS artifact');
  });

  it('VR-SRS-002: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-002')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-SRS-003: should pass when SRS has SF-XXX identifiers', async () => {
    const srsContent = '## Software Features\n### SF-001: Login\n### SF-002: Logout';
    mockReadFile.mockResolvedValue(srsContent);

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-003')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.sfCount).toBe(2);
  });

  it('VR-SRS-003: should fail when SRS has no SF identifiers', async () => {
    const srsContent = '## Software Features\nSome text without IDs';
    mockReadFile.mockResolvedValue(srsContent);

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-003')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No SF-XXX');
  });

  it('VR-SRS-003: should fail when no SRS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-SRS-003: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-003')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-SRS-004: should pass when all FR references in SRS exist in PRD', async () => {
    mockReadFile
      .mockResolvedValueOnce('## Features\nSF-001 traces to FR-001 and FR-002') // SRS
      .mockResolvedValueOnce('## Requirements\nFR-001: Login\nFR-002: Logout'); // PRD

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-004')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('All FR references');
  });

  it('VR-SRS-004: should fail when SRS references FR IDs not in PRD', async () => {
    mockReadFile
      .mockResolvedValueOnce('## Features\nSF-001 traces to FR-001 and FR-099') // SRS
      .mockResolvedValueOnce('## Requirements\nFR-001: Login'); // PRD

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-004')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('FR-099');
    expect(result.details?.orphanRefs).toContain('FR-099');
  });

  it('VR-SRS-004: should pass when SRS has no FR references', async () => {
    mockReadFile.mockResolvedValueOnce('## Features\nSF-001: Login feature');

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-004')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('No FR references');
  });

  it('VR-SRS-004: should pass when PRD not found (skip cross-ref check)', async () => {
    mockReadFile
      .mockResolvedValueOnce('## Features\nTraces to FR-001') // SRS
      .mockRejectedValueOnce(new Error('ENOENT')); // PRD not found

    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-004')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipping');
  });

  it('VR-SRS-004: should fail when no SRS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-004')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-SRS-004: should fail when SRS file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('srs_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SRS-004')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });
});

// =============================================================================
// SDS rules
// =============================================================================

describe('SDS rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-SDS-001: should pass when SDS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-001')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-SDS-001: should pass when lowercase sds artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-001')!;

    const result = await rule.check(['docs/sds.md'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-SDS-001: should fail when no SDS artifact', async () => {
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-001')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No SDS artifact');
  });

  it('VR-SDS-002: should pass when SDS has all required sections', async () => {
    const sdsContent = [
      '# Software Design Specification',
      '## Introduction',
      'This is the intro.',
      '## System Architecture',
      '### Overview',
      '## Component Design',
      '### CMP-001: Auth Service',
    ].join('\n');
    mockReadFile.mockResolvedValue(sdsContent);

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-002')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('all required sections');
  });

  it('VR-SDS-002: should fail when SDS is missing required sections', async () => {
    const sdsContent = '# SDS\n## Introduction\nOnly intro here.';
    mockReadFile.mockResolvedValue(sdsContent);

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-002')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('missing required sections');
    expect(result.details?.missingSections).toContain('System Architecture');
    expect(result.details?.missingSections).toContain('Component Design');
  });

  it('VR-SDS-002: should fail when no SDS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No SDS artifact');
  });

  it('VR-SDS-002: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-002')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-SDS-003: should pass when SDS has CMP-XXX identifiers', async () => {
    const sdsContent = '## Component Design\n### CMP-001: Auth\n### CMP-002: DB';
    mockReadFile.mockResolvedValue(sdsContent);

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-003')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.cmpCount).toBe(2);
  });

  it('VR-SDS-003: should fail when SDS has no CMP identifiers', async () => {
    const sdsContent = '## Component Design\nSome text without IDs';
    mockReadFile.mockResolvedValue(sdsContent);

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-003')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No CMP-XXX');
  });

  it('VR-SDS-003: should fail when no SDS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-SDS-003: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-003')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-SDS-004: should pass when all SF references in SDS exist in SRS', async () => {
    mockReadFile
      .mockResolvedValueOnce('## Components\nCMP-001 implements SF-001 and SF-002') // SDS
      .mockResolvedValueOnce('## Features\nSF-001: Login\nSF-002: Logout'); // SRS

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-004')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('All SF references');
  });

  it('VR-SDS-004: should fail when SDS references SF IDs not in SRS', async () => {
    mockReadFile
      .mockResolvedValueOnce('## Components\nCMP-001 implements SF-001 and SF-099') // SDS
      .mockResolvedValueOnce('## Features\nSF-001: Login'); // SRS

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-004')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('SF-099');
    expect(result.details?.orphanRefs).toContain('SF-099');
  });

  it('VR-SDS-004: should pass when SDS has no SF references', async () => {
    mockReadFile.mockResolvedValueOnce('## Components\nCMP-001: Auth Service');

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-004')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('No SF references');
  });

  it('VR-SDS-004: should pass when SRS not found (skip cross-ref check)', async () => {
    mockReadFile
      .mockResolvedValueOnce('## Components\nImplements SF-001') // SDS
      .mockRejectedValueOnce(new Error('ENOENT')); // SRS not found

    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-004')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipping');
  });

  it('VR-SDS-004: should fail when no SDS artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-004')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-SDS-004: should fail when SDS file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('sds_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-SDS-004')!;

    const result = await rule.check(['docs/SDS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });
});

// =============================================================================
// Issue Generation rules
// =============================================================================

describe('Issue Generation rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-ISS-001: should pass when issue artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-001')!;

    const result = await rule.check(['output/issue_list.yaml'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-ISS-001: should pass when Issue (capitalized) artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-001')!;

    const result = await rule.check(['output/Issue_list.yaml'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-ISS-001: should fail when no issue artifact', async () => {
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-001')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No issue list artifact');
  });

  it('VR-ISS-002: should pass when issue list is valid JSON (.json)', async () => {
    mockReadFile.mockResolvedValue('[{"id": 1, "title": "Fix bug"}]');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid JSON');
  });

  it('VR-ISS-002: should fail when issue list is invalid JSON (.json)', async () => {
    mockReadFile.mockResolvedValue('{ invalid json [');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('not valid JSON');
  });

  it('VR-ISS-002: should pass when issue list is valid YAML (.yaml)', async () => {
    mockReadFile.mockResolvedValue('issues:\n  - id: 1\n    title: Fix bug');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issues.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid YAML');
  });

  it('VR-ISS-002: should fail when issue list is invalid YAML (.yaml)', async () => {
    mockReadFile.mockResolvedValue('{ invalid yaml: [');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issues.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('not valid YAML');
  });

  it('VR-ISS-002: should pass when issue list is valid YAML (.yml)', async () => {
    mockReadFile.mockResolvedValue('issues:\n  - id: 1');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issues.yml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid YAML');
  });

  it('VR-ISS-002: should try JSON then YAML for unknown extension', async () => {
    mockReadFile.mockResolvedValue('issues:\n  - id: 1');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issue_list.txt'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid YAML');
  });

  it('VR-ISS-002: should pass for JSON content with unknown extension', async () => {
    mockReadFile.mockResolvedValue('[{"id": 1}]');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issue_list.txt'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid JSON');
  });

  it('VR-ISS-002: should fail when content is neither JSON nor YAML object with unknown extension', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issue_list.txt'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('neither valid JSON nor YAML');
  });

  it('VR-ISS-002: should fail when no issue artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-ISS-002: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-002')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-ISS-003: should pass when issue list contains entries (JSON array)', async () => {
    mockReadFile.mockResolvedValue('[{"id": 1}, {"id": 2}]');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.issueCount).toBe(2);
  });

  it('VR-ISS-003: should pass when issue list contains entries (YAML with issues key)', async () => {
    mockReadFile.mockResolvedValue('issues:\n  - id: 1\n  - id: 2\n  - id: 3');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.issueCount).toBe(3);
  });

  it('VR-ISS-003: should pass when issue list uses items key', async () => {
    mockReadFile.mockResolvedValue('{"items": [{"id": 1}]}');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.issueCount).toBe(1);
  });

  it('VR-ISS-003: should fail when issue list is empty array', async () => {
    mockReadFile.mockResolvedValue('[]');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('no entries');
    expect(result.details?.issueCount).toBe(0);
  });

  it('VR-ISS-003: should fail when issue list has empty issues key', async () => {
    mockReadFile.mockResolvedValue('issues: []');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.details?.issueCount).toBe(0);
  });

  it('VR-ISS-003: should fail when data is an object without issues/items keys', async () => {
    mockReadFile.mockResolvedValue('{"name": "test"}');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.json'], '/project');
    expect(result.passed).toBe(false);
    expect(result.details?.issueCount).toBe(0);
  });

  it('VR-ISS-003: should fail when no artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-ISS-003: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-ISS-003: should fail when content cannot be parsed as object', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('issue_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-ISS-003')!;

    const result = await rule.check(['output/issues.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });
});

// =============================================================================
// Review rules
// =============================================================================

describe('Review rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-REV-001: should pass when review_result artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-001')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-REV-001: should pass when review-result artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-001')!;

    const result = await rule.check(['output/review-result.yaml'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-REV-001: should pass when PRReviewResult artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-001')!;

    const result = await rule.check(['output/PRReviewResult.yaml'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-REV-001: should pass when pr_review artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-001')!;

    const result = await rule.check(['output/pr_review.yaml'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-REV-001: should fail when no review artifact', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-001')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No review result artifact');
  });

  it('VR-REV-002: should pass when review result is valid YAML', async () => {
    mockReadFile.mockResolvedValue('decision: approve\ncomments: []');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-002')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('valid data file');
  });

  it('VR-REV-002: should pass when review result is valid JSON', async () => {
    mockReadFile.mockResolvedValue('{"decision": "approve"}');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-002')!;

    const result = await rule.check(['output/review_result.json'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-REV-002: should fail when review result is neither valid YAML nor JSON object', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-002')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('neither valid YAML nor JSON');
  });

  it('VR-REV-002: should fail when no review artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-REV-002: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-002')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-REV-003: should pass when review has valid approve decision', async () => {
    mockReadFile.mockResolvedValue('decision: approve');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('approve');
    expect(result.details?.decision).toBe('approve');
  });

  it('VR-REV-003: should pass when review has valid request_changes decision', async () => {
    mockReadFile.mockResolvedValue('decision: request_changes');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.decision).toBe('request_changes');
  });

  it('VR-REV-003: should pass when review has valid reject decision', async () => {
    mockReadFile.mockResolvedValue('decision: reject');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.decision).toBe('reject');
  });

  it('VR-REV-003: should pass when review uses reviewDecision key', async () => {
    mockReadFile.mockResolvedValue('reviewDecision: approve');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(true);
    expect(result.details?.decision).toBe('approve');
  });

  it('VR-REV-003: should fail when decision field is missing', async () => {
    mockReadFile.mockResolvedValue('comments: good work');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No decision field');
  });

  it('VR-REV-003: should fail when decision is invalid string', async () => {
    mockReadFile.mockResolvedValue('decision: maybe');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Invalid review decision');
    expect(result.message).toContain('maybe');
  });

  it('VR-REV-003: should fail when decision is non-string type', async () => {
    mockReadFile.mockResolvedValue('decision: 42');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Invalid review decision');
  });

  it('VR-REV-003: should fail when no review artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
  });

  it('VR-REV-003: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-REV-003: should fail when content cannot be parsed as object', async () => {
    mockReadFile.mockResolvedValue('null');
    const rules = VERIFICATION_RULES.get('review')!;
    const rule = rules.find((r) => r.checkId === 'VR-REV-003')!;

    const result = await rule.check(['output/review_result.yaml'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });
});

// =============================================================================
// Collection rules — error handling branches
// =============================================================================

describe('Collection rules — error paths', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-COL-002: should fail when file read throws', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-002')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-COL-002: should fail when no artifact to validate', async () => {
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-002')!;

    const result = await rule.check(['other.txt'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No collected_info artifact to validate');
  });

  it('VR-COL-003: should fail when file read throws', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-COL-003: should fail when YAML parse fails', async () => {
    mockReadFile.mockResolvedValue('{ invalid yaml: [');
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-003')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });

  it('VR-COL-003: should fail when no artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-003')!;

    const result = await rule.check(['other.txt'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No collected_info artifact');
  });

  it('VR-COL-004: should pass when requirements have acceptance criteria', async () => {
    const yamlContent =
      'requirements:\n  functional:\n    - id: FR-001\n      acceptanceCriteria:\n        - AC-001';
    mockReadFile.mockResolvedValue(yamlContent);
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
    expect(result.details?.withCriteria).toBe(1);
  });

  it('VR-COL-004: should pass with acceptance_criteria (snake_case)', async () => {
    const yamlContent =
      'requirements:\n  functional:\n    - id: FR-001\n      acceptance_criteria:\n        - AC-001';
    mockReadFile.mockResolvedValue(yamlContent);
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(true);
  });

  it('VR-COL-004: should fail when no requirements have acceptance criteria', async () => {
    const yamlContent = 'requirements:\n  functional:\n    - id: FR-001\n      title: Login';
    mockReadFile.mockResolvedValue(yamlContent);
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No functional requirements have acceptance criteria');
    expect(result.details?.withCriteria).toBe(0);
  });

  it('VR-COL-004: should fail when no functional array exists', async () => {
    const yamlContent = 'requirements:\n  nonFunctional: []';
    mockReadFile.mockResolvedValue(yamlContent);
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No functional requirements to check');
  });

  it('VR-COL-004: should fail when no artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(['other.txt'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No collected_info artifact');
  });

  it('VR-COL-004: should fail when file read throws', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-COL-004: should fail when YAML parse fails', async () => {
    mockReadFile.mockResolvedValue('{ invalid yaml: [');
    const rules = VERIFICATION_RULES.get('collection')!;
    const rule = rules.find((r) => r.checkId === 'VR-COL-004')!;

    const result = await rule.check(
      ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      '/project'
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot parse');
  });
});

// =============================================================================
// PRD rules — error handling branches
// =============================================================================

describe('PRD rules — error paths', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('VR-PRD-001: should find lowercase prd artifact', async () => {
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-001')!;

    const result = await rule.check(['docs/prd.md'], '/project');
    expect(result.passed).toBe(true);
  });

  it('VR-PRD-002: should fail when no PRD artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-002')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No PRD artifact');
  });

  it('VR-PRD-002: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-002')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  it('VR-PRD-003: should fail when no PRD artifact exists', async () => {
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-003')!;

    const result = await rule.check(['docs/SRS.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No PRD artifact');
  });

  it('VR-PRD-003: should fail when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const rules = VERIFICATION_RULES.get('prd_generation')!;
    const rule = rules.find((r) => r.checkId === 'VR-PRD-003')!;

    const result = await rule.check(['docs/PRD.md'], '/project');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Cannot read');
  });
});

// =============================================================================
// Which file a document or issue check reads
// =============================================================================

/**
 * A stage's artifact order comes from manifest entry IDs, which hash the session
 * ID (`artifactId`), so a run can get any order. These tests fix the order.
 */
describe('Document and issue checks whatever the artifact order', () => {
  const S = '.ad-sdlc/scratchpad';
  const PROJECT = '/project';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  function serve(files: Readonly<Record<string, string>>): void {
    const contents = new Map(
      Object.entries(files).map(([location, text]) => [resolve(PROJECT, location), text])
    );
    mockReadFile.mockImplementation((location) => {
      const text = contents.get(String(location));
      return text === undefined
        ? Promise.reject(new Error(`ENOENT: ${String(location)}`))
        : Promise.resolve(text);
    });
  }

  function ruleOf(stage: StageName, checkId: string): VerificationRule {
    return VERIFICATION_RULES.get(stage)!.find((rule) => rule.checkId === checkId)!;
  }

  const DOCUMENTS = [
    {
      id: 'PRD',
      type: 'prd',
      generation: 'prd_generation',
      update: 'prd_update',
      checks: ['VR-PRD-001', 'VR-PRD-002', 'VR-PRD-003'],
      english:
        '## Introduction\n## Functional Requirements\n### FR-001: Login\n## Non-Functional Requirements\n',
      korean: '## 소개\n## 기능 요구사항\n### FR-001: 로그인\n## 비기능 요구사항\n',
    },
    {
      id: 'SRS',
      type: 'srs',
      generation: 'srs_generation',
      update: 'srs_update',
      checks: ['VR-SRS-001', 'VR-SRS-002', 'VR-SRS-003', 'VR-SRS-004'],
      english: '## Introduction\n## Software Features\n### SF-001: Login\n',
      korean: '## 소개\n## 소프트웨어 기능\n### SF-001: 로그인\n',
    },
    {
      id: 'SDS',
      type: 'sds',
      generation: 'sds_generation',
      update: 'sds_update',
      checks: ['VR-SDS-001', 'VR-SDS-002', 'VR-SDS-003', 'VR-SDS-004'],
      english: '## Introduction\n## System Architecture\n## Component Design\n### CMP-001: Auth\n',
      korean: '## 소개\n## 시스템 아키텍처\n## 컴포넌트 설계\n### CMP-001: 인증\n',
    },
  ] as const;

  it.each(DOCUMENTS)(
    '$id: checks the English file when a Korean copy is listed first',
    async ({ id, type, generation, english, korean }) => {
      const englishFile = `docs/${type}/${id}-demo.md`;
      const koreanFile = `docs/${type}/${id}-demo.kr.md`;
      serve({ [englishFile]: english, [koreanFile]: korean });

      const result = await ruleOf(generation, `VR-${id}-002`).check(
        [koreanFile, englishFile],
        PROJECT
      );

      expect(result.passed).toBe(true);
      expect(result.message).toContain(englishFile);
    }
  );

  it.each(DOCUMENTS)(
    '$id: names the file it read when the English file misses a section',
    async ({ id, type, generation }) => {
      const englishFile = `docs/${type}/${id}-demo.md`;
      serve({ [englishFile]: '## Introduction\n' });

      const result = await ruleOf(generation, `VR-${id}-002`).check([englishFile], PROJECT);

      expect(result.passed).toBe(false);
      expect(result.message).toContain(englishFile);
    }
  );

  it.each(DOCUMENTS)(
    '$id: reads the contract copy after a changelog and an update result',
    async ({ id, type, update, english }) => {
      const changelog = `${S}/documents/x/${type}_changelog.md`;
      const updateResult = `${S}/documents/x/${type}_update_result.yaml`;
      const contractCopy = `${S}/documents/x/${type}.md`;
      serve({
        [changelog]: '## Changelog\n',
        [updateResult]: 'update_result: {}\n',
        [contractCopy]: english,
      });
      const artifacts = [changelog, updateResult, contractCopy];

      const exists = await ruleOf(update, `VR-${id}-001`).check(artifacts, PROJECT);
      const sections = await ruleOf(update, `VR-${id}-002`).check(artifacts, PROJECT);

      expect(exists.message).toContain(contractCopy);
      expect(sections.passed).toBe(true);
      expect(sections.message).toContain(contractCopy);
    }
  );

  it.each(DOCUMENTS)(
    '$id: prefers the contract copy to a published copy, as locateDocuments does',
    async ({ id, type, generation, english }) => {
      const publishedFile = `docs/${type}/${id}-demo.md`;
      const contractCopy = `${S}/documents/x/${type}.md`;
      serve({ [publishedFile]: '## Stale\n', [contractCopy]: english });
      const artifacts = [publishedFile, contractCopy];

      const result = await ruleOf(generation, `VR-${id}-002`).check(artifacts, PROJECT);

      expect(result.passed).toBe(true);
      expect(result.message).toContain(contractCopy);
      expect(locateDocuments(artifacts)[type]).toBe(contractCopy);
    }
  );

  it.each(DOCUMENTS)(
    '$id: reports no artifact when only Korean copies exist, as locateDocuments does',
    async ({ id, type, generation, checks, korean }) => {
      const artifacts = [`docs/${type}/${id}-demo.kr.md`, `${S}/documents/x/${type}.kr.md`];
      serve(Object.fromEntries(artifacts.map((location) => [location, korean])));

      for (const checkId of checks) {
        const result = await ruleOf(generation, checkId).check(artifacts, PROJECT);
        expect(result.passed, checkId).toBe(false);
        expect(result.message, checkId).toContain(`No ${id} artifact`);
      }
      expect(locateDocuments(artifacts)).toEqual({});
    }
  );

  describe('issue list', () => {
    const graph = `${S}/issues/x/dependency_graph.json`;
    const list = `${S}/issues/x/issue_list.json`;
    const artifacts = [graph, list];

    beforeEach(() => {
      serve({
        [graph]: JSON.stringify({ nodes: [{ id: 'ISS-001' }, { id: 'ISS-002' }], edges: [] }),
        [list]: JSON.stringify({ issues: [{ id: 'ISS-001' }, { id: 'ISS-002' }] }),
      });
    });

    it('VR-ISS-001: names the issue list when the dependency graph is listed first', async () => {
      const result = await ruleOf('issue_generation', 'VR-ISS-001').check(artifacts, PROJECT);
      expect(result.message).toContain(list);
    });

    it('VR-ISS-002: parses the issue list when the dependency graph is listed first', async () => {
      const result = await ruleOf('issue_generation', 'VR-ISS-002').check(artifacts, PROJECT);
      expect(result.passed).toBe(true);
      expect(mockReadFile).toHaveBeenCalledWith(resolve(PROJECT, list), 'utf-8');
      expect(mockReadFile).not.toHaveBeenCalledWith(resolve(PROJECT, graph), 'utf-8');
    });

    it('VR-ISS-003: counts the issues when the dependency graph is listed first', async () => {
      const result = await ruleOf('issue_generation', 'VR-ISS-003').check(artifacts, PROJECT);
      expect(result.passed).toBe(true);
      expect(result.details?.issueCount).toBe(2);
    });
  });
});
