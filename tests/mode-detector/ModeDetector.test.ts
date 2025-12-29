/**
 * Mode Detector tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  ModeDetector,
  getModeDetector,
  resetModeDetector,
  NoActiveSessionError,
  ProjectNotFoundError,
  InvalidSessionStateError,
  DEFAULT_MODE_DETECTOR_CONFIG,
} from '../../src/mode-detector/index.js';

describe('ModeDetector', () => {
  let tempDir: string;
  let detector: ModeDetector;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mode-detector-test-'));

    // Reset singleton
    resetModeDetector();

    // Create new instance
    detector = new ModeDetector();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    resetModeDetector();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      const instance = new ModeDetector();
      expect(instance).toBeInstanceOf(ModeDetector);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        docsBasePath: 'documentation',
        thresholds: {
          minSourceFiles: 10,
        },
      };
      const instance = new ModeDetector(customConfig);
      expect(instance).toBeInstanceOf(ModeDetector);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getModeDetector', () => {
      const instance1 = getModeDetector();
      const instance2 = getModeDetector();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetModeDetector', () => {
      const instance1 = getModeDetector();
      resetModeDetector();
      const instance2 = getModeDetector();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Session Management', () => {
    it('should start a new session', () => {
      const session = detector.startSession('test-project', tempDir, 'add new feature');
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.status).toBe('detecting');
      expect(session.rootPath).toBe(tempDir);
      expect(session.userInput).toBe('add new feature');
    });

    it('should return session with getSession', () => {
      detector.startSession('test-project', tempDir);
      const session = detector.getSession();
      expect(session).not.toBeNull();
      expect(session?.projectId).toBe('test-project');
    });

    it('should return null when no session exists', () => {
      const session = detector.getSession();
      expect(session).toBeNull();
    });
  });

  describe('Greenfield Detection', () => {
    it('should detect greenfield mode when no docs and no code exist', async () => {
      detector.startSession('test-project', tempDir);
      const result = await detector.detect();

      expect(result.selectedMode).toBe('greenfield');
      expect(result.confidence).toBe(1.0);
      expect(result.confidenceLevel).toBe('high');
      expect(result.evidence.documents.prd).toBe(false);
      expect(result.evidence.documents.srs).toBe(false);
      expect(result.evidence.documents.sds).toBe(false);
      expect(result.evidence.codebase.exists).toBe(false);
    });

    it('should detect greenfield with high confidence for empty project', async () => {
      detector.startSession('empty-project', tempDir);
      const result = await detector.detect();

      expect(result.selectedMode).toBe('greenfield');
      expect(result.confidenceLevel).toBe('high');
      expect(result.reasoning).toContain('No existing PRD/SRS/SDS');
      expect(result.reasoning).toContain('No substantial codebase');
    });

    it('should detect greenfield keywords in user input', async () => {
      detector.startSession('new-project', tempDir, 'create new project from scratch');
      const result = await detector.detect();

      expect(result.selectedMode).toBe('greenfield');
      expect(result.evidence.keywords.greenfieldKeywords).toContain('from scratch');
    });
  });

  describe('Enhancement Detection', () => {
    beforeEach(async () => {
      // Create docs structure
      await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'docs', 'srs'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'docs', 'sds'), { recursive: true });

      // Create PRD document
      await fs.writeFile(
        path.join(tempDir, 'docs', 'prd', 'PRD-001.md'),
        '# Product Requirements Document\n\n## Requirements\n\n- FR-001: User login'
      );

      // Create SRS document
      await fs.writeFile(
        path.join(tempDir, 'docs', 'srs', 'SRS-001.md'),
        '# Software Requirements Specification\n\n## Features\n\n- SF-001: Authentication'
      );

      // Create SDS document
      await fs.writeFile(
        path.join(tempDir, 'docs', 'sds', 'SDS-001.md'),
        '# Software Design Specification\n\n## Components\n\n- CMP-001: AuthService'
      );

      // Create source files
      await fs.mkdir(path.join(tempDir, 'src', 'services'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'controllers'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'models'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });

      // Create multiple source files to meet threshold
      for (let i = 0; i < 6; i++) {
        await fs.writeFile(
          path.join(tempDir, 'src', 'services', `service${i}.ts`),
          `export class Service${i} {\n  doSomething(): void {}\n}\n`.repeat(20)
        );
      }

      // Create test file
      await fs.writeFile(
        path.join(tempDir, 'tests', 'service.test.ts'),
        'describe("Service", () => { it("works", () => {}); });'
      );

      // Create package.json
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', version: '1.0.0' })
      );
    });

    it('should detect enhancement mode when docs and code exist', async () => {
      detector.startSession('existing-project', tempDir);
      const result = await detector.detect();

      expect(result.selectedMode).toBe('enhancement');
      expect(result.evidence.documents.prd).toBe(true);
      expect(result.evidence.documents.srs).toBe(true);
      expect(result.evidence.documents.sds).toBe(true);
      expect(result.evidence.codebase.exists).toBe(true);
    });

    it('should detect enhancement mode with high confidence', async () => {
      detector.startSession('existing-project', tempDir);
      const result = await detector.detect();

      expect(result.selectedMode).toBe('enhancement');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect test suite presence', async () => {
      detector.startSession('existing-project', tempDir);
      const result = await detector.detect();

      expect(result.evidence.codebase.hasTests).toBe(true);
    });

    it('should detect build system presence', async () => {
      detector.startSession('existing-project', tempDir);
      const result = await detector.detect();

      expect(result.evidence.codebase.hasBuildSystem).toBe(true);
    });

    it('should detect enhancement keywords in user input', async () => {
      detector.startSession('existing-project', tempDir, 'add feature to improve performance');
      const result = await detector.detect();

      expect(result.evidence.keywords.enhancementKeywords).toContain('add feature');
      expect(result.evidence.keywords.enhancementKeywords).toContain('improve');
    });
  });

  describe('Documents Only Detection', () => {
    beforeEach(async () => {
      // Create docs structure only
      await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'docs', 'prd', 'PRD-001.md'),
        '# Product Requirements Document'
      );
    });

    it('should detect enhancement mode with docs only', async () => {
      detector.startSession('docs-only-project', tempDir);
      const result = await detector.detect();

      expect(result.selectedMode).toBe('enhancement');
      expect(result.evidence.documents.prd).toBe(true);
      expect(result.evidence.codebase.exists).toBe(false);
    });
  });

  describe('Codebase Only Detection', () => {
    beforeEach(async () => {
      // Create source files only (no docs)
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(
          path.join(tempDir, 'src', `module${i}.ts`),
          `export const module${i} = {};\n`.repeat(20)
        );
      }
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'code-only', version: '1.0.0' })
      );
    });

    it('should detect enhancement mode with code only', async () => {
      detector.startSession('code-only-project', tempDir);
      const result = await detector.detect();

      expect(result.selectedMode).toBe('enhancement');
      expect(result.evidence.documents.totalCount).toBe(0);
      expect(result.evidence.codebase.exists).toBe(true);
      expect(result.evidence.codebase.sourceFileCount).toBeGreaterThan(0);
    });

    it('should recommend creating documentation', async () => {
      detector.startSession('code-only-project', tempDir);
      const result = await detector.detect();

      expect(result.recommendations.some((r) => r.includes('PRD'))).toBe(true);
    });
  });

  describe('User Override', () => {
    it('should respect user override for greenfield mode', async () => {
      // Even with existing docs and code
      await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'PRD-001.md'), '# PRD');
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(tempDir, 'src', `file${i}.ts`), 'export {};');
      }

      detector.startSession('override-project', tempDir);
      const result = await detector.detect('greenfield');

      expect(result.selectedMode).toBe('greenfield');
      expect(result.confidence).toBe(1.0);
      expect(result.evidence.userOverride.specified).toBe(true);
      expect(result.evidence.userOverride.mode).toBe('greenfield');
    });

    it('should respect user override for enhancement mode', async () => {
      detector.startSession('override-project', tempDir);
      const result = await detector.detect('enhancement');

      expect(result.selectedMode).toBe('enhancement');
      expect(result.confidence).toBe(1.0);
      expect(result.evidence.userOverride.specified).toBe(true);
    });
  });

  describe('Scoring System', () => {
    it('should calculate document score correctly', async () => {
      // Create only PRD (1/3 docs = 0.33 score)
      await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'PRD-001.md'), '# PRD');

      detector.startSession('partial-docs', tempDir);
      const result = await detector.detect();

      expect(result.scores.documentScore).toBeCloseTo(1 / 3, 2);
    });

    it('should calculate codebase score correctly', async () => {
      // Create substantial codebase
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });

      // Multiple files with lots of lines
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(
          path.join(tempDir, 'src', `file${i}.ts`),
          'export const x = 1;\n'.repeat(50)
        );
      }
      await fs.writeFile(path.join(tempDir, 'tests', 'test.ts'), 'describe("x", () => {});');
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      detector.startSession('substantial-code', tempDir);
      const result = await detector.detect();

      expect(result.scores.codebaseScore).toBeGreaterThan(0.5);
    });

    it('should calculate keyword score based on signal strength', async () => {
      detector.startSession('keyword-test', tempDir, 'add feature improve existing');
      const result = await detector.detect();

      // All enhancement keywords, no greenfield keywords
      expect(result.scores.keywordScore).toBeGreaterThan(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should throw NoActiveSessionError when detecting without session', async () => {
      await expect(detector.detect()).rejects.toThrow(NoActiveSessionError);
    });

    it('should throw ProjectNotFoundError for non-existent path', async () => {
      detector.startSession('test', '/non/existent/path');
      await expect(detector.detect()).rejects.toThrow(ProjectNotFoundError);
    });

    it('should throw InvalidSessionStateError when detecting twice', async () => {
      detector.startSession('test', tempDir);
      await detector.detect();
      await expect(detector.detect()).rejects.toThrow(InvalidSessionStateError);
    });
  });

  describe('Output Generation', () => {
    it('should save result to scratchpad', async () => {
      detector.startSession('output-test', tempDir);
      await detector.detect();

      const outputPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'mode_detection',
        'output-test_mode_detection_result.yaml'
      );

      const exists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should generate valid YAML output', async () => {
      detector.startSession('yaml-test', tempDir);
      await detector.detect();

      const outputPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'mode_detection',
        'yaml-test_mode_detection_result.yaml'
      );

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('detection_result:');
      expect(content).toContain('selected_mode:');
      expect(content).toContain('confidence:');
    });
  });

  describe('Reasoning Generation', () => {
    it('should generate meaningful reasoning for greenfield', async () => {
      detector.startSession('reasoning-test', tempDir);
      const result = await detector.detect();

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('GREENFIELD');
    });

    it('should include all evidence in reasoning', async () => {
      await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'PRD.md'), '# PRD');

      detector.startSession('reasoning-test', tempDir, 'add feature');
      const result = await detector.detect();

      expect(result.reasoning).toContain('PRD');
      expect(result.reasoning).toContain('add feature');
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for greenfield mode', async () => {
      detector.startSession('rec-test', tempDir);
      const result = await detector.detect();

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes('Starting fresh'))).toBe(true);
    });

    it('should recommend creating missing docs in enhancement mode', async () => {
      // Create only code
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(tempDir, 'src', `f${i}.ts`), 'export {};');
      }
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      detector.startSession('rec-test', tempDir);
      const result = await detector.detect();

      expect(result.recommendations.some((r) => r.includes('PRD'))).toBe(true);
      expect(result.recommendations.some((r) => r.includes('SRS'))).toBe(true);
      expect(result.recommendations.some((r) => r.includes('SDS'))).toBe(true);
    });
  });
});

describe('Default Configuration', () => {
  it('should have valid default keywords', () => {
    expect(DEFAULT_MODE_DETECTOR_CONFIG.keywords.greenfieldKeywords.length).toBeGreaterThan(0);
    expect(DEFAULT_MODE_DETECTOR_CONFIG.keywords.enhancementKeywords.length).toBeGreaterThan(0);
  });

  it('should have valid default thresholds', () => {
    expect(DEFAULT_MODE_DETECTOR_CONFIG.thresholds.enhancementThreshold).toBeGreaterThan(0);
    expect(DEFAULT_MODE_DETECTOR_CONFIG.thresholds.greenfieldThreshold).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_MODE_DETECTOR_CONFIG.thresholds.enhancementThreshold).toBeGreaterThan(
      DEFAULT_MODE_DETECTOR_CONFIG.thresholds.greenfieldThreshold
    );
  });

  it('should have valid default weights that sum to 1', () => {
    const { documents, codebase, keywords } = DEFAULT_MODE_DETECTOR_CONFIG.weights;
    expect(documents + codebase + keywords).toBe(1.0);
  });
});
