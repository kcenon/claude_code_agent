/**
 * PRD Updater Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  PRDUpdaterAgent,
  getPRDUpdaterAgent,
  resetPRDUpdaterAgent,
  NoActiveSessionError,
  PRDNotFoundError,
  PRDNotLoadedError,
  RequirementNotFoundError,
  DuplicateRequirementError,
  InvalidChangeRequestError,
  DEFAULT_PRD_UPDATER_CONFIG,
} from '../../src/prd-updater/index.js';
import type { ChangeRequest, NewRequirement } from '../../src/prd-updater/index.js';

describe('PRDUpdaterAgent', () => {
  let tempDir: string;
  let agent: PRDUpdaterAgent;

  const createSamplePRD = (): string => `# PRD: Test Project

| Field | Value |
|-------|-------|
| Document ID | PRD-001 |
| Version | 1.0.0 |
| Status | Draft |
| Created | 2024-01-01 |
| Last Updated | 2024-01-01 |

## 1. Executive Summary

This is a test project.

## 5. Functional Requirements

### FR-001: User Authentication
- **Description**: Users can authenticate using email and password
- **User Story**: As a user, I want to log in so that I can access my account
- **Acceptance Criteria**:
  - [ ] User can enter email
  - [ ] User can enter password
  - [ ] System validates credentials
- **Priority**: P0
- **Dependencies**: None
- **Notes**: Core authentication feature

### FR-002: User Registration
- **Description**: New users can create an account
- **Priority**: P1
- **Notes**: Basic registration feature

## 6. Non-Functional Requirements

### NFR-001: Performance
- **Description**: System should respond within 200ms
- **Category**: performance
- **Target Metric**: Response time < 200ms
- **Priority**: P1

## 11. Out of Scope

Features not included in this release.
`;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prd-updater-test-'));

    await fs.mkdir(path.join(tempDir, 'docs', 'prd'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad', 'documents'), { recursive: true });

    agent = new PRDUpdaterAgent({
      docsBasePath: path.join(tempDir, 'docs'),
      scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    resetPRDUpdaterAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new PRDUpdaterAgent();
      expect(defaultAgent).toBeInstanceOf(PRDUpdaterAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new PRDUpdaterAgent({
        docsBasePath: 'custom/docs',
        generateChangelog: false,
      });
      expect(customAgent).toBeInstanceOf(PRDUpdaterAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_PRD_UPDATER_CONFIG.docsBasePath).toBe('docs');
      expect(DEFAULT_PRD_UPDATER_CONFIG.prdSubdir).toBe('prd');
      expect(DEFAULT_PRD_UPDATER_CONFIG.preserveFormatting).toBe(true);
      expect(DEFAULT_PRD_UPDATER_CONFIG.generateChangelog).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getPRDUpdaterAgent', () => {
      const agent1 = getPRDUpdaterAgent();
      const agent2 = getPRDUpdaterAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getPRDUpdaterAgent();
      resetPRDUpdaterAgent();
      const agent2 = getPRDUpdaterAgent();
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

    it('should throw NoActiveSessionError when loading without session', async () => {
      await expect(agent.loadPRD()).rejects.toThrow(NoActiveSessionError);
    });
  });

  describe('PRD loading', () => {
    it('should load PRD document successfully', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      const parsed = await agent.loadPRD();

      expect(parsed).toBeDefined();
      expect(parsed.metadata.version).toBe('1.0.0');
      expect(parsed.requirements.length).toBeGreaterThan(0);
    });

    it('should throw PRDNotFoundError when PRD does not exist', async () => {
      await agent.startSession('test-project');
      await expect(agent.loadPRD()).rejects.toThrow(PRDNotFoundError);
    });

    it('should extract functional requirements', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      const parsed = await agent.loadPRD();

      const functionalReqs = parsed.requirements.filter((r) => r.type === 'functional');
      expect(functionalReqs.length).toBe(2);

      const fr001 = functionalReqs.find((r) => r.id === 'FR-001');
      expect(fr001).toBeDefined();
      expect(fr001?.title).toBe('User Authentication');
      expect(fr001?.priority).toBe('P0');
    });

    it('should extract non-functional requirements', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      const parsed = await agent.loadPRD();

      const nfReqs = parsed.requirements.filter((r) => r.type === 'non_functional');
      expect(nfReqs.length).toBe(1);

      const nfr001 = nfReqs.find((r) => r.id === 'NFR-001');
      expect(nfr001).toBeDefined();
      expect(nfr001?.title).toBe('Performance');
    });

    it('should update session status to loading', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const session = agent.getSession();
      expect(session?.prdPath).toContain('prd.md');
      expect(session?.parsedPRD).toBeDefined();
    });
  });

  describe('add requirement', () => {
    it('should add a new functional requirement', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'User Notification System',
          description: 'System shall send email notifications',
          priority: 'P1',
          userStory: 'As a user, I want notifications',
          acceptanceCriteria: ['Email sent within 1 minute'],
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.added.length).toBe(1);
      expect(result.updateResult.changes.added[0]?.id).toBe('FR-003');
      expect(result.updateResult.changes.added[0]?.title).toBe('User Notification System');
    });

    it('should add a new non-functional requirement', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'non_functional',
          title: 'Scalability',
          description: 'System should handle 10000 concurrent users',
          priority: 'P0',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.added[0]?.id).toBe('NFR-002');
    });

    it('should increment version on add', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.1.0');
    });

    it('should throw error when newRequirement is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidChangeRequestError);
    });
  });

  describe('modify requirement', () => {
    it('should modify an existing requirement', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'modify_requirement',
        requirementId: 'FR-001',
        modifications: [
          { field: 'priority', newValue: 'P1' },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.modified.length).toBe(1);
      expect(result.updateResult.changes.modified[0]?.field).toBe('priority');
      expect(result.updateResult.changes.modified[0]?.newValue).toBe('P1');
    });

    it('should modify requirement title', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'modify_requirement',
        requirementId: 'FR-001',
        modifications: [
          { field: 'title', newValue: 'Updated Authentication' },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.modified[0]?.newValue).toBe('Updated Authentication');
    });

    it('should increment patch version on modify', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'modify_requirement',
        requirementId: 'FR-001',
        modifications: [
          { field: 'priority', newValue: 'P1' },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionBefore).toBe('1.0.0');
      expect(result.updateResult.versionAfter).toBe('1.0.1');
    });

    it('should throw error when requirement not found', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'modify_requirement',
        requirementId: 'FR-999',
        modifications: [
          { field: 'priority', newValue: 'P1' },
        ],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(RequirementNotFoundError);
    });

    it('should throw error when requirementId is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'modify_requirement',
        modifications: [
          { field: 'priority', newValue: 'P1' },
        ],
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidChangeRequestError);
    });
  });

  describe('deprecate requirement', () => {
    it('should deprecate an existing requirement', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'deprecate_requirement',
        requirementId: 'FR-002',
        deprecationReason: 'Feature no longer needed',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
      expect(result.updateResult.changes.deprecated.length).toBe(1);
      expect(result.updateResult.changes.deprecated[0]?.id).toBe('FR-002');
      expect(result.updateResult.changes.deprecated[0]?.reason).toBe('Feature no longer needed');
    });

    it('should deprecate with replacement ID', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'deprecate_requirement',
        requirementId: 'FR-002',
        deprecationReason: 'Replaced by new feature',
        replacementId: 'FR-001',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changes.deprecated[0]?.replacementId).toBe('FR-001');
    });

    it('should increment minor version on deprecate', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'deprecate_requirement',
        requirementId: 'FR-002',
        deprecationReason: 'No longer needed',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.versionAfter).toBe('1.1.0');
    });

    it('should throw error when deprecationReason is missing', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'deprecate_requirement',
        requirementId: 'FR-002',
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(InvalidChangeRequestError);
    });
  });

  describe('extend scope', () => {
    it('should extend scope section', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'extend_scope',
        scopeExtension: 'Mobile app support added to scope',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.success).toBe(true);
    });
  });

  describe('output generation', () => {
    it('should write updated PRD file', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      const result = await agent.applyChange(changeRequest);

      const updatedContent = await fs.readFile(result.prdPath, 'utf-8');
      expect(updatedContent).toContain('FR-003');
      expect(updatedContent).toContain('New Feature');
      expect(updatedContent).toContain('[NEW]');
    });

    it('should write changelog file', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.changelogPath).toContain('prd_changelog.md');

      const changelogContent = await fs.readFile(result.changelogPath, 'utf-8');
      expect(changelogContent).toContain('Added');
      expect(changelogContent).toContain('FR-003');
    });

    it('should write update result YAML file', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.outputPath).toContain('prd_update_result.yaml');

      const resultContent = await fs.readFile(result.outputPath, 'utf-8');
      expect(resultContent).toContain('update_result');
      expect(resultContent).toContain('version_before');
      expect(resultContent).toContain('version_after');
    });
  });

  describe('consistency check', () => {
    it('should pass consistency check for valid PRD', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.consistencyCheck.passed).toBe(true);
      expect(result.updateResult.consistencyCheck.issues.length).toBe(0);
    });
  });

  describe('changelog entry generation', () => {
    it('should generate changelog entry for added requirements', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('### Added');
      expect(result.updateResult.changelogEntry).toContain('FR-003');
    });

    it('should generate changelog entry for modified requirements', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'modify_requirement',
        requirementId: 'FR-001',
        modifications: [
          { field: 'priority', newValue: 'P1' },
        ],
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('### Changed');
      expect(result.updateResult.changelogEntry).toContain('FR-001');
    });

    it('should generate changelog entry for deprecated requirements', async () => {
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      await agent.loadPRD();

      const changeRequest: ChangeRequest = {
        type: 'deprecate_requirement',
        requirementId: 'FR-002',
        deprecationReason: 'No longer needed',
      };

      const result = await agent.applyChange(changeRequest);

      expect(result.updateResult.changelogEntry).toContain('### Deprecated');
      expect(result.updateResult.changelogEntry).toContain('FR-002');
    });
  });

  describe('error handling', () => {
    it('should throw PRDNotLoadedError when applying change without loading', async () => {
      await agent.startSession('test-project');

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      await expect(agent.applyChange(changeRequest)).rejects.toThrow(PRDNotLoadedError);
    });

    it('should update session status on failure', async () => {
      await agent.startSession('test-project');

      try {
        await agent.loadPRD();
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
      await fs.writeFile(path.join(tempDir, 'docs', 'prd', 'prd.md'), createSamplePRD());

      await agent.startSession('test-project');
      expect(agent.getSession()?.status).toBe('idle');

      await agent.loadPRD();
      // After loading, status should still be idle or loading complete

      const changeRequest: ChangeRequest = {
        type: 'add_requirement',
        newRequirement: {
          type: 'functional',
          title: 'New Feature',
          description: 'A new feature',
          priority: 'P2',
        },
      };

      await agent.applyChange(changeRequest);
      expect(agent.getSession()?.status).toBe('completed');
    });
  });
});
