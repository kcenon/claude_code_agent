/**
 * CollectorAgent - Main agent for information collection
 *
 * Orchestrates the collection of information from various sources,
 * extracts structured data, handles clarification loops, and
 * generates YAML output for downstream agents.
 *
 * Features:
 * - Multiple input types: text, file, URL
 * - Batch input processing for mixed input types
 * - Automatic session cleanup on failure
 * - Clarification question handling
 * - Implements IAgent interface for AgentFactory integration
 */

import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';
import type { ExecutionAdapter } from '../execution/index.js';
import { getScratchpad, type CollectedInfo } from '../scratchpad/index.js';
import { InputParser, type InputParserOptions } from './InputParser.js';
import { InformationExtractor, type InformationExtractorOptions } from './InformationExtractor.js';
import { LLMExtractor } from './LLMExtractor.js';
import type {
  InputSource,
  CollectorAgentConfig,
  CollectionResult,
  CollectionStats,
  CollectionSession,
  ClarificationQuestion,
  ClarificationAnswer,
  ExtractionResult,
  BatchInputItem,
  BatchInputOptions,
  BatchInputResult,
} from './types.js';
import { ProjectInitError, MissingInformationError, SessionStateError } from './errors.js';
import { getLogger } from '../logging/index.js';
import { InvestigationEngine } from './InvestigationEngine.js';
import type {
  InvestigationRound,
  InvestigationAnswer,
  InvestigationState,
} from './investigation-types.js';

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
  investigationDepth: 'quick',
};

/**
 * Agent ID for CollectorAgent used in AgentFactory
 */
export const COLLECTOR_AGENT_ID = 'collector-agent';

/**
 * CollectorAgent class for managing information collection workflow
 * Implements IAgent interface for unified agent instantiation through AgentFactory
 */
export class CollectorAgent implements IAgent {
  public readonly agentId = COLLECTOR_AGENT_ID;
  public readonly name = 'Collector Agent';

  private readonly config: Required<CollectorAgentConfig>;
  private readonly inputParser: InputParser;
  private readonly extractor: InformationExtractor;
  private readonly llmExtractor: LLMExtractor | null;
  private readonly investigationEngine: InvestigationEngine;
  private session: CollectionSession | null = null;
  private initialized = false;

  constructor(config: CollectorAgentConfig = {}, adapter?: ExecutionAdapter) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const parserOptions: InputParserOptions = {};
    const extractorOptions: InformationExtractorOptions = {
      defaultPriority: this.config.defaultPriority,
      minConfidence: 0.3,
      maxQuestions: this.config.maxQuestionsPerRound,
    };

    this.inputParser = new InputParser(parserOptions);
    this.extractor = new InformationExtractor(extractorOptions);

    const effectiveAdapter = adapter ?? null;

    if (effectiveAdapter !== null) {
      this.llmExtractor = new LLMExtractor(
        effectiveAdapter,
        this.extractor,
        this.config.scratchpadBasePath
      );
    } else {
      this.llmExtractor = null;
    }

    this.investigationEngine = new InvestigationEngine(
      {
        depth: this.config.investigationDepth,
        maxQuestionsPerRound: this.config.maxQuestionsPerRound,
        enableLLMQuestions: effectiveAdapter !== null,
      },
      effectiveAdapter
    );
  }

  /**
   * Initialize the agent (IAgent interface)
   * Called after construction, before first use
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // CollectorAgent doesn't require async initialization
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
   * Start a new collection session
   *
   * @param projectName - Initial project name (optional)
   * @returns The created session
   */
  public async startSession(projectName?: string): Promise<CollectionSession> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });
    const sanitized = projectName !== undefined ? this.sanitizeProjectId(projectName) : '';
    const projectId = sanitized !== '' ? sanitized : await scratchpad.generateProjectId();
    const now = new Date().toISOString();
    let projectInitialized = false;

    try {
      await scratchpad.initializeProject(projectId, projectName ?? `Project-${projectId}`);
      projectInitialized = true;

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
    } catch (error) {
      // Clean up project if it was initialized but session setup failed
      if (projectInitialized) {
        await this.cleanupProject(scratchpad, projectId);
      }

      if (error instanceof Error) {
        throw new ProjectInitError(projectId, error.message);
      }
      throw error;
    }
  }

  /**
   * Clean up a project from scratchpad after failed session initialization
   *
   * @param scratchpad - Scratchpad instance
   * @param projectId - Project ID to clean up
   */
  private async cleanupProject(
    scratchpad: ReturnType<typeof getScratchpad>,
    projectId: string
  ): Promise<void> {
    const fs = await import('node:fs');

    const sections = ['info', 'documents', 'issues', 'progress'] as const;

    for (const section of sections) {
      const projectPath = scratchpad.getProjectPath(section, projectId);
      try {
        await fs.promises.rm(projectPath, { recursive: true, force: true });
      } catch (error) {
        getLogger().debug('Scratchpad section cleanup failed', {
          agent: 'CollectorAgent',
          section,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clean up parent directories if empty
    for (const section of sections) {
      const sectionPath = scratchpad.getSectionPath(section);
      try {
        const entries = await fs.promises.readdir(sectionPath);
        if (entries.length === 0) {
          await fs.promises.rmdir(sectionPath);
        }
      } catch (error) {
        getLogger().debug('Empty section directory cleanup failed', {
          agent: 'CollectorAgent',
          section,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Sanitize a project name for use as a filesystem-safe project ID.
   * Replaces non-alphanumeric characters (except hyphens, underscores, dots)
   * with hyphens and collapses consecutive hyphens.
   * @param name
   */
  private sanitizeProjectId(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
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
   * Add multiple inputs of mixed types in a batch
   *
   * Processes text, file, and URL inputs in a single call, with optional
   * error handling strategies.
   *
   * @param items - Array of batch input items
   * @param options - Batch processing options
   * @returns Array of results for each input item
   */
  public async addBatchInput(
    items: readonly BatchInputItem[],
    options: BatchInputOptions = {}
  ): Promise<BatchInputResult[]> {
    this.ensureSession('collecting');

    const { continueOnError = true, parallelLimit = 5 } = options;
    const results: BatchInputResult[] = [];

    // Process items in chunks for controlled parallelism
    for (let i = 0; i < items.length; i += parallelLimit) {
      const chunk = items.slice(i, i + parallelLimit);
      const chunkResults = await Promise.all(
        chunk.map(async (item): Promise<BatchInputResult> => {
          try {
            await this.processInputItem(item);
            return { item, success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!continueOnError) {
              throw error;
            }
            return { item, success: false, error: errorMessage };
          }
        })
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Process a single batch input item
   *
   * @param item - The batch input item to process
   */
  private async processInputItem(item: BatchInputItem): Promise<void> {
    switch (item.type) {
      case 'text':
        this.addTextInput(item.value, item.description);
        break;
      case 'file':
        await this.addFileInput(item.value);
        break;
      case 'url':
        await this.addUrlInput(item.value);
        break;
    }
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
   * Process inputs using LLM extractor when available, falling back to keyword extraction.
   * This async variant is used internally by convenience methods.
   *
   * @returns ExtractionResult with all extracted information
   */
  private async processInputsAsync(): Promise<ExtractionResult> {
    if (this.llmExtractor === null) {
      return this.processInputs();
    }

    const session = this.ensureSession('collecting');

    if (session.sources.length === 0) {
      throw new MissingInformationError(['No input sources provided']);
    }

    const parsed = this.inputParser.combineInputs(session.sources);
    const extraction = await this.llmExtractor.extract(parsed);

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

  // ===========================================================================
  // Investigation Methods
  // ===========================================================================

  /**
   * Start the investigation phase after initial extraction.
   * Transitions session to 'investigating' state and returns first round of questions.
   *
   * @returns The first investigation round with questions
   */
  public async startInvestigation(): Promise<InvestigationRound> {
    if (this.session === null) {
      throw new SessionStateError('no session', 'collecting', 'start investigation');
    }

    // Process inputs first if still in collecting state
    if (this.session.status === 'collecting' && this.session.sources.length > 0) {
      await this.processInputsAsync();
    }

    const currentSession = this.session;
    // After processInputsAsync, status may be 'completed' or 'clarifying' — both are valid
    // starting points for investigation. Only reject truly invalid states (e.g. already investigating).
    if (currentSession.status === 'investigating') {
      throw new SessionStateError(currentSession.status, 'collecting', 'start investigation');
    }

    this.investigationEngine.initialize(this.config.investigationDepth);
    const round = await this.investigationEngine.generateNextRound(currentSession.extraction, []);

    this.session = {
      ...currentSession,
      status: 'investigating',
      investigation: this.investigationEngine.getState(),
      updatedAt: new Date().toISOString(),
    };

    return round;
  }

  /**
   * Submit answers for the current investigation round.
   * Returns the next round of questions, or null if investigation is complete.
   *
   * @param answers - Answers for the current round
   * @returns Next investigation round, or null if complete
   */
  public async submitInvestigationAnswers(
    answers: readonly InvestigationAnswer[]
  ): Promise<InvestigationRound | null> {
    if (this.session === null || this.session.status !== 'investigating') {
      throw new SessionStateError(
        this.session?.status ?? 'no session',
        'investigating',
        'submit investigation answers'
      );
    }

    const state = this.investigationEngine.getState();
    this.investigationEngine.submitRoundAnswers(state.currentRound, answers);

    // Enrich extraction with answers
    const enrichedExtraction = this.investigationEngine.enrichExtraction(
      this.session.extraction,
      this.investigationEngine.getState()
    );

    // Check if investigation should end
    if (this.investigationEngine.isComplete()) {
      this.session = {
        ...this.session,
        extraction: enrichedExtraction,
        investigation: this.investigationEngine.getState(),
        pendingQuestions: enrichedExtraction.clarificationQuestions,
        status: enrichedExtraction.clarificationQuestions.length > 0 ? 'clarifying' : 'completed',
        updatedAt: new Date().toISOString(),
      };
      return null;
    }

    // Check early exit
    if (this.investigationEngine.shouldEarlyExit(enrichedExtraction.overallConfidence)) {
      this.investigationEngine.skipRemaining();
      this.session = {
        ...this.session,
        extraction: enrichedExtraction,
        investigation: this.investigationEngine.getState(),
        pendingQuestions: enrichedExtraction.clarificationQuestions,
        status: enrichedExtraction.clarificationQuestions.length > 0 ? 'clarifying' : 'completed',
        updatedAt: new Date().toISOString(),
      };
      return null;
    }

    // Generate next round
    const allAnswers = this.investigationEngine.getState().rounds.flatMap((r) => r.answers);
    try {
      const nextRound = await this.investigationEngine.generateNextRound(
        enrichedExtraction,
        allAnswers
      );

      this.session = {
        ...this.session,
        extraction: enrichedExtraction,
        investigation: this.investigationEngine.getState(),
        updatedAt: new Date().toISOString(),
      };

      return nextRound;
    } catch {
      // If no more rounds can be generated, investigation is complete
      this.investigationEngine.skipRemaining();
      this.session = {
        ...this.session,
        extraction: enrichedExtraction,
        investigation: this.investigationEngine.getState(),
        pendingQuestions: enrichedExtraction.clarificationQuestions,
        status: enrichedExtraction.clarificationQuestions.length > 0 ? 'clarifying' : 'completed',
        updatedAt: new Date().toISOString(),
      };
      return null;
    }
  }

  /**
   * Skip remaining investigation rounds and proceed to clarification/completion.
   *
   * @returns Updated session
   */
  public skipInvestigation(): CollectionSession {
    if (this.session === null || this.session.status !== 'investigating') {
      throw new SessionStateError(
        this.session?.status ?? 'no session',
        'investigating',
        'skip investigation'
      );
    }

    this.investigationEngine.skipRemaining();

    // Enrich extraction with any answers collected so far
    const enrichedExtraction = this.investigationEngine.enrichExtraction(
      this.session.extraction,
      this.investigationEngine.getState()
    );

    this.session = {
      ...this.session,
      extraction: enrichedExtraction,
      investigation: this.investigationEngine.getState(),
      pendingQuestions: enrichedExtraction.clarificationQuestions,
      status: enrichedExtraction.clarificationQuestions.length > 0 ? 'clarifying' : 'completed',
      updatedAt: new Date().toISOString(),
    };

    return this.session;
  }

  /**
   * Get the current investigation state, or null if not investigating.
   */
  public getInvestigationState(): InvestigationState | null {
    return this.session?.investigation ?? null;
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
      await this.processInputsAsync();
      // Re-read session after processInputsAsync call since it updates this.session
      currentSession = this.session;
    }

    // If still investigating, skip remaining investigation and enrich extraction
    if (currentSession.status === 'investigating') {
      this.skipInvestigation();
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
      investigationRounds: currentSession.investigation?.rounds.length ?? 0,
      investigationQuestionsAsked:
        currentSession.investigation?.rounds.reduce((sum, r) => sum + r.questions.length, 0) ?? 0,
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
   * @param searchText - The text to search for in clarification questions
   * @returns The answer if found, undefined otherwise
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
   * @returns CollectedInfo object formatted for YAML output
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
      ...(session.investigation !== undefined
        ? {
            investigation: {
              depth: session.investigation.depth,
              roundsCompleted: session.investigation.rounds.filter(
                (r) => r.completedAt !== undefined
              ).length,
              totalQuestions: session.investigation.rounds.reduce(
                (sum, r) => sum + r.questions.length,
                0
              ),
              totalAnswers: session.investigation.rounds.reduce(
                (sum, r) => sum + r.answers.length,
                0
              ),
              confidenceGain:
                session.investigation.rounds.length > 0
                  ? (session.investigation.rounds[session.investigation.rounds.length - 1]
                      ?.confidenceAfter ?? 0) -
                    (session.investigation.rounds[0]?.confidenceBefore ?? 0)
                  : 0,
              phasesCompleted: session.investigation.rounds
                .filter((r) => r.completedAt !== undefined)
                .map((r) => r.phase),
            },
          }
        : {}),
      createdAt: session.startedAt,
      updatedAt: now,
      completedAt: now,
    };
  }

  /**
   * Ensure there is an active session in the expected state
   *
   * @param expectedState - The expected state the session must be in to proceed
   * @returns The current session
   */
  private ensureSession(
    expectedState: 'collecting' | 'investigating' | 'clarifying'
  ): CollectionSession {
    if (this.session === null) {
      throw new SessionStateError('no session', expectedState, 'perform this action');
    }

    if (expectedState === 'collecting' && this.session.status === 'completed') {
      throw new SessionStateError(this.session.status, expectedState, 'add more inputs');
    }

    if (expectedState === 'clarifying' && this.session.status !== 'clarifying') {
      throw new SessionStateError(this.session.status, expectedState, 'answer questions');
    }

    if (expectedState === 'investigating' && this.session.status !== 'investigating') {
      throw new SessionStateError(this.session.status, expectedState, 'perform investigation');
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
   * @param options.projectName - Project name override
   * @param options.projectDescription - Project description override
   * @returns CollectionResult
   */
  public async collectFromText(
    text: string,
    options?: { projectName?: string; projectDescription?: string }
  ): Promise<CollectionResult> {
    await this.startSession(options?.projectName);
    this.addTextInput(text);
    const extraction = await this.processInputsAsync();

    // Skip clarification if confidence is high enough
    if (
      this.config.skipClarificationIfConfident &&
      extraction.overallConfidence >= this.config.confidenceThreshold &&
      this.session?.status === 'clarifying'
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
   * @param options.projectName - Project name override
   * @param options.projectDescription - Project description override
   * @returns CollectionResult
   */
  public async collectFromFile(
    filePath: string,
    options?: { projectName?: string; projectDescription?: string }
  ): Promise<CollectionResult> {
    await this.startSession(options?.projectName);
    await this.addFileInput(filePath);
    const extraction = await this.processInputsAsync();

    if (
      this.config.skipClarificationIfConfident &&
      extraction.overallConfidence >= this.config.confidenceThreshold &&
      this.session?.status === 'clarifying'
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
   * @param options.projectName - Project name override
   * @param options.projectDescription - Project description override
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
      throw new MissingInformationError(['No files could be processed successfully', ...errors]);
    }

    const extraction = await this.processInputsAsync();

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
      extraction.overallConfidence >= this.config.confidenceThreshold &&
      this.session?.status === 'clarifying'
    ) {
      this.skipClarification();
    }

    return this.finalize(options?.projectName, options?.projectDescription);
  }

  /**
   * Convenience method: Collect from mixed batch inputs and finalize in one call
   *
   * Processes text, file, and URL inputs in a single batch operation.
   *
   * @param items - Array of batch input items (text, file, or URL)
   * @param options - Optional project name, description, and batch processing options
   * @param options.projectName - Project name override
   * @param options.projectDescription - Project description override
   * @param options.continueOnError - Whether to continue processing on individual item failure
   * @param options.parallelLimit - Maximum number of items to process concurrently
   * @returns CollectionResult with merged information from all inputs
   *
   * @example
   * ```typescript
   * const result = await agent.collectFromBatch([
   *   { type: 'text', value: 'User authentication is required', description: 'Core requirement' },
   *   { type: 'file', value: './requirements.md' },
   *   { type: 'url', value: 'https://example.com/api-spec' }
   * ], { projectName: 'MyApp' });
   * ```
   */
  public async collectFromBatch(
    items: readonly BatchInputItem[],
    options?: {
      projectName?: string;
      projectDescription?: string;
      continueOnError?: boolean;
      parallelLimit?: number;
    }
  ): Promise<CollectionResult> {
    if (items.length === 0) {
      throw new MissingInformationError(['No batch input items provided']);
    }

    await this.startSession(options?.projectName);

    const batchOptions =
      options?.parallelLimit !== undefined
        ? { continueOnError: options.continueOnError ?? true, parallelLimit: options.parallelLimit }
        : { continueOnError: options?.continueOnError ?? true };
    const batchResults = await this.addBatchInput(items, batchOptions);

    // Check if we have at least one successful input
    if (this.session !== null && this.session.sources.length === 0) {
      const errors = batchResults
        .filter((r) => !r.success)
        .map((r) => `Failed to process ${r.item.type} input: ${r.error ?? 'Unknown error'}`);
      throw new MissingInformationError(['No inputs could be processed successfully', ...errors]);
    }

    const extraction = await this.processInputsAsync();

    // Add processing errors as warnings
    const errors = batchResults
      .filter((r) => !r.success)
      .map(
        (r) =>
          `Failed to process ${r.item.type} input "${r.item.value}": ${r.error ?? 'Unknown error'}`
      );

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
      extraction.overallConfidence >= this.config.confidenceThreshold &&
      this.session?.status === 'clarifying'
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
