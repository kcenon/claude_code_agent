/**
 * Tests for frontmatter utility functions
 *
 * Validates generation, parsing, prepending, and change history
 * append operations for YAML frontmatter in AD-SDLC documents.
 */

import { describe, it, expect } from 'vitest';

import {
  generateFrontmatter,
  parseFrontmatter,
  prependFrontmatter,
  appendChangeHistory,
} from '../../src/utilities/frontmatter.js';

describe('generateFrontmatter', () => {
  it('should generate valid YAML frontmatter with required fields', () => {
    const result = generateFrontmatter({
      docId: 'PRD-test',
      title: 'PRD: Test Project',
      version: '1.0.0',
      status: 'Draft',
      generatedBy: 'AD-SDLC PRD Writer Agent',
      generatedAt: '2026-04-12T10:00:00.000Z',
    });

    expect(result).toMatch(/^---\n/);
    expect(result).toMatch(/\n---\n$/);
    expect(result).toContain('doc_id: PRD-test');
    expect(result).toContain("title: 'PRD: Test Project'");
    expect(result).toContain('version: 1.0.0');
    expect(result).toContain('status: Draft');
    expect(result).toContain('generated_by: AD-SDLC PRD Writer Agent');
    expect(result).toContain("generated_at: '2026-04-12T10:00:00.000Z'");
  });

  it('should include optional fields when provided', () => {
    const result = generateFrontmatter({
      docId: 'SRS-test',
      title: 'SRS: Test',
      version: '1.0.0',
      status: 'Draft',
      generatedBy: 'AD-SDLC SRS Writer Agent',
      generatedAt: '2026-04-12T10:00:00.000Z',
      pipelineSession: 'session-abc',
      sourceDocuments: ['PRD-test'],
      changeHistory: [
        {
          version: '1.0.0',
          date: '2026-04-12',
          author: 'AD-SDLC SRS Writer Agent',
          description: 'Initial generation',
        },
      ],
    });

    expect(result).toContain('pipeline_session: session-abc');
    expect(result).toContain('source_documents:');
    expect(result).toContain('- PRD-test');
    expect(result).toContain('change_history:');
    expect(result).toContain('description: Initial generation');
  });

  it('should not include optional fields when not provided', () => {
    const result = generateFrontmatter({
      docId: 'SDS-test',
      title: 'SDS: Test',
      version: '1.0.0',
      status: 'Approved',
      generatedBy: 'AD-SDLC SDS Writer Agent',
      generatedAt: '2026-04-12T10:00:00.000Z',
    });

    expect(result).not.toContain('pipeline_session');
    expect(result).not.toContain('source_documents');
    expect(result).not.toContain('change_history');
  });

  it('should throw on invalid status', () => {
    expect(() =>
      generateFrontmatter({
        docId: 'PRD-test',
        title: 'Test',
        version: '1.0.0',
        status: 'Invalid' as 'Draft',
        generatedBy: 'Test',
        generatedAt: '2026-04-12T10:00:00.000Z',
      })
    ).toThrow();
  });
});

describe('parseFrontmatter', () => {
  it('should parse valid frontmatter from content', () => {
    const content = [
      '---',
      'doc_id: PRD-test',
      'title: PRD Test',
      'version: 1.0.0',
      'status: Draft',
      'generated_by: Test Agent',
      "generated_at: '2026-04-12T10:00:00.000Z'",
      '---',
      '',
      '# Document Title',
      '',
      'Content here.',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.doc_id).toBe('PRD-test');
    expect(result!.frontmatter.version).toBe('1.0.0');
    expect(result!.body).toContain('# Document Title');
    expect(result!.body).toContain('Content here.');
  });

  it('should return null for content without frontmatter', () => {
    const content = '# Just a document\n\nSome content.';
    const result = parseFrontmatter(content);
    expect(result).toBeNull();
  });

  it('should return null for content with only opening delimiter', () => {
    const content = '---\ndoc_id: test\nno closing delimiter';
    const result = parseFrontmatter(content);
    expect(result).toBeNull();
  });

  it('should handle frontmatter with change_history', () => {
    const content = [
      '---',
      'doc_id: SRS-test',
      'title: SRS Test',
      'version: 1.1.0',
      'status: Review',
      'generated_by: Test Agent',
      "generated_at: '2026-04-12T10:00:00.000Z'",
      'change_history:',
      '  - version: 1.0.0',
      "    date: '2026-04-10'",
      '    author: Writer Agent',
      '    description: Initial generation',
      '  - version: 1.1.0',
      "    date: '2026-04-12'",
      '    author: Updater Agent',
      '    description: Added features',
      '---',
      '',
      '# SRS Document',
    ].join('\n');

    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.change_history).toHaveLength(2);
    expect(result!.frontmatter.change_history![0]!.version).toBe('1.0.0');
    expect(result!.frontmatter.change_history![1]!.version).toBe('1.1.0');
  });
});

describe('prependFrontmatter', () => {
  it('should prepend frontmatter to content without existing frontmatter', () => {
    const content = '# My Document\n\nSome content.';
    const result = prependFrontmatter(content, {
      docId: 'PRD-test',
      title: 'PRD: Test',
      version: '1.0.0',
      status: 'Draft',
      generatedBy: 'Test',
      generatedAt: '2026-04-12T10:00:00.000Z',
    });

    expect(result).toMatch(/^---\n/);
    expect(result).toContain('doc_id: PRD-test');
    expect(result).toContain('# My Document');
    expect(result).toContain('Some content.');
  });

  it('should replace existing frontmatter', () => {
    const content = [
      '---',
      'doc_id: PRD-old',
      'title: Old Title',
      'version: 0.9.0',
      'status: Draft',
      'generated_by: Old Agent',
      "generated_at: '2026-01-01T00:00:00.000Z'",
      '---',
      '',
      '# Document',
    ].join('\n');

    const result = prependFrontmatter(content, {
      docId: 'PRD-new',
      title: 'New Title',
      version: '1.0.0',
      status: 'Review',
      generatedBy: 'New Agent',
      generatedAt: '2026-04-12T10:00:00.000Z',
    });

    expect(result).toContain('doc_id: PRD-new');
    expect(result).not.toContain('PRD-old');
    expect(result).toContain('# Document');
  });
});

describe('appendChangeHistory', () => {
  it('should append a change history entry to existing frontmatter', () => {
    const content = [
      '---',
      'doc_id: PRD-test',
      'title: PRD Test',
      'version: 1.0.0',
      'status: Draft',
      'generated_by: Writer Agent',
      "generated_at: '2026-04-10T10:00:00.000Z'",
      'change_history:',
      '  - version: 1.0.0',
      "    date: '2026-04-10'",
      '    author: Writer Agent',
      '    description: Initial generation',
      '---',
      '',
      '# PRD Document',
    ].join('\n');

    const result = appendChangeHistory(content, {
      version: '1.1.0',
      date: '2026-04-12',
      author: 'Updater Agent',
      description: 'Added 2 requirement(s)',
    });

    const parsed = parseFrontmatter(result);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.change_history).toHaveLength(2);
    expect(parsed!.frontmatter.change_history![1]!.version).toBe('1.1.0');
    expect(parsed!.frontmatter.change_history![1]!.description).toBe('Added 2 requirement(s)');
    expect(parsed!.body).toContain('# PRD Document');
  });

  it('should return content unchanged if no frontmatter present', () => {
    const content = '# Just a document\n\nNo frontmatter.';
    const result = appendChangeHistory(content, {
      version: '1.0.0',
      date: '2026-04-12',
      author: 'Test',
      description: 'Test change',
    });

    expect(result).toBe(content);
  });

  it('should create change_history array if not present in frontmatter', () => {
    const content = [
      '---',
      'doc_id: SDS-test',
      'title: SDS Test',
      'version: 1.0.0',
      'status: Draft',
      'generated_by: Writer Agent',
      "generated_at: '2026-04-12T10:00:00.000Z'",
      '---',
      '',
      '# SDS Document',
    ].join('\n');

    const result = appendChangeHistory(content, {
      version: '1.0.1',
      date: '2026-04-12',
      author: 'Updater Agent',
      description: 'Minor fix',
    });

    const parsed = parseFrontmatter(result);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.change_history).toHaveLength(1);
    expect(parsed!.frontmatter.change_history![0]!.version).toBe('1.0.1');
  });
});
