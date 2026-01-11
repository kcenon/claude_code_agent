import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
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

// Create mock functions that can be accessed in tests
const mockExecFromString = vi.fn();
const mockEscapeForParser = vi.fn((str: string) => str.replace(/"/g, '\\"'));

// Mock the security module
vi.mock('../../src/security/index.js', () => ({
  getCommandSanitizer: () => ({
    execFromString: mockExecFromString,
    escapeForParser: mockEscapeForParser,
  }),
}));

// Mock the utils module
vi.mock('../../src/utils/index.js', () => ({
  tryGetProjectRoot: () => '/mock/project/root',
}));

describe('GitHubReviewClient', () => {
  beforeEach(() => {
    resetGitHubReviewClient();
    mockExecFromString.mockReset();
    mockEscapeForParser.mockReset();
    mockEscapeForParser.mockImplementation((str: string) => str.replace(/"/g, '\\"'));
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

  describe('submitMultiFileReview', () => {
    it('should submit batch review successfully when useBatchReview is true', async () => {
      // Setup mocks for PR head commit and repo info
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 456, "node_id": "test", "state": "APPROVED"}',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient({ useBatchReview: true });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Overall review',
        event: 'APPROVE',
        comments: [{ path: 'src/a.ts', line: 1, body: 'Comment 1' }],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.reviewSubmitted).toBe(true);
      expect(result.reviewId).toBe(456);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
    });

    it('should handle batch review failure', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'API error',
          success: false,
          exitCode: 1,
        });

      const client = new GitHubReviewClient({ useBatchReview: true });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Overall review',
        event: 'APPROVE',
        comments: [{ path: 'src/a.ts', line: 1, body: 'Comment 1' }],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.reviewSubmitted).toBe(false);
      expect(result.failureCount).toBe(1);
    });

    it('should submit review and comments individually when useBatchReview is false', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 789, "node_id": "test", "state": "APPROVED"}',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 100, "line": 1, "path": "src/a.ts"}',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient({ useBatchReview: false });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Overall review',
        event: 'COMMENT',
        comments: [{ path: 'src/a.ts', line: 1, body: 'Comment 1' }],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.reviewSubmitted).toBe(true);
      expect(result.successCount).toBe(1);
    });

    it('should stop on comment failure when continueOnCommentFailure is false', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 789, "node_id": "test", "state": "APPROVED"}',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Comment failed',
          success: false,
          exitCode: 1,
        });

      const client = new GitHubReviewClient({
        useBatchReview: false,
        continueOnCommentFailure: false,
      });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Overall review',
        event: 'COMMENT',
        comments: [
          { path: 'src/a.ts', line: 1, body: 'Comment 1' },
          { path: 'src/b.ts', line: 2, body: 'Comment 2' },
        ],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.failureCount).toBe(1);
      expect(result.commentResults).toHaveLength(1);
    });

    it('should handle empty comments array with batch review', async () => {
      mockExecFromString.mockResolvedValueOnce({
        stdout: 'abc123def',
        stderr: '',
        success: true,
        exitCode: 0,
      });

      const client = new GitHubReviewClient({ useBatchReview: true });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'No comments',
        event: 'APPROVE',
        comments: [],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.commentResults).toHaveLength(0);
    });

    it('should handle error during review submission and mark remaining comments as failed', async () => {
      mockExecFromString.mockRejectedValueOnce(new Error('Network error'));

      const client = new GitHubReviewClient({ useBatchReview: true });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Overall review',
        event: 'APPROVE',
        comments: [
          { path: 'src/a.ts', line: 1, body: 'Comment 1' },
          { path: 'src/b.ts', line: 2, body: 'Comment 2' },
        ],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.reviewSubmitted).toBe(false);
      expect(result.failureCount).toBe(2);
    });
  });

  describe('addLineComment', () => {
    it('should add line comment successfully', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 200, "line": 42, "path": "src/test.ts"}',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient();
      const comment: LineReviewComment = {
        path: 'src/test.ts',
        line: 42,
        body: 'Test comment',
      };

      const result = await client.addLineComment(123, comment);

      expect(result.success).toBe(true);
      expect(result.commentId).toBe(200);
      expect(result.path).toBe('src/test.ts');
      expect(result.line).toBe(42);
    });

    it('should add line comment with suggestion', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 201, "line": 42, "path": "src/test.ts"}',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient();
      const comment: LineReviewComment = {
        path: 'src/test.ts',
        line: 42,
        body: 'Use const',
        suggestion: 'const x = 1;',
      };

      const result = await client.addLineComment(123, comment);

      expect(result.success).toBe(true);
    });

    it('should use provided commit SHA instead of fetching', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 202, "line": 42, "path": "src/test.ts"}',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient();
      const comment: LineReviewComment = {
        path: 'src/test.ts',
        line: 42,
        body: 'Test comment',
        side: 'LEFT',
      };

      const result = await client.addLineComment(123, comment, 'provided-sha');

      expect(result.success).toBe(true);
      expect(mockExecFromString).toHaveBeenCalledTimes(2);
    });

    it('should handle command execution failure', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123def',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'Permission denied',
          success: false,
          exitCode: 1,
        });

      const client = new GitHubReviewClient();
      const comment: LineReviewComment = {
        path: 'src/test.ts',
        line: 42,
        body: 'Test comment',
      };

      const result = await client.addLineComment(123, comment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should handle unexpected error', async () => {
      mockExecFromString.mockRejectedValueOnce(new Error('Unexpected error'));

      const client = new GitHubReviewClient();
      const comment: LineReviewComment = {
        path: 'src/test.ts',
        line: 42,
        body: 'Test comment',
      };

      const result = await client.addLineComment(123, comment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });
  });

  describe('error handling', () => {
    it('should handle failed PR head commit fetch', async () => {
      mockExecFromString.mockResolvedValueOnce({
        stdout: '',
        stderr: 'PR not found',
        success: false,
        exitCode: 1,
      });

      const client = new GitHubReviewClient();
      const request: MultiFileReviewRequest = {
        prNumber: 999,
        body: 'Review',
        event: 'COMMENT',
        comments: [{ path: 'src/a.ts', line: 1, body: 'Comment' }],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.reviewSubmitted).toBe(false);
      expect(result.failureCount).toBe(1);
    });

    it('should handle invalid repo info format', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'invalid-format',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient({ useBatchReview: true });
      const request: MultiFileReviewRequest = {
        prNumber: 123,
        body: 'Review',
        event: 'COMMENT',
        comments: [{ path: 'src/a.ts', line: 1, body: 'Comment' }],
      };

      const result = await client.submitMultiFileReview(request);

      expect(result.reviewSubmitted).toBe(false);
    });

    it('should cache repo info on subsequent calls', async () => {
      mockExecFromString
        .mockResolvedValueOnce({
          stdout: 'abc123',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'owner/repo',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 1}',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'def456',
          stderr: '',
          success: true,
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '{"id": 2}',
          stderr: '',
          success: true,
          exitCode: 0,
        });

      const client = new GitHubReviewClient({ useBatchReview: true });

      await client.submitMultiFileReview({
        prNumber: 1,
        body: 'First',
        event: 'COMMENT',
        comments: [{ path: 'a.ts', line: 1, body: 'c' }],
      });

      await client.submitMultiFileReview({
        prNumber: 2,
        body: 'Second',
        event: 'COMMENT',
        comments: [{ path: 'b.ts', line: 1, body: 'd' }],
      });

      // Repo info should only be fetched once
      const repoInfoCalls = mockExecFromString.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).includes('nameWithOwner')
      );
      expect(repoInfoCalls).toHaveLength(1);
    });
  });

  describe('getSeverityEmoji edge cases', () => {
    it('should return default emoji for unknown severity', () => {
      const result = GitHubReviewClient.convertToLineComment(
        'src/test.ts',
        1,
        'unknown',
        'Unknown severity'
      );
      expect(result.body).toContain('📝');
    });
  });

  describe('executeCommand error handling', () => {
    it('should handle execution error with exitCode property', async () => {
      const errorWithExitCode = {
        stdout: 'partial output',
        stderr: 'error message',
        exitCode: 127,
      };
      mockExecFromString.mockRejectedValueOnce(errorWithExitCode);

      const client = new GitHubReviewClient();
      const comment: LineReviewComment = {
        path: 'src/test.ts',
        line: 42,
        body: 'Test',
      };

      const result = await client.addLineComment(123, comment);

      expect(result.success).toBe(false);
    });
  });
});
