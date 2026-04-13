import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TechDecisionWriterAgent,
  getTechDecisionWriterAgent,
  resetTechDecisionWriterAgent,
  TECH_DECISION_WRITER_AGENT_ID,
} from '../../src/tech-decision-writer/TechDecisionWriterAgent.js';
import {
  FileWriteError,
  GenerationError,
  SDSNotFoundError,
  SessionStateError,
  InvalidCriteriaError,
  TechDecisionWriterError,
} from '../../src/tech-decision-writer/errors.js';
import type { GeneratedTechDecision } from '../../src/tech-decision-writer/types.js';
import {
  slugifyTopic,
  parseTechnologyStack,
  parseSDSComponents,
  parseNfrReferences,
  detectDecisions,
} from '../../src/tech-decision-writer/DecisionDetector.js';
import {
  DEFAULT_CRITERIA,
  validateCriteria,
  generateDecisions,
} from '../../src/tech-decision-writer/ComparisonGenerator.js';
import { parseFrontmatter } from '../../src/utilities/frontmatter.js';

const sampleSDS = `---
doc_id: SDS-test-project
title: Test Product
version: 1.0.0
status: Approved
---

# Software Design Specification: Test Product

| Field | Value |
|-------|-------|
| **Document ID** | SDS-test-project |
| **Source SRS** | SRS-test-project |
| **Version** | 1.0.0 |
| **Status** | Approved |

## 2. Architecture Overview

### 2.1 System Context

Bridges NFR-001 and NFR-002 through internal components.

### 2.3 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Runtime | Node.js | 20.x | LTS version with long-term support |
| Language | TypeScript | 5.x | Strong typing for maintainability |
| Framework | Express.js | 4.x | Proven HTTP framework |
| Database | PostgreSQL | 15.x | ACID guarantees and JSON support |
| Testing | Vitest | 1.x | Fast Vite-native test runner |

### 2.4 Component Overview

## 3. Component Design

### CMP-001: AuthController

Handles user authentication via NFR-001.

### CMP-002: AuthService

### CMP-003: SessionStore

NFR-002 latency target applies here.
`;

describe('slugifyTopic', () => {
  it('converts to lowercase kebab-case', () => {
    expect(slugifyTopic('Database Selection')).toBe('database-selection');
  });

  it('collapses non-alphanumeric runs', () => {
    expect(slugifyTopic('API / REST layer!!')).toBe('api-rest-layer');
  });

  it('returns default for empty input', () => {
    expect(slugifyTopic('')).toBe('decision');
    expect(slugifyTopic('---')).toBe('decision');
  });
});

describe('parseTechnologyStack', () => {
  it('extracts all rows from the Technology Stack table', () => {
    const rows = parseTechnologyStack(sampleSDS);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      layer: 'Runtime',
      technology: 'Node.js',
      version: '20.x',
      rationale: 'LTS version with long-term support',
    });
    expect(rows[3]?.technology).toBe('PostgreSQL');
  });

  it('returns empty array when the heading is absent', () => {
    const rows = parseTechnologyStack('# Some other document\n\nNo tech stack here.');
    expect(rows).toHaveLength(0);
  });

  it('stops at the next section heading', () => {
    const content =
      '### 2.3 Technology Stack\n\n' +
      '| Layer | Technology | Version | Rationale |\n' +
      '|-------|------------|---------|-----------|\n' +
      '| Runtime | Node.js | 20.x | Alpha |\n' +
      '\n## 3. Next Section\n\n' +
      '| Layer | Technology | Version | Rationale |\n' +
      '| Poison | Row | 1.0 | Should not appear |\n';
    const rows = parseTechnologyStack(content);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.technology).toBe('Node.js');
  });
});

describe('parseSDSComponents', () => {
  it('extracts component IDs and names', () => {
    const components = parseSDSComponents(sampleSDS);
    expect(components).toHaveLength(3);
    expect(components[0]).toEqual({ id: 'CMP-001', name: 'AuthController' });
    expect(components[2]).toEqual({ id: 'CMP-003', name: 'SessionStore' });
  });

  it('handles components without a name', () => {
    const components = parseSDSComponents('### CMP-010\n\nSome body text.');
    expect(components).toHaveLength(1);
    expect(components[0]).toEqual({ id: 'CMP-010', name: 'CMP-010' });
  });
});

describe('parseNfrReferences', () => {
  it('extracts unique NFR references in order of appearance', () => {
    const nfrs = parseNfrReferences(sampleSDS);
    expect(nfrs).toEqual(['NFR-001', 'NFR-002']);
  });

  it('returns empty when no NFR references exist', () => {
    expect(parseNfrReferences('No requirements mentioned here.')).toEqual([]);
  });
});

describe('detectDecisions', () => {
  it('returns a full parsed extract', () => {
    const extract = detectDecisions(sampleSDS, 'test-project');
    expect(extract.documentId).toBe('SDS-test-project');
    expect(extract.productName).toBe('Test Product');
    expect(extract.technologyStack).toHaveLength(5);
    expect(extract.components).toHaveLength(3);
    expect(extract.nfrIds).toEqual(['NFR-001', 'NFR-002']);
  });

  it('falls back to project ID when SDS headers are missing', () => {
    const extract = detectDecisions('no headers here', 'fallback-id');
    expect(extract.documentId).toBe('SDS-fallback-id');
    expect(extract.productName).toBe('fallback-id');
  });
});

describe('validateCriteria', () => {
  it('accepts the default criteria that sum to 1.0', () => {
    expect(() => {
      validateCriteria(DEFAULT_CRITERIA);
    }).not.toThrow();
  });

  it('throws InvalidCriteriaError when weights do not sum to 1', () => {
    expect(() => {
      validateCriteria([
        { name: 'A', weight: 0.5, description: '' },
        { name: 'B', weight: 0.4, description: '' },
      ]);
    }).toThrow(InvalidCriteriaError);
  });

  it('tolerates floating-point rounding within the configured tolerance', () => {
    expect(() => {
      validateCriteria([
        { name: 'A', weight: 0.3333, description: '' },
        { name: 'B', weight: 0.3333, description: '' },
        { name: 'C', weight: 0.3334, description: '' },
      ]);
    }).not.toThrow();
  });
});

describe('generateDecisions', () => {
  it('produces one decision per technology stack row', () => {
    const extract = detectDecisions(sampleSDS, 'test-project');
    const decisions = generateDecisions(extract);
    expect(decisions).toHaveLength(5);
    expect(decisions[0]?.number).toBe(1);
    expect(decisions[0]?.topic).toBe('Runtime Selection');
    expect(decisions[0]?.topicSlug).toBe('runtime-selection');
  });

  it('selects the SDS-declared technology in every decision', () => {
    const extract = detectDecisions(sampleSDS, 'test-project');
    const decisions = generateDecisions(extract);
    for (const decision of decisions) {
      const expectedTech = extract.technologyStack.find(
        (row) => `${row.layer} Selection` === decision.topic
      )?.technology;
      expect(decision.decision.selected).toBe(expectedTech);
    }
  });

  it('builds matrices whose winning candidate has the highest weighted total', () => {
    const extract = detectDecisions(sampleSDS, 'test-project');
    const [firstDecision] = generateDecisions(extract);
    expect(firstDecision).toBeDefined();
    const rows = firstDecision!.matrix.rows;
    expect(rows.length).toBeGreaterThan(0);
    const selectedRow = rows.find((r) => r.candidate === firstDecision!.decision.selected);
    expect(selectedRow).toBeDefined();
    for (const row of rows) {
      expect(row.weightedTotal).toBeLessThanOrEqual(selectedRow!.weightedTotal);
    }
  });

  it('includes cross-references to SDS components and NFRs', () => {
    const extract = detectDecisions(sampleSDS, 'test-project');
    const [decision] = generateDecisions(extract);
    expect(decision!.references.some((r) => r.includes('SDS-test-project'))).toBe(true);
    expect(decision!.references.some((r) => r.includes('CMP-001'))).toBe(true);
    expect(decision!.references.some((r) => r.includes('NFR-001'))).toBe(true);
  });

  it('returns an empty array when the SDS has no technology stack', () => {
    const extract = detectDecisions('# No tech stack', 'empty-project');
    const decisions = generateDecisions(extract);
    expect(decisions).toHaveLength(0);
  });

  it('produces a single candidate when the layer has no fallback catalog entry', () => {
    const unknownLayerSDS =
      '---\ndoc_id: SDS-unknown-project\ntitle: Unknown Project\n---\n\n' +
      '# Software Design Specification: Unknown Project\n\n' +
      '### 2.3 Technology Stack\n\n' +
      '| Layer | Technology | Version | Rationale |\n' +
      '|-------|------------|---------|-----------|\n' +
      '| Blockchain | Hyperledger | 2.5 | Permissioned ledger |\n';
    const extract = detectDecisions(unknownLayerSDS, 'unknown-project');
    const decisions = generateDecisions(extract);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.candidates).toHaveLength(1);
    expect(decisions[0]!.candidates[0]!.name).toBe('Hyperledger');
    expect(decisions[0]!.candidates[0]!.category).toBe('Blockchain');
  });

  it('dedupes the SDS pick when it already appears in the fallback catalog', () => {
    // PostgreSQL is in the Database fallback — verify no duplicate row is emitted.
    const dedupSDS =
      '---\ndoc_id: SDS-dedup-project\ntitle: Dedup Project\n---\n\n' +
      '# Software Design Specification: Dedup Project\n\n' +
      '### 2.3 Technology Stack\n\n' +
      '| Layer | Technology | Version | Rationale |\n' +
      '|-------|------------|---------|-----------|\n' +
      '| Database | PostgreSQL | 15.x | ACID |\n';
    const extract = detectDecisions(dedupSDS, 'dedup-project');
    const decisions = generateDecisions(extract);
    expect(decisions).toHaveLength(1);
    const names = decisions[0]!.candidates.map((c) => c.name.toLowerCase());
    const postgresOccurrences = names.filter((n) => n === 'postgresql').length;
    expect(postgresOccurrences).toBe(1);
    // SDS pick should be listed first.
    expect(decisions[0]!.candidates[0]!.name.toLowerCase()).toBe('postgresql');
  });

  it('prepends the SDS pick when the layer has a fallback catalog but the pick is not in it', () => {
    // Runtime fallback catalog is Node.js/Deno/Bun — "Elixir" is not there.
    const elixirSDS =
      '---\ndoc_id: SDS-elixir-project\ntitle: Elixir Project\n---\n\n' +
      '# Software Design Specification: Elixir Project\n\n' +
      '### 2.3 Technology Stack\n\n' +
      '| Layer | Technology | Version | Rationale |\n' +
      '|-------|------------|---------|-----------|\n' +
      '| Runtime | Elixir | 1.15 | BEAM VM fault-tolerance |\n';
    const extract = detectDecisions(elixirSDS, 'elixir-project');
    const decisions = generateDecisions(extract);
    expect(decisions).toHaveLength(1);
    const candidateNames = decisions[0]!.candidates.map((c) => c.name);
    expect(candidateNames[0]).toBe('Elixir');
    expect(candidateNames).toContain('Node.js'); // fallback still appended
    expect(candidateNames.length).toBeGreaterThan(1);
  });

  it('falls back to a generic rationale when the SDS row has no rationale text', () => {
    const noRationaleSDS =
      '---\ndoc_id: SDS-no-rationale\ntitle: No Rationale\n---\n\n' +
      '# Software Design Specification: No Rationale\n\n' +
      '### 2.3 Technology Stack\n\n' +
      '| Layer | Technology | Version | Rationale |\n' +
      '|-------|------------|---------|-----------|\n' +
      '| Runtime | Node.js | 20.x |  |\n';
    const extract = detectDecisions(noRationaleSDS, 'no-rationale');
    const decisions = generateDecisions(extract);
    expect(decisions).toHaveLength(1);
    // Generic rationale should reference the declared technology.
    expect(decisions[0]!.decision.rationale).toContain('Node.js');
    // Generic context should NOT include any extra rationale sentence.
    expect(decisions[0]!.context.endsWith('.')).toBe(true);
  });
});

describe('TechDecisionWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'tech-decision-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'tech-decision-writer', 'test-docs');
  const projectId = 'test-project';

  const writeSampleSDS = (): void => {
    const dir = path.join(testBasePath, 'documents', projectId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'sds.md'), sampleSDS, 'utf-8');
  };

  const createAgent = (): TechDecisionWriterAgent =>
    new TechDecisionWriterAgent({
      scratchpadBasePath: testBasePath,
      publicDocsPath: testDocsPath,
    });

  beforeEach(() => {
    resetTechDecisionWriterAgent();
    if (fs.existsSync(testBasePath)) fs.rmSync(testBasePath, { recursive: true, force: true });
    if (fs.existsSync(testDocsPath)) fs.rmSync(testDocsPath, { recursive: true, force: true });
  });

  afterEach(() => {
    if (fs.existsSync(testBasePath)) fs.rmSync(testBasePath, { recursive: true, force: true });
    if (fs.existsSync(testDocsPath)) fs.rmSync(testDocsPath, { recursive: true, force: true });
    resetTechDecisionWriterAgent();
  });

  describe('IAgent lifecycle', () => {
    it('exposes the expected agent identifiers', () => {
      const agent = createAgent();
      expect(agent.agentId).toBe(TECH_DECISION_WRITER_AGENT_ID);
      expect(agent.agentId).toBe('tech-decision-writer-agent');
      expect(agent.name).toBe('Tech Decision Writer Agent');
    });

    it('initializes and disposes without error', async () => {
      const agent = createAgent();
      await agent.initialize();
      await agent.initialize(); // idempotent
      await agent.dispose();
      expect(agent.getSession()).toBeNull();
    });

    it('rejects invalid criteria at construction time', () => {
      expect(() => {
        new TechDecisionWriterAgent({
          criteria: [{ name: 'Only', weight: 0.5, description: 'Broken' }],
        });
      }).toThrow(InvalidCriteriaError);
    });
  });

  describe('startSession', () => {
    it('throws SDSNotFoundError when the SDS is missing', async () => {
      const agent = createAgent();
      await expect(agent.startSession(projectId)).rejects.toBeInstanceOf(SDSNotFoundError);
    });

    it('parses the SDS and collects warnings for missing sections', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const session = await agent.startSession(projectId);
      expect(session.projectId).toBe(projectId);
      expect(session.status).toBe('pending');
      expect(session.parsedSDS.technologyStack).toHaveLength(5);
      expect(session.parsedSDS.components).toHaveLength(3);
      expect(session.warnings ?? []).toHaveLength(0);
    });

    it('warns when the technology stack is empty', async () => {
      const dir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'sds.md'), '# Empty SDS\n\nNo tech stack here.', 'utf-8');

      const agent = createAgent();
      const session = await agent.startSession(projectId);
      expect(session.warnings).toBeDefined();
      expect(session.warnings!.some((w) => w.includes('No technology stack rows'))).toBe(true);
    });
  });

  describe('generateFromProject', () => {
    it('generates one TD document per technology stack row', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      expect(result.success).toBe(true);
      expect(result.generatedDocuments).toHaveLength(5);
      expect(result.scratchpadPaths).toHaveLength(5);
      expect(result.publicPaths).toHaveLength(5);
      expect(result.scratchpadPathsKorean).toHaveLength(5);
      expect(result.publicPathsKorean).toHaveLength(5);

      // Files actually exist on disk with expected naming.
      for (const scratchpadPath of result.scratchpadPaths) {
        expect(fs.existsSync(scratchpadPath)).toBe(true);
        expect(path.basename(scratchpadPath)).toMatch(/^TD-\d{3}-[a-z0-9-]+\.md$/);
      }
      for (const publicPath of result.publicPaths) {
        expect(fs.existsSync(publicPath)).toBe(true);
      }
      for (const scratchpadPath of result.scratchpadPathsKorean) {
        expect(fs.existsSync(scratchpadPath)).toBe(true);
        expect(path.basename(scratchpadPath)).toMatch(/^TD-\d{3}-[a-z0-9-]+\.kr\.md$/);
      }
      for (const publicPath of result.publicPathsKorean) {
        expect(fs.existsSync(publicPath)).toBe(true);
      }
    });

    it('renders Korean variant with translated section headings', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      const firstDoc = result.generatedDocuments[0]!;
      expect(firstDoc.contentKorean).toContain('## 1. 배경');
      expect(firstDoc.contentKorean).toContain('## 2. 후보');
      expect(firstDoc.contentKorean).toContain('## 3. 평가 기준');
      expect(firstDoc.contentKorean).toContain('## 4. 평가 매트릭스');
      expect(firstDoc.contentKorean).toContain('## 5. 결정');
      expect(firstDoc.contentKorean).toContain('## 6. 결과');
      expect(firstDoc.contentKorean).toContain('## 7. 참조');
      expect(firstDoc.contentKorean).toContain('**선택:**');

      // Korean file on disk mirrors the in-memory contentKorean.
      const koreanDiskContent = fs.readFileSync(result.publicPathsKorean[0]!, 'utf-8');
      expect(koreanDiskContent).toContain('## 1. 배경');
      expect(koreanDiskContent).toContain('**선택:**');
    });

    it('writes public docs under docs/decisions by default structure', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);
      for (const publicPath of result.publicPaths) {
        expect(publicPath.startsWith(testDocsPath)).toBe(true);
      }
    });

    it('produces documents with the seven required sections', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      const firstContent = fs.readFileSync(result.publicPaths[0]!, 'utf-8');
      const parsed = parseFrontmatter(firstContent);
      expect(parsed).not.toBeNull();
      const body = parsed!.body;

      expect(body).toContain('## 1. Context');
      expect(body).toContain('## 2. Candidates');
      expect(body).toContain('## 3. Evaluation Criteria');
      expect(body).toContain('## 4. Evaluation Matrix');
      expect(body).toContain('## 5. Decision');
      expect(body).toContain('## 6. Consequences');
      expect(body).toContain('## 7. References');
    });

    it('embeds the selected technology in the Decision section', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      const runtimeDoc = result.generatedDocuments.find((d) =>
        d.decision.topic.startsWith('Runtime')
      );
      expect(runtimeDoc).toBeDefined();
      expect(runtimeDoc!.decision.decision.selected).toBe('Node.js');
      expect(runtimeDoc!.content).toContain('**Selected:** Node.js');
    });

    it('renders candidate and evaluation tables in the markdown body', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      const content = fs.readFileSync(result.publicPaths[0]!, 'utf-8');
      expect(content).toContain('| Name | Category | License | Maturity | Description |');
      expect(content).toContain('| Criterion | Weight | Description |');
      expect(content).toContain('| Performance |');
      expect(content).toContain('Weighted Total');
    });

    it('includes valid frontmatter with TD-specific document ID', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      const content = fs.readFileSync(result.publicPaths[0]!, 'utf-8');
      const parsed = parseFrontmatter(content);
      expect(parsed).not.toBeNull();
      expect(parsed!.frontmatter.doc_id).toMatch(/^TD-001-/);
      expect(parsed!.frontmatter.version).toBe('1.0.0');
      expect(parsed!.frontmatter.status).toBe('Draft');
      expect(parsed!.frontmatter.source_documents).toContain('SDS-test-project');
    });

    it('reports accurate generation stats', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      expect(result.stats.decisionCount).toBe(5);
      expect(result.stats.techStackRowCount).toBe(5);
      expect(result.stats.candidateCount).toBeGreaterThanOrEqual(5);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('propagates generation errors via session state', async () => {
      const agent = createAgent();
      await expect(agent.generateFromProject(projectId)).rejects.toBeInstanceOf(SDSNotFoundError);
      const session = agent.getSession();
      // Session never made it past construction.
      expect(session).toBeNull();
    });
  });

  describe('finalize', () => {
    it('rewrites cached documents without re-parsing', async () => {
      writeSampleSDS();
      const agent = createAgent();
      const first = await agent.generateFromProject(projectId);

      // Remove only the public files and ensure finalize recreates them.
      for (const publicPath of first.publicPaths) {
        fs.rmSync(publicPath, { force: true });
      }
      const second = await agent.finalize();

      expect(second.generatedDocuments).toHaveLength(first.generatedDocuments.length);
      for (const publicPath of second.publicPaths) {
        expect(fs.existsSync(publicPath)).toBe(true);
      }
    });

    it('throws SessionStateError when no session is active', async () => {
      const agent = createAgent();
      await expect(agent.finalize()).rejects.toBeInstanceOf(SessionStateError);
    });

    it('throws SessionStateError when session is not completed', async () => {
      writeSampleSDS();
      const agent = createAgent();
      await agent.startSession(projectId);
      await expect(agent.finalize()).rejects.toBeInstanceOf(SessionStateError);
    });
  });

  describe('singleton helpers', () => {
    it('returns the same instance across calls', () => {
      const a = getTechDecisionWriterAgent();
      const b = getTechDecisionWriterAgent();
      expect(a).toBe(b);
    });

    it('resets the singleton', () => {
      const a = getTechDecisionWriterAgent();
      resetTechDecisionWriterAgent();
      const b = getTechDecisionWriterAgent();
      expect(a).not.toBe(b);
    });
  });

  describe('warning accumulation', () => {
    it('accumulates multiple warnings when SDS lacks tech stack, components, and NFRs', async () => {
      const dir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'sds.md'),
        '---\ndoc_id: SDS-bare\ntitle: Bare Project\n---\n\n# Software Design Specification: Bare Project\n',
        'utf-8'
      );

      const agent = createAgent();
      const session = await agent.startSession(projectId);

      expect(session.warnings).toBeDefined();
      expect(session.warnings!.length).toBeGreaterThanOrEqual(3);
      expect(session.warnings!.some((w) => w.includes('technology stack'))).toBe(true);
      expect(session.warnings!.some((w) => w.includes('components'))).toBe(true);
      expect(session.warnings!.some((w) => w.includes('NFR'))).toBe(true);
    });

    it('passes warnings through to generateFromProject result', async () => {
      const dir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'sds.md'),
        '---\ndoc_id: SDS-bare\ntitle: Bare\n---\n\n# Software Design Specification: Bare\n',
        'utf-8'
      );

      const agent = createAgent();
      const result = await agent.generateFromProject(projectId);

      expect(result.success).toBe(true);
      expect(result.generatedDocuments).toHaveLength(0);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThanOrEqual(3);
      // No technology stack → no decisions → no output files.
      expect(result.scratchpadPaths).toHaveLength(0);
      expect(result.publicPaths).toHaveLength(0);
      expect(result.scratchpadPathsKorean).toHaveLength(0);
      expect(result.publicPathsKorean).toHaveLength(0);
    });
  });

  describe('empty-collection rendering branches', () => {
    // These tests reach into the agent's private renderers to cover the
    // empty-list branches that never fire in the happy path (consequences
    // and references always get populated by buildConsequences/buildReferences).
    type InternalRenderer = {
      renderConsequences: (c: {
        positive: readonly string[];
        negative: readonly string[];
        risks: readonly string[];
      }) => string;
      renderConsequencesKorean: (c: {
        positive: readonly string[];
        negative: readonly string[];
        risks: readonly string[];
      }) => string;
      renderReferences: (refs: readonly string[]) => string;
    };

    it('renders empty consequences as placeholder text (English)', () => {
      const agent = createAgent() as unknown as InternalRenderer;
      const out = agent.renderConsequences({ positive: [], negative: [], risks: [] });
      const noneMatches = out.match(/_None identified\._/g) ?? [];
      expect(noneMatches.length).toBe(3);
    });

    it('renders empty consequences as placeholder text (Korean)', () => {
      const agent = createAgent() as unknown as InternalRenderer;
      const out = agent.renderConsequencesKorean({ positive: [], negative: [], risks: [] });
      const noneMatches = out.match(/_식별된 항목이 없습니다\._/g) ?? [];
      expect(noneMatches.length).toBe(3);
    });

    it('renders empty references as placeholder text', () => {
      const agent = createAgent() as unknown as InternalRenderer;
      const out = agent.renderReferences([]);
      expect(out).toContain('_No references available._');
    });
  });

  describe('file write failure', () => {
    it('wraps filesystem errors in FileWriteError', async () => {
      writeSampleSDS();
      // Point publicDocsPath at an existing FILE so mkdirSync fails with ENOTDIR.
      const collisionFile = path.join(testBasePath, 'collision-file');
      fs.mkdirSync(testBasePath, { recursive: true });
      fs.writeFileSync(collisionFile, 'not a directory', 'utf-8');

      const agent = new TechDecisionWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: path.join(collisionFile, 'nested'),
      });

      await expect(agent.generateFromProject(projectId)).rejects.toBeInstanceOf(FileWriteError);
    });
  });

  describe('finalize edge cases', () => {
    it('throws GenerationError when the completed session has no generated documents', async () => {
      writeSampleSDS();
      const agent = createAgent();
      // Drive the session into `completed` with an empty documents array by
      // calling startSession and then mutating via reflection.
      const session = await agent.startSession(projectId);
      // The session object is readonly from the public surface, so we round
      // through a cast here. This exercises the defensive branch inside
      // finalize() that guards against a completed-but-empty session.
      const mutable = session as {
        status: string;
        generatedDocuments: readonly GeneratedTechDecision[];
      };
      mutable.status = 'completed';
      mutable.generatedDocuments = [];
      await expect(agent.finalize()).rejects.toBeInstanceOf(GenerationError);
    });
  });
});

describe('Tech Decision Writer error classes', () => {
  it('SDSNotFoundError captures project and path', () => {
    const err = new SDSNotFoundError('proj-a', '/tmp/missing/sds.md');
    expect(err).toBeInstanceOf(TechDecisionWriterError);
    expect(err.name).toBe('SDSNotFoundError');
    expect(err.projectId).toBe('proj-a');
    expect(err.searchedPath).toBe('/tmp/missing/sds.md');
    expect(err.message).toContain('proj-a');
    expect(err.message).toContain('/tmp/missing/sds.md');
  });

  it('SessionStateError captures state transition details', () => {
    const err = new SessionStateError('pending', 'completed', 'finalize');
    expect(err).toBeInstanceOf(TechDecisionWriterError);
    expect(err.name).toBe('SessionStateError');
    expect(err.currentState).toBe('pending');
    expect(err.expectedState).toBe('completed');
    expect(err.message).toContain('finalize');
    expect(err.message).toContain('pending');
    expect(err.message).toContain('completed');
  });

  it('GenerationError captures project and phase', () => {
    const err = new GenerationError('proj-b', 'parsing', 'bad table');
    expect(err).toBeInstanceOf(TechDecisionWriterError);
    expect(err.name).toBe('GenerationError');
    expect(err.projectId).toBe('proj-b');
    expect(err.phase).toBe('parsing');
    expect(err.message).toContain('proj-b');
    expect(err.message).toContain('parsing');
    expect(err.message).toContain('bad table');
  });

  it('FileWriteError captures file path', () => {
    const err = new FileWriteError('/tmp/out/TD-001.md', 'EACCES');
    expect(err).toBeInstanceOf(TechDecisionWriterError);
    expect(err.name).toBe('FileWriteError');
    expect(err.filePath).toBe('/tmp/out/TD-001.md');
    expect(err.message).toContain('/tmp/out/TD-001.md');
    expect(err.message).toContain('EACCES');
  });

  it('InvalidCriteriaError reports the observed weight sum', () => {
    const err = new InvalidCriteriaError(0.9);
    expect(err).toBeInstanceOf(TechDecisionWriterError);
    expect(err.name).toBe('InvalidCriteriaError');
    expect(err.weightSum).toBe(0.9);
    expect(err.message).toContain('0.900');
  });
});
