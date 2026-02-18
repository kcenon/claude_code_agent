/**
 * Artifact Validator for AD-SDLC Pipeline
 *
 * Validates that output files from pre-completed stages exist on disk
 * before allowing downstream stages to execute. Supports graceful
 * degradation by identifying which pre-completed stages have missing
 * artifacts so they can be re-executed.
 *
 * Implements SDS-001 CMP-025 artifact validation specification.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { PipelineMode, StageName } from './types.js';

/**
 * Specification for a single artifact produced by a pipeline stage
 */
export interface ArtifactSpec {
  /** Glob pattern for the artifact path (relative to project root) */
  readonly pathPattern: string;
  /** Human-readable description */
  readonly description: string;
  /** Whether this artifact is strictly required for downstream stages */
  readonly required: boolean;
}

/**
 * Maps a pipeline stage to its expected output artifacts
 */
export interface StageArtifactMap {
  readonly stage: StageName;
  readonly requiredArtifacts: readonly ArtifactSpec[];
}

/**
 * Result of validating artifacts for a single stage
 */
export interface ValidationResult {
  /** Whether all required artifacts are present */
  readonly valid: boolean;
  /** Stage that was validated */
  readonly stage: StageName;
  /** Required artifacts that are missing */
  readonly missing: readonly ArtifactSpec[];
  /** File paths that were found */
  readonly found: readonly string[];
}

/**
 * Greenfield pipeline artifact definitions
 */
export const GREENFIELD_ARTIFACTS: readonly StageArtifactMap[] = [
  {
    stage: 'initialization',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad',
        description: 'Scratchpad directory',
        required: true,
      },
    ],
  },
  {
    stage: 'collection',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/info/*/collected_info.yaml',
        description: 'Collected requirements',
        required: true,
      },
    ],
  },
  {
    stage: 'prd_generation',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/documents/*/prd.md',
        description: 'PRD document (scratchpad)',
        required: true,
      },
      {
        pathPattern: 'docs/prd/*.md',
        description: 'PRD document (public)',
        required: false,
      },
    ],
  },
  {
    stage: 'srs_generation',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/documents/*/srs.md',
        description: 'SRS document',
        required: true,
      },
    ],
  },
  {
    stage: 'sds_generation',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/documents/*/sds.md',
        description: 'SDS document',
        required: true,
      },
    ],
  },
  {
    stage: 'issue_generation',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/issues/issue_list.json',
        description: 'Issue list',
        required: true,
      },
    ],
  },
];

/**
 * Enhancement pipeline artifact definitions
 */
export const ENHANCEMENT_ARTIFACTS: readonly StageArtifactMap[] = [
  {
    stage: 'document_reading',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/analysis/*/document_state.yaml',
        description: 'Document state analysis',
        required: true,
      },
    ],
  },
  {
    stage: 'codebase_analysis',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/analysis/*/architecture_overview.yaml',
        description: 'Architecture overview',
        required: true,
      },
    ],
  },
  {
    stage: 'code_reading',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/analysis/*/code_inventory.yaml',
        description: 'Code inventory',
        required: true,
      },
    ],
  },
  {
    stage: 'doc_code_comparison',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/analysis/*/comparison_report.yaml',
        description: 'Doc-code comparison report',
        required: true,
      },
    ],
  },
  {
    stage: 'impact_analysis',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/analysis/*/impact_report.yaml',
        description: 'Impact analysis report',
        required: true,
      },
    ],
  },
  {
    stage: 'prd_update',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/documents/*/prd.md',
        description: 'Updated PRD document',
        required: true,
      },
    ],
  },
  {
    stage: 'srs_update',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/documents/*/srs.md',
        description: 'Updated SRS document',
        required: true,
      },
    ],
  },
  {
    stage: 'sds_update',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/documents/*/sds.md',
        description: 'Updated SDS document',
        required: true,
      },
    ],
  },
  {
    stage: 'issue_generation',
    requiredArtifacts: [
      {
        pathPattern: '.ad-sdlc/scratchpad/issues/issue_list.json',
        description: 'Issue list',
        required: true,
      },
    ],
  },
];

/**
 * Validates that artifacts from pre-completed pipeline stages exist on disk
 */
export class ArtifactValidator {
  constructor(private readonly projectDir: string) {}

  /**
   * Validate all artifacts for a set of pre-completed stages
   * @param stages - Set of stage names to validate
   * @param mode - Pipeline mode to look up artifact definitions
   * @returns Validation results for each stage that has artifact definitions
   */
  async validatePreCompletedStages(
    stages: ReadonlySet<StageName>,
    mode: PipelineMode
  ): Promise<ValidationResult[]> {
    const artifactMap = this.getArtifactMap(mode);
    const results: ValidationResult[] = [];

    for (const entry of artifactMap) {
      if (stages.has(entry.stage)) {
        results.push(await this.validateStageArtifacts(entry.stage, mode));
      }
    }

    return results;
  }

  /**
   * Validate artifacts for a single stage
   * @param stage - Stage name to validate
   * @param mode - Pipeline mode to look up artifact definitions
   * @returns Validation result indicating which artifacts are present or missing
   */
  async validateStageArtifacts(stage: StageName, mode: PipelineMode): Promise<ValidationResult> {
    const artifactMap = this.getArtifactMap(mode);
    const entry = artifactMap.find((e) => e.stage === stage);

    if (!entry) {
      // No artifact definition for this stage — treat as valid
      return { valid: true, stage, missing: [], found: [] };
    }

    const missing: ArtifactSpec[] = [];
    const found: string[] = [];

    for (const artifact of entry.requiredArtifacts) {
      const matches = await this.resolveGlob(artifact.pathPattern);
      if (matches.length > 0) {
        found.push(...matches);
      } else if (artifact.required) {
        missing.push(artifact);
      }
    }

    return {
      valid: missing.length === 0,
      stage,
      missing,
      found,
    };
  }

  /**
   * Get the artifact map for a pipeline mode
   * @param mode - Pipeline mode
   * @returns The artifact definitions for the specified mode
   */
  getArtifactMap(mode: PipelineMode): readonly StageArtifactMap[] {
    switch (mode) {
      case 'greenfield':
        return GREENFIELD_ARTIFACTS;
      case 'enhancement':
        return ENHANCEMENT_ARTIFACTS;
      case 'import':
        return [];
    }
  }

  /**
   * Resolve a simple glob pattern relative to the project directory.
   *
   * Supports `*` as a single-segment wildcard (matches any directory entry).
   * Does not support `**`, `?`, or character classes.
   * @param pattern - Glob pattern with optional `*` segments
   * @returns Array of resolved file paths that match the pattern
   */
  private async resolveGlob(pattern: string): Promise<string[]> {
    const parts = pattern.split('/');
    return this.expandParts(this.projectDir, parts);
  }

  /**
   * Recursively expand path segments, replacing `*` with actual directory entries
   * @param dir - Current directory path being resolved
   * @param parts - Remaining path segments to process
   * @returns Array of resolved file paths matching the expanded pattern
   */
  private async expandParts(dir: string, parts: readonly string[]): Promise<string[]> {
    if (parts.length === 0) {
      // Terminal: check if the path exists
      try {
        await fs.access(dir);
        return [dir];
      } catch {
        return [];
      }
    }

    const [first, ...rest] = parts;

    if (first === '*') {
      // Wildcard: enumerate directory entries and recurse
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const results: string[] = [];

        for (const entry of entries) {
          const subResults = await this.expandParts(path.join(dir, entry.name), rest);
          results.push(...subResults);
        }

        return results;
      } catch {
        return [];
      }
    }

    // Literal segment — first is guaranteed non-undefined since parts.length > 0
    const segment: string = first ?? '';
    return this.expandParts(path.join(dir, segment), rest);
  }
}
