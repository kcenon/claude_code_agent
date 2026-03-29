/**
 * LocalIssueWriter unit tests
 *
 * Tests SRS feature → issue_list.json + ISS-XXX.md file generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalIssueWriter } from '../../src/issue-generator/LocalIssueWriter.js';
import { LocalIssueReader } from '../../src/issue-reader/LocalIssueReader.js';
import type { LocalIssueListFile } from '../../src/issue-generator/LocalIssueWriter.js';

/**
 * Minimal SRS markdown with 3 features for testing
 */
const SAMPLE_SRS = `# Test Project SRS

| **Document ID** | SRS-test |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Project ID** | test_project |

## 1. Introduction

**Test Project** is a sample application for testing LocalIssueWriter.

## 3. System Features

### SF-001: User Authentication

| **Priority** | P0 |
| **Source Requirements** | FR-001 |

**Description:**
Allow users to register and login using email and password.

**Acceptance Criteria:**
- User can register with email and password
- User can login with valid credentials
- Invalid credentials show error message

---

### SF-002: Task Management

| **Priority** | P1 |
| **Source Requirements** | FR-002, FR-003 |
| **Use Cases** | UC-001, UC-002 |

**Description:**
Create, edit, and delete tasks with title, description, and due date.

**Acceptance Criteria:**
- User can create a task
- User can edit a task
- User can delete a task
- Tasks have title, description, and due date

---

### SF-003: Dashboard Overview

| **Priority** | P2 |
| **Source Requirements** | FR-004 |

**Description:**
Display summary of tasks.

## 5. Non-Functional Requirements

### NFR-001: Performance

| **Priority** | P1 |

API response time must be under 200ms.
`;

describe('LocalIssueWriter', () => {
  let tmpDir: string;
  let writer: LocalIssueWriter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-issue-writer-'));
    writer = new LocalIssueWriter({ scratchpadBasePath: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('generate', () => {
    it('should generate issue_list.json from SRS content', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);

      expect(result.issueCount).toBe(3);
      expect(result.issueListPath).toContain('issue_list.json');
      expect(fs.existsSync(result.issueListPath)).toBe(true);

      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      expect(issueList.schemaVersion).toBe('1.0.0');
      expect(issueList.projectId).toBe('test_project');
      expect(issueList.issues).toHaveLength(3);
    });

    it('should produce sequential ISS-XXX IDs', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);
      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      expect(issueList.issues[0].id).toBe('ISS-001');
      expect(issueList.issues[1].id).toBe('ISS-002');
      expect(issueList.issues[2].id).toBe('ISS-003');
    });

    it('should map feature priority to issue labels', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);
      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      expect(issueList.issues[0].labels.priority).toBe('P0');
      expect(issueList.issues[1].labels.priority).toBe('P1');
      expect(issueList.issues[2].labels.priority).toBe('P2');
    });

    it('should include acceptance criteria in issue body', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);
      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      // SF-001 has 3 acceptance criteria
      expect(issueList.issues[0].body).toContain('Acceptance Criteria');
      expect(issueList.issues[0].body).toContain('User can register with email and password');
    });

    it('should include traceability in issue body', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);
      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      expect(issueList.issues[0].body).toContain('SRS Feature: SF-001');
      expect(issueList.issues[0].body).toContain('PRD Requirements: FR-001');
    });

    it('should generate individual ISS-XXX.md files', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);

      expect(result.issueFiles).toHaveLength(3);
      for (const filePath of result.issueFiles) {
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('# [Feature]');
        expect(content).toContain('| **ID** |');
      }
    });

    it('should produce issue titles with [Feature] prefix', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);
      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      expect(issueList.issues[0].title).toBe('[Feature] User Authentication');
      expect(issueList.issues[1].title).toBe('[Feature] Task Management');
      expect(issueList.issues[2].title).toBe('[Feature] Dashboard Overview');
    });

    it('should estimate size based on feature complexity', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);
      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);

      // SF-003 has no AC and short description → S
      expect(issueList.issues[2].estimation.size).toBe('S');
      // SF-002 has 4 AC → L
      expect(issueList.issues[1].estimation.size).toBe('L');
    });

    it('should handle empty SRS gracefully', async () => {
      const emptySRS = '# Empty Project\n\n## 1. Introduction\n\nNo features yet.';
      const result = await writer.generate('empty_project', emptySRS);

      expect(result.issueCount).toBe(0);
      expect(result.issueFiles).toHaveLength(0);

      const raw = fs.readFileSync(result.issueListPath, 'utf-8');
      const issueList: LocalIssueListFile = JSON.parse(raw);
      expect(issueList.issues).toHaveLength(0);
    });
  });

  describe('LocalIssueReader compatibility', () => {
    it('should produce files readable by LocalIssueReader', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);

      const reader = new LocalIssueReader();
      const issueDir = path.dirname(result.issueListPath);
      const importResult = await reader.importFromLocal(issueDir);

      expect(importResult.repository).toBe('local');
      expect(importResult.issues).toHaveLength(3);

      // Verify round-trip integrity
      expect(importResult.issues[0].id).toBe('ISS-001');
      expect(importResult.issues[0].title).toBe('[Feature] User Authentication');
      expect(importResult.issues[0].labels.priority).toBe('P0');
      expect(importResult.issues[0].labels.type).toBe('feature');
      expect(importResult.issues[0].state).toBe('open');
    });

    it('should produce valid dependency graph via LocalIssueReader', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);

      const reader = new LocalIssueReader();
      const issueDir = path.dirname(result.issueListPath);
      const importResult = await reader.importFromLocal(issueDir);

      expect(importResult.dependencyGraph).toBeDefined();
      expect(importResult.dependencyGraph.nodes).toHaveLength(3);
      expect(importResult.dependencyGraph.hasCycles).toBe(false);
    });

    it('should produce valid statistics via LocalIssueReader', async () => {
      const result = await writer.generate('test_project', SAMPLE_SRS);

      const reader = new LocalIssueReader();
      const issueDir = path.dirname(result.issueListPath);
      const importResult = await reader.importFromLocal(issueDir);

      expect(importResult.stats.total).toBe(3);
      expect(importResult.stats.imported).toBe(3);
      expect(importResult.stats.byPriority.P0).toBe(1);
      expect(importResult.stats.byPriority.P1).toBe(1);
      expect(importResult.stats.byPriority.P2).toBe(1);
    });
  });

  describe('SRS from scratchpad', () => {
    it('should read SRS from scratchpad when no content provided', async () => {
      // Write SRS to scratchpad location
      const docsDir = path.join(tmpDir, 'documents', 'from_file');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'srs.md'), SAMPLE_SRS);

      const result = await writer.generate('from_file');

      expect(result.issueCount).toBe(3);
    });

    it('should throw when SRS file is missing from scratchpad', async () => {
      await expect(writer.generate('nonexistent')).rejects.toThrow('SRS file not found');
    });
  });
});
