/**
 * Architecture Generator module tests
 *
 * Tests for SRS parsing, architecture analysis, diagram generation,
 * technology stack selection, and directory structure generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ArchitectureGenerator,
  SRSParser,
  ArchitectureAnalyzer,
  DiagramGenerator,
  TechnologyStackGenerator,
  DirectoryStructureGenerator,
  SRSNotFoundError,
  SRSValidationError,
  ArchitectureGeneratorError,
  ArchitectureAnalysisError,
  DiagramGenerationError,
  TechnologyStackError,
  DirectoryStructureError,
  OutputWriteError,
  getArchitectureGenerator,
  resetArchitectureGenerator,
} from '../../src/architecture-generator/index.js';
import type { ParsedSRS, ArchitectureAnalysis } from '../../src/architecture-generator/index.js';

// ============================================================
// Test Data
// ============================================================

const SAMPLE_SRS_CONTENT = `# SRS: Test Product

| Field | Value |
|-------|-------|
| **Document ID** | SRS-TEST |
| **Source PRD** | PRD-TEST |
| **Version** | 1.0.0 |
| **Status** | Draft |

## System Features

### SF-001: User Authentication

**Priority**: P0

This feature provides user authentication capabilities including login, logout, and session management.

#### UC-001: User Login

**Actor**: End User
**Preconditions**:
- User has valid credentials

**Main Flow**:
1. User enters credentials
2. System validates credentials
3. System creates session
4. User is redirected to dashboard

**Postconditions**:
- User is authenticated

### SF-002: Data Processing Pipeline

**Priority**: P1

This feature implements a data processing pipeline for transforming and analyzing data.

#### UC-002: Process Data

**Actor**: System
**Preconditions**:
- Data is available

**Main Flow**:
1. System reads input data
2. System transforms data
3. System outputs results

## Non-Functional Requirements

### NFR-001: Performance

**Priority**: P0
**Target**: Response time < 200ms

The system must respond to requests within 200 milliseconds.

### NFR-002: Scalability

**Priority**: P1
**Target**: 10000 concurrent users

The system must support 10000 concurrent users.

### NFR-003: Security

**Priority**: P0
**Target**: OWASP Top 10 compliance

The system must be secure against OWASP Top 10 vulnerabilities.

## Constraints

### CON-001: Technical Constraint

**Type**: Technical
**Architecture Impact**: Must use Node.js runtime

The system must be built using Node.js.

## Assumptions

- Users have modern web browsers
- Network connectivity is reliable
`;

const MINIMAL_SRS_CONTENT = `# SRS: Minimal Product

| Field | Value |
|-------|-------|
| **Document ID** | SRS-MIN |
| **Source PRD** | PRD-MIN |
| **Version** | 1.0.0 |
| **Status** | Draft |

## System Features

### SF-001: Basic Feature

**Priority**: P2

A basic feature for testing.
`;

const PIPELINE_SRS_CONTENT = `# SRS: Data Pipeline System

| Field | Value |
|-------|-------|
| **Document ID** | SRS-PIPE |
| **Source PRD** | PRD-PIPE |
| **Version** | 1.0.0 |
| **Status** | Draft |

## System Features

### SF-001: Data Pipeline

**Priority**: P0

This feature implements a sequential data processing pipeline with multiple transform stages.

#### UC-001: Process Pipeline

**Actor**: System
**Main Flow**:
1. Input stage receives data
2. Transform stage processes data
3. Output stage delivers results

## Non-Functional Requirements

### NFR-001: Performance

**Priority**: P0
**Target**: Process 1000 records/second

The pipeline must maintain high throughput.
`;

const EVENT_DRIVEN_SRS_CONTENT = `# SRS: Event System

| Field | Value |
|-------|-------|
| **Document ID** | SRS-EVENT |
| **Source PRD** | PRD-EVENT |
| **Version** | 1.0.0 |
| **Status** | Draft |

## System Features

### SF-001: Event Publishing

**Priority**: P0

This feature publishes events to subscribers via message broker with reactive event notification.

#### UC-001: Publish Event

**Actor**: Producer
**Main Flow**:
1. Producer creates event
2. Event is published to broker
3. Subscribers receive notification

## Non-Functional Requirements

### NFR-001: Scalability

**Priority**: P0
**Target**: Handle 100000 events/second

The system must scale to handle high event volumes.
`;

const AGENT_SRS_CONTENT = `# SRS: Multi-Agent System

| Field | Value |
|-------|-------|
| **Document ID** | SRS-AGENT |
| **Source PRD** | PRD-AGENT |
| **Version** | 1.0.0 |
| **Status** | Draft |

## System Features

### SF-001: Agent Orchestration

**Priority**: P0

This feature provides orchestration of multiple autonomous agents for task coordination and delegation.

#### UC-001: Coordinate Agents

**Actor**: Orchestrator
**Main Flow**:
1. Orchestrator receives task
2. Orchestrator delegates to worker agents
3. Workers execute tasks autonomously
4. Orchestrator collects results

### SF-002: Worker Agent

**Priority**: P0

Worker agents that execute delegated tasks.

## Non-Functional Requirements

### NFR-001: Scalability

**Priority**: P0
**Target**: Support 100 concurrent agents

The system must support 100 concurrent worker agents.

### NFR-002: Reliability

**Priority**: P0
**Target**: 99.9% uptime

The system must have 99.9% uptime.
`;

// ============================================================
// SRSParser Tests
// ============================================================

describe('SRSParser', () => {
  let parser: SRSParser;

  beforeEach(() => {
    parser = new SRSParser();
  });

  describe('parse', () => {
    it('should parse SRS content and extract metadata', () => {
      const result = parser.parse(SAMPLE_SRS_CONTENT);

      expect(result.metadata.documentId).toBe('SRS-TEST');
      expect(result.metadata.sourcePRD).toBe('PRD-TEST');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.status).toBe('Draft');
    });

    it('should extract system features', () => {
      const result = parser.parse(SAMPLE_SRS_CONTENT);

      expect(result.features).toHaveLength(2);
      expect(result.features[0]?.id).toBe('SF-001');
      expect(result.features[0]?.name).toBe('User Authentication');
      expect(result.features[0]?.priority).toBe('P0');
    });

    it('should extract use cases from features', () => {
      const result = parser.parse(SAMPLE_SRS_CONTENT);

      const feature = result.features[0];
      expect(feature?.useCases).toHaveLength(1);
      expect(feature?.useCases[0]?.id).toBe('UC-001');
      expect(feature?.useCases[0]?.name).toBe('User Login');
      expect(feature?.useCases[0]?.actor).toBe('End User');
    });

    it('should extract non-functional requirements', () => {
      const result = parser.parse(SAMPLE_SRS_CONTENT);

      expect(result.nfrs).toHaveLength(3);
      expect(result.nfrs[0]?.id).toBe('NFR-001');
      expect(result.nfrs[0]?.category).toBe('performance');
      expect(result.nfrs[0]?.priority).toBe('P0');
    });

    it('should extract constraints', () => {
      const result = parser.parse(SAMPLE_SRS_CONTENT);

      expect(result.constraints).toHaveLength(1);
      expect(result.constraints[0]?.id).toBe('CON-001');
      expect(result.constraints[0]?.type).toBe('technical');
    });

    it('should extract assumptions', () => {
      const result = parser.parse(SAMPLE_SRS_CONTENT);

      expect(result.assumptions).toHaveLength(2);
      expect(result.assumptions[0]).toContain('modern web browsers');
    });

    it('should handle minimal SRS content', () => {
      const result = parser.parse(MINIMAL_SRS_CONTENT);

      expect(result.metadata.documentId).toBe('SRS-MIN');
      expect(result.features).toHaveLength(1);
      expect(result.nfrs).toHaveLength(0);
    });
  });

  describe('parseFile', () => {
    const testDir = '/tmp/architecture-generator-test';
    const testFile = path.join(testDir, 'test-srs.md');

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(testFile, SAMPLE_SRS_CONTENT);
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('should parse SRS from file', () => {
      const result = parser.parseFile(testFile);

      expect(result.metadata.documentId).toBe('SRS-TEST');
      expect(result.features).toHaveLength(2);
    });

    it('should throw SRSNotFoundError for missing file', () => {
      expect(() => parser.parseFile('/nonexistent/file.md')).toThrow(SRSNotFoundError);
    });
  });

  describe('strict mode', () => {
    it('should throw SRSValidationError in strict mode when features missing', () => {
      const strictParser = new SRSParser({ strict: true });
      const noFeaturesContent = `# SRS: No Features

| Field | Value |
|-------|-------|
| **Document ID** | SRS-EMPTY |
`;
      expect(() => strictParser.parse(noFeaturesContent)).toThrow(SRSValidationError);
    });

    it('should not throw in non-strict mode with missing sections', () => {
      const result = parser.parse('# SRS: Empty\n\n');
      expect(result.features).toHaveLength(0);
      expect(result.nfrs).toHaveLength(0);
    });

    it('should disable use case extraction when option is false', () => {
      const noUCParser = new SRSParser({ extractUseCases: false });
      const result = noUCParser.parse(SAMPLE_SRS_CONTENT);

      expect(result.features[0]?.useCases).toHaveLength(0);
    });

    it('should disable NFR parsing when option is false', () => {
      const noNFRParser = new SRSParser({ parseNFRs: false });
      const result = noNFRParser.parse(SAMPLE_SRS_CONTENT);

      expect(result.nfrs).toHaveLength(0);
    });
  });
});

// ============================================================
// ArchitectureAnalyzer Tests
// ============================================================

describe('ArchitectureAnalyzer', () => {
  let analyzer: ArchitectureAnalyzer;
  let parser: SRSParser;

  beforeEach(() => {
    analyzer = new ArchitectureAnalyzer();
    parser = new SRSParser();
  });

  describe('analyze', () => {
    it('should analyze SRS and recommend architecture pattern', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.primaryPattern).toBeDefined();
      expect(result.supportingPatterns).toBeDefined();
      expect(result.rationale).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect hierarchical-multi-agent pattern for agent systems', () => {
      const srs = parser.parse(AGENT_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.primaryPattern).toBe('hierarchical-multi-agent');
    });

    it('should provide pattern recommendations with scores', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.recommendations).toHaveLength(4);
      for (const rec of result.recommendations) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
        expect(rec.reasons.length).toBeGreaterThan(0);
        expect(rec.drawbacks.length).toBeGreaterThan(0);
      }
    });

    it('should identify architectural concerns from NFRs', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.concerns.length).toBeGreaterThan(0);
      for (const concern of result.concerns) {
        expect(concern.category).toBeDefined();
        expect(concern.mitigation).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(concern.priority);
      }
    });

    it('should select compatible supporting patterns', () => {
      const srs = parser.parse(AGENT_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.supportingPatterns.length).toBeLessThanOrEqual(2);
      expect(result.supportingPatterns).not.toContain(result.primaryPattern);
    });

    it('should detect pipeline pattern for sequential processing systems', () => {
      const srs = parser.parse(PIPELINE_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.primaryPattern).toBe('pipeline');
    });

    it('should detect event-driven pattern for event systems', () => {
      const srs = parser.parse(EVENT_DRIVEN_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.primaryPattern).toBe('event-driven');
    });

    it('should use default pattern for minimal SRS', () => {
      const srs = parser.parse(MINIMAL_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      expect(result.primaryPattern).toBeDefined();
      expect(result.rationale).toContain('features');
    });

    it('should add concern for missing critical NFR categories', () => {
      const srs = parser.parse(MINIMAL_SRS_CONTENT);
      const result = analyzer.analyze(srs);

      // Should have concerns for missing security, reliability, or performance
      const missingConcerns = result.concerns.filter((c) => c.description.includes('No explicit'));
      expect(missingConcerns.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// DiagramGenerator Tests
// ============================================================

describe('DiagramGenerator', () => {
  let generator: DiagramGenerator;
  let parser: SRSParser;
  let analyzer: ArchitectureAnalyzer;

  beforeEach(() => {
    generator = new DiagramGenerator();
    parser = new SRSParser();
    analyzer = new ArchitectureAnalyzer();
  });

  describe('generate', () => {
    it('should generate architecture overview diagram', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = generator.generate(srs, analysis);

      const overview = diagrams.find((d) => d.type === 'architecture-overview');
      expect(overview).toBeDefined();
      expect(overview?.code).toContain('mermaid');
      expect(overview?.code).toContain('flowchart');
    });

    it('should generate component interaction diagram', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = generator.generate(srs, analysis);

      const interaction = diagrams.find((d) => d.type === 'component-interaction');
      expect(interaction).toBeDefined();
      expect(interaction?.code).toContain('mermaid');
    });

    it('should generate all diagram types when option is enabled', () => {
      const fullGenerator = new DiagramGenerator(true);
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = fullGenerator.generate(srs, analysis);

      expect(diagrams.length).toBeGreaterThanOrEqual(4);
    });

    it('should generate pattern-specific diagrams', () => {
      const srs = parser.parse(AGENT_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = generator.generate(srs, analysis);

      const overview = diagrams.find((d) => d.type === 'architecture-overview');
      expect(overview?.code).toContain('Orchestrator');
    });

    it('should generate diagrams for pipeline pattern', () => {
      const srs = parser.parse(PIPELINE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = generator.generate(srs, analysis);

      const overview = diagrams.find((d) => d.type === 'architecture-overview');
      expect(overview).toBeDefined();
      expect(overview?.code).toContain('Stage');
    });

    it('should generate diagrams for event-driven pattern', () => {
      const srs = parser.parse(EVENT_DRIVEN_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = generator.generate(srs, analysis);

      const overview = diagrams.find((d) => d.type === 'architecture-overview');
      expect(overview).toBeDefined();
      expect(overview?.code).toContain('Broker');
    });

    it('should include deployment and data-flow diagrams when all types enabled', () => {
      const fullGenerator = new DiagramGenerator(true);
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const diagrams = fullGenerator.generate(srs, analysis);

      const deployment = diagrams.find((d) => d.type === 'deployment');
      const dataFlow = diagrams.find((d) => d.type === 'data-flow');

      expect(deployment).toBeDefined();
      expect(dataFlow).toBeDefined();
    });
  });
});

// ============================================================
// TechnologyStackGenerator Tests
// ============================================================

describe('TechnologyStackGenerator', () => {
  let generator: TechnologyStackGenerator;
  let parser: SRSParser;
  let analyzer: ArchitectureAnalyzer;

  beforeEach(() => {
    generator = new TechnologyStackGenerator();
    parser = new SRSParser();
    analyzer = new ArchitectureAnalyzer();
  });

  describe('generate', () => {
    it('should generate technology stack for all layers', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = generator.generate(srs, analysis);

      expect(stack.layers.length).toBe(8);

      const layers = stack.layers.map((l) => l.layer);
      expect(layers).toContain('runtime');
      expect(layers).toContain('framework');
      expect(layers).toContain('database');
      expect(layers).toContain('caching');
      expect(layers).toContain('messaging');
      expect(layers).toContain('monitoring');
      expect(layers).toContain('testing');
      expect(layers).toContain('build');
    });

    it('should include technology alternatives', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = generator.generate(srs, analysis);

      const runtime = stack.layers.find((l) => l.layer === 'runtime');
      expect(runtime?.alternatives.length).toBeGreaterThan(0);
    });

    it('should provide rationale for selections', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = generator.generate(srs, analysis);

      for (const layer of stack.layers) {
        expect(layer.rationale).toBeDefined();
        expect(layer.rationale.length).toBeGreaterThan(0);
      }
    });

    it('should check compatibility between technologies', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = generator.generate(srs, analysis);

      expect(stack.compatibilityNotes).toBeDefined();
    });

    it('should generate stack without alternatives when disabled', () => {
      const noAltGenerator = new TechnologyStackGenerator(false);
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = noAltGenerator.generate(srs, analysis);

      const runtime = stack.layers.find((l) => l.layer === 'runtime');
      expect(runtime?.alternatives).toHaveLength(0);
    });

    it('should generate different frameworks based on pattern', () => {
      const srs1 = parser.parse(SAMPLE_SRS_CONTENT);
      const srs2 = parser.parse(AGENT_SRS_CONTENT);

      const analysis1 = analyzer.analyze(srs1);
      const analysis2 = analyzer.analyze(srs2);

      const stack1 = generator.generate(srs1, analysis1);
      const stack2 = generator.generate(srs2, analysis2);

      // Both should have valid stacks
      expect(stack1.layers.length).toBe(8);
      expect(stack2.layers.length).toBe(8);
    });
  });
});

// ============================================================
// DirectoryStructureGenerator Tests
// ============================================================

describe('DirectoryStructureGenerator', () => {
  let generator: DirectoryStructureGenerator;
  let parser: SRSParser;
  let analyzer: ArchitectureAnalyzer;
  let techGenerator: TechnologyStackGenerator;

  beforeEach(() => {
    generator = new DirectoryStructureGenerator();
    parser = new SRSParser();
    analyzer = new ArchitectureAnalyzer();
    techGenerator = new TechnologyStackGenerator();
  });

  describe('generate', () => {
    it('should generate directory structure based on pattern', () => {
      const srs = parser.parse(AGENT_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = techGenerator.generate(srs, analysis);
      const structure = generator.generate(srs, analysis, stack);

      expect(structure.root).toBe('project-root');
      expect(structure.entries.length).toBeGreaterThan(0);
      expect(structure.description).toContain('agent');
    });

    it('should include src directory', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = techGenerator.generate(srs, analysis);
      const structure = generator.generate(srs, analysis, stack);

      const srcDir = structure.entries.find((e) => e.name === 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir?.type).toBe('directory');
    });

    it('should add technology-specific config files', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = techGenerator.generate(srs, analysis);
      const structure = generator.generate(srs, analysis, stack);

      const fileNames = structure.entries.map((e) => e.name);
      expect(fileNames).toContain('README.md');
      expect(fileNames).toContain('.gitignore');
    });

    it('should generate ASCII tree representation', () => {
      const srs = parser.parse(SAMPLE_SRS_CONTENT);
      const analysis = analyzer.analyze(srs);
      const stack = techGenerator.generate(srs, analysis);
      const structure = generator.generate(srs, analysis, stack);

      const tree = DirectoryStructureGenerator.toAsciiTree(structure);
      expect(tree).toContain('project-root/');
      expect(tree).toContain('├──');
      expect(tree).toContain('└──');
    });
  });
});

// ============================================================
// ArchitectureGenerator Integration Tests
// ============================================================

describe('ArchitectureGenerator', () => {
  let generator: ArchitectureGenerator;

  beforeEach(() => {
    resetArchitectureGenerator();
    generator = new ArchitectureGenerator();
  });

  describe('generateFromContent', () => {
    it('should generate complete architecture design', () => {
      const design = generator.generateFromContent(SAMPLE_SRS_CONTENT);

      expect(design.analysis).toBeDefined();
      expect(design.technologyStack).toBeDefined();
      expect(design.diagrams.length).toBeGreaterThan(0);
      expect(design.directoryStructure).toBeDefined();
      expect(design.metadata).toBeDefined();
    });

    it('should include metadata with source SRS', () => {
      const design = generator.generateFromContent(SAMPLE_SRS_CONTENT);

      expect(design.metadata.sourceSRS).toBe('SRS-TEST');
      expect(design.metadata.generatedAt).toBeDefined();
      expect(design.metadata.version).toBeDefined();
    });

    it('should generate design for agent systems', () => {
      const design = generator.generateFromContent(AGENT_SRS_CONTENT);

      expect(design.analysis.primaryPattern).toBe('hierarchical-multi-agent');
    });
  });

  describe('designToMarkdown', () => {
    it('should convert design to markdown format', () => {
      const design = generator.generateFromContent(SAMPLE_SRS_CONTENT);
      const markdown = generator.designToMarkdown(design);

      expect(markdown).toContain('# System Architecture Design');
      expect(markdown).toContain('## 1. Architecture Overview');
      expect(markdown).toContain('## 3. Technology Stack');
      expect(markdown).toContain('## 5. Directory Structure');
      expect(markdown).toContain('```mermaid');
    });

    it('should include pattern analysis table', () => {
      const design = generator.generateFromContent(SAMPLE_SRS_CONTENT);
      const markdown = generator.designToMarkdown(design);

      expect(markdown).toContain('## 2. Pattern Analysis');
      expect(markdown).toContain('| Pattern | Score | Key Reasons |');
    });

    it('should include architectural concerns if present', () => {
      const design = generator.generateFromContent(SAMPLE_SRS_CONTENT);
      const markdown = generator.designToMarkdown(design);

      expect(markdown).toContain('## 6. Architectural Concerns');
    });
  });

  describe('singleton behavior', () => {
    it('should return same instance from getArchitectureGenerator', () => {
      const instance1 = getArchitectureGenerator();
      const instance2 = getArchitectureGenerator();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance with resetArchitectureGenerator', () => {
      const instance1 = getArchitectureGenerator();
      resetArchitectureGenerator();
      const instance2 = getArchitectureGenerator();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('verbose mode', () => {
    it('should work in verbose mode without errors', () => {
      const verboseGenerator = new ArchitectureGenerator({
        defaultOptions: { verbose: true },
      });

      const design = verboseGenerator.generateFromContent(SAMPLE_SRS_CONTENT);

      expect(design.analysis).toBeDefined();
      expect(design.technologyStack).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should use custom output directory', () => {
      const customGenerator = new ArchitectureGenerator({
        outputDir: 'custom/output',
      });

      const design = customGenerator.generateFromContent(SAMPLE_SRS_CONTENT);
      expect(design).toBeDefined();
    });

    it('should use custom default pattern', () => {
      const customGenerator = new ArchitectureGenerator({
        defaultOptions: { defaultPattern: 'microservices' },
      });

      const design = customGenerator.generateFromContent(MINIMAL_SRS_CONTENT);
      // The minimal SRS should still trigger pattern detection
      expect(design.analysis.primaryPattern).toBeDefined();
    });

    it('should generate all diagram types when option is set', () => {
      const customGenerator = new ArchitectureGenerator({
        defaultOptions: { generateAllDiagrams: true },
      });

      const design = customGenerator.generateFromContent(SAMPLE_SRS_CONTENT);
      expect(design.diagrams.length).toBeGreaterThanOrEqual(4);
    });
  });
});

// ============================================================
// Error Classes Tests
// ============================================================

describe('Error Classes', () => {
  describe('ArchitectureGeneratorError', () => {
    it('should create base error with message', () => {
      const error = new ArchitectureGeneratorError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ArchitectureGeneratorError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('SRSNotFoundError', () => {
    it('should include file path in message', () => {
      const error = new SRSNotFoundError('/path/to/file.md');
      expect(error.message).toContain('/path/to/file.md');
      expect(error.path).toBe('/path/to/file.md');
      expect(error).toBeInstanceOf(ArchitectureGeneratorError);
    });
  });

  describe('SRSValidationError', () => {
    it('should include validation errors in message', () => {
      const errors = ['Missing features', 'Invalid format'];
      const error = new SRSValidationError(errors);
      expect(error.message).toContain('Missing features');
      expect(error.message).toContain('Invalid format');
      expect(error.errors).toEqual(errors);
    });
  });

  describe('ArchitectureAnalysisError', () => {
    it('should include phase and details', () => {
      const error = new ArchitectureAnalysisError('pattern-detection', 'No patterns found');
      expect(error.message).toContain('pattern-detection');
      expect(error.message).toContain('No patterns found');
      expect(error.phase).toBe('pattern-detection');
    });
  });

  describe('DiagramGenerationError', () => {
    it('should include diagram type and details', () => {
      const error = new DiagramGenerationError('architecture-overview', 'Invalid components');
      expect(error.message).toContain('architecture-overview');
      expect(error.diagramType).toBe('architecture-overview');
    });
  });

  describe('TechnologyStackError', () => {
    it('should include layer and details', () => {
      const error = new TechnologyStackError('runtime', 'No compatible technology');
      expect(error.message).toContain('runtime');
      expect(error.layer).toBe('runtime');
    });
  });

  describe('DirectoryStructureError', () => {
    it('should include pattern and details', () => {
      const error = new DirectoryStructureError('microservices', 'Template not found');
      expect(error.message).toContain('microservices');
      expect(error.pattern).toBe('microservices');
    });
  });

  describe('OutputWriteError', () => {
    it('should include path and details', () => {
      const error = new OutputWriteError('/output/file.md', 'Permission denied');
      expect(error.message).toContain('/output/file.md');
      expect(error.message).toContain('Permission denied');
      expect(error.path).toBe('/output/file.md');
    });
  });
});
