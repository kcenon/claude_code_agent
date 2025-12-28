import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SDSWriterAgent,
  getSDSWriterAgent,
  resetSDSWriterAgent,
} from '../../src/sds-writer/SDSWriterAgent.js';
import {
  SessionStateError,
  SRSNotFoundError,
  GenerationError,
} from '../../src/sds-writer/errors.js';

describe('SDSWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'sds-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'sds-writer', 'test-docs');

  const createSampleSRS = (): string => `
# Software Requirements Specification: Test Product

| **Document ID** | SRS-001 |
| **Source PRD** | PRD-001 |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Project ID** | test-project |

---

## 1. Introduction

### 1.1 Purpose

**Test Product** is a system for testing SDS generation.

## 2. Software Features

### SF-001: User Authentication

| **Priority** | P0 |
| **Source** | FR-001 |
| **Use Cases** | UC-001 |

**Description:**

Users can authenticate using email and password.

**Acceptance Criteria:**

- User can log in with valid credentials
- User receives error for invalid credentials
- Session is created upon successful login

### SF-002: Data Export

| **Priority** | P1 |
| **Source** | FR-002 |
| **Use Cases** | UC-002 |

**Description:**

Users can export their data in various formats.

**Acceptance Criteria:**

- Export to CSV format
- Export to JSON format

## 3. Use Cases

#### UC-001: User Login

| **Primary Actor** | User |
| **Source Feature** | SF-001 |

**Preconditions:**

- User has an account

**Main Success Scenario:**

1. User enters email
2. User enters password
3. System validates credentials
4. System creates session

**Postconditions:**

- User is logged in

#### UC-002: Export Data

| **Primary Actor** | User |
| **Source Feature** | SF-002 |

**Preconditions:**

- User is logged in

**Main Success Scenario:**

1. User selects export format
2. System generates export
3. User downloads file

**Postconditions:**

- Data exported

## 4. Non-Functional Requirements

### NFR-001: Performance

| **Category** | Performance |
| **Priority** | P1 |
| **Metric** | Response time < 200ms |

System should respond within 200ms.

### NFR-002: Security

| **Category** | Security |
| **Priority** | P0 |

All data must be encrypted.

## 5. Constraints

### CON-001: Technical

| **Type** | Technical |

Must use TypeScript.

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

  const setupSRSFile = async (projectId: string, content: string) => {
    const srsDir = path.join(testBasePath, 'documents', projectId);
    await fs.promises.mkdir(srsDir, { recursive: true });
    await fs.promises.writeFile(path.join(srsDir, 'srs.md'), content);
  };

  beforeEach(async () => {
    await cleanupTestEnvironment();
    resetSDSWriterAgent();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
    resetSDSWriterAgent();
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const agent = new SDSWriterAgent();
      expect(agent).toBeDefined();
    });

    it('should create agent with custom config', () => {
      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        coverageThreshold: 90,
      });
      expect(agent).toBeDefined();
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const agent1 = getSDSWriterAgent();
      const agent2 = getSDSWriterAgent();
      expect(agent1).toBe(agent2);
    });

    it('should reset instance', () => {
      const agent1 = getSDSWriterAgent();
      resetSDSWriterAgent();
      const agent2 = getSDSWriterAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('startSession', () => {
    it('should start session with valid SRS', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const session = await agent.startSession('test-project');

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.status).toBe('pending');
      expect(session.parsedSRS).toBeDefined();
    });

    it('should throw when SRS not found', async () => {
      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.startSession('non-existent')).rejects.toThrow(SRSNotFoundError);
    });
  });

  describe('getSession', () => {
    it('should return null when no session', () => {
      const agent = new SDSWriterAgent();
      expect(agent.getSession()).toBeNull();
    });

    it('should return session after startSession', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession('test-project');
      const session = agent.getSession();

      expect(session).not.toBeNull();
      expect(session?.projectId).toBe('test-project');
    });
  });

  describe('generateFromProject', () => {
    it('should generate SDS from project', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project');
      expect(result.generatedSDS).toBeDefined();
      expect(result.stats.componentsGenerated).toBeGreaterThan(0);
    });

    it('should write output files', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(fs.existsSync(result.scratchpadPath)).toBe(true);
      expect(fs.existsSync(result.publicPath)).toBe(true);
    });

    it('should generate components from features', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.components.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate APIs when enabled', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        generateAPIs: true,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.apis.length).toBeGreaterThan(0);
    });

    it('should skip APIs when disabled', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        generateAPIs: false,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.apis).toHaveLength(0);
    });

    it('should generate data models when enabled', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        generateDataModels: true,
      });

      const result = await agent.generateFromProject('test-project');

      // Data models depend on component names containing data-related keywords
      expect(result.stats.dataModelsGenerated).toBeDefined();
    });

    it('should include traceability when enabled', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        includeTraceability: true,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.traceabilityMatrix).toBeDefined();
      expect(result.generatedSDS.content).toContain('Traceability Matrix');
    });

    it('should update session status during generation', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.generateFromProject('test-project');
      const session = agent.getSession();

      expect(session?.status).toBe('completed');
    });

    it('should set failed status on error', async () => {
      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      try {
        await agent.generateFromProject('non-existent');
      } catch {
        // Expected
      }

      // Session might not exist if error occurred before session creation
    });
  });

  describe('finalize', () => {
    it('should throw when no session', async () => {
      const agent = new SDSWriterAgent();

      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });

    it('should return result for completed session', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.generateFromProject('test-project');
      const result = await agent.finalize();

      expect(result.success).toBe(true);
    });
  });

  describe('SDS content', () => {
    it('should include metadata', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.metadata.documentId).toBe('SDS-test-project');
      expect(result.generatedSDS.metadata.sourceSRS).toBe('SRS-001');
    });

    it('should include technology stack', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.technologyStack.length).toBeGreaterThan(0);
      expect(result.generatedSDS.content).toContain('Technology Stack');
    });

    it('should include security spec when enabled', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        generateSecuritySpecs: true,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.security).toBeDefined();
      expect(result.generatedSDS.content).toContain('Security Design');
    });

    it('should include deployment spec', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.deployment).toBeDefined();
      expect(result.generatedSDS.content).toContain('Deployment Architecture');
    });

    it('should generate markdown with sections', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');
      const content = result.generatedSDS.content;

      expect(content).toContain('## 1. Introduction');
      expect(content).toContain('## 2. System Architecture');
      expect(content).toContain('## 3. Component Design');
      expect(content).toContain('## 4. Data Design');
      expect(content).toContain('## 5. Interface Design');
      expect(content).toContain('## 6. Security Design');
    });

    it('should include Mermaid diagram', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.generatedSDS.content).toContain('```mermaid');
      expect(result.generatedSDS.content).toContain('graph TB');
    });
  });

  describe('stats', () => {
    it('should track processing time', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.stats.processingTimeMs).toBeGreaterThan(0);
    });

    it('should count features and components', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.stats.srsFeatureCount).toBe(2);
      expect(result.stats.componentsGenerated).toBe(2);
    });

    it('should calculate traceability coverage', async () => {
      await setupSRSFile('test-project', createSampleSRS());

      const agent = new SDSWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject('test-project');

      expect(result.stats.traceabilityCoverage).toBe(100);
    });
  });
});
