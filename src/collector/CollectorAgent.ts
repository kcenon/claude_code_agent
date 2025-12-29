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
import { ProjectInitError, MissingInformationError, SessionStateError } from './errors.js';

/**
 * Default configuration for CollectorAgent
 * Note: maxQuestionsPerRound is set to 5 per issue #13 requirements
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
    return this.addSource(source);
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
    return this.addSource(source);
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
    return this.addSource(source);
  }

  /**
   * Add an input source to the session
   *
   * @param source - Input source to add
   * @returns The updated session
   */
  private addSource(source: InputSource): CollectionSession {
    const session = this.ensureSession('collecting');
    this.session = {
      ...session,
      sources: [...session.sources, source],
      updatedAt: new Date().toISOString(),
    };
    return this.session;
  }

  /**
   * Process all collected inputs and extract information
   *
   * @returns ExtractionResult with all extracted information
   */
  public processInputs(): ExtractionResult {
    const session = this.ensureSession('collecting');

    if (session.sources.length === 0) {
      throw new MissingInformationError(['No input sources provided']);
    }

    const parsed = this.inputParser.combineInputs(session.sources);
    const extraction = this.extractor.extract(parsed);

    // Update session with extraction results
    this.session = {
      ...session,
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
    const session = this.ensureSession('clarifying');

    const question = session.pendingQuestions.find((q) => q.id === questionId);
    if (question === undefined) {
      throw new Error(`Question not found: ${questionId}`);
    }

    const clarificationAnswer: ClarificationAnswer = {
      questionId,
      answer,
      answeredAt: new Date().toISOString(),
    };

    const remainingQuestions = session.pendingQuestions.filter((q) => q.id !== questionId);

    this.session = {
      ...session,
      pendingQuestions: remainingQuestions,
      answeredQuestions: [...session.answeredQuestions, clarificationAnswer],
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
    const session = this.ensureSession('clarifying');

    this.session = {
      ...session,
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

    let currentSession = this.session;

    if (currentSession.status === 'collecting' && currentSession.sources.length > 0) {
      this.processInputs();
      // Re-read session after processInputs call since it updates this.session
      currentSession = this.session;
    }

    const startTime = Date.now();
    const extraction = currentSession.extraction;

    // Determine final project name and description
    const finalName =
      projectName ??
      extraction.projectName ??
      this.getAnsweredValue('project name') ??
      `Project-${currentSession.projectId}`;

    const finalDescription =
      projectDescription ??
      extraction.projectDescription ??
      this.getAnsweredValue('project description') ??
      'Project collected by Collector Agent';

    // Build CollectedInfo
    const collectedInfo = this.buildCollectedInfo(currentSession, finalName, finalDescription);

    // Write to scratchpad
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const outputPath = scratchpad.getCollectedInfoPath(currentSession.projectId);
    await scratchpad.writeYaml(outputPath, collectedInfo);

    const processingTimeMs = Date.now() - startTime;

    // Calculate stats
    const stats: CollectionStats = {
      sourcesProcessed: currentSession.sources.length,
      functionalRequirements: extraction.functionalRequirements.length,
      nonFunctionalRequirements: extraction.nonFunctionalRequirements.length,
      constraints: extraction.constraints.length,
      assumptions: extraction.assumptions.length,
      dependencies: extraction.dependencies.length,
      questionsAsked: extraction.clarificationQuestions.length,
      questionsAnswered: currentSession.answeredQuestions.length,
      processingTimeMs,
    };

    return {
      success: true,
      projectId: currentSession.projectId,
      outputPath,
      collectedInfo,
      remainingQuestions: currentSession.pendingQuestions,
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
      return question !== undefined && question.question.toLowerCase().includes(searchText);
    });
    return answer?.answer;
  }

  /**
   * Build CollectedInfo from session data
   *
   * @param session - The current session
   * @param name - Project name
   * @param description - Project description
   */
  private buildCollectedInfo(
    session: CollectionSession,
    name: string,
    description: string
  ): CollectedInfo {
    const now = new Date().toISOString();
    const extraction = session.extraction;

    return {
      schemaVersion: '1.0.0',
      projectId: session.projectId,
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
          acceptanceCriteria: (r.acceptanceCriteria ?? []).map((ac, index) => ({
            id: `AC-${String(index + 1).padStart(3, '0')}`,
            description: ac,
            testable: true,
          })),
          dependencies: [] as string[],
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
      clarifications: session.answeredQuestions.map((a) => {
        const question = session.extraction.clarificationQuestions.find(
          (q) => q.id === a.questionId
        );
        // Filter to match schema category (exclude 'scope')
        const category = question?.category ?? 'requirement';
        const validCategory: 'requirement' | 'constraint' | 'assumption' | 'priority' =
          category === 'scope' ? 'requirement' : category;
        return {
          id: a.questionId,
          category: validCategory,
          question: question?.question ?? '',
          required: question?.required ?? false,
          answer: a.answer,
          timestamp: a.answeredAt,
        };
      }),
      sources: session.sources.map((s) => ({
        type: s.type === 'text' ? 'conversation' : s.type,
        reference: s.reference,
        extractedAt: s.extractedAt,
        summary: s.summary,
      })),
      createdAt: session.startedAt,
      updatedAt: now,
      completedAt: now,
    };
  }

  /**
   * Ensure there is an active session in the expected state
   *
   * @returns The current session
   */
  private ensureSession(expectedState: 'collecting' | 'clarifying'): CollectionSession {
    if (this.session === null) {
      throw new SessionStateError('no session', expectedState, 'perform this action');
    }

    if (expectedState === 'collecting' && this.session.status === 'completed') {
      throw new SessionStateError(this.session.status, expectedState, 'add more inputs');
    }

    if (expectedState === 'clarifying' && this.session.status !== 'clarifying') {
      throw new SessionStateError(this.session.status, expectedState, 'answer questions');
    }

    return this.session;
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
    const extraction = this.processInputs();

    // Skip clarification if confidence is high enough
    if (
      this.config.skipClarificationIfConfident &&
      extraction.overallConfidence >= this.config.confidenceThreshold
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
    const extraction = this.processInputs();

    if (
      this.config.skipClarificationIfConfident &&
      extraction.overallConfidence >= this.config.confidenceThreshold
    ) {
      this.skipClarification();
    }

    return this.finalize(options?.projectName, options?.projectDescription);
  }

  /**
   * Convenience method: Collect from multiple files and finalize in one call
   *
   * @param filePaths - Array of file paths to process
   * @param options - Optional project name and description
   * @returns CollectionResult with merged information from all files
   */
  public async collectFromFiles(
    filePaths: readonly string[],
    options?: { projectName?: string; projectDescription?: string }
  ): Promise<CollectionResult> {
    if (filePaths.length === 0) {
      throw new MissingInformationError(['No file paths provided']);
    }

    await this.startSession(options?.projectName);

    // Process all files sequentially, collecting errors
    const errors: string[] = [];
    for (const filePath of filePaths) {
      try {
        await this.addFileInput(filePath);
      } catch (error) {
        errors.push(
          `Failed to process "${filePath}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Check if we have at least one successful source
    if (this.session !== null && this.session.sources.length === 0) {
      throw new MissingInformationError([
        'No files could be processed successfully',
        ...errors,
      ]);
    }

    const extraction = this.processInputs();

    // Add file processing errors as warnings
    if (errors.length > 0 && this.session !== null) {
      this.session = {
        ...this.session,
        extraction: {
          ...this.session.extraction,
          warnings: [...this.session.extraction.warnings, ...errors],
        },
        updatedAt: new Date().toISOString(),
      };
    }

    if (
      this.config.skipClarificationIfConfident &&
      extraction.overallConfidence >= this.config.confidenceThreshold
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
