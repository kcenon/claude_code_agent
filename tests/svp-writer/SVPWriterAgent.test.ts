import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SVPWriterAgent,
  getSVPWriterAgent,
  resetSVPWriterAgent,
  SVP_WRITER_AGENT_ID,
} from '../../src/svp-writer/SVPWriterAgent.js';
import { SRSNotFoundError, SessionStateError } from '../../src/svp-writer/errors.js';
import { TestLevel } from '../../src/svp-writer/types.js';
import {
  deriveTestCasesForUseCase,
  deriveTestCasesForUseCases,
  type DerivationContext,
} from '../../src/svp-writer/TestCaseDeriver.js';
import { generateNFRTestCases } from '../../src/svp-writer/NFRTestGenerator.js';

describe('SVPWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'svp-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'svp-writer', 'test-docs');

  const sampleSRS = `---
doc_id: SRS-test-project
title: Test Product
version: 1.0.0
status: Approved
---

# SRS: Test Product

| Field | Value |
|-------|-------|
| **Document ID** | SRS-test-project |
| **Source PRD** | PRD-test-project |
| **Version** | 1.0.0 |
| **Status** | Approved |

## 1. Introduction

### 1.1 Purpose
Verification fixture.

## 2. System Features

### F-001: Authentication

**Priority**: P0

**Description**:
User login and logout flows.

#### Use Cases

##### UC-001: Login

- **Actor**: End User
- **Description**: User authenticates with username and password.

**Preconditions**:
  - User has a registered account
  - Authentication service is reachable

**Main Flow**:
  1. User submits credentials
  2. System validates credentials
  3. System issues a session token

**Alternative Flows**:
  - Credentials invalid: system rejects login with error
  - Account locked: system redirects to recovery flow

**Postconditions**:
  - Session is established

##### UC-002: Logout

- **Actor**: End User
- **Description**: User terminates the active session.

**Preconditions**:
  - User is currently authenticated

**Main Flow**:
  1. User triggers logout
  2. System invalidates the session

**Postconditions**:
  - Session no longer exists

## 3. Non-Functional Requirements

### 3.1 Performance Requirements

| ID | Description | Target | Priority |
|----|-------------|--------|----------|
| NFR-001 | Login latency under load | p95 < 200ms | P1 |

### 3.2 Security Requirements

| ID | Description | Target | Priority |
|----|-------------|--------|----------|
| NFR-002 | Brute-force resistance | 5 attempts/min | P0 |

### 3.3 Reliability Requirements

| ID | Description | Target | Priority |
|----|-------------|--------|----------|
| NFR-003 | Availability of auth service | 99.9% monthly | P1 |
`;

  const sampleSDS = `---
doc_id: SDS-test-project
title: Test Product
---

# SDS: Test Product

## 5. Interface Design

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
`;

  const setupSRS = (projectId: string, srs: string = sampleSRS, sds?: string): void => {
    const docsDir = path.join(testBasePath, 'documents', projectId);
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'srs.md'), srs, 'utf-8');
    if (sds !== undefined) {
      fs.writeFileSync(path.join(docsDir, 'sds.md'), sds, 'utf-8');
    }
  };

  beforeEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetSVPWriterAgent();
  });

  afterEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    if (fs.existsSync(testDocsPath)) {
      fs.rmSync(testDocsPath, { recursive: true, force: true });
    }
    resetSVPWriterAgent();
  });

  describe('constructor and IAgent interface', () => {
    it('constructs with default config', () => {
      const agent = new SVPWriterAgent();
      expect(agent.agentId).toBe(SVP_WRITER_AGENT_ID);
      expect(agent.name).toBe('SVP Writer Agent');
    });

    it('accepts custom config overrides', () => {
      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      expect(agent.agentId).toBe(SVP_WRITER_AGENT_ID);
    });

    it('initialize is idempotent and dispose clears session', async () => {
      const agent = new SVPWriterAgent();
      await agent.initialize();
      await agent.initialize();
      expect(agent.getSession()).toBeNull();
      await agent.dispose();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getSVPWriterAgent();
      const b = getSVPWriterAgent();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after reset', () => {
      const a = getSVPWriterAgent();
      resetSVPWriterAgent();
      const b = getSVPWriterAgent();
      expect(a).not.toBe(b);
    });
  });

  describe('startSession', () => {
    it('creates a session when SRS exists', async () => {
      const projectId = 'test-project';
      setupSRS(projectId, sampleSRS, sampleSDS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession(projectId);

      expect(session.projectId).toBe(projectId);
      expect(session.status).toBe('pending');
      expect(session.parsedSRS.documentId).toBe('SRS-test-project');
      expect(session.parsedSRS.useCases).toHaveLength(2);
      expect(session.parsedSRS.nfrs).toHaveLength(3);
      expect(session.parsedSDS.interfaces.length).toBeGreaterThan(0);
      expect(session.sessionId).toBeTruthy();
    });

    it('throws SRSNotFoundError when SRS is missing', async () => {
      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await expect(agent.startSession('missing')).rejects.toThrow(SRSNotFoundError);
    });

    it('warns and uses empty interfaces when SDS is missing', async () => {
      const projectId = 'no-sds';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const session = await agent.startSession(projectId);

      expect(session.parsedSDS.interfaces).toHaveLength(0);
      expect(session.warnings ?? []).toContain(
        'SDS document not found — integration tests will reference SRS use cases only.'
      );
    });

    it('extracts use case fields correctly', async () => {
      const projectId = 'uc-extract';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const session = await agent.startSession(projectId);

      const uc1 = session.parsedSRS.useCases[0];
      expect(uc1?.id).toBe('UC-001');
      expect(uc1?.title).toBe('Login');
      expect(uc1?.actor).toBe('End User');
      expect(uc1?.preconditions).toHaveLength(2);
      expect(uc1?.mainFlow).toHaveLength(3);
      expect(uc1?.alternativeFlows).toHaveLength(2);
      expect(uc1?.postconditions).toHaveLength(1);
    });

    it('extracts NFR rows with category, target, and priority', async () => {
      const projectId = 'nfr-extract';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const session = await agent.startSession(projectId);

      const ids = session.parsedSRS.nfrs.map((n) => n.id);
      expect(ids).toEqual(['NFR-001', 'NFR-002', 'NFR-003']);

      const perf = session.parsedSRS.nfrs.find((n) => n.id === 'NFR-001');
      expect(perf?.category).toBe('performance');
      expect(perf?.target).toBe('p95 < 200ms');
      expect(perf?.priority).toBe('P1');

      const sec = session.parsedSRS.nfrs.find((n) => n.id === 'NFR-002');
      expect(sec?.category).toBe('security');
      expect(sec?.priority).toBe('P0');
    });
  });

  describe('generateFromProject', () => {
    it('produces a result with bilingual content and all four output files', async () => {
      const projectId = 'gen-project';
      setupSRS(projectId, sampleSRS, sampleSDS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(result.generatedSVP.metadata.documentId).toBe('SVP-gen-project');
      expect(result.generatedSVP.content).toContain('Software Verification Plan');
      expect(result.generatedSVP.contentKorean).toContain('소프트웨어 검증 계획');

      expect(fs.existsSync(result.scratchpadPath)).toBe(true);
      expect(fs.existsSync(result.scratchpadPathKorean)).toBe(true);
      expect(fs.existsSync(result.publicPath)).toBe(true);
      expect(fs.existsSync(result.publicPathKorean)).toBe(true);
    });

    it('derives at least one test case per use case main flow', async () => {
      const projectId = 'derivation';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      // Each UC produces: 1 happy + N alt + M precondition.
      // UC-001: 1 + 2 + 2 = 5
      // UC-002: 1 + 0 + 1 = 2
      // NFRs:   3
      // Total:  10
      expect(result.stats.totalTestCases).toBe(10);
      expect(result.stats.useCaseCount).toBe(2);
      expect(result.stats.nfrCount).toBe(3);
      expect(result.stats.systemTestCases).toBeGreaterThanOrEqual(2);
      expect(result.stats.unitTestCases).toBeGreaterThanOrEqual(3);
      expect(result.stats.integrationTestCases).toBeGreaterThanOrEqual(2);
    });

    it('renders the seven canonical sections', async () => {
      const projectId = 'sections';
      setupSRS(projectId, sampleSRS, sampleSDS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);
      const md = result.generatedSVP.content;

      expect(md).toContain('## 1. Verification Strategy');
      expect(md).toContain('## 2. Test Environment');
      expect(md).toContain('## 3. Unit Verification');
      expect(md).toContain('## 4. Integration Verification');
      expect(md).toContain('## 5. System Verification');
      expect(md).toContain('## 6. Traceability Matrix');
      expect(md).toContain('## 7. Coverage Summary');
    });

    it('embeds frontmatter referencing both SRS and SDS', async () => {
      const projectId = 'frontmatter';
      setupSRS(projectId, sampleSRS, sampleSDS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.generatedSVP.content.startsWith('---\n')).toBe(true);
      expect(result.generatedSVP.content).toContain('doc_id: SVP-frontmatter');
      expect(result.generatedSVP.content).toContain('SRS-test-project');
      expect(result.generatedSVP.content).toContain('SDS-test-project');
    });

    it('produces a traceability matrix that maps every UC and NFR', async () => {
      const projectId = 'trace';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      const trace = result.generatedSVP.traceability;
      const ucEntries = trace.filter((t) => t.sourceKind === 'use_case');
      const nfrEntries = trace.filter((t) => t.sourceKind === 'nfr');

      expect(ucEntries).toHaveLength(2);
      expect(nfrEntries).toHaveLength(3);
      for (const entry of trace) {
        expect(entry.testCaseIds.length).toBeGreaterThan(0);
      }
    });

    it('emits the bilingual section headings in the Korean variant', async () => {
      const projectId = 'korean';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);
      const ko = result.generatedSVP.contentKorean;

      expect(ko).toContain('## 1. 검증 전략');
      expect(ko).toContain('## 2. 테스트 환경');
      expect(ko).toContain('## 3. 단위 검증');
      expect(ko).toContain('## 4. 통합 검증');
      expect(ko).toContain('## 5. 시스템 검증');
      expect(ko).toContain('## 6. 추적 매트릭스');
      expect(ko).toContain('## 7. 커버리지 요약');
    });

    it('falls back to a default smoke test when SRS has no UCs and no NFRs', async () => {
      const projectId = 'empty';
      const minimalSRS = `---
doc_id: SRS-empty
title: Empty Product
---

# SRS: Empty Product

## 2. System Features

(no use cases yet)
`;
      setupSRS(projectId, minimalSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      const result = await agent.generateFromProject(projectId);

      expect(result.stats.totalTestCases).toBe(1);
      expect(result.generatedSVP.testCases[0]?.level).toBe(TestLevel.System);
    });
  });

  describe('finalize', () => {
    it('rewrites output files for a completed session', async () => {
      const projectId = 'finalize';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.generateFromProject(projectId);

      // Delete one of the outputs and verify finalize re-creates it
      const session = agent.getSession();
      expect(session?.status).toBe('completed');

      const deletePath = path.join(testDocsPath, `SVP-${projectId}.md`);
      fs.rmSync(deletePath, { force: true });
      expect(fs.existsSync(deletePath)).toBe(false);

      const finalized = await agent.finalize();
      expect(finalized.success).toBe(true);
      expect(fs.existsSync(deletePath)).toBe(true);
    });

    it('throws SessionStateError when no session exists', async () => {
      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });

    it('throws SessionStateError when session has not completed', async () => {
      const projectId = 'incomplete';
      setupSRS(projectId, sampleSRS);

      const agent = new SVPWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });
      await agent.startSession(projectId);
      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });
  });

  describe('TestCaseDeriver (pure)', () => {
    it('derives happy + alt + precondition tests for a UC', () => {
      const ctx: DerivationContext = { nextId: 1 };
      const tests = deriveTestCasesForUseCase(
        {
          id: 'UC-100',
          title: 'Sample',
          actor: 'User',
          preconditions: ['p1', 'p2'],
          mainFlow: ['s1', 's2'],
          alternativeFlows: ['alt1'],
          postconditions: ['post1'],
        },
        ctx
      );

      expect(tests).toHaveLength(4); // 1 happy + 1 alt + 2 precondition
      expect(tests[0]?.level).toBe(TestLevel.System);
      expect(tests[1]?.level).toBe(TestLevel.Integration);
      expect(tests[2]?.level).toBe(TestLevel.Unit);
      expect(tests[3]?.level).toBe(TestLevel.Unit);
      expect(ctx.nextId).toBe(5);
    });

    it('shares the id counter across multiple UCs', () => {
      const ctx: DerivationContext = { nextId: 1 };
      const tests = deriveTestCasesForUseCases(
        [
          {
            id: 'UC-100',
            title: 'A',
            actor: '',
            preconditions: [],
            mainFlow: ['m'],
            alternativeFlows: [],
            postconditions: [],
          },
          {
            id: 'UC-101',
            title: 'B',
            actor: '',
            preconditions: [],
            mainFlow: ['m'],
            alternativeFlows: [],
            postconditions: [],
          },
        ],
        ctx
      );
      expect(tests).toHaveLength(2);
      expect(tests[0]?.id).toBe('TC-001');
      expect(tests[1]?.id).toBe('TC-002');
    });
  });

  describe('NFRTestGenerator (pure)', () => {
    it('maps performance NFRs to integration tests', () => {
      const ctx: DerivationContext = { nextId: 10 };
      const tests = generateNFRTestCases(
        [
          {
            id: 'NFR-100',
            category: 'performance',
            description: 'Latency',
            target: 'p95 < 100ms',
            priority: 'P1',
          },
        ],
        ctx
      );
      expect(tests[0]?.level).toBe(TestLevel.Integration);
      expect(tests[0]?.category).toBe('nfr_performance');
      expect(tests[0]?.id).toBe('TC-010');
    });

    it('maps reliability NFRs to system tests', () => {
      const ctx: DerivationContext = { nextId: 1 };
      const tests = generateNFRTestCases(
        [
          {
            id: 'NFR-200',
            category: 'reliability',
            description: 'Recovery',
            target: '< 1 minute',
            priority: 'P0',
          },
        ],
        ctx
      );
      expect(tests[0]?.level).toBe(TestLevel.System);
      expect(tests[0]?.category).toBe('nfr_reliability');
    });
  });
});
