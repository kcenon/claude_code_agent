/**
 * ArtifactValidator tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  ArtifactValidator,
  GREENFIELD_ARTIFACTS,
  ENHANCEMENT_ARTIFACTS,
  IMPORT_ARTIFACTS,
} from '../../src/ad-sdlc-orchestrator/ArtifactValidator.js';
import type { StageName } from '../../src/ad-sdlc-orchestrator/types.js';

describe('ArtifactValidator', () => {
  let tempDir: string;
  let validator: ArtifactValidator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-validator-test-'));
    validator = new ArtifactValidator(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getArtifactMap', () => {
    it('should return greenfield artifacts for greenfield mode', () => {
      const map = validator.getArtifactMap('greenfield');
      expect(map).toBe(GREENFIELD_ARTIFACTS);
      expect(map.length).toBeGreaterThan(0);
    });

    it('should return enhancement artifacts for enhancement mode', () => {
      const map = validator.getArtifactMap('enhancement');
      expect(map).toBe(ENHANCEMENT_ARTIFACTS);
      expect(map.length).toBeGreaterThan(0);
    });

    it('should return import artifacts for import mode', () => {
      const map = validator.getArtifactMap('import');
      expect(map).toBe(IMPORT_ARTIFACTS);
      expect(map.length).toBeGreaterThan(0);
    });
  });

  describe('validateStageArtifacts', () => {
    it('should return valid for a stage with no artifact definition', async () => {
      const result = await validator.validateStageArtifacts('mode_detection', 'greenfield');
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.found).toHaveLength(0);
    });

    it('should return valid when all required artifacts exist', async () => {
      // Create the expected artifact for initialization stage
      const scratchpadDir = path.join(tempDir, '.ad-sdlc', 'scratchpad');
      await fs.mkdir(scratchpadDir, { recursive: true });

      const result = await validator.validateStageArtifacts('initialization', 'greenfield');
      expect(result.valid).toBe(true);
      expect(result.stage).toBe('initialization');
      expect(result.found.length).toBeGreaterThan(0);
      expect(result.missing).toHaveLength(0);
    });

    it('should return invalid when required artifacts are missing', async () => {
      const result = await validator.validateStageArtifacts('collection', 'greenfield');
      expect(result.valid).toBe(false);
      expect(result.stage).toBe('collection');
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing[0]!.description).toBe('Collected requirements');
    });

    it('should match artifacts with wildcard glob pattern', async () => {
      // Create directory structure matching .ad-sdlc/scratchpad/info/*/collected_info.yaml
      const infoDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'info', 'session-001');
      await fs.mkdir(infoDir, { recursive: true });
      await fs.writeFile(path.join(infoDir, 'collected_info.yaml'), 'test: true\n');

      const result = await validator.validateStageArtifacts('collection', 'greenfield');
      expect(result.valid).toBe(true);
      expect(result.found.length).toBe(1);
      expect(result.found[0]).toContain('collected_info.yaml');
    });

    it('should not fail on non-required missing artifacts', async () => {
      // prd_generation has a required scratchpad artifact and an optional public docs artifact
      // Create only the required one
      const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
      await fs.mkdir(docsDir, { recursive: true });
      await fs.writeFile(path.join(docsDir, 'prd.md'), '# PRD\n');

      const result = await validator.validateStageArtifacts('prd_generation', 'greenfield');
      expect(result.valid).toBe(true);
      // Only the required artifact found, optional one missing but not in missing list
      expect(result.found.length).toBe(1);
      expect(result.missing).toHaveLength(0);
    });

    it('should validate enhancement mode artifacts', async () => {
      // Create document_state.yaml for document_reading stage
      const analysisDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'analysis', 'run-001');
      await fs.mkdir(analysisDir, { recursive: true });
      await fs.writeFile(path.join(analysisDir, 'document_state.yaml'), 'state: parsed\n');

      const result = await validator.validateStageArtifacts('document_reading', 'enhancement');
      expect(result.valid).toBe(true);
      expect(result.found.length).toBe(1);
    });

    it('should return valid for any stage in import mode', async () => {
      // Import mode has no artifact definitions
      const result = await validator.validateStageArtifacts('issue_reading', 'import');
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should validate literal path without wildcards', async () => {
      // issue_generation uses a literal path: .ad-sdlc/scratchpad/issues/issue_list.json
      const issueDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'issues');
      await fs.mkdir(issueDir, { recursive: true });
      await fs.writeFile(path.join(issueDir, 'issue_list.json'), '[]');

      const result = await validator.validateStageArtifacts('issue_generation', 'greenfield');
      expect(result.valid).toBe(true);
      expect(result.found.length).toBe(1);
    });
  });

  describe('validatePreCompletedStages', () => {
    it('should validate only the specified stages', async () => {
      const stages = new Set<StageName>(['initialization', 'collection']);

      // Create initialization artifact only
      await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad'), { recursive: true });

      const results = await validator.validatePreCompletedStages(stages, 'greenfield');
      expect(results).toHaveLength(2);

      const initResult = results.find((r) => r.stage === 'initialization');
      const collectionResult = results.find((r) => r.stage === 'collection');

      expect(initResult?.valid).toBe(true);
      expect(collectionResult?.valid).toBe(false);
    });

    it('should return empty results when no stages match artifact definitions', async () => {
      // mode_detection has no artifact definition
      const stages = new Set<StageName>(['mode_detection']);
      const results = await validator.validatePreCompletedStages(stages, 'greenfield');
      expect(results).toHaveLength(0);
    });

    it('should return empty results for import mode', async () => {
      const stages = new Set<StageName>(['issue_reading', 'orchestration']);
      const results = await validator.validatePreCompletedStages(stages, 'import');
      expect(results).toHaveLength(0);
    });

    it('should validate all artifacts present correctly', async () => {
      // Create all required artifacts for collection and prd_generation
      const infoDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'info', 'session-001');
      const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
      await fs.mkdir(infoDir, { recursive: true });
      await fs.mkdir(docsDir, { recursive: true });
      await fs.writeFile(path.join(infoDir, 'collected_info.yaml'), 'data: true\n');
      await fs.writeFile(path.join(docsDir, 'prd.md'), '# PRD\n');

      const stages = new Set<StageName>(['collection', 'prd_generation']);
      const results = await validator.validatePreCompletedStages(stages, 'greenfield');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.valid)).toBe(true);
    });

    it('should identify all missing artifacts when none exist', async () => {
      const stages = new Set<StageName>([
        'collection',
        'prd_generation',
        'srs_generation',
        'sds_generation',
        'issue_generation',
      ]);

      const results = await validator.validatePreCompletedStages(stages, 'greenfield');

      expect(results).toHaveLength(5);
      expect(results.every((r) => !r.valid)).toBe(true);
    });

    it('should find multiple matches for a wildcard pattern', async () => {
      // Create multiple session directories with collected_info.yaml
      for (const session of ['session-001', 'session-002']) {
        const dir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'info', session);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'collected_info.yaml'), `session: ${session}\n`);
      }

      const result = await validator.validateStageArtifacts('collection', 'greenfield');
      expect(result.valid).toBe(true);
      expect(result.found).toHaveLength(2);
    });
  });

  describe('validateStageOutput (content quality)', () => {
    describe('collection stage', () => {
      it('should return good quality when collected_info.yaml has FR with title and description', async () => {
        const infoDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'info', 'session-001');
        await fs.mkdir(infoDir, { recursive: true });
        await fs.writeFile(
          path.join(infoDir, 'collected_info.yaml'),
          'functional_requirements:\n  - title: User Login\n    description: Users can log in with email and password\n'
        );

        const result = await validator.validateStageOutput('collection', 'greenfield');
        expect(result.stage).toBe('collection');
        expect(result.quality).toBe('good');
        expect(result.warnings).toHaveLength(0);
      });

      it('should return degraded when collected_info.yaml has no FR content', async () => {
        const infoDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'info', 'session-001');
        await fs.mkdir(infoDir, { recursive: true });
        await fs.writeFile(
          path.join(infoDir, 'collected_info.yaml'),
          'functional_requirements:\n  - title:\n    description:\n'
        );

        const result = await validator.validateStageOutput('collection', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('should return degraded when collected_info.yaml does not exist', async () => {
        const result = await validator.validateStageOutput('collection', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings).toContain('collected_info.yaml not found');
      });
    });

    describe('prd_generation stage', () => {
      it('should return good quality for a well-formed PRD', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'prd.md'),
          '# PRD: My Project\n\n## Overview\n\nThis is a product requirements document that describes the functional and non-functional requirements for the system in sufficient detail.\n'
        );

        const result = await validator.validateStageOutput('prd_generation', 'greenfield');
        expect(result.quality).toBe('good');
        expect(result.warnings).toHaveLength(0);
      });

      it('should detect unsubstituted ${...} template variables', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'prd.md'),
          '# PRD: ${PROJECT_NAME}\n\nThis project ${DESCRIPTION} provides enough content to pass the length check for meaningful content in the validator.\n'
        );

        const result = await validator.validateStageOutput('prd_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.some((w) => w.includes('template variable'))).toBe(true);
      });

      it('should detect unsubstituted {{...}} mustache variables', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'prd.md'),
          '# PRD: {{PROJECT_NAME}}\n\nThe {{DESCRIPTION}} here provides enough meaningful content to pass the minimum length check for the validator.\n'
        );

        const result = await validator.validateStageOutput('prd_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.some((w) => w.includes('template variable'))).toBe(true);
      });

      it('should detect insufficient content length', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(path.join(docsDir, 'prd.md'), '# PRD\n\nShort.\n');

        const result = await validator.validateStageOutput('prd_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.some((w) => w.includes('insufficient meaningful content'))).toBe(
          true
        );
      });

      it('should return degraded when PRD file is missing', async () => {
        const result = await validator.validateStageOutput('prd_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings).toContain('PRD document not found in scratchpad');
      });
    });

    describe('srs_generation stage', () => {
      it('should return good quality for a well-formed SRS', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'srs.md'),
          '# SRS: My Application\n\n## 3. System Features\n\n### 3.1 User Management\n'
        );

        const result = await validator.validateStageOutput('srs_generation', 'greenfield');
        expect(result.quality).toBe('good');
        expect(result.warnings).toHaveLength(0);
      });

      it('should detect missing System Features section', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'srs.md'),
          '# SRS: My Application\n\n## Introduction\n\nSome intro text.\n'
        );

        const result = await validator.validateStageOutput('srs_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.some((w) => w.includes('System Features'))).toBe(true);
      });

      it('should detect placeholder product name "Unknown Product"', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'srs.md'),
          '# SRS: Unknown Product\n\n## 3. System Features\n\n### 3.1 Feature A\n'
        );

        const result = await validator.validateStageOutput('srs_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.some((w) => w.includes('placeholder product name'))).toBe(true);
      });

      it('should detect template variable in product name', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(
          path.join(docsDir, 'srs.md'),
          '# SRS: ${PROJECT_NAME}\n\n## 3. System Features\n\n### 3.1 Feature A\n'
        );

        const result = await validator.validateStageOutput('srs_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings.some((w) => w.includes('placeholder product name'))).toBe(true);
      });

      it('should return degraded when SRS file is missing', async () => {
        const result = await validator.validateStageOutput('srs_generation', 'greenfield');
        expect(result.quality).toBe('degraded');
        expect(result.warnings).toContain('SRS document not found in scratchpad');
      });
    });

    describe('prd_update and srs_update stages', () => {
      it('should validate prd_update the same as prd_generation', async () => {
        const docsDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents', 'v1');
        await fs.mkdir(docsDir, { recursive: true });
        await fs.writeFile(path.join(docsDir, 'prd.md'), '# PRD\n\nShort.\n');

        const result = await validator.validateStageOutput('prd_update', 'enhancement');
        expect(result.quality).toBe('degraded');
      });

      it('should validate srs_update the same as srs_generation', async () => {
        const result = await validator.validateStageOutput('srs_update', 'enhancement');
        expect(result.quality).toBe('degraded');
        expect(result.warnings).toContain('SRS document not found in scratchpad');
      });
    });

    describe('other stages', () => {
      it('should return good quality for stages without content validation', async () => {
        const result = await validator.validateStageOutput('initialization', 'greenfield');
        expect(result.quality).toBe('good');
        expect(result.warnings).toHaveLength(0);
      });

      it('should return good quality for sds_generation (no content check yet)', async () => {
        const result = await validator.validateStageOutput('sds_generation', 'greenfield');
        expect(result.quality).toBe('good');
        expect(result.warnings).toHaveLength(0);
      });
    });
  });
});

describe('Artifact Map Definitions', () => {
  it('GREENFIELD_ARTIFACTS should cover key stages', () => {
    const stageNames = GREENFIELD_ARTIFACTS.map((a) => a.stage);
    expect(stageNames).toContain('initialization');
    expect(stageNames).toContain('collection');
    expect(stageNames).toContain('prd_generation');
    expect(stageNames).toContain('srs_generation');
    expect(stageNames).toContain('sds_generation');
    expect(stageNames).toContain('issue_generation');
  });

  it('ENHANCEMENT_ARTIFACTS should cover key stages', () => {
    const stageNames = ENHANCEMENT_ARTIFACTS.map((a) => a.stage);
    expect(stageNames).toContain('document_reading');
    expect(stageNames).toContain('codebase_analysis');
    expect(stageNames).toContain('code_reading');
    expect(stageNames).toContain('doc_code_comparison');
    expect(stageNames).toContain('impact_analysis');
    expect(stageNames).toContain('prd_update');
    expect(stageNames).toContain('srs_update');
    expect(stageNames).toContain('sds_update');
    expect(stageNames).toContain('issue_generation');
  });

  it('every artifact spec should have non-empty fields', () => {
    const allMaps = [...GREENFIELD_ARTIFACTS, ...ENHANCEMENT_ARTIFACTS];
    for (const entry of allMaps) {
      expect(entry.stage).toBeTruthy();
      for (const artifact of entry.requiredArtifacts) {
        expect(artifact.pathPattern).toBeTruthy();
        expect(artifact.description).toBeTruthy();
        expect(typeof artifact.required).toBe('boolean');
      }
    }
  });
});
