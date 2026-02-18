/**
 * Pipeline Runner Helper
 *
 * Provides utilities for running the complete AD-SDLC pipeline
 * in E2E tests, including document generation and issue creation.
 */

import * as fs from 'node:fs/promises';
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

// =============================================================================
// Resume / Start-From Helpers
// =============================================================================

/**
 * Options for running pipeline with resume capabilities
 */
export interface ResumeOptions {
  /** Session ID to resume from */
  resumeSessionId?: string;
  /** Stage to start from */
  startFromStage?: string;
  /** Pipeline mode override */
  mode?: 'greenfield' | 'enhancement' | 'import';
  /** Stages to treat as pre-completed */
  preCompletedStages?: readonly string[];
}

/**
 * Create a mock persisted session YAML for testing
 *
 * Writes a valid session YAML file to the pipeline state directory
 * that can be loaded by `loadPriorSession()`.
 *
 * @param projectDir - Project root directory
 * @param mode - Pipeline mode for the session
 * @param completedStages - Stage names to mark as completed
 * @param options - Additional session options
 * @returns Session ID of the created mock session
 */
export async function createMockSession(
  projectDir: string,
  mode: 'greenfield' | 'enhancement' | 'import',
  completedStages: readonly string[],
  options: {
    sessionId?: string;
    overallStatus?: string;
    failedStages?: ReadonlyArray<{ name: string; error: string }>;
  } = {}
): Promise<string> {
  const yaml = await import('js-yaml');

  const sessionId = options.sessionId ?? `mock-session-${Date.now()}`;
  const stateDir = path.join(projectDir, '.ad-sdlc', 'scratchpad', 'pipeline');
  await fs.mkdir(stateDir, { recursive: true });

  const stages: Array<Record<string, unknown>> = [];

  // Add completed stages
  for (const stageName of completedStages) {
    stages.push({
      name: stageName,
      agentType: `mock-${stageName}`,
      status: 'completed',
      durationMs: Math.floor(Math.random() * 5000) + 100,
      output: `Stage "${stageName}" completed`,
      artifacts: [],
      error: null,
      retryCount: 0,
    });
  }

  // Add failed stages
  if (options.failedStages) {
    for (const failed of options.failedStages) {
      stages.push({
        name: failed.name,
        agentType: `mock-${failed.name}`,
        status: 'failed',
        durationMs: Math.floor(Math.random() * 5000) + 100,
        output: '',
        artifacts: [],
        error: failed.error,
        retryCount: 3,
      });
    }
  }

  const overallStatus =
    options.overallStatus ??
    (options.failedStages && options.failedStages.length > 0 ? 'partial' : 'completed');

  const content = yaml.dump({
    pipelineId: sessionId,
    projectDir,
    userRequest: 'Mock session for testing',
    startedAt: new Date().toISOString(),
    mode,
    overallStatus,
    stages,
  });

  await fs.writeFile(path.join(stateDir, `${sessionId}.yaml`), content, 'utf-8');
  return sessionId;
}

/**
 * Place mock artifacts for specified greenfield pipeline stages
 *
 * Creates the expected directory/file structure so that `ArtifactValidator`
 * considers these stages as having valid artifacts.
 *
 * @param projectDir - Project root directory
 * @param stages - Stage names to create artifacts for
 * @param projectId - Project ID for artifact paths (default: 'mock-project')
 */
export async function placeMockArtifacts(
  projectDir: string,
  stages: readonly string[],
  projectId: string = 'mock-project'
): Promise<void> {
  for (const stage of stages) {
    switch (stage) {
      case 'initialization':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad'), { recursive: true });
        break;
      case 'collection':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'info', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(projectDir, '.ad-sdlc', 'scratchpad', 'info', projectId, 'collected_info.yaml'),
          'collected: true\n',
          'utf-8'
        );
        break;
      case 'prd_generation':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'documents', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(projectDir, '.ad-sdlc', 'scratchpad', 'documents', projectId, 'prd.md'),
          '# Mock PRD\n',
          'utf-8'
        );
        break;
      case 'srs_generation':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'documents', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(projectDir, '.ad-sdlc', 'scratchpad', 'documents', projectId, 'srs.md'),
          '# Mock SRS\n',
          'utf-8'
        );
        break;
      case 'sds_generation':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'documents', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(projectDir, '.ad-sdlc', 'scratchpad', 'documents', projectId, 'sds.md'),
          '# Mock SDS\n',
          'utf-8'
        );
        break;
      case 'issue_generation':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'issues'), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(projectDir, '.ad-sdlc', 'scratchpad', 'issues', 'issue_list.json'),
          '{"issues": []}\n',
          'utf-8'
        );
        break;
      // Enhancement mode artifacts
      case 'document_reading':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'analysis', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(
            projectDir,
            '.ad-sdlc',
            'scratchpad',
            'analysis',
            projectId,
            'document_state.yaml'
          ),
          'state: analyzed\n',
          'utf-8'
        );
        break;
      case 'codebase_analysis':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'analysis', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(
            projectDir,
            '.ad-sdlc',
            'scratchpad',
            'analysis',
            projectId,
            'architecture_overview.yaml'
          ),
          'overview: analyzed\n',
          'utf-8'
        );
        break;
      case 'code_reading':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'analysis', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(
            projectDir,
            '.ad-sdlc',
            'scratchpad',
            'analysis',
            projectId,
            'code_inventory.yaml'
          ),
          'inventory: read\n',
          'utf-8'
        );
        break;
      case 'doc_code_comparison':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'analysis', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(
            projectDir,
            '.ad-sdlc',
            'scratchpad',
            'analysis',
            projectId,
            'comparison_report.yaml'
          ),
          'comparison: done\n',
          'utf-8'
        );
        break;
      case 'impact_analysis':
        await fs.mkdir(path.join(projectDir, '.ad-sdlc', 'scratchpad', 'analysis', projectId), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(
            projectDir,
            '.ad-sdlc',
            'scratchpad',
            'analysis',
            projectId,
            'impact_report.yaml'
          ),
          'impact: assessed\n',
          'utf-8'
        );
        break;
      // prd_update, srs_update, sds_update use same artifacts as prd/srs/sds_generation
      case 'prd_update':
        await placeMockArtifacts(projectDir, ['prd_generation'], projectId);
        break;
      case 'srs_update':
        await placeMockArtifacts(projectDir, ['srs_generation'], projectId);
        break;
      case 'sds_update':
        await placeMockArtifacts(projectDir, ['sds_generation'], projectId);
        break;
      // Stages without artifact definitions (mode_detection, repo_detection, etc.) — no-op
      default:
        break;
    }
  }
}
