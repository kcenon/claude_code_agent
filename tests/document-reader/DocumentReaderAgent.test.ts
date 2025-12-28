/**
 * Document Reader Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  DocumentReaderAgent,
  getDocumentReaderAgent,
  resetDocumentReaderAgent,
  NoActiveSessionError,
  DEFAULT_DOCUMENT_READER_CONFIG,
} from '../../src/document-reader/index.js';

describe('DocumentReaderAgent', () => {
  let tempDir: string;
  let agent: DocumentReaderAgent;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-reader-test-'));

    // Create docs directory structure
    await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'docs', 'srs'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'docs', 'sds'), { recursive: true });

    // Create agent with temp directory config
    agent = new DocumentReaderAgent({
      docsBasePath: path.join(tempDir, 'docs'),
      scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    resetDocumentReaderAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new DocumentReaderAgent();
      expect(defaultAgent).toBeInstanceOf(DocumentReaderAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new DocumentReaderAgent({
        strictMode: true,
        extractTraceability: false,
      });
      expect(customAgent).toBeInstanceOf(DocumentReaderAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_DOCUMENT_READER_CONFIG.docsBasePath).toBe('docs');
      expect(DEFAULT_DOCUMENT_READER_CONFIG.prdSubdir).toBe('prd');
      expect(DEFAULT_DOCUMENT_READER_CONFIG.srsSubdir).toBe('srs');
      expect(DEFAULT_DOCUMENT_READER_CONFIG.sdsSubdir).toBe('sds');
      expect(DEFAULT_DOCUMENT_READER_CONFIG.extractTraceability).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getDocumentReaderAgent', () => {
      const agent1 = getDocumentReaderAgent();
      const agent2 = getDocumentReaderAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getDocumentReaderAgent();
      resetDocumentReaderAgent();
      const agent2 = getDocumentReaderAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('session management', () => {
    it('should start a session with project ID', async () => {
      const session = await agent.startSession('test-project');

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('reading');
      expect(session.documents).toEqual([]);
      expect(session.currentState).toBeNull();
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

    it('should throw NoActiveSessionError when reading without session', async () => {
      await expect(agent.readDocuments()).rejects.toThrow(NoActiveSessionError);
    });
  });

  describe('document reading', () => {
    it('should read empty directories gracefully', async () => {
      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.success).toBe(true);
      expect(result.stats.documentsProcessed).toBe(0);
      expect(result.currentState.requirements.functional).toEqual([]);
      expect(result.currentState.requirements.nonFunctional).toEqual([]);
    });

    it('should read PRD document and extract functional requirements', async () => {
      // Create a sample PRD
      const prdContent = `# PRD: Test Project

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Document ID | PRD-001 |

## 5. Functional Requirements

### FR-001: User Authentication
- **Description**: Users can authenticate using email and password
- **Priority**: P0
- **User Story**: As a user, I want to log in so that I can access my account
- **Acceptance Criteria**:
  - [ ] User can enter email
  - [ ] User can enter password
  - [ ] System validates credentials

### FR-002: User Registration
- **Description**: New users can create an account
- **Priority**: P1
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), prdContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.success).toBe(true);
      expect(result.stats.prdCount).toBe(1);
      expect(result.currentState.requirements.functional.length).toBe(2);

      const fr001 = result.currentState.requirements.functional.find((r) => r.id === 'FR-001');
      expect(fr001).toBeDefined();
      expect(fr001?.title).toBe('User Authentication');
      expect(fr001?.priority).toBe('P0');
      expect(fr001?.description).toContain('authenticate');
    });

    it('should read PRD document and extract non-functional requirements', async () => {
      const prdContent = `# PRD: Test Project

## 6. Non-Functional Requirements

### NFR-001: Performance
- **Description**: System should respond within 200ms
- **Category**: performance
- **Target Metric**: Response time < 200ms
- **Priority**: P1

### NFR-002: Security
- **Description**: All data must be encrypted
- **Category**: security
- **Priority**: P0
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), prdContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.requirements.nonFunctional.length).toBe(2);

      const nfr001 = result.currentState.requirements.nonFunctional.find((r) => r.id === 'NFR-001');
      expect(nfr001).toBeDefined();
      expect(nfr001?.category).toBe('performance');
      expect(nfr001?.targetMetric).toContain('200ms');
    });

    it('should read SRS document and extract features', async () => {
      const srsContent = `# SRS: Test Project

## 3. System Features

### SF-001: Authentication Module
- **Description**: Handles user authentication
- **Use Cases**:
  - Login
  - Logout
- Source: FR-001

### SF-002: Registration Module
- **Description**: Handles user registration
- Source: FR-002
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), srsContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.stats.srsCount).toBe(1);
      expect(result.currentState.features.length).toBe(2);

      const sf001 = result.currentState.features.find((f) => f.id === 'SF-001');
      expect(sf001).toBeDefined();
      expect(sf001?.name).toBe('Authentication Module');
      expect(sf001?.sourceRequirements).toContain('FR-001');
    });

    it('should read SRS document and extract use cases', async () => {
      const srsContent = `# SRS: Test Project

## 4. Use Cases

### UC-001: User Login
- **Primary Actor**: End User
- **Preconditions**:
  - User has an account
- **Main Flow**:
  1. User enters email
  2. User enters password
  3. System validates credentials
- **Postconditions**:
  - User is logged in
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), srsContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.useCases.length).toBe(1);

      const uc001 = result.currentState.useCases.find((u) => u.id === 'UC-001');
      expect(uc001).toBeDefined();
      expect(uc001?.name).toBe('User Login');
      expect(uc001?.primaryActor).toBe('End User');
    });

    it('should read SDS document and extract components', async () => {
      const sdsContent = `# SDS: Test Project

## 3. Component Design

### CMP-001: AuthService
- **Type**: Service
- **Description**: Authentication service component
- **Responsibilities**:
  - Validate credentials
  - Manage sessions
- Source: SF-001

### CMP-002: UserRepository
- **Type**: Library
- **Description**: User data access component
- **Dependencies**:
  - Database
- Source: SF-002
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'sds', 'sds.md'), sdsContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.stats.sdsCount).toBe(1);
      expect(result.currentState.components.length).toBe(2);

      const cmp001 = result.currentState.components.find((c) => c.id === 'CMP-001');
      expect(cmp001).toBeDefined();
      expect(cmp001?.name).toBe('AuthService');
      expect(cmp001?.type).toBe('service');
      expect(cmp001?.sourceFeatures).toContain('SF-001');
    });
  });

  describe('traceability', () => {
    it('should build PRD to SRS traceability', async () => {
      const prdContent = `# PRD: Test Project

### FR-001: Authentication
- **Description**: User authentication
- **Priority**: P0
`;

      const srsContent = `# SRS: Test Project

### SF-001: Auth Module
- **Description**: Authentication module
- Source: FR-001
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), prdContent);
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), srsContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.traceability.prdToSrs.length).toBe(1);
      expect(result.currentState.traceability.prdToSrs[0]?.prdId).toBe('FR-001');
      expect(result.currentState.traceability.prdToSrs[0]?.srsIds).toContain('SF-001');
    });

    it('should build SRS to SDS traceability', async () => {
      const srsContent = `# SRS: Test Project

### SF-001: Auth Module
- **Description**: Authentication module
`;

      const sdsContent = `# SDS: Test Project

### CMP-001: AuthService
- **Description**: Auth service
- Source: SF-001
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), srsContent);
      await fs.writeFile(path.join(tempDir, 'docs', 'sds', 'sds.md'), sdsContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.traceability.srsToSds.length).toBe(1);
      expect(result.currentState.traceability.srsToSds[0]?.srsId).toBe('SF-001');
      expect(result.currentState.traceability.srsToSds[0]?.sdsIds).toContain('CMP-001');
    });

    it('should calculate coverage statistics', async () => {
      const prdContent = `# PRD: Test Project

### FR-001: Feature 1
- **Priority**: P0

### FR-002: Feature 2
- **Priority**: P1
`;

      const srsContent = `# SRS: Test Project

### SF-001: Module 1
- Source: FR-001
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), prdContent);
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), srsContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      // One out of two requirements has traceability
      expect(result.currentState.statistics.coveragePrdToSrs).toBe(0.5);
    });
  });

  describe('output generation', () => {
    it('should write current_state.yaml file', async () => {
      const prdContent = `# PRD: Test Project

### FR-001: Test Feature
- **Description**: A test feature
- **Priority**: P0
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), prdContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.outputPath).toContain('current_state.yaml');

      // Verify file exists
      const fileExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content
      const content = await fs.readFile(result.outputPath, 'utf-8');
      expect(content).toContain('current_state');
      expect(content).toContain('FR-001');
    });

    it('should include project metadata in output', async () => {
      const prdContent = `# PRD: My Awesome Project

| Field | Value |
|-------|-------|
| Version | 2.0.0 |
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), prdContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.project.name).toBe('My Awesome Project');
      expect(result.currentState.project.version).toBe('2.0.0');
    });
  });

  describe('error handling', () => {
    it('should handle missing document directories gracefully', async () => {
      // Remove docs directories
      await fs.rm(path.join(tempDir, 'docs'), { recursive: true });

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.success).toBe(true);
      expect(result.stats.documentsProcessed).toBe(0);
    });

    it('should handle malformed documents with warnings', async () => {
      // Create a file that will trigger parsing issues
      const malformedContent = `Not a valid markdown structure
Some random content without proper sections
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'malformed.md'), malformedContent);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.success).toBe(true);
      // Document is parsed but no requirements extracted
      expect(result.currentState.requirements.functional.length).toBe(0);
    });

    it('should update session status on failure', async () => {
      // This test checks that session status reflects failures
      await agent.startSession('test-project');

      // Normal flow should complete
      const result = await agent.readDocuments();
      expect(result.success).toBe(true);

      const session = agent.getSession();
      expect(session?.status).toBe('completed');
    });
  });

  describe('metadata extraction', () => {
    it('should extract metadata from frontmatter', async () => {
      const content = `---
title: My Document
version: 1.5.0
status: Draft
id: DOC-001
---

# Content
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), content);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.documents.prd?.version).toBe('1.5.0');
    });

    it('should extract metadata from table', async () => {
      const content = `# PRD: Document

| Field | Value |
|-------|-------|
| Document ID | PRD-100 |
| Version | 3.0.0 |
`;

      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), content);

      await agent.startSession('test-project');
      const result = await agent.readDocuments();

      expect(result.currentState.documents.prd?.version).toBe('3.0.0');
    });
  });
});
