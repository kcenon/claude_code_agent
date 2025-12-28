/**
 * Pipeline Runner Helper
 *
 * Provides utilities for running the complete AD-SDLC pipeline
 * in E2E tests, including document generation and issue creation.
 */

import * as path from 'node:path';
import type { TestEnvironment } from './test-environment.js';
import type { CollectionResult } from '../../../src/collector/types.js';
import type { PRDGenerationResult } from '../../../src/prd-writer/types.js';
import type { SRSGenerationResult } from '../../../src/srs-writer/types.js';
import type { SDSGenerationResult } from '../../../src/sds-writer/types.js';
import type { IssueGenerationResult } from '../../../src/issue-generator/types.js';

/**
 * Pipeline execution options
 */
export interface PipelineOptions {
  /** Skip clarification during collection */
  skipClarification?: boolean;
  /** Generate issues from SDS */
  generateIssues?: boolean;
  /** Custom project name */
  projectName?: string;
  /** Custom project description */
  projectDescription?: string;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  /** Whether the pipeline succeeded */
  success: boolean;
  /** Project ID */
  projectId: string;
  /** Collection result */
  collection?: CollectionResult;
  /** PRD generation result */
  prd?: PRDGenerationResult;
  /** SRS generation result */
  srs?: SRSGenerationResult;
  /** SDS generation result */
  sds?: SDSGenerationResult;
  /** Issue generation result */
  issues?: IssueGenerationResult;
  /** Total processing time in ms */
  totalTimeMs: number;
  /** Timing breakdown by stage */
  timing: {
    collection?: number;
    prd?: number;
    srs?: number;
    sds?: number;
    issues?: number;
  };
  /** Error if pipeline failed */
  error?: Error;
}

/**
 * Document pipeline stage result
 */
export interface StageResult<T> {
  success: boolean;
  result?: T;
  timeMs: number;
  error?: Error;
}

/**
 * Run the complete pipeline from input text to issues
 */
export async function runPipeline(
  env: TestEnvironment,
  inputText: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const timing: PipelineResult['timing'] = {};

  try {
    // Stage 1: Collection
    const collectionStart = Date.now();
    const collection = await runCollectionStage(env, inputText, options);
    timing.collection = Date.now() - collectionStart;

    if (!collection.success || !collection.result) {
      return {
        success: false,
        projectId: '',
        totalTimeMs: Date.now() - startTime,
        timing,
        error: collection.error,
      };
    }

    const projectId = collection.result.projectId;

    // Stage 2: PRD Generation
    const prdStart = Date.now();
    const prd = await runPRDStage(env, projectId);
    timing.prd = Date.now() - prdStart;

    if (!prd.success) {
      return {
        success: false,
        projectId,
        collection: collection.result,
        totalTimeMs: Date.now() - startTime,
        timing,
        error: prd.error,
      };
    }

    // Stage 3: SRS Generation
    const srsStart = Date.now();
    const srs = await runSRSStage(env, projectId);
    timing.srs = Date.now() - srsStart;

    if (!srs.success) {
      return {
        success: false,
        projectId,
        collection: collection.result,
        prd: prd.result,
        totalTimeMs: Date.now() - startTime,
        timing,
        error: srs.error,
      };
    }

    // Stage 4: SDS Generation
    const sdsStart = Date.now();
    const sds = await runSDSStage(env, projectId);
    timing.sds = Date.now() - sdsStart;

    if (!sds.success) {
      return {
        success: false,
        projectId,
        collection: collection.result,
        prd: prd.result,
        srs: srs.result,
        totalTimeMs: Date.now() - startTime,
        timing,
        error: sds.error,
      };
    }

    // Stage 5: Issue Generation (optional)
    let issues: StageResult<IssueGenerationResult> | undefined;
    if (options.generateIssues !== false) {
      const issuesStart = Date.now();
      issues = await runIssueGenerationStage(env, projectId);
      timing.issues = Date.now() - issuesStart;
    }

    return {
      success: true,
      projectId,
      collection: collection.result,
      prd: prd.result,
      srs: srs.result,
      sds: sds.result,
      issues: issues?.result,
      totalTimeMs: Date.now() - startTime,
      timing,
    };
  } catch (error) {
    return {
      success: false,
      projectId: '',
      totalTimeMs: Date.now() - startTime,
      timing,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run only the collection stage
 */
export async function runCollectionStage(
  env: TestEnvironment,
  inputText: string,
  options: PipelineOptions = {}
): Promise<StageResult<CollectionResult>> {
  const startTime = Date.now();

  try {
    const { CollectorAgent } = await import('../../../src/collector/index.js');

    const collector = new CollectorAgent({
      scratchpadBasePath: env.scratchpadPath,
      skipClarificationIfConfident: options.skipClarification ?? true,
      confidenceThreshold: 0.5,
    });

    const result = await collector.collectFromText(inputText, {
      projectName: options.projectName,
      projectDescription: options.projectDescription,
    });

    return {
      success: result.success,
      result,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      timeMs: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run only the PRD generation stage
 */
export async function runPRDStage(
  env: TestEnvironment,
  projectId: string
): Promise<StageResult<PRDGenerationResult>> {
  const startTime = Date.now();

  try {
    const { PRDWriterAgent } = await import('../../../src/prd-writer/index.js');

    const prdWriter = new PRDWriterAgent({
      scratchpadBasePath: env.scratchpadPath,
      publicDocsPath: path.join(env.publicDocsPath, 'prd'),
      failOnCriticalGaps: false,
    });

    const result = await prdWriter.generateFromProject(projectId);

    return {
      success: result.success,
      result,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      timeMs: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run only the SRS generation stage
 */
export async function runSRSStage(
  env: TestEnvironment,
  projectId: string
): Promise<StageResult<SRSGenerationResult>> {
  const startTime = Date.now();

  try {
    const { SRSWriterAgent } = await import('../../../src/srs-writer/index.js');

    const srsWriter = new SRSWriterAgent({
      scratchpadBasePath: env.scratchpadPath,
      publicDocsPath: path.join(env.publicDocsPath, 'srs'),
      failOnLowCoverage: false,
    });

    const result = await srsWriter.generateFromProject(projectId);

    return {
      success: result.success,
      result,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      timeMs: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run only the SDS generation stage
 */
export async function runSDSStage(
  env: TestEnvironment,
  projectId: string
): Promise<StageResult<SDSGenerationResult>> {
  const startTime = Date.now();

  try {
    const { SDSWriterAgent } = await import('../../../src/sds-writer/index.js');

    const sdsWriter = new SDSWriterAgent({
      scratchpadBasePath: env.scratchpadPath,
      publicDocsPath: path.join(env.publicDocsPath, 'sds'),
      failOnLowCoverage: false,
    });

    const result = await sdsWriter.generateFromProject(projectId);

    return {
      success: result.success,
      result,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      timeMs: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run only the issue generation stage
 */
export async function runIssueGenerationStage(
  env: TestEnvironment,
  projectId: string
): Promise<StageResult<IssueGenerationResult>> {
  const startTime = Date.now();

  try {
    const { IssueGenerator } = await import('../../../src/issue-generator/index.js');

    const sdsPath = path.join(env.scratchpadPath, 'documents', projectId, 'sds.md');

    const issueGenerator = new IssueGenerator({
      outputPath: path.join(env.scratchpadPath, 'issues'),
      validateSDS: true,
    });

    const result = await issueGenerator.generateFromFile(sdsPath, projectId);

    return {
      success: true,
      result,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      timeMs: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run document pipeline only (Collection → PRD → SRS → SDS)
 */
export async function runDocumentPipeline(
  env: TestEnvironment,
  inputText: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  return runPipeline(env, inputText, { ...options, generateIssues: false });
}
