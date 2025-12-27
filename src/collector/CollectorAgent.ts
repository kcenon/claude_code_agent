/**
 * CollectorAgent - Main agent for information collection
 *
 * Orchestrates the collection of information from various sources,
 * extracts structured data, handles clarification loops, and
 * generates YAML output for downstream agents.
 */

import { randomUUID } from 'node:crypto';
import { getScratchpad, type CollectedInfo } from '../scratchpad/index.js';
import { InputParser, type InputParserOptions } from './InputParser.js';
import { InformationExtractor, type InformationExtractorOptions } from './InformationExtractor.js';
import type {
  InputSource,
  CollectorAgentConfig,
  CollectionResult,
  CollectionStats,
  CollectionSession,
  ClarificationQuestion,
  ClarificationAnswer,
  ExtractionResult,
} from './types.js';
import {
  ProjectInitError,
  MissingInformationError,
  SessionStateError,
} from './errors.js';

/**
 * Default configuration for CollectorAgent
 */
const DEFAULT_CONFIG: Required<CollectorAgentConfig> = {
  confidenceThreshold: 0.7,
  maxQuestionsPerRound: 5,
  skipClarificationIfConfident: false,
  defaultPriority: 'P2',
  detectLanguage: true,
  scratchpadBasePath: '.ad-sdlc/scratchpad',
};

/**
 * CollectorAgent class for managing information collection workflow
 */
export class CollectorAgent {
  private readonly config: Required<CollectorAgentConfig>;
  private readonly inputParser: InputParser;
  private readonly extractor: InformationExtractor;
  private session: CollectionSession | null = null;

  constructor(config: CollectorAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const parserOptions: InputParserOptions = {};
    const extractorOptions: InformationExtractorOptions = {
      defaultPriority: this.config.defaultPriority,
      minConfidence: 0.3,
      maxQuestions: this.config.maxQuestionsPerRound,
    };

    this.inputParser = new InputParser(parserOptions);
    this.extractor = new InformationExtractor(extractorOptions);
  }

  /**
   * Start a new collection session
   *
   * @param projectName - Initial project name (optional)
   * @returns The created session
   */
  public async startSession(projectName?: string): Promise<CollectionSession> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const projectId = await scratchpad.generateProjectId();
    const now = new Date().toISOString();

    try {
      await scratchpad.initializeProject(projectId, projectName ?? `Project-${projectId}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new ProjectInitError(projectId, error.message);
      }
      throw error;
    }

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'collecting',
      sources: [],
      extraction: {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        constraints: [],
        assumptions: [],
        dependencies: [],
        clarificationQuestions: [],
        overallConfidence: 0,
        warnings: [],
      },
      pendingQuestions: [],
      answeredQuestions: [],
      startedAt: now,
      updatedAt: now,
    };

    return this.session;
  }

  /**
   * Get the current session
   *
   * @returns Current session or null if none active
   */
  public getSession(): CollectionSession | null {
    return this.session;
  }

  /**
   * Add text input to the current session
   *
   * @param text - Text content to add
   * @param description - Optional description
   * @returns Updated session
   */
  public addTextInput(text: string, description?: string): CollectionSession {
    this.ensureSession('collecting');

    const source = this.inputParser.parseText(text, description);
    this.addSource(source);

    return this.session!;
  }

  /**
   * Add a file input to the current session
   *
   * @param filePath - Path to the file
   * @returns Promise resolving to updated session
   */
  public async addFileInput(filePath: string): Promise<CollectionSession> {
    this.ensureSession('collecting');

    const source = await this.inputParser.parseFile(filePath);
    this.addSource(source);

    return this.session!;
  }

  /**
   * Add a URL input to the current session
   *
   * @param url - URL to fetch
   * @returns Promise resolving to updated session
   */
  public async addUrlInput(url: string): Promise<CollectionSession> {
    this.ensureSession('collecting');

    const source = await this.inputParser.parseUrl(url);
    this.addSource(source);

    return this.session!;
  }

  /**
   * Add an input source to the session
   *
   * @param source - Input source to add
   */
  private addSource(source: InputSource): void {
    this.session = {
      ...this.session!,
      sources: [...this.session!.sources, source],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Process all collected inputs and extract information
   *
   * @returns ExtractionResult with all extracted information
   */
  public processInputs(): ExtractionResult {
    this.ensureSession('collecting');

    if (this.session!.sources.length === 0) {
      throw new MissingInformationError(['No input sources provided']);
    }

    const parsed = this.inputParser.combineInputs(this.session!.sources);
    const extraction = this.extractor.extract(parsed);

    // Update session with extraction results
    this.session = {
      ...this.session!,
      extraction,
      pendingQuestions: extraction.clarificationQuestions,
      status: extraction.clarificationQuestions.length > 0 ? 'clarifying' : 'completed',
      updatedAt: new Date().toISOString(),
    };

    return extraction;
  }

  /**
   * Get pending clarification questions
   *
   * @returns Array of pending questions
   */
  public getPendingQuestions(): readonly ClarificationQuestion[] {
    if (this.session === null) {
      return [];
    }
    return this.session.pendingQuestions;
  }

  /**
   * Submit an answer to a clarification question
   *
   * @param questionId - ID of the question being answered
   * @param answer - The answer
   * @returns Updated session
   */
  public answerQuestion(questionId: string, answer: string): CollectionSession {
    this.ensureSession('clarifying');

    const question = this.session!.pendingQuestions.find((q) => q.id === questionId);
    if (question === undefined) {
      throw new Error(`Question not found: ${questionId}`);
    }

    const clarificationAnswer: ClarificationAnswer = {
      questionId,
      answer,
      answeredAt: new Date().toISOString(),
    };

    const remainingQuestions = this.session!.pendingQuestions.filter((q) => q.id !== questionId);

    this.session = {
      ...this.session!,
      pendingQuestions: remainingQuestions,
      answeredQuestions: [...this.session!.answeredQuestions, clarificationAnswer],
      status: remainingQuestions.length > 0 ? 'clarifying' : 'completed',
      updatedAt: new Date().toISOString(),
    };

    return this.session;
  }

  /**
   * Skip all remaining clarification questions
   *
   * @returns Updated session
   */
  public skipClarification(): CollectionSession {
    this.ensureSession('clarifying');

    this.session = {
      ...this.session!,
      pendingQuestions: [],
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };

    return this.session;
  }

  /**
   * Finalize collection and generate output
   *
   * @param projectName - Project name (required if not detected)
   * @param projectDescription - Project description (required if not detected)
   * @returns CollectionResult with output path and stats
   */
  public async finalize(
    projectName?: string,
    projectDescription?: string
  ): Promise<CollectionResult> {
    if (this.session === null) {
      throw new SessionStateError('no session', 'active', 'finalize');
    }

    if (this.session.status === 'collecting' && this.session.sources.length > 0) {
      this.processInputs();
    }

    const startTime = Date.now();
    const extraction = this.session.extraction;

    // Determine final project name and description
    const finalName = projectName ??
      extraction.projectName ??
      this.getAnsweredValue('project name') ??
      `Project-${this.session.projectId}`;

    const finalDescription = projectDescription ??
      extraction.projectDescription ??
      this.getAnsweredValue('project description') ??
      'Project collected by Collector Agent';

    // Build CollectedInfo
    const collectedInfo = this.buildCollectedInfo(finalName, finalDescription);

    // Write to scratchpad
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const outputPath = scratchpad.getCollectedInfoPath(this.session.projectId);
    await scratchpad.writeYaml(outputPath, collectedInfo);

    const processingTimeMs = Date.now() - startTime;

    // Calculate stats
    const stats: CollectionStats = {
      sourcesProcessed: this.session.sources.length,
      functionalRequirements: extraction.functionalRequirements.length,
      nonFunctionalRequirements: extraction.nonFunctionalRequirements.length,
      constraints: extraction.constraints.length,
      assumptions: extraction.assumptions.length,
      dependencies: extraction.dependencies.length,
      questionsAsked: extraction.clarificationQuestions.length,
      questionsAnswered: this.session.answeredQuestions.length,
      processingTimeMs,
    };

    return {
      success: true,
      projectId: this.session.projectId,
      outputPath,
      collectedInfo,
      remainingQuestions: this.session.pendingQuestions,
      stats,
    };
  }

  /**
   * Get an answered value by searching question text
   */
  private getAnsweredValue(searchText: string): string | undefined {
    const answer = this.session?.answeredQuestions.find((a) => {
      const question = this.session?.extraction.clarificationQuestions.find(
        (q) => q.id === a.questionId
      );
      return question?.question.toLowerCase().includes(searchText);
    });
    return answer?.answer;
  }

  /**
   * Build CollectedInfo from session data
   */
  private buildCollectedInfo(name: string, description: string): CollectedInfo {
    const now = new Date().toISOString();
    const extraction = this.session!.extraction;

    return {
      schemaVersion: '1.0.0',
      projectId: this.session!.projectId,
      status: 'completed',
      project: {
        name,
        description,
      },
      requirements: {
        functional: extraction.functionalRequirements.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: 'proposed' as const,
          acceptanceCriteria: [],
          dependencies: [],
          source: r.source,
        })),
        nonFunctional: extraction.nonFunctionalRequirements.map((r) => ({
          id: r.id,
          category: r.nfrCategory ?? 'performance',
          title: r.title,
          description: r.description,
          priority: r.priority,
        })),
      },
      constraints: extraction.constraints.map((c) => ({
        id: c.id,
        description: c.description,
        reason: c.reason,
        type: c.type,
      })),
      assumptions: extraction.assumptions.map((a) => ({
        id: a.id,
        description: a.description,
        validated: false,
        riskIfWrong: a.riskIfWrong,
      })),
      dependencies: extraction.dependencies.map((d) => ({
        name: d.name,
        type: d.type,
        version: d.version,
        purpose: d.purpose,
        required: d.required,
      })),
      clarifications: this.session!.answeredQuestions.map((a) => {
        const question = this.session!.extraction.clarificationQuestions.find(
          (q) => q.id === a.questionId
        );
        // Filter to match schema category (exclude 'scope')
        const category = question?.category ?? 'requirement';
        const validCategory = category === 'scope' ? 'requirement' : category;
        return {
          id: a.questionId,
          category: validCategory as 'requirement' | 'constraint' | 'assumption' | 'priority',
          question: question?.question ?? '',
          required: question?.required ?? false,
          answer: a.answer,
          timestamp: a.answeredAt,
        };
      }),
      sources: this.session!.sources.map((s) => ({
        type: s.type === 'text' ? 'conversation' : s.type,
        reference: s.reference,
        extractedAt: s.extractedAt,
        summary: s.summary,
      })),
      createdAt: this.session!.startedAt,
      updatedAt: now,
      completedAt: now,
    };
  }

  /**
   * Ensure there is an active session in the expected state
   */
  private ensureSession(expectedState: 'collecting' | 'clarifying'): void {
    if (this.session === null) {
      throw new SessionStateError('no session', expectedState, 'perform this action');
    }

    if (expectedState === 'collecting' && this.session.status === 'completed') {
      throw new SessionStateError(this.session.status, expectedState, 'add more inputs');
    }

    if (expectedState === 'clarifying' && this.session.status !== 'clarifying') {
      throw new SessionStateError(this.session.status, expectedState, 'answer questions');
    }
  }

  /**
   * Reset the agent, clearing the current session
   */
  public reset(): void {
    this.session = null;
  }

  /**
   * Convenience method: Collect from text and finalize in one call
   *
   * @param text - Text content to collect from
   * @param options - Optional project name and description
   * @returns CollectionResult
   */
  public async collectFromText(
    text: string,
    options?: { projectName?: string; projectDescription?: string }
  ): Promise<CollectionResult> {
    await this.startSession(options?.projectName);
    this.addTextInput(text);
    this.processInputs();

    // Skip clarification if confidence is high enough
    if (
      this.config.skipClarificationIfConfident &&
      this.session!.extraction.overallConfidence >= this.config.confidenceThreshold
    ) {
      this.skipClarification();
    }

    return this.finalize(options?.projectName, options?.projectDescription);
  }

  /**
   * Convenience method: Collect from file and finalize in one call
   *
   * @param filePath - Path to file
   * @param options - Optional project name and description
   * @returns CollectionResult
   */
  public async collectFromFile(
    filePath: string,
    options?: { projectName?: string; projectDescription?: string }
  ): Promise<CollectionResult> {
    await this.startSession(options?.projectName);
    await this.addFileInput(filePath);
    this.processInputs();

    if (
      this.config.skipClarificationIfConfident &&
      this.session!.extraction.overallConfidence >= this.config.confidenceThreshold
    ) {
      this.skipClarification();
    }

    return this.finalize(options?.projectName, options?.projectDescription);
  }
}

/**
 * Singleton instance for global access
 */
let globalCollectorAgent: CollectorAgent | null = null;

/**
 * Get or create the global CollectorAgent instance
 *
 * @param config - Configuration options
 * @returns The global CollectorAgent instance
 */
export function getCollectorAgent(config?: CollectorAgentConfig): CollectorAgent {
  if (globalCollectorAgent === null) {
    globalCollectorAgent = new CollectorAgent(config);
  }
  return globalCollectorAgent;
}

/**
 * Reset the global CollectorAgent instance (for testing)
 */
export function resetCollectorAgent(): void {
  if (globalCollectorAgent !== null) {
    globalCollectorAgent.reset();
    globalCollectorAgent = null;
  }
}
