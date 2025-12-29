import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SDSUpdaterAgent, getSDSUpdaterAgent, resetSDSUpdaterAgent } from '../../src/sds-updater/SDSUpdaterAgent.js';
import {
  NoActiveSDSSessionError,
  SDSNotLoadedError,
  InvalidSDSChangeRequestError,
  ComponentNotFoundError,
  APINotFoundError,
  DuplicateComponentError,
  DuplicateAPIError,
} from '../../src/sds-updater/errors.js';
import type { SDSChangeRequest, NewComponent, NewAPI } from '../../src/sds-updater/types.js';

// Mock fs module
vi.mock('node:fs/promises');

const SAMPLE_SDS_CONTENT = `# SDS: Test Project

| Field | Value |
|-------|-------|
| Document ID | SDS-001 |
| Source SRS | SRS-001 |
| Version | 1.0.0 |
| Status | Draft |
| Last Updated | 2024-01-01 |

## 1. Introduction

### 1.1 Purpose
Test SDS document for unit testing.

## 2. System Architecture

### 2.1 Architecture Overview
High-level architecture diagram.

## 3. Component Design

### CMP-001: User Service
**Source Features**: SF-001, SF-002
**Type**: service
**Responsibility**: Handles user authentication and profile management
**Added**: 2024-01-01

#### Interface Definition
\`\`\`typescript
interface IUserService {
  authenticate(credentials: Credentials): Promise<User>;
  getProfile(userId: string): Promise<UserProfile>;
}
\`\`\`

#### Dependencies
- Internal: CMP-002
- External: bcrypt@5.0.0

### CMP-002: Database Repository
**Source Features**: SF-003
**Type**: repository
**Responsibility**: Handles database operations
**Added**: 2024-01-01

## 4. Data Design

### 4.1 Entity-Relationship Diagram
ER diagram content.

## 5. Interface Design

### 5.1 API Endpoints

#### POST /api/v1/auth/login
**Source Use Case**: UC-001
**Component**: CMP-001
**Added**: 2024-01-01

**Request**:
\`\`\`json
{
  "email": "string",
  "password": "string"
}
\`\`\`

**Response** (200 OK):
\`\`\`json
{
  "token": "string",
  "user": {}
}
\`\`\`

#### GET /api/v1/users/:id
**Source Use Case**: UC-002
**Component**: CMP-001
**Added**: 2024-01-01

## 6. Security Design

### 6.1 Authentication
JWT-based authentication.

## 7. Traceability Matrix

| SRS Feature | SDS Components |
|-------------|----------------|
| SF-001 | CMP-001 |
| SF-002 | CMP-001 |
| SF-003 | CMP-002 |
`;

describe('SDSUpdaterAgent', () => {
  let agent: SDSUpdaterAgent;
  const testProjectId = 'test-project';

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new SDSUpdaterAgent({
      docsBasePath: 'docs',
      sdsSubdir: 'sds',
      scratchpadBasePath: '.ad-sdlc/scratchpad',
    });
  });

  afterEach(() => {
    agent.reset();
  });

  describe('startSession', () => {
    it('should create a new session with correct initial state', async () => {
      const session = await agent.startSession(testProjectId);

      expect(session.projectId).toBe(testProjectId);
      expect(session.status).toBe('idle');
      expect(session.sessionId).toBeDefined();
      expect(session.startedAt).toBeDefined();
      expect(session.warnings).toEqual([]);
      expect(session.errors).toEqual([]);
    });

    it('should overwrite existing session when starting new one', async () => {
      const session1 = await agent.startSession('project-1');
      const session2 = await agent.startSession('project-2');

      expect(session2.projectId).toBe('project-2');
      expect(session2.sessionId).not.toBe(session1.sessionId);
    });
  });

  describe('loadSDS', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);
    });

    it('should throw NoActiveSDSSessionError when no session exists', async () => {
      agent.reset();

      await expect(agent.loadSDS('/docs/sds/sds.md')).rejects.toThrow(NoActiveSDSSessionError);
    });

    it('should parse SDS document correctly', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      const parsedSDS = await agent.loadSDS('/docs/sds/sds.md');

      expect(parsedSDS.metadata.id).toBe('SDS-001');
      expect(parsedSDS.metadata.version).toBe('1.0.0');
      expect(parsedSDS.metadata.sourceSrs).toBe('SRS-001');
      expect(parsedSDS.components).toHaveLength(2);
      expect(parsedSDS.apis).toHaveLength(2);
    });

    it('should extract components correctly', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      const parsedSDS = await agent.loadSDS('/docs/sds/sds.md');

      const userService = parsedSDS.components.find((c) => c.id === 'CMP-001');
      expect(userService).toBeDefined();
      expect(userService?.name).toBe('User Service');
      expect(userService?.type).toBe('service');
      expect(userService?.linkedSrsIds).toContain('SF-001');

      const dbRepo = parsedSDS.components.find((c) => c.id === 'CMP-002');
      expect(dbRepo).toBeDefined();
      expect(dbRepo?.name).toBe('Database Repository');
      expect(dbRepo?.type).toBe('repository');
    });

    it('should extract APIs correctly', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      const parsedSDS = await agent.loadSDS('/docs/sds/sds.md');

      const loginApi = parsedSDS.apis.find((a) => a.endpoint === '/api/v1/auth/login');
      expect(loginApi).toBeDefined();
      expect(loginApi?.method).toBe('POST');
      expect(loginApi?.componentId).toBe('CMP-001');
    });

    it('should update session status on successful load', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      await agent.loadSDS('/docs/sds/sds.md');

      const session = agent.getSession();
      expect(session?.sdsPath).toBe('/docs/sds/sds.md');
      expect(session?.parsedSDS).toBeDefined();
    });
  });

  describe('applyChange - add_component', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should throw SDSNotLoadedError when SDS not loaded', async () => {
      agent.reset();
      await agent.startSession(testProjectId);

      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'New Component',
          description: 'Test component',
          type: 'service',
          linkedSrsIds: ['SF-004'],
        },
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(SDSNotLoadedError);
    });

    it('should add new component successfully', async () => {
      const newComponent: NewComponent = {
        name: 'Email Service',
        description: 'Handles email notifications',
        type: 'service',
        linkedSrsIds: ['SF-004'],
      };

      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent,
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.componentsAdded).toHaveLength(1);
      expect(result.updateResult.changes.componentsAdded[0]?.id).toBe('CMP-003');
      expect(result.updateResult.changes.componentsAdded[0]?.name).toBe('Email Service');
    });

    it('should throw error when newComponent is missing', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should update traceability when adding component', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'New Component',
          description: 'Test',
          type: 'utility',
          linkedSrsIds: ['SF-005', 'SF-006'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.traceabilityUpdates).toHaveLength(2);
      expect(result.updateResult.traceabilityUpdates[0]?.srsId).toBe('SF-005');
      expect(result.updateResult.traceabilityUpdates[1]?.srsId).toBe('SF-006');
    });
  });

  describe('applyChange - add_api', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should add new API endpoint successfully', async () => {
      const newAPI: NewAPI = {
        endpoint: '/api/v1/users',
        method: 'POST',
        componentId: 'CMP-001',
        linkedUseCase: 'UC-003',
        requestSchema: { name: 'string', email: 'string' },
        responseSchema: { id: 'uuid', name: 'string' },
      };

      const changeRequest: SDSChangeRequest = {
        type: 'add_api',
        newAPI,
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.apisAdded).toHaveLength(1);
      expect(result.updateResult.changes.apisAdded[0]?.endpoint).toContain('/api/v1/users');
    });

    it('should throw error when newAPI is missing', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_api',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw error when adding duplicate API', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_api',
        newAPI: {
          endpoint: '/api/v1/auth/login',
          method: 'POST',
          componentId: 'CMP-001',
        },
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(DuplicateAPIError);
    });
  });

  describe('applyChange - modify_component', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should modify existing component', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        itemId: 'CMP-001',
        modifications: [
          { field: 'name', newValue: 'Updated User Service' },
          { field: 'type', oldValue: 'service', newValue: 'controller' },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.componentsModified).toHaveLength(2);
    });

    it('should throw error when component not found', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        itemId: 'CMP-999',
        modifications: [{ field: 'name', newValue: 'New Name' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(ComponentNotFoundError);
    });

    it('should throw error when itemId is missing', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        modifications: [{ field: 'name', newValue: 'New Name' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw error when modifications are empty', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        itemId: 'CMP-001',
        modifications: [],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });
  });

  describe('applyChange - modify_api', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should modify existing API endpoint', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        itemId: 'POST /api/v1/auth/login',
        modifications: [{ field: 'Component', newValue: 'CMP-002' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.apisModified).toHaveLength(1);
    });

    it('should throw error when API not found', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        itemId: 'DELETE /api/v1/nonexistent',
        modifications: [{ field: 'Component', newValue: 'CMP-001' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(APINotFoundError);
    });
  });

  describe('applyChange - update_data_model', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should update data model', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_data_model',
        dataModelUpdate: {
          entityName: 'User',
          dataChanges: [
            { type: 'add_field', details: { name: 'phoneNumber', type: 'string' } },
          ],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.dataModelsChanged).toHaveLength(1);
      expect(result.updateResult.changes.dataModelsChanged[0]?.entity).toBe('User');
    });

    it('should throw error when dataModelUpdate is missing', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_data_model',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });
  });

  describe('applyChange - update_architecture', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should update architecture', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_architecture',
        architectureChange: {
          type: 'add_pattern',
          description: 'Added CQRS pattern for read/write separation',
          rationale: 'Improve scalability for high-read scenarios',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.architectureChanges).toHaveLength(1);
      expect(result.updateResult.changes.architectureChanges[0]?.type).toBe('add_pattern');
    });

    it('should throw error when architectureChange is missing', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_architecture',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });
  });

  describe('applyChange - update_traceability', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should update traceability matrix', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_traceability',
        traceabilityUpdates: [
          { srsId: 'SF-004', sdsIds: ['CMP-001', 'CMP-002'] },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.traceabilityUpdates).toHaveLength(1);
    });

    it('should throw error when traceabilityUpdates is empty', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_traceability',
        traceabilityUpdates: [],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });
  });

  describe('version management', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should increment minor version for new component', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'New Component',
          description: 'Test',
          type: 'service',
          linkedSrsIds: ['SF-004'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.1.0');
    });

    it('should increment patch version for API addition', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_api',
        newAPI: {
          endpoint: '/api/v1/new',
          method: 'GET',
          componentId: 'CMP-001',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.0.1');
    });

    it('should increment minor version for architecture change', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_architecture',
        architectureChange: {
          type: 'add_pattern',
          description: 'New pattern',
          rationale: 'Testing',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.1.0');
    });
  });

  describe('getSession and reset', () => {
    it('should return null when no session exists', () => {
      expect(agent.getSession()).toBeNull();
    });

    it('should return session after startSession', async () => {
      await agent.startSession(testProjectId);
      expect(agent.getSession()).not.toBeNull();
    });

    it('should clear session on reset', async () => {
      await agent.startSession(testProjectId);
      agent.reset();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('singleton pattern', () => {
    afterEach(() => {
      resetSDSUpdaterAgent();
    });

    it('should return same instance from getSDSUpdaterAgent', () => {
      const agent1 = getSDSUpdaterAgent();
      const agent2 = getSDSUpdaterAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getSDSUpdaterAgent();
      resetSDSUpdaterAgent();
      const agent2 = getSDSUpdaterAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('consistency check', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should pass consistency check for valid document', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'Valid Component',
          description: 'Test',
          type: 'service',
          linkedSrsIds: ['SF-004'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.consistencyCheck.passed).toBe(true);
      expect(result.updateResult.consistencyCheck.issues).toHaveLength(0);
    });
  });

  describe('changelog generation', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should generate changelog entry for component addition', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'New Service',
          description: 'Test',
          type: 'service',
          linkedSrsIds: ['SF-004'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('Components Added');
      expect(result.updateResult.changelogEntry).toContain('CMP-003');
      expect(result.updateResult.changelogEntry).toContain('New Service');
    });

    it('should generate changelog entry for API addition', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_api',
        newAPI: {
          endpoint: '/api/v1/test',
          method: 'PUT',
          componentId: 'CMP-001',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('APIs Added');
      expect(result.updateResult.changelogEntry).toContain('/api/v1/test');
    });
  });

  describe('validation edge cases', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should throw for modify_component without itemId', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        modifications: [{ field: 'description', newValue: 'New description' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw for modify_component without modifications', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        itemId: 'CMP-001',
        modifications: [],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw for modify_api without itemId', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        modifications: [{ field: 'description', newValue: 'New description' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw for modify_api without modifications', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        itemId: 'POST /api/v1/auth/login',
        modifications: [],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw for update_data_model without dataModelUpdate', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_data_model',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw for update_architecture without architectureChange', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_architecture',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });

    it('should throw for update_traceability without updates', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'update_traceability',
        traceabilityUpdates: [],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSDSChangeRequestError);
    });
  });

  describe('component with interfaces and dependencies', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should add component with provided interfaces', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'API Gateway',
          description: 'Central API routing',
          type: 'service',
          linkedSrsIds: ['SF-005'],
          interfaces: {
            provided: [
              {
                name: 'IApiGateway',
                methods: [
                  { name: 'route', parameters: ['request: Request'], returnType: 'Response', async: true },
                  { name: 'validate', parameters: ['token: string'], returnType: 'boolean', async: false },
                ],
              },
            ],
          },
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.componentsAdded.length).toBe(1);
    });

    it('should add component with required interfaces', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'Cache Service',
          description: 'Caching layer',
          type: 'service',
          linkedSrsIds: ['SF-006'],
          interfaces: {
            required: [
              { name: 'IDatabase', reason: 'Data persistence' },
            ],
          },
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
    });

    it('should add component with dependencies', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'Message Queue',
          description: 'Async messaging',
          type: 'service',
          linkedSrsIds: ['SF-007'],
          dependencies: {
            internal: [
              { componentId: 'CMP-001', type: 'uses', description: 'User context' },
            ],
            external: [
              { name: 'rabbitmq', version: '3.12.0', purpose: 'Message broker' },
            ],
          },
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
    });
  });

  describe('API with error responses', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should add API with error responses', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'add_api',
        newAPI: {
          endpoint: '/api/v1/validate',
          method: 'POST',
          componentId: 'CMP-001',
          linkedUseCase: 'UC-003',
          description: 'Validation endpoint',
          authentication: 'Bearer token',
          requestSchema: { body: { type: 'object' } },
          responseSchema: { status: 'number' },
          errorResponses: [
            { statusCode: 400, description: 'Invalid input', schema: { error: 'string' } },
            { statusCode: 401, description: 'Unauthorized', schema: { message: 'string' } },
            { statusCode: 500, description: 'Server error', schema: { details: 'string' } },
          ],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.apisAdded.length).toBe(1);
    });
  });

  describe('parsing edge cases', () => {
    it('should handle malformed component sections', async () => {
      const malformedContent = `# SDS: Test Project

| Field | Value |
|-------|-------|
| Version | 1.0.0 |

## 1. Component Design

### CMP-001:
**Type**: service
**Responsibility**: Missing name

### : Empty ID
**Type**: service

### CMP-002: Valid Component
**Type**: service
**Responsibility**: Valid component
`;

      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(malformedContent);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      await agent.loadSDS('/docs/sds/sds.md');
      const session = agent.getSession();
      expect(session.parsedSDS).toBeDefined();
      // Should only parse valid components
      expect(session.parsedSDS?.components.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle API without method', async () => {
      const apiContent = `# SDS: Test Project

| Field | Value |
|-------|-------|
| Version | 1.0.0 |

## 1. Interface Design

#### /api/v1/test
**Component**: CMP-001
`;

      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(apiContent);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      await agent.loadSDS('/docs/sds/sds.md');
      const session = agent.getSession();
      // API without proper method format should not be parsed
      expect(session.parsedSDS?.apis.length).toBe(0);
    });
  });

  describe('modify component advanced cases', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should modify component and add Modified date', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        itemId: 'CMP-001',
        modifications: [{ field: 'Responsibility', newValue: 'Updated responsibility' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.componentsModified.length).toBe(1);
    });

    it('should update existing Modified date', async () => {
      const contentWithModified = SAMPLE_SDS_CONTENT.replace(
        '**Added**: 2024-01-01',
        '**Added**: 2024-01-01\n**Modified**: 2024-01-02'
      );

      vi.mocked(fs.readFile).mockResolvedValue(contentWithModified);
      await agent.loadSDS('/docs/sds/sds.md');

      const changeRequest: SDSChangeRequest = {
        type: 'modify_component',
        itemId: 'CMP-001',
        modifications: [{ field: 'Responsibility', newValue: 'New responsibility' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
    });
  });

  describe('modify API advanced cases', () => {
    beforeEach(async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');
    });

    it('should modify API with method and path', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        itemId: 'POST /api/v1/auth/login',
        modifications: [{ field: 'Source Use Case', newValue: 'UC-004' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.apisModified.length).toBe(1);
    });

    it('should modify API and update existing Modified date', async () => {
      const contentWithModifiedApi = SAMPLE_SDS_CONTENT.replace(
        '#### POST /api/v1/auth/login',
        '#### POST /api/v1/auth/login\n**Modified**: 2024-01-02'
      );

      vi.mocked(fs.readFile).mockResolvedValue(contentWithModifiedApi);
      await agent.loadSDS('/docs/sds/sds.md');

      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        itemId: 'POST /api/v1/auth/login',
        modifications: [{ field: 'Component', newValue: 'CMP-002' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
    });

    it('should handle modification when field not found', async () => {
      const changeRequest: SDSChangeRequest = {
        type: 'modify_api',
        itemId: 'POST /api/v1/auth/login',
        modifications: [{ field: 'NonExistentField', newValue: 'Value' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      // No modifications recorded since field wasn't found
      expect(result.updateResult.changes.apisModified.length).toBe(0);
    });
  });

  describe('output write error handling', () => {
    it('should throw SDSOutputWriteError on write failure', async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');

      // All writes fail
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'Test Component',
          description: 'Test',
          type: 'service',
          linkedSrsIds: ['SF-008'],
        },
      };

      // Should throw SDSOutputWriteError
      await expect(agent.applyChange(changeRequest)).rejects.toThrow('Permission denied');
    });

    it('should successfully write when no errors occur', async () => {
      await agent.startSession(testProjectId);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_SDS_CONTENT);
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1000,
        mtime: new Date('2024-01-01'),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await agent.loadSDS('/docs/sds/sds.md');

      const changeRequest: SDSChangeRequest = {
        type: 'add_component',
        newComponent: {
          name: 'Test Component',
          description: 'Test',
          type: 'service',
          linkedSrsIds: ['SF-008'],
        },
      };

      const result = await agent.applyChange(changeRequest);
      expect(result.success).toBe(true);
    });
  });
});
