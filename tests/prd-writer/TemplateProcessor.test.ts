import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TemplateProcessor } from '../../src/prd-writer/TemplateProcessor.js';
import type { CollectedInfo } from '../../src/scratchpad/index.js';
import type { PRDMetadata } from '../../src/prd-writer/types.js';

describe('TemplateProcessor', () => {
  const testTemplateDir = path.join(process.cwd(), 'tests', 'prd-writer', 'test-templates');
  const testTemplatePath = path.join(testTemplateDir, 'test-template.md');

  const createMinimalCollectedInfo = (overrides: Partial<CollectedInfo> = {}): CollectedInfo => ({
    schemaVersion: '1.0.0',
    projectId: '001',
    status: 'completed',
    project: {
      name: 'Test Project',
      description: 'A comprehensive test project for validation purposes',
    },
    requirements: {
      functional: [],
      nonFunctional: [],
    },
    constraints: [],
    assumptions: [],
    dependencies: [],
    clarifications: [],
    sources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createMetadata = (): PRDMetadata => ({
    documentId: 'PRD-001',
    version: '1.0.0',
    status: 'Draft',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    projectId: '001',
    productName: 'Test Project',
  });

  beforeEach(async () => {
    await fs.promises.mkdir(testTemplateDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testTemplateDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create processor with default options', () => {
      const processor = new TemplateProcessor();
      expect(processor).toBeDefined();
    });

    it('should create processor with custom options', () => {
      const processor = new TemplateProcessor({
        templatePath: 'custom/template.md',
        removeUnsubstituted: true,
      });
      expect(processor).toBeDefined();
    });
  });

  describe('process', () => {
    it('should process template with variable substitution', async () => {
      // Using snake_case variables as per buildVariableMap
      const templateContent = `# \${product_name}

## Version
\${version}

## Description
\${project_description}
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('# Test Project');
      expect(result.content).toContain('## Version');
      expect(result.content).toContain('1.0.0');
      expect(result.content).toContain('A comprehensive test project');
    });

    it('should include functional requirements in generated content', async () => {
      const templateContent = `# PRD

<!-- Repeat FR-XXX section for each functional requirement -->
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'User Login',
              description: 'Allow users to authenticate',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [
                { id: 'AC-001', description: 'Login form works', testable: true },
              ],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [],
        },
      });
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('FR-001');
      expect(result.content).toContain('User Login');
      expect(result.content).toContain('Allow users to authenticate');
    });

    it('should handle missing template file gracefully', () => {
      const processor = new TemplateProcessor({
        templatePath: 'non-existent/template.md',
      });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      expect(() => processor.process(info, metadata)).toThrow();
    });

    it('should track missing variables', async () => {
      const templateContent = `# \${product_name}

## Unknown Section
\${unknownVariable}
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({
        templatePath: testTemplatePath,
        removeUnsubstituted: false,
      });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.missingVariables.length).toBeGreaterThan(0);
      expect(result.missingVariables).toContain('unknownVariable');
    });

    it('should remove unsubstituted variables when option is set', async () => {
      const templateContent = `# \${product_name}

Some text \${unknownVariable} more text
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({
        templatePath: testTemplatePath,
        removeUnsubstituted: true,
      });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).not.toContain('${unknownVariable}');
    });

    it('should track substituted variables', async () => {
      const templateContent = `# \${product_name}

Version: \${version}
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.substitutedVariables).toContain('product_name');
      expect(result.substitutedVariables).toContain('version');
    });
  });

  describe('generateWithoutTemplate', () => {
    it('should generate PRD without template file', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'User Login',
              description: 'Allow users to authenticate',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [{ id: 'AC-001', description: 'Login works', testable: true }],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Speed',
              description: 'Fast',
              priority: 'P1',
              metric: '< 100ms',
            },
          ],
        },
        constraints: [{ id: 'CON-001', description: 'Use TypeScript', reason: 'Standard' }],
        assumptions: [
          {
            id: 'ASM-001',
            description: 'Internet available',
            validated: true,
            riskIfWrong: 'Offline issues',
          },
        ],
        dependencies: [{ name: 'vitest', type: 'library', required: true, purpose: 'Testing' }],
      });
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('# PRD: Test Project');
      expect(content).toContain('FR-001');
      expect(content).toContain('NFR-001');
      expect(content).toContain('CON-001');
      expect(content).toContain('ASM-001');
      expect(content).toContain('vitest');
    });

    it('should include metadata in generated PRD', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('PRD-001');
      expect(content).toContain('1.0.0');
      expect(content).toContain('Draft');
    });

    it('should handle empty requirements gracefully', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('# PRD: Test Project');
      expect(content).toContain('No functional requirements defined');
    });

    it('should categorize NFRs by category', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Speed',
              description: 'Fast response',
              priority: 'P0',
            },
            {
              id: 'NFR-002',
              category: 'security',
              title: 'Encryption',
              description: 'Data encryption',
              priority: 'P0',
            },
            {
              id: 'NFR-003',
              category: 'performance',
              title: 'Throughput',
              description: 'High throughput',
              priority: 'P1',
            },
          ],
        },
      });
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('NFR-001');
      expect(content).toContain('NFR-002');
      expect(content).toContain('NFR-003');
      expect(content).toContain('Speed');
      expect(content).toContain('Encryption');
      expect(content).toContain('Throughput');
    });

    it('should generate value propositions from high priority requirements', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Core Feature',
              description: 'The main feature that provides great value',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [],
        },
      });
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('Key Value Propositions');
      expect(content).toContain('Core Feature');
    });

    it('should generate goals from P0 requirements', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Critical Feature',
              description: 'Must have feature',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [],
        },
      });
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('Primary Goals');
      expect(content).toContain('Critical Feature');
    });

    it('should generate risks from assumptions', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo({
        assumptions: [
          {
            id: 'ASM-001',
            description: 'Users have stable internet',
            validated: false,
            riskIfWrong: 'Application may fail offline',
          },
        ],
      });
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('Risks');
      expect(content).toContain('ASM-001');
      expect(content).toContain('Application may fail offline');
    });

    it('should separate external and internal dependencies', () => {
      const processor = new TemplateProcessor();
      const info = createMinimalCollectedInfo({
        dependencies: [
          { name: 'axios', type: 'library', required: true, purpose: 'HTTP client' },
          { name: 'node', type: 'tool', required: true, purpose: 'Runtime' },
        ],
      });
      const metadata = createMetadata();

      const content = processor.generateWithoutTemplate(info, metadata);

      expect(content).toContain('External Dependencies');
      expect(content).toContain('Internal Dependencies');
      expect(content).toContain('axios');
      expect(content).toContain('node');
    });
  });

  describe('mustache variable substitution', () => {
    it('should replace {{PROJECT_NAME}} with product name', async () => {
      const templateContent = '# {{PROJECT_NAME}}\n\nVersion: {{VERSION}}\nDate: {{DATE}}';
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('# Test Project');
      expect(result.content).toContain('Version: 1.0.0');
      expect(result.content).toContain('Date: 2024-01-01');
      expect(result.content).not.toContain('{{PROJECT_NAME}}');
      expect(result.content).not.toContain('{{VERSION}}');
    });

    it('should replace unmatched mustache vars with [Not yet generated]', async () => {
      const templateContent = '# {{PROJECT_NAME}}\n\n{{UNKNOWN_FIELD}}';
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('# Test Project');
      expect(result.missingVariables).toContain('UNKNOWN_FIELD');
    });

    it('should remove unmatched mustache vars when removeUnsubstituted is set', async () => {
      const templateContent = '# {{PROJECT_NAME}}\n{{UNKNOWN_FIELD}}';
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({
        templatePath: testTemplatePath,
        removeUnsubstituted: true,
      });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('# Test Project');
      expect(result.content).not.toContain('UNKNOWN_FIELD');
      expect(result.content).not.toContain('[Not yet generated]');
    });

    it('should handle mixed ${...} and {{...}} patterns', async () => {
      const templateContent = '# {{PROJECT_NAME}}\n\nID: ${project_id}\nDesc: {{DESCRIPTION}}';
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('# Test Project');
      expect(result.content).toContain('ID: 001');
      expect(result.content).toContain(info.project.description);
    });
  });

  describe('HTML comment placeholder replacement', () => {
    it('should replace purpose/overview comments with project description', async () => {
      const templateContent = `# \${product_name}

## 1. Purpose

<!-- Describe the purpose of this product -->

## 2. Scope

<!-- Describe the scope of this project -->
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Bookmark Manager',
          description:
            'A CLI tool for managing bookmarks with add, delete, list, and search commands.',
        },
      });
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).not.toContain('<!-- Describe the purpose');
      expect(result.content).not.toContain('<!-- Describe the scope');
      expect(result.content).toContain('A CLI tool for managing bookmarks');
    });

    it('should replace non-purpose comments with [To be elaborated]', async () => {
      const templateContent = `# \${product_name}

## Timeline

<!-- Add timeline details here -->
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).not.toContain('<!-- Add timeline details here -->');
      expect(result.content).toContain('[To be elaborated]');
    });

    it('should not modify inline HTML comments within other content', async () => {
      const templateContent = `# \${product_name}

Some text <!-- inline comment --> more text
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo();
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      // Inline comments (not the entire line) should be preserved
      expect(result.content).toContain('Some text <!-- inline comment --> more text');
    });

    it('should use source summary when project description is empty', async () => {
      const templateContent = `# \${product_name}

## Overview

<!-- Describe the overview -->
`;
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test',
          description: '',
        },
        sources: [
          {
            type: 'conversation',
            reference: 'user input',
            summary: 'Build a task tracking CLI with TypeScript',
          },
        ],
      });
      const metadata = createMetadata();

      const result = processor.process(info, metadata);

      expect(result.content).toContain('Build a task tracking CLI with TypeScript');
      expect(result.content).not.toContain('<!-- Describe the overview -->');
    });
  });

  describe('loadTemplate', () => {
    it('should cache loaded template', async () => {
      const templateContent = '# Test Template';
      await fs.promises.writeFile(testTemplatePath, templateContent);

      const processor = new TemplateProcessor({ templatePath: testTemplatePath });

      // First load
      const template1 = processor.loadTemplate();
      // Second load (should use cache)
      const template2 = processor.loadTemplate();

      expect(template1).toBe(template2);
      expect(template1).toContain('Test Template');
    });
  });
});
