/**
 * Tests for scaffold cleanup utilities (isEmptyDirectory, cleanupEmptyScaffolds)
 */

import * as fs from 'fs';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupEmptyScaffolds,
  isEmptyDirectory,
} from '../../src/project-initializer/ProjectInitializer.js';

describe('Scaffold Cleanup Utilities', () => {
  const testDir = path.join(process.cwd(), 'test-output', 'scaffold-cleanup');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('isEmptyDirectory', () => {
    it('should return true for an empty directory', async () => {
      const emptyDir = path.join(testDir, 'empty');
      fs.mkdirSync(emptyDir);

      expect(await isEmptyDirectory(emptyDir)).toBe(true);
    });

    it('should return false for a directory with a file', async () => {
      const dirWithFile = path.join(testDir, 'with-file');
      fs.mkdirSync(dirWithFile);
      fs.writeFileSync(path.join(dirWithFile, 'data.txt'), 'content');

      expect(await isEmptyDirectory(dirWithFile)).toBe(false);
    });

    it('should return true for a directory containing only empty subdirectories', async () => {
      const parentDir = path.join(testDir, 'parent');
      fs.mkdirSync(path.join(parentDir, 'child1'), { recursive: true });
      fs.mkdirSync(path.join(parentDir, 'child2'), { recursive: true });

      expect(await isEmptyDirectory(parentDir)).toBe(true);
    });

    it('should return false for a directory containing subdirectory with a file', async () => {
      const parentDir = path.join(testDir, 'parent-with-content');
      fs.mkdirSync(path.join(parentDir, 'child'), { recursive: true });
      fs.writeFileSync(path.join(parentDir, 'child', 'data.yaml'), 'key: value');

      expect(await isEmptyDirectory(parentDir)).toBe(false);
    });

    it('should return false for a file path', async () => {
      const filePath = path.join(testDir, 'file.txt');
      fs.writeFileSync(filePath, 'content');

      expect(await isEmptyDirectory(filePath)).toBe(false);
    });

    it('should return false for a non-existent path', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist');

      expect(await isEmptyDirectory(nonExistent)).toBe(false);
    });

    it('should return true for nested empty directories (progress-like structure)', async () => {
      // Simulate the progress/{projectId}/{work_orders,results,reviews} structure
      const projectDir = path.join(testDir, '042');
      fs.mkdirSync(path.join(projectDir, 'work_orders'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'results'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'reviews'), { recursive: true });

      expect(await isEmptyDirectory(projectDir)).toBe(true);
    });

    it('should return false when one nested directory has content', async () => {
      const projectDir = path.join(testDir, '043');
      fs.mkdirSync(path.join(projectDir, 'work_orders'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'results'), { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, 'results', 'WO-001-result.yaml'),
        'status: completed'
      );

      expect(await isEmptyDirectory(projectDir)).toBe(false);
    });
  });

  describe('cleanupEmptyScaffolds', () => {
    let scratchpadDir: string;

    beforeEach(() => {
      scratchpadDir = path.join(testDir, 'scratchpad');
      fs.mkdirSync(path.join(scratchpadDir, 'issues'), { recursive: true });
      fs.mkdirSync(path.join(scratchpadDir, 'progress'), { recursive: true });
      fs.mkdirSync(path.join(scratchpadDir, 'documents'), { recursive: true });
    });

    it('should remove empty directories under issues, progress, and documents', async () => {
      // Create empty scaffold directories
      for (let i = 2; i <= 10; i++) {
        const id = String(i).padStart(3, '0');
        fs.mkdirSync(path.join(scratchpadDir, 'issues', id));
        fs.mkdirSync(path.join(scratchpadDir, 'progress', id));
        fs.mkdirSync(path.join(scratchpadDir, 'documents', id));
      }

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      // 9 dirs each for issues, progress, documents = 27
      expect(removed).toBe(27);
      expect(fs.readdirSync(path.join(scratchpadDir, 'issues'))).toHaveLength(0);
      expect(fs.readdirSync(path.join(scratchpadDir, 'progress'))).toHaveLength(0);
      expect(fs.readdirSync(path.join(scratchpadDir, 'documents'))).toHaveLength(0);
    });

    it('should preserve directories with actual content', async () => {
      // Create one directory with content
      const contentDir = path.join(scratchpadDir, 'issues', '001');
      fs.mkdirSync(contentDir);
      fs.writeFileSync(path.join(contentDir, 'issue_list.json'), '[]');

      // Create empty directories
      fs.mkdirSync(path.join(scratchpadDir, 'issues', '002'));
      fs.mkdirSync(path.join(scratchpadDir, 'issues', '003'));

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      expect(removed).toBe(2);
      expect(fs.existsSync(contentDir)).toBe(true);
      expect(fs.existsSync(path.join(scratchpadDir, 'issues', '002'))).toBe(false);
      expect(fs.existsSync(path.join(scratchpadDir, 'issues', '003'))).toBe(false);
    });

    it('should handle progress directories with empty subdirectories', async () => {
      // Simulate pre-created progress structure with empty subsections
      const progressDir = path.join(scratchpadDir, 'progress', '005');
      fs.mkdirSync(path.join(progressDir, 'work_orders'), { recursive: true });
      fs.mkdirSync(path.join(progressDir, 'results'));
      fs.mkdirSync(path.join(progressDir, 'reviews'));

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      expect(removed).toBe(1);
      expect(fs.existsSync(progressDir)).toBe(false);
    });

    it('should preserve progress directories with files in subsections', async () => {
      const progressDir = path.join(scratchpadDir, 'progress', '005');
      fs.mkdirSync(path.join(progressDir, 'work_orders'), { recursive: true });
      fs.mkdirSync(path.join(progressDir, 'results'));
      fs.writeFileSync(
        path.join(progressDir, 'work_orders', 'WO-001.yaml'),
        'id: WO-001'
      );

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      expect(removed).toBe(0);
      expect(fs.existsSync(progressDir)).toBe(true);
    });

    it('should return 0 when there are no empty directories', async () => {
      // Add content to all sections
      const issueDir = path.join(scratchpadDir, 'issues', '001');
      fs.mkdirSync(issueDir);
      fs.writeFileSync(path.join(issueDir, 'issue_list.json'), '[]');

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      expect(removed).toBe(0);
    });

    it('should return 0 when scratchpad directory does not exist', async () => {
      const nonExistent = path.join(testDir, 'non-existent-scratchpad');

      const removed = await cleanupEmptyScaffolds(nonExistent);

      expect(removed).toBe(0);
    });

    it('should handle missing section directories gracefully', async () => {
      // Only create issues, not progress or documents
      fs.rmSync(path.join(scratchpadDir, 'progress'), { recursive: true });
      fs.rmSync(path.join(scratchpadDir, 'documents'), { recursive: true });

      fs.mkdirSync(path.join(scratchpadDir, 'issues', '002'));

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      expect(removed).toBe(1);
    });

    it('should not touch README.md files in section directories', async () => {
      // README.md is a file at the section level, not a directory - should be ignored
      fs.writeFileSync(path.join(scratchpadDir, 'issues', 'README.md'), '# Issues');
      fs.mkdirSync(path.join(scratchpadDir, 'issues', '002'));

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      // Only the empty directory should be removed, README.md stays
      expect(removed).toBe(1);
      expect(fs.existsSync(path.join(scratchpadDir, 'issues', 'README.md'))).toBe(true);
    });

    it('should preserve documents directory with content (like 001)', async () => {
      // documents/001 has actual content
      const docDir = path.join(scratchpadDir, 'documents', '001');
      fs.mkdirSync(docDir);
      fs.writeFileSync(path.join(docDir, 'prd.md'), '# PRD');

      // documents/002 through 010 are empty
      for (let i = 2; i <= 10; i++) {
        fs.mkdirSync(path.join(scratchpadDir, 'documents', String(i).padStart(3, '0')));
      }

      const removed = await cleanupEmptyScaffolds(scratchpadDir);

      expect(removed).toBe(9);
      expect(fs.existsSync(docDir)).toBe(true);
    });
  });
});
