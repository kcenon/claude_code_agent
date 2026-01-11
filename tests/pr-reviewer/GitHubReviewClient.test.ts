import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GitHubReviewClient,
  getGitHubReviewClient,
  resetGitHubReviewClient,
} from '../../src/pr-reviewer/GitHubReviewClient.js';
import type {
  LineReviewComment,
  MultiFileReviewRequest,
} from '../../src/pr-reviewer/types.js';
import { DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG } from '../../src/pr-reviewer/types.js';

// Mock the security module
vi.mock('../../src/security/index.js', () => ({
  getCommandSanitizer: () => ({
    execFromString: vi.fn().mockResolvedValue({
      stdout: '{"id": 123, "node_id": "test", "state": "APPROVED"}',
      stderr: '',
      success: true,
      exitCode: 0,
    }),
    escapeForParser: (str: string) => str.replace(/"/g, '\\"'),
  }),
}));

describe('GitHubReviewClient', () => {
  beforeEach(() => {
    resetGitHubReviewClient();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const client = new GitHubReviewClient();
      const config = client.getConfig();

      expect(config.continueOnCommentFailure).toBe(
        DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.continueOnCommentFailure
      );
      expect(config.useBatchReview).toBe(DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.useBatchReview);
    });

    it('should accept custom configuration', () => {
      const client = new GitHubReviewClient({
        projectRoot: '/custom/path',
        continueOnCommentFailure: false,
        useBatchReview: false,
      });
      const config = client.getConfig();

      expect(config.projectRoot).toBe('/custom/path');
      expect(config.continueOnCommentFailure).toBe(false);
      expect(config.useBatchReview).toBe(false);
    });
  });

  describe('convertToLineComment', () => {
    it('should convert review comment to line comment format', () => {
      const result = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        42,
        'major',
        'This needs to be fixed'
      );

      expect(result.path).toBe('src/test.ts');
      expect(result.line).toBe(42);
      expect(result.body).toContain('MAJOR');
      expect(result.body).toContain('This needs to be fixed');
      expect(result.side).toBe('RIGHT');
    });

    it('should include suggestion when provided', () => {
      const result = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        42,
        'minor',
        'Consider using const',
        'const x = 1;'
      );

      expect(result.suggestion).toBe('const x = 1;');
    });

    it('should not include suggestion when not provided', () => {
      const result = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        42,
        'minor',
        'Some comment'
      );

      expect(result.suggestion).toBeUndefined();
    });

    it('should use correct emoji for each severity', () => {
      const criticalResult = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        1,
        'critical',
        'Critical issue'
      );
      expect(criticalResult.body).toContain('🚨');

      const majorResult = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        1,
        'major',
        'Major issue'
      );
      expect(majorResult.body).toContain('⚠️');

      const minorResult = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        1,
        'minor',
        'Minor issue'
      );
      expect(minorResult.body).toContain('💡');

      const suggestionResult = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        1,
        'suggestion',
        'Suggestion'
      );
      expect(suggestionResult.body).toContain('💭');
    });
  });

  describe('getGitHubReviewClient singleton', () => {
    it('should return same instance', () => {
      const client1 = getGitHubReviewClient();
      const client2 = getGitHubReviewClient();

      expect(client1).toBe(client2);
    });

    it('should reset singleton', () => {
      const client1 = getGitHubReviewClient();
      resetGitHubReviewClient();
      const client2 = getGitHubReviewClient();

      expect(client1).not.toBe(client2);
    });
  });

  describe('LineReviewComment type', () => {
    it('should accept valid comment without suggestion', () => {
      const comment: LineReviewComment = {
        path: 'src/file.ts',
        line: 10,
        body: 'This is a comment',
        side: 'RIGHT',
      };

      expect(comment.path).toBe('src/file.ts');
      expect(comment.line).toBe(10);
      expect(comment.body).toBe('This is a comment');
      expect(comment.side).toBe('RIGHT');
    });

    it('should accept valid comment with suggestion', () => {
      const comment: LineReviewComment = {
        path: 'src/file.ts',
        line: 10,
        body: 'This is a comment',
        side: 'LEFT',
        suggestion: 'const x = 1;',
      };

      expect(comment.suggestion).toBe('const x = 1;');
    });
  });

  describe('MultiFileReviewRequest type', () => {
    it('should accept valid request', () => {
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Overall review',
        event: 'APPROVE',
        comments: [
          { path: 'src/a.ts', line: 1, body: 'Comment 1' },
          { path: 'src/b.ts', line: 2, body: 'Comment 2' },
        ],
      };

      expect(request.prNumber).toBe(123);
      expect(request.event).toBe('APPROVE');
      expect(request.comments).toHaveLength(2);
    });

    it('should accept all event types', () => {
      const approveRequest: MultiFileReviewRequest = {
        prNumber: 1,
        body: 'LGTM',
        event: 'APPROVE',
        comments: [],
      };
      expect(approveRequest.event).toBe('APPROVE');

      const changesRequest: MultiFileReviewRequest = {
        prNumber: 1,
        body: 'Please fix',
        event: 'REQUEST_CHANGES',
        comments: [],
      };
      expect(changesRequest.event).toBe('REQUEST_CHANGES');

      const commentRequest: MultiFileReviewRequest = {
        prNumber: 1,
        body: 'Just a comment',
        event: 'COMMENT',
        comments: [],
      };
      expect(commentRequest.event).toBe('COMMENT');
    });
  });

  describe('DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG', () => {
    it('should have correct defaults', () => {
      expect(DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.continueOnCommentFailure).toBe(true);
      expect(DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.useBatchReview).toBe(true);
      expect(DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.projectRoot).toBe(process.cwd());
    });
  });
});
