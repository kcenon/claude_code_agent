/**
 * Tests for GitHub Zod schema definitions
 *
 * Validates runtime parsing behavior for GitHub API responses including
 * PR data, merge info, reviews, checks, repository info, security audits,
 * and workflow run data.
 */

import { describe, it, expect } from 'vitest';

import {
  GitHubPRDataSchema,
  GitHubPRDataArraySchema,
  GitHubMergeInfoSchema,
  GitHubReviewSchema,
  GitHubReviewsResponseSchema,
  GitHubCheckResultSchema,
  GitHubCheckResultArraySchema,
  GitHubRepoInfoSchema,
  SecurityAuditResultSchema,
  GitHubRunDataSchema,
} from '../../src/schemas/github.js';

describe('GitHubPRDataSchema', () => {
  const validPR = {
    number: 42,
    url: 'https://github.com/owner/repo/pull/42',
    title: 'feat: add authentication',
    headRefName: 'feature/auth',
    baseRefName: 'main',
    createdAt: '2026-01-01T00:00:00Z',
    state: 'OPEN',
  };

  it('should accept valid PR data', () => {
    const result = GitHubPRDataSchema.safeParse(validPR);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.number).toBe(42);
      expect(result.data.title).toBe('feat: add authentication');
      expect(result.data.state).toBe('OPEN');
    }
  });

  it('should accept PR with statusCheckRollup', () => {
    const data = {
      ...validPR,
      statusCheckRollup: [{ name: 'build', status: 'completed' }, { status: 'in_progress' }],
    };

    const result = GitHubPRDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept PR with reviews', () => {
    const data = {
      ...validPR,
      reviews: [
        { state: 'APPROVED', author: { login: 'reviewer1' } },
        { state: 'CHANGES_REQUESTED' },
        {},
      ],
    };

    const result = GitHubPRDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = {
      ...validPR,
      body: 'PR description',
      labels: [{ name: 'enhancement' }],
    };

    const result = GitHubPRDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(GitHubPRDataSchema.safeParse({}).success).toBe(false);
    expect(GitHubPRDataSchema.safeParse({ number: 1 }).success).toBe(false);
    expect(
      GitHubPRDataSchema.safeParse({
        number: 1,
        url: 'url',
        title: 'title',
      }).success
    ).toBe(false);
  });

  it('should reject non-number PR number', () => {
    const data = { ...validPR, number: '42' };
    expect(GitHubPRDataSchema.safeParse(data).success).toBe(false);
  });

  it('should reject non-object input', () => {
    expect(GitHubPRDataSchema.safeParse(null).success).toBe(false);
    expect(GitHubPRDataSchema.safeParse(undefined).success).toBe(false);
    expect(GitHubPRDataSchema.safeParse('string').success).toBe(false);
  });
});

describe('GitHubPRDataArraySchema', () => {
  it('should accept array of valid PRs', () => {
    const data = [
      {
        number: 1,
        url: 'https://github.com/owner/repo/pull/1',
        title: 'PR 1',
        headRefName: 'branch-1',
        baseRefName: 'main',
        createdAt: '2026-01-01T00:00:00Z',
        state: 'OPEN',
      },
      {
        number: 2,
        url: 'https://github.com/owner/repo/pull/2',
        title: 'PR 2',
        headRefName: 'branch-2',
        baseRefName: 'main',
        createdAt: '2026-01-02T00:00:00Z',
        state: 'MERGED',
      },
    ];

    const result = GitHubPRDataArraySchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('should accept empty array', () => {
    const result = GitHubPRDataArraySchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('should reject non-array input', () => {
    expect(GitHubPRDataArraySchema.safeParse({}).success).toBe(false);
    expect(GitHubPRDataArraySchema.safeParse('string').success).toBe(false);
  });

  it('should reject array with invalid PR', () => {
    const data = [{ number: 'not-a-number' }];
    expect(GitHubPRDataArraySchema.safeParse(data).success).toBe(false);
  });
});

describe('GitHubMergeInfoSchema', () => {
  it('should accept valid merge info', () => {
    const data = { mergeable: true };

    const result = GitHubMergeInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept null mergeable', () => {
    const data = { mergeable: null };

    const result = GitHubMergeInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mergeable).toBeNull();
    }
  });

  it('should accept full merge info', () => {
    const data = {
      mergeable: true,
      mergeableState: 'clean',
      files: [
        { filename: 'src/auth.ts', status: 'added' },
        { filename: 'tests/auth.test.ts', status: 'added' },
      ],
    };

    const result = GitHubMergeInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toHaveLength(2);
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = { mergeable: true, headRefOid: 'abc123' };

    const result = GitHubMergeInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject non-boolean mergeable', () => {
    const result = GitHubMergeInfoSchema.safeParse({ mergeable: 'yes' });
    expect(result.success).toBe(false);
  });

  it('should reject files with missing required fields', () => {
    const data = {
      mergeable: true,
      files: [{ filename: 'test.ts' }],
    };
    expect(GitHubMergeInfoSchema.safeParse(data).success).toBe(false);
  });
});

describe('GitHubReviewSchema', () => {
  it('should accept valid review', () => {
    const data = {
      author: { login: 'reviewer' },
      state: 'APPROVED',
      body: 'Looks good to me!',
      submittedAt: '2026-01-01T00:00:00Z',
    };

    const result = GitHubReviewSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author.login).toBe('reviewer');
      expect(result.data.state).toBe('APPROVED');
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = {
      author: { login: 'reviewer' },
      state: 'APPROVED',
      body: 'LGTM',
      submittedAt: '2026-01-01T00:00:00Z',
      id: 12345,
    };

    const result = GitHubReviewSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing author', () => {
    const data = {
      state: 'APPROVED',
      body: 'LGTM',
      submittedAt: '2026-01-01T00:00:00Z',
    };
    expect(GitHubReviewSchema.safeParse(data).success).toBe(false);
  });

  it('should reject missing state', () => {
    const data = {
      author: { login: 'reviewer' },
      body: 'LGTM',
      submittedAt: '2026-01-01T00:00:00Z',
    };
    expect(GitHubReviewSchema.safeParse(data).success).toBe(false);
  });

  it('should reject author without login', () => {
    const data = {
      author: {},
      state: 'APPROVED',
      body: 'LGTM',
      submittedAt: '2026-01-01T00:00:00Z',
    };
    expect(GitHubReviewSchema.safeParse(data).success).toBe(false);
  });
});

describe('GitHubReviewsResponseSchema', () => {
  it('should accept response with reviews', () => {
    const data = {
      reviews: [
        {
          author: { login: 'reviewer1' },
          state: 'APPROVED',
          body: 'LGTM',
          submittedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };

    const result = GitHubReviewsResponseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept response without reviews', () => {
    const result = GitHubReviewsResponseSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept empty reviews array', () => {
    const result = GitHubReviewsResponseSchema.safeParse({ reviews: [] });
    expect(result.success).toBe(true);
  });
});

describe('GitHubCheckResultSchema', () => {
  it('should accept valid check result', () => {
    const data = { name: 'build', status: 'completed', conclusion: 'success' };

    const result = GitHubCheckResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('build');
      expect(result.data.conclusion).toBe('success');
    }
  });

  it('should accept null conclusion', () => {
    const data = { name: 'test', status: 'in_progress', conclusion: null };

    const result = GitHubCheckResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conclusion).toBeNull();
    }
  });

  it('should accept without conclusion', () => {
    const data = { name: 'test', status: 'queued' };

    const result = GitHubCheckResultSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = {
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      detailsUrl: 'https://example.com',
    };

    const result = GitHubCheckResultSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = GitHubCheckResultSchema.safeParse({ status: 'completed' });
    expect(result.success).toBe(false);
  });

  it('should reject missing status', () => {
    const result = GitHubCheckResultSchema.safeParse({ name: 'build' });
    expect(result.success).toBe(false);
  });
});

describe('GitHubCheckResultArraySchema', () => {
  it('should accept array of check results', () => {
    const data = [
      { name: 'build', status: 'completed', conclusion: 'success' },
      { name: 'lint', status: 'completed', conclusion: 'failure' },
    ];

    const result = GitHubCheckResultArraySchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('should accept empty array', () => {
    const result = GitHubCheckResultArraySchema.safeParse([]);
    expect(result.success).toBe(true);
  });
});

describe('GitHubRepoInfoSchema', () => {
  it('should accept valid repo info', () => {
    const data = { name: 'my-repo', owner: { login: 'owner' } };

    const result = GitHubRepoInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('my-repo');
      expect(result.data.owner.login).toBe('owner');
    }
  });

  it('should accept full repo info', () => {
    const data = {
      name: 'my-repo',
      owner: { login: 'owner' },
      isPrivate: true,
      defaultBranchRef: { name: 'main' },
      url: 'https://github.com/owner/my-repo',
    };

    const result = GitHubRepoInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPrivate).toBe(true);
      expect(result.data.defaultBranchRef?.name).toBe('main');
    }
  });

  it('should accept null defaultBranchRef', () => {
    const data = { name: 'empty-repo', owner: { login: 'owner' }, defaultBranchRef: null };

    const result = GitHubRepoInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultBranchRef).toBeNull();
    }
  });

  it('should accept public repo (isPrivate false)', () => {
    const data = { name: 'public-repo', owner: { login: 'owner' }, isPrivate: false };

    const result = GitHubRepoInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPrivate).toBe(false);
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = {
      name: 'my-repo',
      owner: { login: 'owner' },
      description: 'A test repo',
      stargazerCount: 100,
    };

    const result = GitHubRepoInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = GitHubRepoInfoSchema.safeParse({ owner: { login: 'owner' } });
    expect(result.success).toBe(false);
  });

  it('should reject missing owner', () => {
    const result = GitHubRepoInfoSchema.safeParse({ name: 'my-repo' });
    expect(result.success).toBe(false);
  });

  it('should reject owner without login', () => {
    const result = GitHubRepoInfoSchema.safeParse({ name: 'my-repo', owner: {} });
    expect(result.success).toBe(false);
  });

  it('should reject non-object input', () => {
    expect(GitHubRepoInfoSchema.safeParse(null).success).toBe(false);
    expect(GitHubRepoInfoSchema.safeParse(undefined).success).toBe(false);
    expect(GitHubRepoInfoSchema.safeParse('string').success).toBe(false);
  });
});

describe('SecurityAuditResultSchema', () => {
  it('should accept empty result', () => {
    const result = SecurityAuditResultSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept result with vulnerabilities', () => {
    const data = {
      vulnerabilities: { critical: 1, high: 3, moderate: 5, low: 10, info: 2 },
    };

    const result = SecurityAuditResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vulnerabilities?.critical).toBe(1);
      expect(result.data.vulnerabilities?.high).toBe(3);
    }
  });

  it('should apply defaults for missing vulnerability counts', () => {
    const data = { vulnerabilities: { critical: 2 } };

    const result = SecurityAuditResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vulnerabilities?.critical).toBe(2);
      expect(result.data.vulnerabilities?.high).toBe(0);
      expect(result.data.vulnerabilities?.moderate).toBe(0);
      expect(result.data.vulnerabilities?.low).toBe(0);
      expect(result.data.vulnerabilities?.info).toBe(0);
    }
  });

  it('should accept unknown fields (loose mode)', () => {
    const result = SecurityAuditResultSchema.safeParse({
      vulnerabilities: { critical: 0 },
      totalDependencies: 150,
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-number vulnerability counts', () => {
    const data = { vulnerabilities: { critical: 'many' } };
    expect(SecurityAuditResultSchema.safeParse(data).success).toBe(false);
  });
});

describe('GitHubRunDataSchema', () => {
  it('should accept minimal run data', () => {
    const result = GitHubRunDataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept full run data', () => {
    const data = {
      conclusion: 'success',
      status: 'completed',
      jobs: [
        {
          name: 'build',
          conclusion: 'success',
          steps: [
            { name: 'Checkout', conclusion: 'success' },
            { name: 'Install', conclusion: 'success' },
            { name: 'Build', conclusion: 'success' },
          ],
        },
        {
          name: 'test',
          conclusion: 'failure',
          steps: [
            { name: 'Checkout', conclusion: 'success' },
            { name: 'Test', conclusion: 'failure' },
          ],
        },
      ],
    };

    const result = GitHubRunDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conclusion).toBe('success');
      expect(result.data.jobs).toHaveLength(2);
    }
  });

  it('should accept null conclusion', () => {
    const data = { conclusion: null, status: 'in_progress' };

    const result = GitHubRunDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conclusion).toBeNull();
    }
  });

  it('should accept jobs without steps', () => {
    const data = { jobs: [{ name: 'build', conclusion: 'success' }] };

    const result = GitHubRunDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept jobs with null step conclusions', () => {
    const data = {
      jobs: [
        {
          name: 'build',
          conclusion: null,
          steps: [{ name: 'Running', conclusion: null }],
        },
      ],
    };

    const result = GitHubRunDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should accept unknown fields (loose mode)', () => {
    const data = { conclusion: 'success', databaseId: 12345, workflowName: 'CI' };

    const result = GitHubRunDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject jobs with missing name', () => {
    const data = { jobs: [{ conclusion: 'success' }] };
    expect(GitHubRunDataSchema.safeParse(data).success).toBe(false);
  });

  it('should reject non-object input', () => {
    expect(GitHubRunDataSchema.safeParse(null).success).toBe(false);
    expect(GitHubRunDataSchema.safeParse('string').success).toBe(false);
    expect(GitHubRunDataSchema.safeParse(42).success).toBe(false);
  });
});
