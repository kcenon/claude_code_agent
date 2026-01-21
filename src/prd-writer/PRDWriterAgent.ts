/**
 * PRDWriterAgent - Main agent for PRD document generation
 *
 * Orchestrates the generation of Product Requirements Documents
 * from collected information, including gap analysis,
 * consistency checking, and template-based generation.
 *
 * Implements IAgent interface for AgentFactory integration
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getScratchpad, type CollectedInfo } from '../scratchpad/index.js';
import { GapAnalyzer, type GapAnalyzerOptions } from './GapAnalyzer.js';
import { ConsistencyChecker, type ConsistencyCheckerOptions } from './ConsistencyChecker.js';
import { TemplateProcessor, type TemplateProcessorOptions } from './TemplateProcessor.js';
import { QualityMetricsCalculator } from './QualityMetricsCalculator.js';
import type {
  PRDWriterAgentConfig,
  PRDGenerationSession,
  PRDGenerationResult,
  PRDGenerationStats,
  GeneratedPRD,
  PRDMetadata,
  GapAnalysisResult,
  ConsistencyCheckResult,
  QualityMetrics,
} from './types.js';
import {
  CollectedInfoNotFoundError,
  CriticalGapsError,
  GenerationError,
  FileWriteError,
  SessionStateError,
} from './errors.js';

/**
 * Default configuration for PRDWriterAgent
 */
const DEFAULT_CONFIG: Required<PRDWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  templatePath: '.ad-sdlc/templates/prd-template.md',
  failOnCriticalGaps: false,
  autoSuggestPriorities: true,
  publicDocsPath: 'docs/prd',
  includeGapAnalysis: true,
};

/**
 * Agent ID for PRDWriterAgent used in AgentFactory
 */
export const PRD_WRITER_AGENT_ID = 'prd-writer-agent';

/**
 * PRDWriterAgent class for generating PRD documents
 * Implements IAgent interface for unified agent instantiation through AgentFactory
 */
export class PRDWriterAgent implements IAgent {
  public readonly agentId = PRD_WRITER_AGENT_ID;
  public readonly name = 'PRD Writer Agent';

  private readonly config: Required<PRDWriterAgentConfig>;
  private readonly gapAnalyzer: GapAnalyzer;
  private readonly consistencyChecker: ConsistencyChecker;
  private readonly templateProcessor: TemplateProcessor;
  private readonly qualityMetricsCalculator: QualityMetricsCalculator;
  private session: PRDGenerationSession | null = null;
  private initialized = false;

  constructor(config: PRDWriterAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const gapOptions: GapAnalyzerOptions = {
      minFunctionalRequirements: 1,
      minAcceptanceCriteria: 1,
      requireUserStories: false,
      requireNFRMetrics: true,
    };

    const consistencyOptions: ConsistencyCheckerOptions = {
      maxP0Percentage: 30,
      minLowPriorityPercentage: 20,
      checkBidirectionalDeps: true,
    };

    const templateOptions: TemplateProcessorOptions = {
      templatePath: this.config.templatePath,
      removeUnsubstituted: false,
    };

    this.gapAnalyzer = new GapAnalyzer(gapOptions);
    this.consistencyChecker = new ConsistencyChecker(consistencyOptions);
    this.templateProcessor = new TemplateProcessor(templateOptions);
    this.qualityMetricsCalculator = new QualityMetricsCalculator();
  }

  /**
   * Initialize the agent (IAgent interface)
   * Called after construction, before first use
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // PRDWriterAgent doesn't require async initialization
    // but the interface requires this method
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources (IAgent interface)
   * Called when the agent is no longer needed
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.reset();
    this.initialized = false;
  }

  /**
   * Get the current session
   *
   * @returns Current session or null if none active
   */
  public getSession(): PRDGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new PRD generation session for a project
   *
   * @param projectId - Project identifier
   * @returns The created session
   */
  public async startSession(projectId: string): Promise<PRDGenerationSession> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const collectedInfoPath = scratchpad.getCollectedInfoPath(projectId);

    // Read collected info
    const collectedInfo = await scratchpad.readYaml<CollectedInfo>(collectedInfoPath, {
      allowMissing: false,
    });

    if (collectedInfo === null) {
      throw new CollectedInfoNotFoundError(projectId, collectedInfoPath);
    }

    const now = new Date().toISOString();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      collectedInfo,
      startedAt: now,
      updatedAt: now,
    };

    return this.session;
  }

  /**
   * Analyze the collected info for gaps
   *
   * @returns Gap analysis result
   */
  public analyzeGaps(): GapAnalysisResult {
    const session = this.ensureSession(['pending', 'analyzing']);

    this.session = {
      ...session,
      status: 'analyzing',
      updatedAt: new Date().toISOString(),
    };

    const gapAnalysis = this.gapAnalyzer.analyze(session.collectedInfo);

    this.session = {
      ...this.session,
      gapAnalysis,
      updatedAt: new Date().toISOString(),
    };

    return gapAnalysis;
  }

  /**
   * Check the collected info for consistency
   *
   * @returns Consistency check result
   */
  public checkConsistency(): ConsistencyCheckResult {
    const session = this.ensureSession(['pending', 'analyzing']);

    const consistencyCheck = this.consistencyChecker.check(session.collectedInfo);

    this.session = {
      ...session,
      consistencyCheck,
      updatedAt: new Date().toISOString(),
    };

    return consistencyCheck;
  }

  /**
   * Generate the PRD document
   *
   * @returns Generated PRD
   */
  public generate(): GeneratedPRD {
    const session = this.ensureSession(['pending', 'analyzing']);

    this.session = {
      ...session,
      status: 'generating',
      updatedAt: new Date().toISOString(),
    };

    // Perform gap analysis if not done
    const gapAnalysis = session.gapAnalysis ?? this.gapAnalyzer.analyze(session.collectedInfo);

    // Check for critical gaps if configured to fail
    if (this.config.failOnCriticalGaps && gapAnalysis.criticalGaps.length > 0) {
      const descriptions = gapAnalysis.criticalGaps.map((g) => g.description);
      this.session = {
        ...session,
        status: 'failed',
        errorMessage: `Critical gaps found: ${descriptions.join('; ')}`,
        updatedAt: new Date().toISOString(),
      };
      throw new CriticalGapsError(gapAnalysis.criticalGaps.length, descriptions);
    }

    // Perform consistency check if not done
    const consistencyCheck =
      session.consistencyCheck ?? this.consistencyChecker.check(session.collectedInfo);

    // Calculate quality metrics
    const qualityMetrics = this.qualityMetricsCalculator.calculate(
      session.collectedInfo,
      gapAnalysis,
      consistencyCheck
    );

    // Create metadata
    const metadata = this.createMetadata(session);

    // Generate PRD content
    let content: string;
    try {
      // Try template-based generation first
      const templateResult = this.templateProcessor.process(session.collectedInfo, metadata);
      content = templateResult.content;
    } catch {
      // Fall back to template-less generation
      content = this.templateProcessor.generateWithoutTemplate(session.collectedInfo, metadata);
    }

    const generatedPRD: GeneratedPRD = {
      metadata,
      content,
      gapAnalysis,
      consistencyCheck,
      qualityMetrics,
    };

    this.session = {
      ...session,
      status: 'completed',
      generatedPRD,
      gapAnalysis,
      consistencyCheck,
      updatedAt: new Date().toISOString(),
    };

    return generatedPRD;
  }

  /**
   * Finalize the PRD generation and save to files
   *
   * @returns PRD generation result
   */
  public async finalize(): Promise<PRDGenerationResult> {
    const startTime = Date.now();
    let session = this.ensureSession(['pending', 'analyzing', 'generating', 'completed']);

    // Generate if not already done
    let generatedPRD: GeneratedPRD;
    if (session.status !== 'completed' || session.generatedPRD === undefined) {
      generatedPRD = this.generate();
      if (this.session === null) {
        throw new SessionStateError('no session', 'active', 'finalize after generation');
      }
      session = this.session;
    } else {
      generatedPRD = session.generatedPRD;
    }

    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });

    // Save to scratchpad
    const scratchpadPath = scratchpad.getDocumentPath(session.projectId, 'prd');
    try {
      await scratchpad.writeMarkdown(scratchpadPath, generatedPRD.content);
    } catch (error) {
      throw new FileWriteError(scratchpadPath, String(error));
    }

    // Save to public docs
    const publicPath = path.join(this.config.publicDocsPath, `PRD-${session.projectId}.md`);
    try {
      await this.ensureDir(path.dirname(publicPath));
      await fs.promises.writeFile(publicPath, generatedPRD.content, 'utf8');
    } catch (error) {
      throw new FileWriteError(publicPath, String(error));
    }

    const processingTimeMs = Date.now() - startTime;

    // Calculate stats
    const stats = this.calculateStats(session, generatedPRD, processingTimeMs);

    return {
      success: true,
      projectId: session.projectId,
      scratchpadPath,
      publicPath,
      generatedPRD,
      stats,
    };
  }

  /**
   * Generate PRD from project ID in one call
   *
   * @param projectId - Project identifier
   * @returns PRD generation result
   */
  public async generateFromProject(projectId: string): Promise<PRDGenerationResult> {
    await this.startSession(projectId);
    this.analyzeGaps();
    this.checkConsistency();
    return this.finalize();
  }

  /**
   * Generate PRD directly from collected info
   *
   * @param collectedInfo - The collected information
   * @returns PRD generation result
   */
  public async generateFromCollectedInfo(
    collectedInfo: CollectedInfo
  ): Promise<PRDGenerationResult> {
    const startTime = Date.now();
    const now = new Date().toISOString();

    // Create session directly
    this.session = {
      sessionId: randomUUID(),
      projectId: collectedInfo.projectId,
      status: 'pending',
      collectedInfo,
      startedAt: now,
      updatedAt: now,
    };

    // Perform analysis
    this.analyzeGaps();
    this.checkConsistency();

    // Generate
    const generatedPRD = this.generate();

    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });

    // Save to scratchpad
    const scratchpadPath = scratchpad.getDocumentPath(collectedInfo.projectId, 'prd');
    try {
      await scratchpad.writeMarkdown(scratchpadPath, generatedPRD.content);
    } catch (error) {
      throw new FileWriteError(scratchpadPath, String(error));
    }

    // Save to public docs
    const publicPath = path.join(this.config.publicDocsPath, `PRD-${collectedInfo.projectId}.md`);
    try {
      await this.ensureDir(path.dirname(publicPath));
      await fs.promises.writeFile(publicPath, generatedPRD.content, 'utf8');
    } catch (error) {
      throw new FileWriteError(publicPath, String(error));
    }

    const processingTimeMs = Date.now() - startTime;

    // Calculate stats
    if (this.session === null) {
      throw new SessionStateError('no session', 'active', 'calculate stats');
    }
    const stats = this.calculateStats(this.session, generatedPRD, processingTimeMs);

    return {
      success: true,
      projectId: collectedInfo.projectId,
      scratchpadPath,
      publicPath,
      generatedPRD,
      stats,
    };
  }

  /**
   * Reset the agent, clearing the current session
   */
  public reset(): void {
    this.session = null;
  }

  /**
   * Create PRD metadata
   */
  private createMetadata(session: PRDGenerationSession): PRDMetadata {
    const now = new Date().toISOString();
    return {
      documentId: `PRD-${session.projectId}`,
      version: '1.0.0',
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
      projectId: session.projectId,
      productName: session.collectedInfo.project.name,
    };
  }

  /**
   * Calculate generation statistics
   */
  private calculateStats(
    session: PRDGenerationSession,
    generatedPRD: GeneratedPRD,
    processingTimeMs: number
  ): PRDGenerationStats {
    const info = session.collectedInfo;
    return {
      functionalRequirements: info.requirements?.functional?.length ?? 0,
      nonFunctionalRequirements: info.requirements?.nonFunctional?.length ?? 0,
      constraints: info.constraints?.length ?? 0,
      assumptions: info.assumptions?.length ?? 0,
      dependencies: info.dependencies?.length ?? 0,
      gapsFound: generatedPRD.gapAnalysis.totalGaps,
      consistencyIssues: generatedPRD.consistencyCheck.issues.length,
      completenessScore: generatedPRD.gapAnalysis.completenessScore,
      qualityMetrics: generatedPRD.qualityMetrics,
      processingTimeMs,
    };
  }

  /**
   * Calculate quality metrics for the current session
   *
   * @returns Quality metrics
   */
  public calculateQualityMetrics(): QualityMetrics {
    const session = this.ensureSession(['pending', 'analyzing', 'generating', 'completed']);

    const gapAnalysis = session.gapAnalysis ?? this.gapAnalyzer.analyze(session.collectedInfo);
    const consistencyCheck =
      session.consistencyCheck ?? this.consistencyChecker.check(session.collectedInfo);

    return this.qualityMetricsCalculator.calculate(
      session.collectedInfo,
      gapAnalysis,
      consistencyCheck
    );
  }

  /**
   * Ensure there is an active session in the expected state
   */
  private ensureSession(
    expectedStates: readonly ('pending' | 'analyzing' | 'generating' | 'completed')[]
  ): PRDGenerationSession {
    if (this.session === null) {
      throw new SessionStateError(
        'no session',
        expectedStates[0] ?? 'active',
        'perform this action'
      );
    }

    if (this.session.status === 'failed') {
      throw new GenerationError(
        this.session.projectId,
        'session',
        this.session.errorMessage ?? 'Session failed'
      );
    }

    // Allow any of the expected states - currentStatus is narrowed after 'failed' check
    const currentStatus = this.session.status;
    if (!expectedStates.includes(currentStatus)) {
      throw new SessionStateError(
        currentStatus,
        expectedStates.join(' or '),
        'perform this action'
      );
    }

    return this.session;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Singleton instance for global access
 */
let globalPRDWriterAgent: PRDWriterAgent | null = null;

/**
 * Get or create the global PRDWriterAgent instance
 *
 * @param config - Configuration options
 * @returns The global PRDWriterAgent instance
 */
export function getPRDWriterAgent(config?: PRDWriterAgentConfig): PRDWriterAgent {
  if (globalPRDWriterAgent === null) {
    globalPRDWriterAgent = new PRDWriterAgent(config);
  }
  return globalPRDWriterAgent;
}

/**
 * Reset the global PRDWriterAgent instance (for testing)
 */
export function resetPRDWriterAgent(): void {
  if (globalPRDWriterAgent !== null) {
    globalPRDWriterAgent.reset();
    globalPRDWriterAgent = null;
  }
}
