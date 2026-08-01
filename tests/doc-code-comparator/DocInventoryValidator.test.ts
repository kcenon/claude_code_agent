import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ENHANCEMENT_STAGES,
  GREENFIELD_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import {
  DocInventoryValidator,
  type DocInventoryMetrics,
} from '../../src/doc-code-comparator/DocInventoryValidator.js';

describe('DocInventoryValidator', () => {
  let root: string;
  let metrics: DocInventoryMetrics;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'doc-inventory-validator-'));
    metrics = {
      agentDefinitionFiles: 2,
      uniquePipelineAgentTypes: new Set(
        [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES].map(
          (stage) => stage.agentType
        )
      ).size,
      supportAgentDefinitions: 1,
      greenfieldStageSlots: GREENFIELD_STAGES.length,
      enhancementStageSlots: ENHANCEMENT_STAGES.length,
      importStageSlots: IMPORT_STAGES.length,
      totalStageSlots: GREENFIELD_STAGES.length + ENHANCEMENT_STAGES.length + IMPORT_STAGES.length,
      historicalCutoverTargets: 33,
      functionalRequirements: 2,
      softwareFeatures: 1,
      designComponents: 3,
    };
    writeValidFixture();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('accepts source-derived counts, synchronized mirrors, and one ADR tree', () => {
    const result = new DocInventoryValidator(root).validate();

    expect(result.pass).toBe(true);
    expect(result.metrics).toEqual(metrics);
    expect(result.violations).toEqual([]);
  });

  it('accepts a generated inventory table after Markdown column alignment', () => {
    const alignedBlock = DocInventoryValidator.renderRuntimeInventoryBlock(metrics)
      .replace(
        '| Axis | Current value | Authoritative source |',
        '| Axis     | Current value | Authoritative source |'
      )
      .replace('| --- | ---: | --- |', '| -------- | ------------: | -------------------- |');
    write('docs/architecture/runtime-inventory.md', `${alignedBlock}\n`);

    expect(new DocInventoryValidator(root).validate().pass).toBe(true);
  });

  it('reports mirror and dependency-version drift', () => {
    write('docs/api/_media/PRD.md', 'stale mirror');
    write(
      'README.md',
      '### Dependencies\n\n| Package | Version | Role |\n| --- | --- | --- |\n| `@anthropic-ai/claude-agent-sdk` | `^0.1.0` | SDK |\n\nOptional integrations\n'
    );

    const result = new DocInventoryValidator(root).validate();
    const codes = result.violations.map((entry) => entry.code);

    expect(result.pass).toBe(false);
    expect(codes).toContain('MIRROR_DRIFT');
    expect(codes).toContain('DEPENDENCY_VERSION');
  });

  it('reports dependency drift in the architecture overview', () => {
    write(
      'docs/architecture/overview.md',
      '### Core Dependencies\n\n| Package | Version | Role |\n| --- | --- | --- |\n| `@anthropic-ai/claude-agent-sdk` | ^0.1.0 | SDK |\n\n### Development Tools\n\n### External Integrations\n'
    );

    const result = new DocInventoryValidator(root).validate();

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: 'DEPENDENCY_VERSION',
        path: 'docs/architecture/overview.md',
      })
    );
  });

  it('reports a legacy ADR tree and stale generated inventory block', () => {
    write('docs/architecture/decisions/ADR-001-old.md', '# Legacy ADR\n');
    write(
      'docs/architecture/runtime-inventory.md',
      '<!-- generated-runtime-inventory:start -->\nstale\n<!-- generated-runtime-inventory:end -->\n'
    );

    const result = new DocInventoryValidator(root).validate();
    const codes = result.violations.map((entry) => entry.code);

    expect(result.pass).toBe(false);
    expect(codes).toContain('ADR_TREE');
    expect(codes).toContain('RUNTIME_INVENTORY');
  });

  function writeValidFixture(): void {
    write('.claude/agents/collector.md', '---\nname: collector\n---\n');
    write('.claude/agents/support.md', '---\nname: support\n---\n');
    write('CHANGELOG.md', 'All 33 cutover-target stages use the adapter.\n');
    write('docs/PRD-001-agent-driven-sdlc.md', 'FR-001 FR-002 FR-001\n');
    write('docs/SRS-001-agent-driven-sdlc.md', 'SF-001\n');
    write('docs/SDS-001-agent-driven-sdlc.md', 'CMP-001 CMP-002 CMP-003\n');
    write('docs/api/_media/PRD.md', 'FR-001 FR-002 FR-001\n');
    write('docs/api/_media/SRS.md', 'SF-001\n');
    write('docs/api/_media/SDS.md', 'CMP-001 CMP-002 CMP-003\n');
    write('docs/adr/ADR-0001-test.md', '# ADR-0001\n');
    write('docs/adr/README.md', '[ADR-0001](ADR-0001-test.md)\n');
    write(
      'package.json',
      JSON.stringify({ dependencies: { '@anthropic-ai/claude-agent-sdk': '^1.2.3' } })
    );
    write(
      'README.md',
      '### Dependencies\n\n| Package | Version | Role |\n| --- | --- | --- |\n| `@anthropic-ai/claude-agent-sdk` | `^1.2.3` | SDK |\n\nOptional integrations\n'
    );
    write(
      'docs/architecture/overview.md',
      '### Core Dependencies\n\n| Package | Version | Role |\n| --- | --- | --- |\n| `@anthropic-ai/claude-agent-sdk` | ^1.2.3 | SDK |\n\n### Development Tools\n\n### External Integrations\n'
    );
    write(
      'docs/architecture/runtime-inventory.md',
      `${DocInventoryValidator.renderRuntimeInventoryBlock(metrics)}\n`
    );
    write('doc-sync-points.yaml', renderSyncConfig());
  }

  function renderSyncConfig(): string {
    const expected = Object.entries(metrics)
      .map(([key, value]) => `    ${key}: ${String(value)}`)
      .join('\n');
    return [
      'documents:',
      '  PRD:',
      '    path: docs/PRD-001-agent-driven-sdlc.md',
      '    mirror_path: docs/api/_media/PRD.md',
      '  SRS:',
      '    path: docs/SRS-001-agent-driven-sdlc.md',
      '    mirror_path: docs/api/_media/SRS.md',
      '  SDS:',
      '    path: docs/SDS-001-agent-driven-sdlc.md',
      '    mirror_path: docs/api/_media/SDS.md',
      'inventory:',
      '  expected:',
      expected,
      '',
    ].join('\n');
  }

  function write(relativePath: string, content: string): void {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
  }
});
