import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ThreatModelWriterAgent,
  getThreatModelWriterAgent,
  resetThreatModelWriterAgent,
  THREAT_MODEL_WRITER_AGENT_ID,
} from '../../src/threat-model-writer/ThreatModelWriterAgent.js';
import { SDSNotFoundError, SessionStateError } from '../../src/threat-model-writer/errors.js';
import { StrideCategory } from '../../src/threat-model-writer/types.js';

describe('ThreatModelWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'threat-model-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'threat-model-writer', 'test-docs');

  const sampleSDS = `---
doc_id: SDS-test-project
title: Test Product
version: 1.0.0
status: Approved
---

# Software Design Specification: Test Product

## 1. Architecture Overview

Three-layer architecture: API, Service, Data.

## 2. Component Design

### CMP-001: AuthController

The authentication HTTP controller handling login and logout endpoints.

| Attribute | Value |
|-----------|-------|
| Responsibility | HTTP auth |

### CMP-002: AuthService

Business logic for credential validation and session management.

### CMP-003: DashboardController

Serves dashboard data for authenticated users.

## 5. Interface Design

- POST /api/auth/login
- POST /api/auth/logout
- GET /api/dashboard

## 4. Data Design

- User table
- Session table
`;

  const sampleSDSNoApi = `---
doc_id: SDS-cli-project
title: CLI Tool
version: 1.0.0
status: Approved
---

# Software Design Specification: CLI Tool

## 2. Component Design

### CMP-001: CommandParser

Parses command-line arguments.
`;

  const setupSDS = (projectId: string, content: string = sampleSDS): void => {
    const docsDir = path.join(testBasePath, 'documents', projectId);
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'sds.md'), content, 'utf-8');
  };

  beforeEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetThreatModelWriterAgent();
  });

  afterEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetThreatModelWriterAgent();
  });

  describe('constructor and IAgent interface', () => {
    it('should construct with default config', () => {
      const agent = new ThreatModelWriterAgent();
      expect(agent.agentId).toBe(THREAT_MODEL_WRITER_AGENT_ID);
      expect(agent.name).toBe('Threat Model Writer Agent');
    });

    it('should accept custom config overrides', () => {
      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      expect(agent.agentId).toBe(THREAT_MODEL_WRITER_AGENT_ID);
    });

    it('should initialize and dispose without error', async () => {
      const agent = new ThreatModelWriterAgent();
      await agent.initialize();
      await agent.initialize(); // idempotent
      expect(agent.getSession()).toBeNull();
      await agent.dispose();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return the same instance on repeated calls', () => {
      const a = getThreatModelWriterAgent();
      const b = getThreatModelWriterAgent();
      expect(a).toBe(b);
    });

    it('should return a fresh instance after reset', () => {
      const a = getThreatModelWriterAgent();
      resetThreatModelWriterAgent();
      const b = getThreatModelWriterAgent();
      expect(a).not.toBe(b);
    });
  });

  describe('startSession', () => {
    it('should create a session when SDS exists', async () => {
      const projectId = 'test-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      const session = await agent.startSession(projectId);

      expect(session.projectId).toBe(projectId);
      expect(session.status).toBe('pending');
      expect(session.parsedSDS.documentId).toBe('SDS-test-project');
      expect(session.parsedSDS.components).toHaveLength(3);
      expect(session.parsedSDS.hasApiSurface).toBe(true);
      expect(session.parsedSDS.hasDataLayer).toBe(true);
      expect(session.sessionId).toBeTruthy();
    });

    it('should throw SDSNotFoundError when SDS is missing', async () => {
      const projectId = 'no-sds';
      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.startSession(projectId)).rejects.toThrow(SDSNotFoundError);
    });

    it('should extract component IDs and names from CMP headings', async () => {
      const projectId = 'cmp-extract';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const session = await agent.startSession(projectId);

      const ids = session.parsedSDS.components.map((c) => c.id);
      const names = session.parsedSDS.components.map((c) => c.name);
      expect(ids).toEqual(['CMP-001', 'CMP-002', 'CMP-003']);
      expect(names).toContain('AuthController');
      expect(names).toContain('AuthService');
      expect(names).toContain('DashboardController');
    });

    it('should detect absence of API surface and data layer', async () => {
      const projectId = 'cli-project';
      setupSDS(projectId, sampleSDSNoApi);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const session = await agent.startSession(projectId);

      expect(session.parsedSDS.hasApiSurface).toBe(false);
      expect(session.parsedSDS.hasDataLayer).toBe(false);
    });
  });

  describe('generateFromProject', () => {
    it('should generate a complete Threat Model from SDS', async () => {
      const projectId = 'gen-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      const result = await agent.generateFromProject(projectId);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(result.generatedThreatModel.metadata.documentId).toBe('TM-gen-project');
      expect(result.generatedThreatModel.metadata.sourceSDS).toBe('SDS-test-project');
      expect(result.generatedThreatModel.threats.length).toBeGreaterThanOrEqual(6);
      expect(result.stats.sdsComponentCount).toBe(3);
      expect(result.stats.threatsIdentified).toBeGreaterThanOrEqual(6);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should write all four output files', async () => {
      const projectId = 'file-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(fs.existsSync(result.scratchpadPath)).toBe(true);
      expect(fs.existsSync(result.publicPath)).toBe(true);
      expect(fs.existsSync(result.scratchpadPathKorean)).toBe(true);
      expect(fs.existsSync(result.publicPathKorean)).toBe(true);

      expect(result.scratchpadPath).toContain('tm.md');
      expect(result.scratchpadPathKorean).toContain('tm.kr.md');
      expect(result.publicPath).toContain('TM-file-project.md');
      expect(result.publicPathKorean).toContain('TM-file-project.kr.md');
    });

    it('should cover all six STRIDE categories', async () => {
      const projectId = 'stride-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const categories = new Set(result.generatedThreatModel.threats.map((t) => t.category));
      expect(categories.has(StrideCategory.Spoofing)).toBe(true);
      expect(categories.has(StrideCategory.Tampering)).toBe(true);
      expect(categories.has(StrideCategory.Repudiation)).toBe(true);
      expect(categories.has(StrideCategory.InformationDisclosure)).toBe(true);
      expect(categories.has(StrideCategory.DenialOfService)).toBe(true);
      expect(categories.has(StrideCategory.ElevationOfPrivilege)).toBe(true);
    });

    it('should assign valid DREAD scores (1-10) with averaged overall', async () => {
      const projectId = 'dread-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      for (const threat of result.generatedThreatModel.threats) {
        expect(threat.dread.damage).toBeGreaterThanOrEqual(1);
        expect(threat.dread.damage).toBeLessThanOrEqual(10);
        expect(threat.dread.reproducibility).toBeGreaterThanOrEqual(1);
        expect(threat.dread.reproducibility).toBeLessThanOrEqual(10);
        expect(threat.dread.exploitability).toBeGreaterThanOrEqual(1);
        expect(threat.dread.exploitability).toBeLessThanOrEqual(10);
        expect(threat.dread.affectedUsers).toBeGreaterThanOrEqual(1);
        expect(threat.dread.affectedUsers).toBeLessThanOrEqual(10);
        expect(threat.dread.discoverability).toBeGreaterThanOrEqual(1);
        expect(threat.dread.discoverability).toBeLessThanOrEqual(10);

        const expected =
          Math.round(
            ((threat.dread.damage +
              threat.dread.reproducibility +
              threat.dread.exploitability +
              threat.dread.affectedUsers +
              threat.dread.discoverability) /
              5) *
              10
          ) / 10;
        expect(threat.dread.overall).toBeCloseTo(expected, 1);
      }
    });

    it('should add API injection threat when API surface detected', async () => {
      const projectId = 'api-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const titles = result.generatedThreatModel.threats.map((t) => t.title);
      expect(titles.some((t) => t.toLowerCase().includes('injection'))).toBe(true);
    });

    it('should skip API threat when API surface is absent', async () => {
      const projectId = 'no-api-project';
      setupSDS(projectId, sampleSDSNoApi);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const titles = result.generatedThreatModel.threats.map((t) => t.title);
      expect(titles.some((t) => t.toLowerCase().includes('injection'))).toBe(false);
      // Still has base six STRIDE threats
      expect(result.generatedThreatModel.threats.length).toBeGreaterThanOrEqual(6);
    });

    it('should count high-risk threats with overall DREAD >= 7', async () => {
      const projectId = 'highrisk-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const actualHighCount = result.generatedThreatModel.threats.filter(
        (t) => t.dread.overall >= 7
      ).length;
      expect(result.stats.highRiskThreats).toBe(actualHighCount);
    });

    it('should embed Mermaid data flow diagram in content', async () => {
      const projectId = 'mermaid-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.generatedThreatModel.content).toContain('```mermaid');
      expect(result.generatedThreatModel.content).toContain('flowchart LR');
      expect(result.generatedThreatModel.contentKorean).toContain('```mermaid');
    });

    it('should include all five required sections in English content', async () => {
      const projectId = 'sections-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const content = result.generatedThreatModel.content;
      expect(content).toContain('## 1. System Overview');
      expect(content).toContain('## 2. Threat Identification (STRIDE)');
      expect(content).toContain('## 3. Risk Assessment (DREAD)');
      expect(content).toContain('## 4. Mitigation Strategies');
      expect(content).toContain('## 5. Residual Risk Summary');
    });

    it('should include all five required sections in Korean content', async () => {
      const projectId = 'sections-kr-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const content = result.generatedThreatModel.contentKorean;
      expect(content).toContain('## 1. 시스템 개요');
      expect(content).toContain('## 2. 위협 식별 (STRIDE)');
      expect(content).toContain('## 3. 위험 평가 (DREAD)');
      expect(content).toContain('## 4. 완화 전략');
      expect(content).toContain('## 5. 잔여 위험 요약');
    });

    it('should include frontmatter with docId and sourceDocuments', async () => {
      const projectId = 'frontmatter-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.generatedThreatModel.content).toMatch(/^---/);
      expect(result.generatedThreatModel.content).toContain('TM-frontmatter-project');
      expect(result.generatedThreatModel.content).toContain('SDS-test-project');
    });

    it('should emit warning when SDS has no components', async () => {
      const projectId = 'empty-project';
      const emptySDS = `---
doc_id: SDS-empty
title: Empty
---

# Software Design Specification: Empty

## 2. Component Design

No components defined yet.
`;
      setupSDS(projectId, emptySDS);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length ?? 0).toBeGreaterThanOrEqual(1);
      // Should still produce base threat set
      expect(result.generatedThreatModel.threats.length).toBeGreaterThanOrEqual(6);
    });

    it('should set session status to completed after generation', async () => {
      const projectId = 'status-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.generateFromProject(projectId);

      expect(agent.getSession()?.status).toBe('completed');
    });
  });

  describe('finalize', () => {
    it('should re-write output files from the cached session', async () => {
      const projectId = 'finalize-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.generateFromProject(projectId);

      // Delete output files and re-finalize
      const tmPath = path.join(testBasePath, 'documents', projectId, 'tm.md');
      fs.rmSync(tmPath, { force: true });
      expect(fs.existsSync(tmPath)).toBe(false);

      const result = await agent.finalize();
      expect(result.success).toBe(true);
      expect(fs.existsSync(tmPath)).toBe(true);
    });

    it('should throw SessionStateError when no session exists', async () => {
      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });

    it('should throw SessionStateError when session is not completed', async () => {
      const projectId = 'incomplete-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.startSession(projectId);

      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });
  });

  describe('content quality', () => {
    it('should include all threats in STRIDE and DREAD tables', async () => {
      const projectId = 'tables-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const content = result.generatedThreatModel.content;
      for (const threat of result.generatedThreatModel.threats) {
        expect(content).toContain(`| ${threat.id} |`);
      }
    });

    it('should include a ranked risk subsection', async () => {
      const projectId = 'rank-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.generatedThreatModel.content).toContain('### 3.1 Risk Ranking');
    });

    it('should include residual risk breakdown', async () => {
      const projectId = 'residual-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const content = result.generatedThreatModel.content;
      expect(content).toContain('### 5.1 Per-Threat Residual Risk');
      expect(content).toContain('### 5.2 Review Cadence');
    });

    it('should render components in the scope table', async () => {
      const projectId = 'scope-project';
      setupSDS(projectId);

      const agent = new ThreatModelWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const content = result.generatedThreatModel.content;
      expect(content).toContain('### 1.2 Components in Scope');
      expect(content).toContain('| CMP-001 | AuthController');
      expect(content).toContain('| CMP-002 | AuthService');
      expect(content).toContain('| CMP-003 | DashboardController');
    });
  });
});
