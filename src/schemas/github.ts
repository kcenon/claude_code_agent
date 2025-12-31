/**
 * Zod schemas for GitHub API responses
 *
 * Provides runtime validation for data received from GitHub CLI commands.
 * These schemas support lenient parsing with .loose() to handle
 * unknown fields from API responses.
 *
 * @module schemas/github
 */

import { z } from 'zod';

// ============================================================
// PR Data Schemas
// ============================================================

/**
 * GitHub PR data from `gh pr view/list --json` command
 *
 * Used in: PRCreator, PRReviewerAgent
 */
export const GitHubPRDataSchema = z
  .object({
    number: z.number(),
    url: z.string(),
    title: z.string(),
    headRefName: z.string(),
    baseRefName: z.string(),
    createdAt: z.string(),
    state: z.string(),
    statusCheckRollup: z
      .array(
        z.object({
          name: z.string().optional(),
          status: z.string(),
        })
      )
      .optional(),
    reviews: z
      .array(
        z.object({
          state: z.string().optional(),
          author: z.object({ login: z.string().optional() }).optional(),
        })
      )
      .optional(),
  })
  .loose()
  .describe('GitHubPRData');

export type GitHubPRData = z.infer<typeof GitHubPRDataSchema>;

/**
 * Array of PR data (for list commands)
 */
export const GitHubPRDataArraySchema = z.array(GitHubPRDataSchema).describe('GitHubPRDataArray');

// ============================================================
// Merge Info Schemas
// ============================================================

/**
 * GitHub merge info from `gh pr view --json mergeable,mergeStateStatus,files`
 *
 * Used in: MergeDecision
 */
export const GitHubMergeInfoSchema = z
  .object({
    mergeable: z.boolean().nullable(),
    mergeableState: z.string().optional(),
    files: z
      .array(
        z.object({
          filename: z.string(),
          status: z.string(),
        })
      )
      .optional(),
  })
  .loose()
  .describe('GitHubMergeInfo');

export type GitHubMergeInfo = z.infer<typeof GitHubMergeInfoSchema>;

// ============================================================
// Review Schemas
// ============================================================

/**
 * GitHub review from `gh pr view --json reviews`
 *
 * Used in: MergeDecision
 */
export const GitHubReviewSchema = z
  .object({
    author: z.object({ login: z.string() }),
    state: z.string(),
    body: z.string(),
    submittedAt: z.string(),
  })
  .loose()
  .describe('GitHubReview');

export type GitHubReview = z.infer<typeof GitHubReviewSchema>;

/**
 * Container for reviews array
 */
export const GitHubReviewsResponseSchema = z
  .object({
    reviews: z.array(GitHubReviewSchema).optional(),
  })
  .loose()
  .describe('GitHubReviewsResponse');

export type GitHubReviewsResponse = z.infer<typeof GitHubReviewsResponseSchema>;

// ============================================================
// Check/Status Schemas
// ============================================================

/**
 * GitHub check result from `gh pr checks --json`
 *
 * Used in: PRReviewerAgent, CIFixAgent
 */
export const GitHubCheckResultSchema = z
  .object({
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable().optional(),
  })
  .loose()
  .describe('GitHubCheckResult');

export type GitHubCheckResult = z.infer<typeof GitHubCheckResultSchema>;

/**
 * Array of check results
 */
export const GitHubCheckResultArraySchema = z
  .array(GitHubCheckResultSchema)
  .describe('GitHubCheckResultArray');

// ============================================================
// Repository Schemas
// ============================================================

/**
 * GitHub repository info from `gh repo view --json`
 *
 * Used in: RepoDetector
 */
export const GitHubRepoInfoSchema = z
  .object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
    isPrivate: z.boolean().optional(),
    defaultBranchRef: z
      .object({
        name: z.string(),
      })
      .nullable()
      .optional(),
    url: z.string().optional(),
  })
  .loose()
  .describe('GitHubRepoInfo');

export type GitHubRepoInfo = z.infer<typeof GitHubRepoInfoSchema>;

// ============================================================
// Audit/Security Schemas
// ============================================================

/**
 * Security audit result from npm/yarn audit
 *
 * Used in: ReviewChecks
 */
export const SecurityAuditResultSchema = z
  .object({
    vulnerabilities: z
      .object({
        critical: z.number().optional().default(0),
        high: z.number().optional().default(0),
        moderate: z.number().optional().default(0),
        low: z.number().optional().default(0),
        info: z.number().optional().default(0),
      })
      .optional(),
  })
  .loose()
  .describe('SecurityAuditResult');

export type SecurityAuditResult = z.infer<typeof SecurityAuditResultSchema>;

// ============================================================
// Run Data Schemas
// ============================================================

/**
 * GitHub workflow run data from `gh run view --json`
 *
 * Used in: CIFixAgent
 */
export const GitHubRunDataSchema = z
  .object({
    conclusion: z.string().nullable().optional(),
    status: z.string().optional(),
    jobs: z
      .array(
        z.object({
          name: z.string(),
          conclusion: z.string().nullable().optional(),
          steps: z
            .array(
              z.object({
                name: z.string(),
                conclusion: z.string().nullable().optional(),
              })
            )
            .optional(),
        })
      )
      .optional(),
  })
  .loose()
  .describe('GitHubRunData');

export type GitHubRunData = z.infer<typeof GitHubRunDataSchema>;
