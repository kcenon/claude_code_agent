/**
 * Doc-Code Comparator Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  DocCodeComparatorAgent,
  getDocCodeComparatorAgent,
  resetDocCodeComparatorAgent,
  NoActiveSessionError,
  DocumentInventoryNotFoundError,
  CodeInventoryNotFoundError,
  DEFAULT_DOC_CODE_COMPARATOR_CONFIG,
} from '../../src/doc-code-comparator/index.js';

describe('DocCodeComparatorAgent', () => {
  let tempDir: string;
  let agent: DocCodeComparatorAgent;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-code-comparator-test-'));

    // Create directory structure
    await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad', 'state', 'test-project'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad', 'analysis', 'test-project'), {
      recursive: true,
    });

    // Create agent with temp directory config
    agent = new DocCodeComparatorAgent({
      scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    resetDocCodeComparatorAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new DocCodeComparatorAgent();
      expect(defaultAgent).toBeInstanceOf(DocCodeComparatorAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new DocCodeComparatorAgent({
        minMatchConfidence: 0.7,
        generateIssues: false,
        reportUndocumentedCode: false,
      });
      expect(customAgent).toBeInstanceOf(DocCodeComparatorAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_DOC_CODE_COMPARATOR_CONFIG.scratchpadBasePath).toBe('.ad-sdlc/scratchpad');
      expect(DEFAULT_DOC_CODE_COMPARATOR_CONFIG.sourceRoot).toBe('src');
      expect(DEFAULT_DOC_CODE_COMPARATOR_CONFIG.minMatchConfidence).toBe(0.5);
      expect(DEFAULT_DOC_CODE_COMPARATOR_CONFIG.generateIssues).toBe(true);
      expect(DEFAULT_DOC_CODE_COMPARATOR_CONFIG.reportUndocumentedCode).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getDocCodeComparatorAgent', () => {
      const agent1 = getDocCodeComparatorAgent();
      const agent2 = getDocCodeComparatorAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getDocCodeComparatorAgent();
      resetDocCodeComparatorAgent();
      const agent2 = getDocCodeComparatorAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('session management', () => {
    it('should start a session with project ID', async () => {
      const session = await agent.startSession('test-project');

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('idle');
      expect(session.documentInventoryPath).toBeNull();
      expect(session.codeInventoryPath).toBeNull();
      expect(session.result).toBeNull();
    });

    it('should return current session', async () => {
      expect(agent.getSession()).toBeNull();

      await agent.startSession('test-project');
      const session = agent.getSession();

      expect(session).toBeDefined();
      expect(session?.projectId).toBe('test-project');
    });

    it('should reset agent state', async () => {
      await agent.startSession('test-project');
      expect(agent.getSession()).not.toBeNull();

      agent.reset();
      expect(agent.getSession()).toBeNull();
    });

    it('should throw NoActiveSessionError when comparing without session', async () => {
      await expect(agent.compare()).rejects.toThrow(NoActiveSessionError);
    });
  });

  describe('inventory loading', () => {
    it('should throw DocumentInventoryNotFoundError when document inventory is missing', async () => {
      await agent.startSession('test-project');

      await expect(
        agent.compare(
          path.join(tempDir, 'nonexistent.yaml'),
          path.join(tempDir, 'code_inventory.yaml')
        )
      ).rejects.toThrow(DocumentInventoryNotFoundError);
    });

    it('should throw CodeInventoryNotFoundError when code inventory is missing', async () => {
      // Create document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components: []
  apis: []
`
      );

      await agent.startSession('test-project');

      await expect(
        agent.compare(docInventoryPath, path.join(tempDir, 'nonexistent.yaml'))
      ).rejects.toThrow(CodeInventoryNotFoundError);
    });
  });

  describe('comparison functionality', () => {
    it('should compare empty inventories successfully', async () => {
      // Create empty document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components: []
  apis: []
`
      );

      // Create empty code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project');
      expect(result.stats.documentItemsAnalyzed).toBe(0);
      expect(result.stats.codeModulesAnalyzed).toBe(0);
    });

    it('should detect documented but not implemented gaps', async () => {
      // Create document inventory with a component
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components:
    - id: CMP-001
      name: Test Component
      description: A test component
      sourceLocation: docs/sds/SDS-001.md:10
  apis: []
`
      );

      // Create empty code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);
      expect(result.result.gaps.length).toBeGreaterThan(0);

      const docNotImplGap = result.result.gaps.find(
        (g) => g.type === 'documented_not_implemented'
      );
      expect(docNotImplGap).toBeDefined();
      expect(docNotImplGap?.relatedIds).toContain('CMP-001');
    });

    it('should detect implemented but not documented gaps', async () => {
      // Create empty document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components: []
  apis: []
`
      );

      // Create code inventory with a module
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules:
    - name: custom-feature
      path: src/custom-feature
      classes:
        - name: CustomFeatureClass
      functions: []
      interfaces: []
      statistics:
        linesOfCode: 100
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);

      const implNotDocGap = result.result.gaps.find(
        (g) => g.type === 'implemented_not_documented'
      );
      expect(implNotDocGap).toBeDefined();
    });

    it('should match documented components to code modules', async () => {
      // Create document inventory with collector component
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components:
    - id: CMP-001
      name: Collector Agent
      description: Collects user requirements
      sourceLocation: docs/sds/SDS-001.md:10
  apis: []
`
      );

      // Create code inventory with matching module
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules:
    - name: collector
      path: src/collector
      classes:
        - name: CollectorAgent
      functions: []
      interfaces: []
      statistics:
        linesOfCode: 500
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);

      const matchedMapping = result.result.mappings.find(
        (m) => m.documentId === 'CMP-001' && m.status === 'matched'
      );
      expect(matchedMapping).toBeDefined();
      expect(matchedMapping?.codeModulePath).toBe('src/collector');
    });

    it('should skip infrastructure modules when reporting undocumented code', async () => {
      // Create empty document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components: []
  apis: []
`
      );

      // Create code inventory with infrastructure modules
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules:
    - name: utils
      path: src/utils
      classes: []
      functions:
        - name: formatDate
      interfaces: []
      statistics:
        linesOfCode: 50
    - name: types
      path: src/types
      classes: []
      functions: []
      interfaces:
        - name: Config
      statistics:
        linesOfCode: 30
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);

      // Infrastructure modules should not generate gaps
      const utilsGap = result.result.gaps.find(
        (g) => g.codeReference === 'src/utils'
      );
      const typesGap = result.result.gaps.find(
        (g) => g.codeReference === 'src/types'
      );

      expect(utilsGap).toBeUndefined();
      expect(typesGap).toBeUndefined();
    });
  });

  describe('gap summary and statistics', () => {
    it('should calculate correct gap summary', async () => {
      // Create document inventory with components
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional:
      - id: FR-001
        title: Feature 1
        description: Test feature
        sourceLocation: docs/prd/PRD-001.md:10
  features: []
  components:
    - id: CMP-001
      name: Missing Component
      description: A missing component
      sourceLocation: docs/sds/SDS-001.md:10
  apis: []
`
      );

      // Create empty code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);
      expect(result.result.gapSummary.totalGaps).toBeGreaterThan(0);
      expect(result.result.gapSummary.byType.documentedNotImplemented).toBeGreaterThan(0);
    });

    it('should calculate overall match score', async () => {
      // Create document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components:
    - id: CMP-001
      name: Collector Agent
      description: Matched component
      sourceLocation: docs/sds/SDS-001.md:10
    - id: CMP-002
      name: Unmatched Component
      description: Unmatched component
      sourceLocation: docs/sds/SDS-001.md:20
  apis: []
`
      );

      // Create code inventory with one matching module
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules:
    - name: collector
      path: src/collector
      classes:
        - name: CollectorAgent
      functions: []
      interfaces: []
      statistics:
        linesOfCode: 500
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);
      expect(result.result.statistics.overallMatchScore).toBeGreaterThanOrEqual(0);
      expect(result.result.statistics.overallMatchScore).toBeLessThanOrEqual(1);
    });
  });

  describe('issue generation', () => {
    it('should generate issues for gaps when configured', async () => {
      const agentWithIssues = new DocCodeComparatorAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        generateIssues: true,
      });

      // Create document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components:
    - id: CMP-001
      name: Missing Component
      description: A missing component
      sourceLocation: docs/sds/SDS-001.md:10
  apis: []
`
      );

      // Create empty code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agentWithIssues.startSession('test-project');
      const result = await agentWithIssues.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.gapIssuesPath).not.toBeNull();

      // Verify issues have expected structure
      const issue = result.issues[0];
      expect(issue).toBeDefined();
      if (issue) {
        expect(issue.title).toContain('[P');
        expect(issue.body).toContain('## Description');
        expect(issue.labels).toContain('gap-analysis');
      }
    });

    it('should not generate issues when disabled', async () => {
      const agentNoIssues = new DocCodeComparatorAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        generateIssues: false,
      });

      // Create document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components:
    - id: CMP-001
      name: Missing Component
      description: A missing component
      sourceLocation: docs/sds/SDS-001.md:10
  apis: []
`
      );

      // Create empty code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agentNoIssues.startSession('test-project');
      const result = await agentNoIssues.compare(docInventoryPath, codeInventoryPath);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.gapIssuesPath).toBeNull();
    });
  });

  describe('output files', () => {
    it('should write comparison result to YAML file', async () => {
      // Create document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components: []
  apis: []
`
      );

      // Create code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      expect(result.comparisonResultPath).toContain('comparison_result.yaml');

      // Verify file exists
      const content = await fs.readFile(result.comparisonResultPath, 'utf-8');
      expect(content).toContain('comparison_result');
      expect(content).toContain('project');
    });
  });

  describe('priority assignment', () => {
    it('should assign P0 priority to missing core pipeline agents', async () => {
      // Create document inventory with core agent
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components:
    - id: collector
      name: Collector Agent
      description: Core pipeline agent
      sourceLocation: docs/sds/SDS-001.md:10
  apis: []
`
      );

      // Create empty code inventory
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules: []
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      const collectorGap = result.result.gaps.find(
        (g) => g.relatedIds.includes('collector')
      );
      expect(collectorGap).toBeDefined();
      expect(collectorGap?.priority).toBe('P0');
    });

    it('should assign P3 priority to undocumented code', async () => {
      // Create empty document inventory
      const docInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'state',
        'test-project',
        'current_state.yaml'
      );
      await fs.writeFile(
        docInventoryPath,
        `current_state:
  project:
    name: test-project
  requirements:
    functional: []
    nonFunctional: []
  features: []
  components: []
  apis: []
`
      );

      // Create code inventory with undocumented module
      const codeInventoryPath = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'code_inventory.yaml'
      );
      await fs.writeFile(
        codeInventoryPath,
        `code_inventory:
  project:
    name: test-project
  modules:
    - name: custom-module
      path: src/custom-module
      classes:
        - name: CustomClass
      functions: []
      interfaces: []
      statistics:
        linesOfCode: 100
`
      );

      await agent.startSession('test-project');
      const result = await agent.compare(docInventoryPath, codeInventoryPath);

      const undocGap = result.result.gaps.find(
        (g) => g.type === 'implemented_not_documented'
      );
      expect(undocGap).toBeDefined();
      expect(undocGap?.priority).toBe('P3');
    });
  });
});
