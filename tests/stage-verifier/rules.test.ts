/**
 * Tests for Stage Verifier rules and shouldRunRule
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VERIFICATION_RULES, shouldRunRule } from '../../src/stage-verifier/rules.js';

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
});
