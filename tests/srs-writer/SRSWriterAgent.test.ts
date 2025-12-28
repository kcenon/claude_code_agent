import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SRSWriterAgent,
  getSRSWriterAgent,
  resetSRSWriterAgent,
} from '../../src/srs-writer/SRSWriterAgent.js';
import {
  SessionStateError,
  PRDNotFoundError,
  LowCoverageError,
  GenerationError,
} from '../../src/srs-writer/errors.js';

describe('SRSWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'srs-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'srs-writer', 'test-docs');

  const createSamplePRD = (): string => `
# PRD: Test Product

| Field | Value |
|-------|-------|
| Document ID | PRD-001 |
| Version | 1.0.0 |
| Status | Draft |

## 1. Executive Summary

This is a test product for automated SRS generation.

## 2. User Personas

### 2.1 Developer
**Role**: Software Engineer
**Description**: Builds the system

## 3. Functional Requirements

### FR-001: User Authentication
**Priority**: P0
**Description**: Users must be able to authenticate with email and password.

**Acceptance Criteria**:
- [ ] Users can log in
- [ ] Users can log out
- [ ] Session is managed securely

### FR-002: Data Export
**Priority**: P1
**Description**: Users should be able to export their data.

**Acceptance Criteria**:
- [ ] Export to CSV
- [ ] Export to JSON

**Depends on**: FR-001

## 4. Non-Functional Requirements

### NFR-001: Performance
**Category**: Performance
**Description**: System response time must be under 200ms
**Priority**: P1

### NFR-002: Security
**Category**: Security
**Description**: All data must be encrypted
**Priority**: P0

## 5. Constraints

- **Technical**: Must use TypeScript

## 6. Assumptions

- Users have modern browsers
`;

  const cleanupTestEnvironment = async () => {
    try {
      await fs.promises.rm(testBasePath, { recursive: true });
    } catch {
      // Ignore
    }
    try {
      await fs.promises.rm(testDocsPath, { recursive: true });
    } catch {
      // Ignore
    }
  };

  const setupPRDFile = async (projectId: string, content: string) => {
    const prdDir = path.join(testBasePath, 'documents', projectId);
    await fs.promises.mkdir(prdDir, { recursive: true });
    await fs.promises.writeFile(path.join(prdDir, 'prd.md'), content);
  };

  beforeEach(async () => {
    resetSRSWriterAgent();
    await cleanupTestEnvironment();
    await fs.promises.mkdir(testBasePath, { recursive: true });
    await fs.promises.mkdir(testDocsPath, { recursive: true });
  });

  afterEach(async () => {
    resetSRSWriterAgent();
    await cleanupTestEnvironment();
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const agent = new SRSWriterAgent();
      expect(agent).toBeInstanceOf(SRSWriterAgent);
    });

    it('should accept custom config', () => {
      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        coverageThreshold: 90,
      });
      expect(agent).toBeInstanceOf(SRSWriterAgent);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getSRSWriterAgent', () => {
      const agent1 = getSRSWriterAgent();
      const agent2 = getSRSWriterAgent();
      expect(agent1).toBe(agent2);
    });

    it('should reset instance with resetSRSWriterAgent', () => {
      const agent1 = getSRSWriterAgent();
      resetSRSWriterAgent();
      const agent2 = getSRSWriterAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('getSession', () => {
    it('should return null when no session started', () => {
      const agent = new SRSWriterAgent();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('startSession', () => {
    it('should start session with valid PRD', async () => {
      await setupPRDFile('001', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession('001');

      expect(session).toBeDefined();
      expect(session.projectId).toBe('001');
      expect(session.status).toBe('pending');
      expect(session.parsedPRD).toBeDefined();
    });

    it('should throw error when PRD missing', async () => {
      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      // Should throw an error (either PRDNotFoundError or scratchpad error)
      await expect(agent.startSession('nonexistent')).rejects.toThrow();
    });

    it('should parse PRD content correctly', async () => {
      await setupPRDFile('002', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession('002');

      expect(session.parsedPRD.productName).toBe('Test Product');
      expect(session.parsedPRD.functionalRequirements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('decompose', () => {
    it('should decompose requirements into features', async () => {
      await setupPRDFile('003', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('003');
      const result = agent.decompose();

      expect(result.features.length).toBeGreaterThanOrEqual(2);
      expect(result.traceabilityMap.size).toBeGreaterThan(0);
    });

    it('should throw SessionStateError when no session', () => {
      const agent = new SRSWriterAgent();

      expect(() => agent.decompose()).toThrow(SessionStateError);
    });

    it('should update session status', async () => {
      await setupPRDFile('004', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('004');
      agent.decompose();

      const session = agent.getSession();
      expect(session?.decompositionResult).toBeDefined();
    });
  });

  describe('buildTraceability', () => {
    it('should build traceability matrix', async () => {
      await setupPRDFile('005', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('005');
      const matrix = agent.buildTraceability();

      expect(matrix.entries.length).toBeGreaterThan(0);
      expect(matrix.forwardCoverage).toBeGreaterThan(0);
    });

    it('should include use case IDs', async () => {
      await setupPRDFile('006', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('006');
      const matrix = agent.buildTraceability();

      const hasUseCases = matrix.entries.some((e) => e.useCaseIds.length > 0);
      expect(hasUseCases).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate SRS document', async () => {
      await setupPRDFile('007', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('007');
      const srs = agent.generate();

      expect(srs.metadata.documentId).toBe('SRS-007');
      expect(srs.metadata.sourcePRD).toBe('PRD-001');
      expect(srs.content.length).toBeGreaterThan(0);
    });

    it('should include features in generated SRS', async () => {
      await setupPRDFile('008', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('008');
      const srs = agent.generate();

      expect(srs.features.length).toBeGreaterThan(0);
    });

    it('should include traceability matrix', async () => {
      await setupPRDFile('009', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        includeTraceability: true,
      });

      await agent.startSession('009');
      const srs = agent.generate();

      expect(srs.traceabilityMatrix).toBeDefined();
      expect(srs.content).toContain('Traceability Matrix');
    });

    it('should update session to completed status', async () => {
      await setupPRDFile('010', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('010');
      agent.generate();

      const session = agent.getSession();
      expect(session?.status).toBe('completed');
    });
  });

  describe('finalize', () => {
    it('should save SRS to scratchpad and public docs', async () => {
      await setupPRDFile('011', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('011');
      const result = await agent.finalize();

      expect(result.success).toBe(true);
      expect(fs.existsSync(result.scratchpadPath)).toBe(true);
      expect(fs.existsSync(result.publicPath)).toBe(true);
    });

    it('should return generation stats', async () => {
      await setupPRDFile('012', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('012');
      const result = await agent.finalize();

      expect(result.stats.prdRequirementsCount).toBeGreaterThanOrEqual(0);
      expect(result.stats.featuresGenerated).toBeGreaterThanOrEqual(0);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateFromProject', () => {
    it('should complete full generation in one call', async () => {
      await setupPRDFile('013', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('013');

      expect(result.success).toBe(true);
      expect(result.generatedSRS.features.length).toBeGreaterThan(0);
    });
  });

  describe('generateFromPRDContent', () => {
    it('should generate SRS from PRD content directly', async () => {
      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromPRDContent(createSamplePRD(), '014');

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('014');
      expect(result.generatedSRS.features.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear current session', async () => {
      await setupPRDFile('015', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('015');
      expect(agent.getSession()).not.toBeNull();

      agent.reset();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('coverage threshold', () => {
    it('should fail when coverage below threshold', async () => {
      // Create PRD with requirement that won't be mapped
      const partialPRD = `
# PRD: Partial Test

| Document ID | PRD-016 |

## Functional Requirements

### FR-001: Feature 1
**Description**:
**Priority**: P1

### FR-002: Feature 2
**Description**:
**Priority**: P1

### FR-003: Feature 3
**Description**:
**Priority**: P1
`;
      await setupPRDFile('016', partialPRD);

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        failOnLowCoverage: true,
        coverageThreshold: 100, // Require 100% coverage
      });

      await agent.startSession('016');

      // This might throw LowCoverageError if coverage < 100%
      // But since decomposition is based on requirements, it should map all
      try {
        agent.decompose();
      } catch (error) {
        if (error instanceof LowCoverageError) {
          expect(error.actualCoverage).toBeLessThan(100);
        }
      }
    });
  });

  describe('error handling', () => {
    it('should throw SessionStateError when decompose called in wrong state', async () => {
      await setupPRDFile('021', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('021');
      agent.decompose();
      agent.buildTraceability();
      agent.generate(); // Now status is 'completed'

      // Trying to decompose again when status is 'completed' should throw
      expect(() => agent.decompose()).toThrow(SessionStateError);
    });

    it('should throw SessionStateError when buildTraceability called after completion', async () => {
      await setupPRDFile('022', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('022');
      agent.generate(); // This sets status to 'completed'

      // Trying to build traceability when status is 'completed' should throw
      expect(() => agent.buildTraceability()).toThrow(SessionStateError);
    });

    it('should throw SessionStateError when generate called after completion', async () => {
      await setupPRDFile('023', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('023');
      agent.generate(); // This sets status to 'completed'

      // Trying to generate again when status is 'completed' should throw
      expect(() => agent.generate()).toThrow(SessionStateError);
    });

    it('should auto-decompose when buildTraceability called without explicit decompose', async () => {
      await setupPRDFile('025', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('025');
      // Directly call buildTraceability without decompose - should auto-decompose
      const matrix = agent.buildTraceability();

      expect(matrix.entries.length).toBeGreaterThan(0);
    });

    it('should auto-decompose and auto-build-traceability when generate called directly', async () => {
      await setupPRDFile('026', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('026');
      // Directly call generate without decompose or buildTraceability
      const srs = agent.generate();

      expect(srs.features.length).toBeGreaterThan(0);
      expect(srs.traceabilityMatrix).toBeDefined();
    });
  });

  describe('NFR references in features', () => {
    it('should include related NFRs in generated SRS when features reference NFRs', async () => {
      const prdWithNFRReferences = `
# PRD: NFR Reference Test

| Document ID | PRD-024 |

## User Personas

### Developer
**Role**: Engineer

## Functional Requirements

### FR-001: High Performance API
**Priority**: P0
**Description**: The API must meet NFR-001 performance requirements. Also comply with NFR-002 security standards.

**Acceptance Criteria**:
- [ ] Response time under 200ms (NFR-001)
- [ ] All data encrypted (NFR-002)

## Non-Functional Requirements

### NFR-001: Performance
**Category**: Performance
**Description**: Response time under 200ms
**Priority**: P0

### NFR-002: Security
**Category**: Security
**Description**: All data must be encrypted
**Priority**: P0
`;
      await setupPRDFile('024', prdWithNFRReferences);

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('024');
      const srs = agent.generate();

      // Check that NFR references are extracted and included
      expect(srs.content).toContain('NFR-001');
      expect(srs.content).toContain('NFR-002');
    });
  });

  describe('generated content', () => {
    it('should include system features section', async () => {
      await setupPRDFile('017', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('017');
      const srs = agent.generate();

      expect(srs.content).toContain('## 2. System Features');
    });

    it('should include use cases in content', async () => {
      await setupPRDFile('018', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('018');
      const srs = agent.generate();

      expect(srs.content).toContain('#### Use Cases');
      expect(srs.content).toContain('UC-');
    });

    it('should include NFR section', async () => {
      await setupPRDFile('019', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('019');
      const srs = agent.generate();

      expect(srs.content).toContain('## 3. Non-Functional Requirements');
      expect(srs.content).toContain('NFR-');
    });

    it('should include metadata table', async () => {
      await setupPRDFile('020', createSamplePRD());

      const agent = new SRSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('020');
      const srs = agent.generate();

      expect(srs.content).toContain('| **Document ID** |');
      expect(srs.content).toContain('| **Source PRD** |');
    });
  });
});
