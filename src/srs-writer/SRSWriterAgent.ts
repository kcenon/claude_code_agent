/**
 * SRS Writer Agent - Main agent for SRS document generation
 *
 * Orchestrates the generation of Software Requirements Specifications
 * from PRD documents, including feature decomposition, use case
 * generation, and traceability matrix creation.
 *
 * Implements IAgent interface for AgentFactory integration
 */

import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getScratchpad } from '../scratchpad/index.js';
import type {
  SRSMetadata,
  NonFunctionalRequirement,
  Constraint,
} from '../architecture-generator/types.js';
import { PRDParser, type PRDParserOptions } from './PRDParser.js';
import { FeatureDecomposer, type FeatureDecomposerOptions } from './FeatureDecomposer.js';
import { TraceabilityBuilder, type TraceabilityBuilderOptions } from './TraceabilityBuilder.js';
import type {
  SRSWriterAgentConfig,
  SRSGenerationSession,
  SRSGenerationResult,
  SRSGenerationStats,
  GeneratedSRS,
  ParsedPRD,
  FeatureDecompositionResult,
  TraceabilityMatrix,
} from './types.js';
import {
  PRDNotFoundError,
  LowCoverageError,
  GenerationError,
  FileWriteError,
  SessionStateError,
} from './errors.js';

/**
 * Default configuration for SRSWriterAgent
 */
const DEFAULT_CONFIG: Required<SRSWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  templatePath: '.ad-sdlc/templates/srs-template.md',
  publicDocsPath: 'docs/srs',
  minUseCasesPerFeature: 1,
  failOnLowCoverage: false,
  coverageThreshold: 80,
  includeTraceability: true,
};

/**
 * Agent ID for SRSWriterAgent used in AgentFactory
 */
export const SRS_WRITER_AGENT_ID = 'srs-writer-agent';

/**
 * SRS Writer Agent class for generating SRS documents
 * Implements IAgent interface for unified agent instantiation through AgentFactory
 */
export class SRSWriterAgent implements IAgent {
  public readonly agentId = SRS_WRITER_AGENT_ID;
  public readonly name = 'SRS Writer Agent';

  private readonly config: Required<SRSWriterAgentConfig>;
  private readonly prdParser: PRDParser;
  private readonly featureDecomposer: FeatureDecomposer;
  private readonly traceabilityBuilder: TraceabilityBuilder;
  private session: SRSGenerationSession | null = null;
  private initialized = false;

  constructor(config: SRSWriterAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const parserOptions: PRDParserOptions = {
      strict: false,
      parsePersonas: true,
      parseGoals: true,
    };

    const decomposerOptions: FeatureDecomposerOptions = {
      maxFeaturesPerRequirement: 5,
      minFeaturesPerRequirement: 1,
      generateSubFeatures: true,
    };

    const traceabilityOptions: TraceabilityBuilderOptions = {
      requireFullCoverage: this.config.failOnLowCoverage,
      includeNFRs: true,
      validateBidirectional: true,
    };

    this.prdParser = new PRDParser(parserOptions);
    this.featureDecomposer = new FeatureDecomposer(decomposerOptions);
    this.traceabilityBuilder = new TraceabilityBuilder(traceabilityOptions);
  }

  /**
   * Initialize the agent (IAgent interface)
   * Called after construction, before first use
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // SRSWriterAgent doesn't require async initialization
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
  public getSession(): SRSGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new SRS generation session for a project
   *
   * @param projectId - Project identifier
   * @returns The created session
   */
  public async startSession(projectId: string): Promise<SRSGenerationSession> {
    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });

    // Read PRD document
    const prdPath = scratchpad.getDocumentPath(projectId, 'prd');
    const prdContent = await scratchpad.readMarkdown(prdPath, { allowMissing: false });

    if (prdContent === null) {
      throw new PRDNotFoundError(projectId, prdPath);
    }

    // Parse PRD
    const parsedPRD = this.prdParser.parse(prdContent, projectId);

    const now = new Date().toISOString();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedPRD,
      startedAt: now,
      updatedAt: now,
    };

    return this.session;
  }

  /**
   * Decompose PRD requirements into SRS features
   *
   * @returns Feature decomposition result
   */
  public decompose(): FeatureDecompositionResult {
    const session = this.ensureSession(['pending', 'parsing']);

    this.session = {
      ...session,
      status: 'decomposing',
      updatedAt: new Date().toISOString(),
    };

    const decompositionResult = this.featureDecomposer.decompose(session.parsedPRD);

    // Check coverage
    if (
      this.config.failOnLowCoverage &&
      decompositionResult.coverage < this.config.coverageThreshold
    ) {
      this.session = {
        ...session,
        status: 'failed',
        errorMessage: `Coverage ${decompositionResult.coverage.toFixed(1)}% is below threshold ${String(this.config.coverageThreshold)}%`,
        updatedAt: new Date().toISOString(),
      };
      throw new LowCoverageError(
        decompositionResult.coverage,
        this.config.coverageThreshold,
        decompositionResult.unmappedRequirements
      );
    }

    this.session = {
      ...this.session,
      decompositionResult,
      updatedAt: new Date().toISOString(),
    };

    return decompositionResult;
  }

  /**
   * Build traceability matrix
   *
   * @returns Traceability matrix
   */
  public buildTraceability(): TraceabilityMatrix {
    const session = this.ensureSession(['pending', 'parsing', 'decomposing']);

    // Decompose if not done
    const decompositionResult =
      session.decompositionResult ?? this.featureDecomposer.decompose(session.parsedPRD);

    const traceabilityMatrix = this.traceabilityBuilder.build(
      session.parsedPRD,
      decompositionResult
    );

    this.session = {
      ...session,
      decompositionResult,
      traceabilityMatrix,
      updatedAt: new Date().toISOString(),
    };

    return traceabilityMatrix;
  }

  /**
   * Generate the SRS document
   *
   * @returns Generated SRS
   */
  public generate(): GeneratedSRS {
    const session = this.ensureSession(['pending', 'parsing', 'decomposing']);

    this.session = {
      ...session,
      status: 'generating',
      updatedAt: new Date().toISOString(),
    };

    // Decompose if not done
    const decompositionResult =
      session.decompositionResult ?? this.featureDecomposer.decompose(session.parsedPRD);

    // Build traceability if not done
    const traceabilityMatrix =
      session.traceabilityMatrix ??
      this.traceabilityBuilder.build(session.parsedPRD, decompositionResult);

    // Create metadata
    const metadata = this.createMetadata(session);

    // Convert NFRs
    const nfrs = this.convertNFRs(session.parsedPRD);

    // Convert constraints
    const constraints = this.convertConstraints(session.parsedPRD);

    // Generate content
    const content = this.generateContent(
      session.parsedPRD,
      metadata,
      decompositionResult,
      traceabilityMatrix,
      nfrs,
      constraints
    );

    const generatedSRS: GeneratedSRS = {
      metadata,
      content,
      features: [...decompositionResult.features],
      nfrs,
      constraints,
      assumptions: [...session.parsedPRD.assumptions],
      traceabilityMatrix,
    };

    this.session = {
      ...session,
      status: 'completed',
      decompositionResult,
      traceabilityMatrix,
      generatedSRS,
      updatedAt: new Date().toISOString(),
    };

    return generatedSRS;
  }

  /**
   * Finalize the SRS generation and save to files
   *
   * @returns SRS generation result
   */
  public async finalize(): Promise<SRSGenerationResult> {
    const startTime = Date.now();
    let session = this.ensureSession([
      'pending',
      'parsing',
      'decomposing',
      'generating',
      'completed',
    ]);

    // Generate if not done
    let generatedSRS: GeneratedSRS;
    if (session.status !== 'completed' || session.generatedSRS === undefined) {
      generatedSRS = this.generate();
      if (this.session === null) {
        throw new SessionStateError('no session', 'active', 'finalize after generation');
      }
      session = this.session;
    } else {
      generatedSRS = session.generatedSRS;
    }

    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });

    // Save to scratchpad
    const scratchpadPath = scratchpad.getDocumentPath(session.projectId, 'srs');
    try {
      await scratchpad.writeMarkdown(scratchpadPath, generatedSRS.content);
    } catch (error) {
      throw new FileWriteError(scratchpadPath, String(error));
    }

    // Save to public docs
    const publicPath = path.join(this.config.publicDocsPath, `SRS-${session.projectId}.md`);
    try {
      await this.ensureDir(path.dirname(publicPath));
      await fs.promises.writeFile(publicPath, generatedSRS.content, 'utf8');
    } catch (error) {
      throw new FileWriteError(publicPath, String(error));
    }

    const processingTimeMs = Date.now() - startTime;

    // Calculate stats
    const stats = this.calculateStats(session, generatedSRS, processingTimeMs);

    return {
      success: true,
      projectId: session.projectId,
      scratchpadPath,
      publicPath,
      generatedSRS,
      stats,
    };
  }

  /**
   * Generate SRS from project ID in one call
   *
   * @param projectId - Project identifier
   * @returns SRS generation result
   */
  public async generateFromProject(projectId: string): Promise<SRSGenerationResult> {
    await this.startSession(projectId);
    this.decompose();
    this.buildTraceability();
    return this.finalize();
  }

  /**
   * Generate SRS directly from PRD content
   *
   * @param prdContent - The PRD markdown content
   * @param projectId - Project identifier
   * @returns SRS generation result
   */
  public async generateFromPRDContent(
    prdContent: string,
    projectId: string
  ): Promise<SRSGenerationResult> {
    const startTime = Date.now();
    const now = new Date().toISOString();

    // Parse PRD
    const parsedPRD = this.prdParser.parse(prdContent, projectId);

    // Create session
    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedPRD,
      startedAt: now,
      updatedAt: now,
    };

    // Decompose and build traceability
    this.decompose();
    this.buildTraceability();

    // Generate
    const generatedSRS = this.generate();

    const scratchpad = getScratchpad({ basePath: this.config.scratchpadBasePath });

    // Save to scratchpad
    const scratchpadPath = scratchpad.getDocumentPath(projectId, 'srs');
    try {
      await scratchpad.writeMarkdown(scratchpadPath, generatedSRS.content);
    } catch (error) {
      throw new FileWriteError(scratchpadPath, String(error));
    }

    // Save to public docs
    const publicPath = path.join(this.config.publicDocsPath, `SRS-${projectId}.md`);
    try {
      await this.ensureDir(path.dirname(publicPath));
      await fs.promises.writeFile(publicPath, generatedSRS.content, 'utf8');
    } catch (error) {
      throw new FileWriteError(publicPath, String(error));
    }

    const processingTimeMs = Date.now() - startTime;

    const stats = this.calculateStats(this.session, generatedSRS, processingTimeMs);

    return {
      success: true,
      projectId,
      scratchpadPath,
      publicPath,
      generatedSRS,
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
   * Create SRS metadata
   * @param session - Active generation session containing parsed PRD data
   * @returns SRS metadata derived from the session and PRD
   */
  private createMetadata(session: SRSGenerationSession): SRSMetadata {
    return {
      documentId: `SRS-${session.projectId}`,
      sourcePRD: session.parsedPRD.metadata.documentId,
      version: '1.0.0',
      status: 'Draft',
      productName: session.parsedPRD.productName,
    };
  }

  /**
   * Convert parsed NFRs to proper format
   * @param parsedPRD - Parsed PRD containing raw non-functional requirements
   * @returns Array of normalized NonFunctionalRequirement objects
   */
  private convertNFRs(parsedPRD: ParsedPRD): NonFunctionalRequirement[] {
    return parsedPRD.nonFunctionalRequirements.map((nfr) => ({
      id: nfr.id,
      category: this.normalizeNFRCategory(nfr.category),
      description: nfr.description,
      target: nfr.metric ?? '',
      priority: nfr.priority,
    }));
  }

  /**
   * Normalize NFR category
   * @param category - Raw category string to classify
   * @returns Standardized NFR category value
   */
  private normalizeNFRCategory(
    category: string
  ):
    | 'performance'
    | 'scalability'
    | 'reliability'
    | 'security'
    | 'maintainability'
    | 'usability'
    | 'availability' {
    const lower = category.toLowerCase();
    if (lower.includes('perform')) return 'performance';
    if (lower.includes('scal')) return 'scalability';
    if (lower.includes('reliab')) return 'reliability';
    if (lower.includes('secur')) return 'security';
    if (lower.includes('maintain')) return 'maintainability';
    if (lower.includes('usab') || lower.includes('ux')) return 'usability';
    if (lower.includes('avail')) return 'availability';
    return 'reliability';
  }

  /**
   * Convert parsed constraints to proper format
   * @param parsedPRD - Parsed PRD containing raw constraints
   * @returns Array of normalized Constraint objects with architecture impact
   */
  private convertConstraints(parsedPRD: ParsedPRD): Constraint[] {
    return parsedPRD.constraints.map((con) => ({
      id: con.id,
      type: this.normalizeConstraintType(con.type),
      description: con.description,
      architectureImpact: this.inferArchitectureImpact(con.description),
    }));
  }

  /**
   * Normalize constraint type
   * @param type - Raw constraint type string
   * @returns Standardized constraint type value
   */
  private normalizeConstraintType(
    type: string
  ): 'technical' | 'business' | 'regulatory' | 'resource' | 'timeline' {
    const lower = type.toLowerCase();
    if (lower.includes('tech')) return 'technical';
    if (lower.includes('business')) return 'business';
    if (lower.includes('regul') || lower.includes('legal')) return 'regulatory';
    if (lower.includes('resource')) return 'resource';
    if (lower.includes('time')) return 'timeline';
    return 'technical';
  }

  /**
   * Infer architecture impact from constraint description
   * @param description - Constraint description to analyze for impact keywords
   * @returns Human-readable architecture impact statement
   */
  private inferArchitectureImpact(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('database') || lower.includes('storage')) {
      return 'Affects data layer design';
    }
    if (lower.includes('api') || lower.includes('interface')) {
      return 'Affects API design';
    }
    if (lower.includes('security') || lower.includes('auth')) {
      return 'Affects security architecture';
    }
    if (lower.includes('performance') || lower.includes('scale')) {
      return 'Affects system scalability design';
    }
    return 'General architecture consideration';
  }

  /**
   * Generate SRS markdown content
   * @param parsedPRD - Parsed PRD providing source requirements and assumptions
   * @param metadata - SRS document metadata for the header section
   * @param decompositionResult - Feature decomposition with use cases
   * @param traceabilityMatrix - Requirement-to-feature traceability data
   * @param nfrs - Normalized non-functional requirements
   * @param constraints - Normalized constraints with architecture impact
   * @returns Complete SRS document as a markdown string
   */
  private generateContent(
    parsedPRD: ParsedPRD,
    metadata: SRSMetadata,
    decompositionResult: FeatureDecompositionResult,
    traceabilityMatrix: TraceabilityMatrix,
    nfrs: NonFunctionalRequirement[],
    constraints: Constraint[]
  ): string {
    const lines: string[] = [];

    // Title
    lines.push(`# SRS: ${metadata.productName}`);
    lines.push('');

    // Metadata table
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| **Document ID** | ${metadata.documentId} |`);
    lines.push(`| **Source PRD** | ${metadata.sourcePRD} |`);
    lines.push(`| **Version** | ${metadata.version} |`);
    lines.push(`| **Status** | ${metadata.status} |`);
    lines.push(`| **Product Name** | ${metadata.productName} |`);
    lines.push('');

    // Introduction
    lines.push('## 1. Introduction');
    lines.push('');
    lines.push('### 1.1 Purpose');
    lines.push(
      'This Software Requirements Specification (SRS) document describes the detailed software requirements for the ' +
        `${metadata.productName}. It is intended for use by the development team, testers, and stakeholders.`
    );
    lines.push('');
    lines.push('### 1.2 Scope');
    lines.push(parsedPRD.productDescription || 'See source PRD for product scope.');
    lines.push('');
    lines.push('### 1.3 References');
    lines.push(`- Source PRD: ${metadata.sourcePRD}`);
    lines.push('');

    // System Features
    lines.push('## 2. System Features');
    lines.push('');

    for (const feature of decompositionResult.features) {
      lines.push(`### ${feature.id}: ${feature.name}`);
      lines.push('');
      lines.push(`**Priority**: ${feature.priority}`);
      lines.push('');
      lines.push('**Description**:');
      lines.push(feature.description);
      lines.push('');

      // Use cases
      if (feature.useCases.length > 0) {
        lines.push('#### Use Cases');
        lines.push('');
        for (const uc of feature.useCases) {
          lines.push(`##### ${uc.id}: ${uc.name}`);
          lines.push('');
          lines.push(`- **Actor**: ${uc.actor}`);
          lines.push('- **Description**: ' + uc.description);
          lines.push('');
          lines.push('**Preconditions**:');
          for (const pre of uc.preconditions) {
            lines.push(`  - ${pre}`);
          }
          lines.push('');
          lines.push('**Main Flow**:');
          uc.mainFlow.forEach((step, idx) => {
            lines.push(`  ${String(idx + 1)}. ${step}`);
          });
          lines.push('');
          if (uc.alternativeFlows.length > 0) {
            lines.push('**Alternative Flows**:');
            for (const alt of uc.alternativeFlows) {
              lines.push(`  - ${alt}`);
            }
            lines.push('');
          }
          lines.push('**Postconditions**:');
          for (const post of uc.postconditions) {
            lines.push(`  - ${post}`);
          }
          lines.push('');
        }
      }

      // NFR references
      if (feature.nfrs.length > 0) {
        lines.push('**Related NFRs**: ' + feature.nfrs.join(', '));
        lines.push('');
      }
    }

    // Non-Functional Requirements
    lines.push('## 3. Non-Functional Requirements');
    lines.push('');

    // Group by category
    const nfrsByCategory = new Map<string, NonFunctionalRequirement[]>();
    for (const nfr of nfrs) {
      const existing = nfrsByCategory.get(nfr.category) ?? [];
      existing.push(nfr);
      nfrsByCategory.set(nfr.category, existing);
    }

    for (const [category, categoryNfrs] of nfrsByCategory) {
      lines.push(
        `### 3.${String(this.getCategoryNumber(category))} ${this.capitalize(category)} Requirements`
      );
      lines.push('');
      lines.push('| ID | Description | Target | Priority |');
      lines.push('|----|-------------|--------|----------|');
      for (const nfr of categoryNfrs) {
        lines.push(`| ${nfr.id} | ${nfr.description} | ${nfr.target || '-'} | ${nfr.priority} |`);
      }
      lines.push('');
    }

    // Constraints
    if (constraints.length > 0) {
      lines.push('## 4. Constraints');
      lines.push('');
      lines.push('| ID | Type | Description | Architecture Impact |');
      lines.push('|----|------|-------------|---------------------|');
      for (const con of constraints) {
        lines.push(`| ${con.id} | ${con.type} | ${con.description} | ${con.architectureImpact} |`);
      }
      lines.push('');
    }

    // Assumptions
    if (parsedPRD.assumptions.length > 0) {
      lines.push('## 5. Assumptions');
      lines.push('');
      for (const assumption of parsedPRD.assumptions) {
        lines.push(`- ${assumption}`);
      }
      lines.push('');
    }

    // Traceability Matrix
    if (this.config.includeTraceability) {
      lines.push('## 6. Traceability Matrix');
      lines.push('');
      lines.push(this.traceabilityBuilder.toMarkdown(traceabilityMatrix));
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated from ${metadata.sourcePRD}*`);

    return lines.join('\n');
  }

  /**
   * Get category number for section numbering
   * @param category - NFR category name
   * @returns Ordinal number for the category in the SRS section hierarchy
   */
  private getCategoryNumber(category: string): number {
    const order = [
      'performance',
      'security',
      'scalability',
      'reliability',
      'usability',
      'maintainability',
      'availability',
    ];
    const index = order.indexOf(category);
    return index >= 0 ? index + 1 : order.length + 1;
  }

  /**
   * Capitalize first letter
   * @param str - Input string to capitalize
   * @returns String with the first character uppercased
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Calculate generation statistics
   * @param session - Completed generation session with parsed PRD
   * @param generatedSRS - Generated SRS containing features and NFRs
   * @param processingTimeMs - Total processing time in milliseconds
   * @returns Aggregated statistics for the generation run
   */
  private calculateStats(
    session: SRSGenerationSession,
    generatedSRS: GeneratedSRS,
    processingTimeMs: number
  ): SRSGenerationStats {
    const totalUseCases = generatedSRS.features.reduce((sum, f) => sum + f.useCases.length, 0);

    return {
      prdRequirementsCount: session.parsedPRD.functionalRequirements.length,
      featuresGenerated: generatedSRS.features.length,
      useCasesGenerated: totalUseCases,
      nfrsCount: generatedSRS.nfrs.length,
      constraintsCount: generatedSRS.constraints.length,
      traceabilityCoverage: generatedSRS.traceabilityMatrix.forwardCoverage,
      processingTimeMs,
    };
  }

  /**
   * Ensure there is an active session in the expected state
   * @param expectedStates - Allowed session states for the current operation
   * @returns The validated active session
   */
  private ensureSession(
    expectedStates: readonly ('pending' | 'parsing' | 'decomposing' | 'generating' | 'completed')[]
  ): SRSGenerationSession {
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
   * @param dirPath - Absolute or relative directory path to create recursively
   */
  private async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Singleton instance for global access
 */
let globalSRSWriterAgent: SRSWriterAgent | null = null;

/**
 * Get or create the global SRSWriterAgent instance
 *
 * @param config - Configuration options
 * @returns The global SRSWriterAgent instance
 */
export function getSRSWriterAgent(config?: SRSWriterAgentConfig): SRSWriterAgent {
  if (globalSRSWriterAgent === null) {
    globalSRSWriterAgent = new SRSWriterAgent(config);
  }
  return globalSRSWriterAgent;
}

/**
 * Reset the global SRSWriterAgent instance (for testing)
 */
export function resetSRSWriterAgent(): void {
  if (globalSRSWriterAgent !== null) {
    globalSRSWriterAgent.reset();
    globalSRSWriterAgent = null;
  }
}
