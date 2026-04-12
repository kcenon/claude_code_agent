import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SDPWriterAgent,
  getSDPWriterAgent,
  resetSDPWriterAgent,
  SDP_WRITER_AGENT_ID,
} from '../../src/sdp-writer/SDPWriterAgent.js';
import {
  PRDNotFoundError,
  SRSNotFoundError,
  SessionStateError,
} from '../../src/sdp-writer/errors.js';

describe('SDPWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'sdp-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'sdp-writer', 'test-docs');

  const samplePRD = `---
doc_id: PRD-test-project
title: Test Product
version: 1.0.0
status: Approved
---

# Product Requirements Document: Test Product

## Overview

Test Product is a sample product used for SDP generation tests. It includes a small set of features and non-functional requirements to verify scope sizing.

## Goals

- Goal 1
- Goal 2
`;

  const sampleSRS = `---
doc_id: SRS-test-project
title: Test Product
version: 1.0.0
status: Approved
---

# Software Requirements Specification: Test Product

## 2. Software Features

### SF-001: User Authentication

Description for SF-001.

### SF-002: Data Export

Description for SF-002.

### SF-003: Reporting

Description for SF-003.

## 4. Non-Functional Requirements

### NFR-001: Performance

Performance description.

### NFR-002: Security

Security description.
`;

  const setupPRDAndSRS = (projectId: string): void => {
    const docsDir = path.join(testBasePath, 'documents', projectId);
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'prd.md'), samplePRD, 'utf-8');
    fs.writeFileSync(path.join(docsDir, 'srs.md'), sampleSRS, 'utf-8');
  };

  beforeEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetSDPWriterAgent();
  });

  afterEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetSDPWriterAgent();
  });

  describe('constructor and IAgent interface', () => {
    it('should construct with default config', () => {
      const agent = new SDPWriterAgent();
      expect(agent.agentId).toBe(SDP_WRITER_AGENT_ID);
      expect(agent.name).toBe('SDP Writer Agent');
    });

    it('should accept custom config overrides', () => {
      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        lifecycleModel: 'Waterfall',
      });
      expect(agent.agentId).toBe(SDP_WRITER_AGENT_ID);
    });

    it('should initialize and dispose without error', async () => {
      const agent = new SDPWriterAgent();
      await agent.initialize();
      await agent.initialize(); // idempotent
      expect(agent.getSession()).toBeNull();
      await agent.dispose();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return the same instance on repeated calls', () => {
      const a = getSDPWriterAgent();
      const b = getSDPWriterAgent();
      expect(a).toBe(b);
    });

    it('should return a fresh instance after reset', () => {
      const a = getSDPWriterAgent();
      resetSDPWriterAgent();
      const b = getSDPWriterAgent();
      expect(a).not.toBe(b);
    });
  });

  describe('startSession', () => {
    it('should create a session when PRD and SRS exist', async () => {
      const projectId = 'test-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.initialize();

      const session = await agent.startSession(projectId);

      expect(session.projectId).toBe(projectId);
      expect(session.status).toBe('pending');
      expect(session.parsedPRD.documentId).toBe('PRD-test-project');
      expect(session.parsedSRS.documentId).toBe('SRS-test-project');
      expect(session.parsedSRS.featureCount).toBe(3);
      expect(session.parsedSRS.nfrCount).toBe(2);
      expect(session.sessionId).toBeTruthy();
    });

    it('should throw PRDNotFoundError when PRD is missing', async () => {
      const projectId = 'no-prd';
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'srs.md'), sampleSRS, 'utf-8');

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.startSession(projectId)).rejects.toThrow(PRDNotFoundError);
    });

    it('should throw SRSNotFoundError when SRS is missing', async () => {
      const projectId = 'no-srs';
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'prd.md'), samplePRD, 'utf-8');

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.startSession(projectId)).rejects.toThrow(SRSNotFoundError);
    });

    it('should add a warning when SRS has zero features', async () => {
      const projectId = 'empty-srs';
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'prd.md'), samplePRD, 'utf-8');
      fs.writeFileSync(
        path.join(docsDir, 'srs.md'),
        `---
doc_id: SRS-empty-srs
title: Empty
---
# Software Requirements Specification: Empty
`,
        'utf-8'
      );

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);
      expect(session.parsedSRS.featureCount).toBe(0);
      expect(session.warnings).toBeDefined();
      expect(session.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('generateFromProject', () => {
    it('should generate SDP and write four output files', async () => {
      const projectId = 'gen-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(fs.existsSync(result.scratchpadPath)).toBe(true);
      expect(fs.existsSync(result.publicPath)).toBe(true);
      expect(fs.existsSync(result.scratchpadPathKorean)).toBe(true);
      expect(fs.existsSync(result.publicPathKorean)).toBe(true);

      expect(result.publicPath).toContain(`SDP-${projectId}.md`);
      expect(result.publicPathKorean).toContain(`SDP-${projectId}.kr.md`);
    });

    it('should generate metadata referencing PRD and SRS', async () => {
      const projectId = 'meta-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);

      expect(result.generatedSDP.metadata.documentId).toBe(`SDP-${projectId}`);
      expect(result.generatedSDP.metadata.sourcePRD).toBe('PRD-test-project');
      expect(result.generatedSDP.metadata.sourceSRS).toBe('SRS-test-project');
      expect(result.generatedSDP.metadata.version).toBe('1.0.0');
      expect(result.generatedSDP.metadata.status).toBe('Draft');
    });

    it('should generate the standard set of milestones', async () => {
      const projectId = 'milestone-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);

      expect(result.generatedSDP.milestones.length).toBeGreaterThanOrEqual(5);
      const ids = result.generatedSDP.milestones.map((m) => m.id);
      expect(ids).toContain('M1');
      expect(ids).toContain('M5');
    });

    it('should generate base risks and conditional risks based on scope', async () => {
      const projectId = 'risk-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      // 3 features + 2 NFRs - only base risks (R1-R3) expected
      expect(result.generatedSDP.risks.length).toBe(3);
      const ids = result.generatedSDP.risks.map((r) => r.id);
      expect(ids).toContain('R1');
      expect(ids).toContain('R2');
      expect(ids).toContain('R3');
    });

    it('should add scope risks for large feature/NFR counts', async () => {
      const projectId = 'large-project';
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'prd.md'), samplePRD, 'utf-8');

      const features = Array.from(
        { length: 12 },
        (_, i) => `### SF-${String(i + 1).padStart(3, '0')}: Feature ${i + 1}\n\nDescription.\n`
      ).join('\n');
      const nfrs = Array.from(
        { length: 6 },
        (_, i) => `### NFR-${String(i + 1).padStart(3, '0')}: NFR ${i + 1}\n\nDescription.\n`
      ).join('\n');

      fs.writeFileSync(
        path.join(docsDir, 'srs.md'),
        `---\ndoc_id: SRS-${projectId}\n---\n# SRS\n\n## Features\n\n${features}\n\n## NFRs\n\n${nfrs}\n`,
        'utf-8'
      );

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      // Base 3 + scope-based 2 = 5
      expect(result.generatedSDP.risks.length).toBe(5);
    });

    it('should populate generation stats', async () => {
      const projectId = 'stats-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);

      expect(result.stats.srsFeatureCount).toBe(3);
      expect(result.stats.nfrCount).toBe(2);
      expect(result.stats.milestonesGenerated).toBe(result.generatedSDP.milestones.length);
      expect(result.stats.risksGenerated).toBe(result.generatedSDP.risks.length);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('content checks', () => {
    it('should produce English content with all 9 sections', async () => {
      const projectId = 'sections-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      const content = result.generatedSDP.content;

      expect(content).toContain('## 1. Project Overview');
      expect(content).toContain('## 2. Lifecycle Model');
      expect(content).toContain('## 3. Development Environment');
      expect(content).toContain('## 4. Artifact Definitions');
      expect(content).toContain('## 5. QA Strategy');
      expect(content).toContain('## 6. V&V Strategy');
      expect(content).toContain('## 7. Risk Management');
      expect(content).toContain('## 8. Schedule and Milestones');
      expect(content).toContain('## 9. Configuration Management');
    });

    it('should produce Korean content with all 9 sections', async () => {
      const projectId = 'kr-sections';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      const content = result.generatedSDP.contentKorean;

      expect(content).toContain('## 1. 프로젝트 개요');
      expect(content).toContain('## 2. 생명주기 모델');
      expect(content).toContain('## 3. 개발 환경');
      expect(content).toContain('## 4. 산출물 정의');
      expect(content).toContain('## 5. 품질 보증 전략');
      expect(content).toContain('## 6. V&V 전략');
      expect(content).toContain('## 7. 리스크 관리');
      expect(content).toContain('## 8. 일정 및 마일스톤');
      expect(content).toContain('## 9. 형상 관리');
    });

    it('should include YAML frontmatter in both English and Korean output', async () => {
      const projectId = 'frontmatter-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);

      expect(result.generatedSDP.content.startsWith('---')).toBe(true);
      expect(result.generatedSDP.content).toContain(`doc_id: SDP-${projectId}`);
      expect(result.generatedSDP.contentKorean.startsWith('---')).toBe(true);
      expect(result.generatedSDP.contentKorean).toContain(`doc_id: SDP-${projectId}`);
    });

    it('should write identical content to scratchpad and public locations', async () => {
      const projectId = 'parity-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);

      const scratchpadContent = fs.readFileSync(result.scratchpadPath, 'utf-8');
      const publicContent = fs.readFileSync(result.publicPath, 'utf-8');
      expect(scratchpadContent).toBe(publicContent);

      const scratchpadKr = fs.readFileSync(result.scratchpadPathKorean, 'utf-8');
      const publicKr = fs.readFileSync(result.publicPathKorean, 'utf-8');
      expect(scratchpadKr).toBe(publicKr);
    });
  });

  describe('lifecycle model selection', () => {
    const buildSRS = (featureCount: number): string => {
      const features = Array.from(
        { length: featureCount },
        (_, i) =>
          `### SF-${String(i + 1).padStart(3, '0')}: Feature ${String(i + 1)}\n\nDescription.\n`
      ).join('\n');
      return `---\ndoc_id: SRS-test\n---\n# SRS\n\n## Features\n\n${features}\n`;
    };

    const writeProject = (projectId: string, srsContent: string): void => {
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'prd.md'), samplePRD, 'utf-8');
      fs.writeFileSync(path.join(docsDir, 'srs.md'), srsContent, 'utf-8');
    };

    it('should select Agile when feature count is below 20', async () => {
      const projectId = 'lifecycle-agile';
      writeProject(projectId, buildSRS(5));

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.content).toContain('**Selected Model:** Agile');
      expect(result.generatedSDP.content).toContain('< 20');
      expect(result.generatedSDP.contentKorean).toContain('**선택 모델:** Agile');
    });

    it('should select Iterative when feature count is between 20 and 50', async () => {
      const projectId = 'lifecycle-iterative';
      writeProject(projectId, buildSRS(25));

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.content).toContain('**Selected Model:** Iterative');
      expect(result.generatedSDP.content).toContain('20-50');
    });

    it('should select V-Model when feature count exceeds 50', async () => {
      const projectId = 'lifecycle-vmodel';
      writeProject(projectId, buildSRS(60));

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.content).toContain('**Selected Model:** V-Model');
      expect(result.generatedSDP.content).toContain('> 50');
    });

    it('should honour explicit lifecycleModel config override', async () => {
      const projectId = 'lifecycle-override';
      writeProject(projectId, buildSRS(60)); // would normally pick V-Model

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        lifecycleModel: 'Waterfall',
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.content).toContain('**Selected Model:** Waterfall');
      expect(result.generatedSDP.content).toContain('explicitly configured');
    });

    it('should render the selection heuristic table in both languages', async () => {
      const projectId = 'lifecycle-table';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.content).toContain('### Selection Heuristic');
      expect(result.generatedSDP.content).toContain('| SRS Feature Count | Lifecycle Model |');
      expect(result.generatedSDP.contentKorean).toContain('### 선택 휴리스틱');
      expect(result.generatedSDP.contentKorean).toContain('| SRS 기능 수 | 생명주기 모델 |');
    });
  });

  describe('PRD timeline extraction', () => {
    const writeProject = (projectId: string, prdContent: string): void => {
      const docsDir = path.join(testBasePath, 'documents', projectId);
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'prd.md'), prdContent, 'utf-8');
      fs.writeFileSync(path.join(docsDir, 'srs.md'), sampleSRS, 'utf-8');
    };

    it('should derive milestones from a PRD timeline table', async () => {
      const projectId = 'timeline-table';
      const prd = `---
doc_id: PRD-${projectId}
title: Timeline Table Project
---

# Product Requirements Document: Timeline Table Project

## Overview

A project with a timeline table.

## 7. Timeline

| Phase | Date | Deliverables |
|-------|------|--------------|
| Discovery | 2026-01 | Requirements gathering |
| Build | 2026-02 | Implementation |
| Launch | 2026-03 | Go-live |
`;
      writeProject(projectId, prd);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      const milestoneNames = result.generatedSDP.milestones.map((m) => m.name);
      expect(result.generatedSDP.milestones.length).toBe(3);
      expect(milestoneNames).toEqual(['Discovery', 'Build', 'Launch']);
      expect(result.generatedSDP.milestones[0]?.description).toContain('2026-01');
      // No fallback warning expected when timeline exists
      expect(result.warnings ?? []).not.toContain(
        expect.stringContaining('PRD timeline section was empty')
      );
    });

    it('should derive milestones from a PRD timeline bullet list', async () => {
      const projectId = 'timeline-bullets';
      const prd = `---
doc_id: PRD-${projectId}
title: Bullet Timeline
---

# Product Requirements Document: Bullet Timeline

## Overview

A project with bullet timeline.

## Schedule

- Alpha: prototype with mock data
- Beta: integration with backend
- GA: production release with monitoring
`;
      writeProject(projectId, prd);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.milestones.length).toBe(3);
      const phases = result.generatedSDP.milestones.map((m) => m.phase);
      expect(phases).toEqual(['Alpha', 'Beta', 'GA']);
      expect(result.generatedSDP.milestones[1]?.description).toBe('integration with backend');
    });

    it('should fall back to default milestones with warning when timeline is missing', async () => {
      const projectId = 'timeline-missing';
      // samplePRD has no timeline section
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.milestones.length).toBe(5);
      expect(result.generatedSDP.milestones[0]?.id).toBe('M1');
      expect(result.generatedSDP.milestones[4]?.id).toBe('M5');
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('PRD timeline section was empty'))).toBe(true);
    });

    it('should support Korean timeline section heading', async () => {
      const projectId = 'timeline-korean';
      const prd = `---
doc_id: PRD-${projectId}
title: 한국어 일정
---

# Product Requirements Document: 한국어 일정

## 개요

설명.

## 일정

- 1단계: 요구사항 수집
- 2단계: 구현
`;
      writeProject(projectId, prd);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.generatedSDP.milestones.length).toBe(2);
      expect(result.generatedSDP.milestones[0]?.phase).toBe('1단계');
    });
  });

  describe('V&V section content', () => {
    it('should reference actual SRS feature and NFR counts in English V&V section', async () => {
      const projectId = 'vv-en';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      const content = result.generatedSDP.content;

      expect(content).toContain('### 6.1 Scope Under V&V');
      expect(content).toContain('**3 software feature(s) (SF-xxx)**');
      expect(content).toContain('**2 non-functional requirement(s) (NFR-xxx)**');
      expect(content).toContain('| Software Features (SF-xxx) | 3 |');
      expect(content).toContain('| Non-Functional Requirements (NFR-xxx) | 2 |');
      // Verification subsection should also reference counts
      expect(content).toMatch(/3 SF requirements requires at least one dedicated unit test/);
    });

    it('should reference actual SRS feature and NFR counts in Korean V&V section', async () => {
      const projectId = 'vv-kr';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      const content = result.generatedSDP.contentKorean;

      expect(content).toContain('### 6.1 V&V 대상 범위');
      expect(content).toContain('소프트웨어 기능 3건(SF-xxx)');
      expect(content).toContain('비기능 요구사항 2건(NFR-xxx)');
      expect(content).toContain('| 소프트웨어 기능 (SF-xxx) | 3 |');
      expect(content).toContain('| 비기능 요구사항 (NFR-xxx) | 2 |');
    });
  });

  describe('finalize', () => {
    it('should re-write outputs from a completed session', async () => {
      const projectId = 'finalize-project';
      setupPRDAndSRS(projectId);

      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.generateFromProject(projectId);
      const result = await agent.finalize();

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(fs.existsSync(result.publicPath)).toBe(true);
    });

    it('should throw SessionStateError when no session is active', async () => {
      const agent = new SDPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });
  });
});
