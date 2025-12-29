/**
 * SRS Updater Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  SRSUpdaterAgent,
  getSRSUpdaterAgent,
  resetSRSUpdaterAgent,
  NoActiveSRSSessionError,
  SRSNotFoundError,
  SRSNotLoadedError,
  FeatureNotFoundError,
  UseCaseNotFoundError,
  DuplicateFeatureError,
  InvalidSRSChangeRequestError,
  DEFAULT_SRS_UPDATER_CONFIG,
} from '../../src/srs-updater/index.js';
import type { SRSChangeRequest, NewFeature, NewUseCase } from '../../src/srs-updater/index.js';

describe('SRSUpdaterAgent', () => {
  let tempDir: string;
  let agent: SRSUpdaterAgent;

  const createSampleSRS = (): string => `# SRS: Test Project

| Field | Value |
|-------|-------|
| Document ID | SRS-001 |
| Version | 1.0.0 |
| Status | Draft |
| Created | 2024-01-01 |
| Last Updated | 2024-01-01 |

## 1. Executive Summary

This is a test software requirements specification.

## 5. Software Features

### SF-001: User Authentication Feature
- **Description**: Software feature for user authentication
- **Linked PRD**: FR-001
- **Priority**: P0
- **Preconditions**:
  - User has an account
- **Postconditions**:
  - User is authenticated
- **Dependencies**: None
- **Notes**: Core authentication feature

### SF-002: User Registration Feature
- **Description**: Software feature for user registration
- **Linked PRD**: FR-002
- **Priority**: P1
- **Notes**: Basic registration feature

## 6. Use Cases

### UC-001: User Login
- **Description**: User logs into the system
- **Feature**: SF-001
- **Primary Actor**: User
- **Preconditions**:
  - User has valid credentials

**Main Flow**:
1. User navigates to login page
2. User enters credentials
3. System validates credentials
4. User is redirected to dashboard

- **Postconditions**:
  - User session is created

### UC-002: User Logout
- **Description**: User logs out of the system
- **Feature**: SF-001
- **Primary Actor**: User

**Main Flow**:
1. User clicks logout
2. System invalidates session
3. User is redirected to login page

## 8. External Interfaces

### API Interface
- **Type**: REST API
- **Version**: v1

## 10. PRD→SRS Traceability Matrix

| PRD ID | SRS IDs |
|--------|--------|
| FR-001 | SF-001, UC-001, UC-002 |
| FR-002 | SF-002 |
`;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srs-updater-test-'));

    await fs.mkdir(path.join(tempDir, 'docs', 'srs'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents'), { recursive: true });

    agent = new SRSUpdaterAgent({
      docsBasePath: path.join(tempDir, 'docs'),
      scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    resetSRSUpdaterAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new SRSUpdaterAgent();
      expect(defaultAgent).toBeInstanceOf(SRSUpdaterAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new SRSUpdaterAgent({
        docsBasePath: 'custom/docs',
        generateChangelog: false,
      });
      expect(customAgent).toBeInstanceOf(SRSUpdaterAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_SRS_UPDATER_CONFIG.docsBasePath).toBe('docs');
      expect(DEFAULT_SRS_UPDATER_CONFIG.srsSubdir).toBe('srs');
      expect(DEFAULT_SRS_UPDATER_CONFIG.preserveFormatting).toBe(true);
      expect(DEFAULT_SRS_UPDATER_CONFIG.generateChangelog).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getSRSUpdaterAgent', () => {
      const agent1 = getSRSUpdaterAgent();
      const agent2 = getSRSUpdaterAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getSRSUpdaterAgent();
      resetSRSUpdaterAgent();
      const agent2 = getSRSUpdaterAgent();
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

    it('should throw NoActiveSRSSessionError when loading without session', async () => {
      await expect(agent.loadSRS()).rejects.toThrow(NoActiveSRSSessionError);
    });
  });

  describe('SRS loading', () => {
    it('should load SRS document successfully', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      const parsed = await agent.loadSRS();

      expect(parsed).toBeDefined();
      expect(parsed.metadata.version).toBe('1.0.0');
      expect(parsed.features.length).toBeGreaterThan(0);
    });

    it('should throw SRSNotFoundError when SRS does not exist', async () => {
      await agent.startSession('test-project');
      await expect(agent.loadSRS()).rejects.toThrow(SRSNotFoundError);
    });

    it('should extract software features', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      const parsed = await agent.loadSRS();

      expect(parsed.features.length).toBe(2);

      const sf001 = parsed.features.find((f) => f.id === 'SF-001');
      expect(sf001).toBeDefined();
      expect(sf001?.title).toBe('User Authentication Feature');
      expect(sf001?.priority).toBe('P0');
      expect(sf001?.linkedPrdIds).toContain('FR-001');
    });

    it('should extract use cases', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      const parsed = await agent.loadSRS();

      expect(parsed.useCases.length).toBe(2);

      const uc001 = parsed.useCases.find((uc) => uc.id === 'UC-001');
      expect(uc001).toBeDefined();
      expect(uc001?.title).toBe('User Login');
      expect(uc001?.featureId).toBe('SF-001');
      expect(uc001?.primaryActor).toBe('User');
    });

    it('should extract traceability matrix', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      const parsed = await agent.loadSRS();

      expect(parsed.traceabilityMatrix.length).toBeGreaterThan(0);

      const fr001Entry = parsed.traceabilityMatrix.find((e) => e.prdId === 'FR-001');
      expect(fr001Entry).toBeDefined();
      expect(fr001Entry?.srsIds).toContain('SF-001');
    });

    it('should update session status to loading', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const session = agent.getSession();
      expect(session?.srsPath).toContain('srs.md');
      expect(session?.parsedSRS).toBeDefined();
    });
  });

  describe('add feature', () => {
    it('should add a new software feature', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'User Notification Feature',
          description: 'Software feature for user notifications',
          priority: 'P1',
          linkedPrdIds: ['FR-003'],
          preconditions: ['User is logged in'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.featuresAdded.length).toBe(1);
      expect(result.updateResult.changes.featuresAdded[0]?.id).toBe('SF-003');
      expect(result.updateResult.changes.featuresAdded[0]?.title).toBe('User Notification Feature');
    });

    it('should update traceability when adding feature with PRD link', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: ['FR-003'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.traceabilityUpdates.length).toBe(1);
      expect(result.updateResult.traceabilityUpdates[0]?.prdId).toBe('FR-003');
    });

    it('should increment version on add feature', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.1.0');
    });

    it('should throw error when newFeature is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSRSChangeRequestError);
    });
  });

  describe('add use case', () => {
    it('should add a new use case', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_use_case',
        newUseCase: {
          title: 'Password Reset',
          description: 'User resets their password',
          primaryActor: 'User',
          featureId: 'SF-001',
          mainFlow: [
            'User clicks forgot password',
            'User enters email',
            'System sends reset link',
            'User creates new password',
          ],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.useCasesAdded.length).toBe(1);
      expect(result.updateResult.changes.useCasesAdded[0]?.id).toBe('UC-003');
      expect(result.updateResult.changes.useCasesAdded[0]?.title).toBe('Password Reset');
    });

    it('should increment patch version on add use case', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_use_case',
        newUseCase: {
          title: 'New Use Case',
          description: 'A new use case',
          primaryActor: 'User',
          featureId: 'SF-001',
          mainFlow: ['Step 1'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.0.1');
    });

    it('should throw error when newUseCase is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_use_case',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSRSChangeRequestError);
    });
  });

  describe('modify feature', () => {
    it('should modify an existing feature', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_feature',
        itemId: 'SF-001',
        modifications: [{ field: 'priority', newValue: 'P1' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.featuresModified.length).toBe(1);
      expect(result.updateResult.changes.featuresModified[0]?.field).toBe('priority');
      expect(result.updateResult.changes.featuresModified[0]?.newValue).toBe('P1');
    });

    it('should modify feature title', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_feature',
        itemId: 'SF-001',
        modifications: [{ field: 'title', newValue: 'Updated Authentication Feature' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.featuresModified[0]?.newValue).toBe(
        'Updated Authentication Feature'
      );
    });

    it('should increment patch version on modify', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_feature',
        itemId: 'SF-001',
        modifications: [{ field: 'priority', newValue: 'P1' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.0.1');
    });

    it('should throw error when feature not found', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_feature',
        itemId: 'SF-999',
        modifications: [{ field: 'priority', newValue: 'P1' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(FeatureNotFoundError);
    });

    it('should throw error when itemId is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_feature',
        modifications: [{ field: 'priority', newValue: 'P1' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSRSChangeRequestError);
    });
  });

  describe('modify use case', () => {
    it('should modify an existing use case', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_use_case',
        itemId: 'UC-001',
        modifications: [{ field: 'description', newValue: 'Updated login description' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.useCasesModified.length).toBe(1);
      expect(result.updateResult.changes.useCasesModified[0]?.field).toBe('description');
    });

    it('should throw error when use case not found', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_use_case',
        itemId: 'UC-999',
        modifications: [{ field: 'description', newValue: 'New description' }],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(UseCaseNotFoundError);
    });
  });

  describe('update interface', () => {
    it('should update interface section', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'update_interface',
        interfaceName: 'REST API',
        interfaceChanges: 'Added new endpoint /api/v2/users',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.interfacesModified.length).toBe(1);
      expect(result.updateResult.changes.interfacesModified[0]?.name).toBe('REST API');
    });

    it('should increment minor version on interface update', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'update_interface',
        interfaceName: 'REST API',
        interfaceChanges: 'Added new endpoint',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionAfter).toBe('1.1.0');
    });

    it('should throw error when interfaceName is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'update_interface',
        interfaceChanges: 'Some changes',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSRSChangeRequestError);
    });
  });

  describe('update traceability', () => {
    it('should update traceability matrix', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'update_traceability',
        traceabilityUpdates: [
          { prdId: 'FR-003', srsIds: ['SF-003', 'UC-003'] },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.traceabilityUpdates.length).toBe(1);
    });

    it('should throw error when traceabilityUpdates is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'update_traceability',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidSRSChangeRequestError);
    });
  });

  describe('output generation', () => {
    it('should write updated SRS file', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      const result = await agent.applyChange(changeRequest);

      const updatedContent = await fs.readFile(result.srsPath, 'utf-8');
      expect(updatedContent).toContain('SF-003');
      expect(updatedContent).toContain('New Feature');
      expect(updatedContent).toContain('[NEW]');
    });

    it('should write changelog file', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.changelogPath).toContain('srs_changelog.md');

      const changelogContent = await fs.readFile(result.changelogPath, 'utf-8');
      expect(changelogContent).toContain('Features Added');
      expect(changelogContent).toContain('SF-003');
    });

    it('should write update result YAML file', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.outputPath).toContain('srs_update_result.yaml');

      const resultContent = await fs.readFile(result.outputPath, 'utf-8');
      expect(resultContent).toContain('update_result');
      expect(resultContent).toContain('version_before');
      expect(resultContent).toContain('version_after');
    });
  });

  describe('consistency check', () => {
    it('should pass consistency check for valid SRS', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.consistencyCheck.passed).toBe(true);
      expect(result.updateResult.consistencyCheck.issues.length).toBe(0);
    });
  });

  describe('changelog entry generation', () => {
    it('should generate changelog entry for added features', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: ['FR-003'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('### Features Added');
      expect(result.updateResult.changelogEntry).toContain('SF-003');
      expect(result.updateResult.changelogEntry).toContain('FR-003');
    });

    it('should generate changelog entry for added use cases', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'add_use_case',
        newUseCase: {
          title: 'New Use Case',
          description: 'A new use case',
          primaryActor: 'User',
          featureId: 'SF-001',
          mainFlow: ['Step 1'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('### Use Cases Added');
      expect(result.updateResult.changelogEntry).toContain('UC-003');
    });

    it('should generate changelog entry for modified features', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      await agent.loadSRS();

      const changeRequest: SRSChangeRequest = {
        type: 'modify_feature',
        itemId: 'SF-001',
        modifications: [{ field: 'priority', newValue: 'P1' }],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('### Features Modified');
      expect(result.updateResult.changelogEntry).toContain('SF-001');
    });
  });

  describe('error handling', () => {
    it('should throw SRSNotLoadedError when applying change without loading', async () => {
      await agent.startSession('test-project');

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(SRSNotLoadedError);
    });

    it('should update session status on failure', async () => {
      await agent.startSession('test-project');

      try {
        await agent.loadSRS();
      } catch {
        // Expected to fail
      }

      const session = agent.getSession();
      expect(session?.status).toBe('failed');
      expect(session?.errors.length).toBeGreaterThan(0);
    });
  });

  describe('session status updates', () => {
    it('should update session status through workflow', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'srs', 'srs.md'), createSampleSRS());

      await agent.startSession('test-project');
      expect(agent.getSession()?.status).toBe('idle');

      await agent.loadSRS();
      // After loading, status should still be idle or loading complete

      const changeRequest: SRSChangeRequest = {
        type: 'add_feature',
        newFeature: {
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
          linkedPrdIds: [],
        },
      };

      await agent.applyChange(changeRequest);
      expect(agent.getSession()?.status).toBe('completed');
    });
  });
});
