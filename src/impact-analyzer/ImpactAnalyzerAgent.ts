/**
 * Impact Analyzer Agent
 *
 * Assesses the implications of proposed changes on existing codebase
 * and documentation. Combines Document Reader and Codebase Analyzer
 * outputs to produce comprehensive impact reports.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  AffectedComponent,
  AffectedFile,
  AffectedRequirement,
  AnalysisStatistics,
  ArchitectureOverview,
  AvailableInputs,
  ChangeRequest,
  ChangeScope,
  ChangeSize,
  ChangeType,
  CurrentState,
  DependencyChainEntry,
  DependencyGraph,
  ImpactAnalysis,
  ImpactAnalyzerConfig,
  ImpactAnalysisResult,
  ImpactAnalysisSession,
  ImpactLevel,
  ImpactPropagation,
  Recommendation,
  RegressionRisk,
  RiskAssessment,
  RiskFactor,
  RiskLevel,
} from './types.js';
import { DEFAULT_IMPACT_ANALYZER_CONFIG } from './types.js';
import {
  ChangeRequestParseError,
  FileReadError,
  InputParseError,
  InvalidChangeRequestError,
  NoActiveSessionError,
  NoInputsAvailableError,
  OutputWriteError,
} from './errors.js';

// YAML parser
let yaml: { dump: (obj: unknown) => string; load: (str: string) => unknown } | null = null;

async function loadYaml(): Promise<void> {
  if (yaml === null) {
    const jsYaml = await import('js-yaml');
    yaml = { dump: jsYaml.dump, load: jsYaml.load };
  }
}

/**
 * Impact Analyzer Agent class
 *
 * Responsible for:
 * - Loading and parsing inputs from Document Reader and Codebase Analyzer
 * - Analyzing change requests
 * - Identifying affected components and dependencies
 * - Assessing risk levels
 * - Predicting regression risks
 * - Generating comprehensive impact reports
 */
export class ImpactAnalyzerAgent {
  private readonly config: Required<ImpactAnalyzerConfig>;
  private session: ImpactAnalysisSession | null = null;

  constructor(config: ImpactAnalyzerConfig = {}) {
    this.config = {
      ...DEFAULT_IMPACT_ANALYZER_CONFIG,
      ...config,
      riskWeights: {
        ...DEFAULT_IMPACT_ANALYZER_CONFIG.riskWeights,
        ...config.riskWeights,
      },
    };
  }

  /**
   * Start a new analysis session
   */
  public async startSession(
    projectId: string,
    changeRequest: ChangeRequest
  ): Promise<ImpactAnalysisSession> {
    await loadYaml();

    // Validate change request
    const validationErrors = this.validateChangeRequest(changeRequest);
    if (validationErrors.length > 0) {
      throw new InvalidChangeRequestError(validationErrors);
    }

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'loading',
      changeRequest,
      impactAnalysis: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      errors: [],
    };

    return this.session;
  }

  /**
   * Check available inputs for analysis
   */
  public async checkAvailableInputs(projectId: string, rootPath: string): Promise<AvailableInputs> {
    const basePath = path.join(rootPath, this.config.scratchpadBasePath);

    const currentStatePath = path.join(basePath, 'state', projectId, 'current_state.yaml');
    const architecturePath = path.join(basePath, 'analysis', projectId, 'architecture_overview.yaml');
    const dependencyPath = path.join(basePath, 'analysis', projectId, 'dependency_graph.json');

    const [hasCurrentState, hasArchitectureOverview, hasDependencyGraph] = await Promise.all([
      this.fileExists(currentStatePath),
      this.fileExists(architecturePath),
      this.fileExists(dependencyPath),
    ]);

    return {
      hasCurrentState,
      hasArchitectureOverview,
      hasDependencyGraph,
      paths: {
        currentState: hasCurrentState ? currentStatePath : undefined,
        architectureOverview: hasArchitectureOverview ? architecturePath : undefined,
        dependencyGraph: hasDependencyGraph ? dependencyPath : undefined,
      },
    };
  }

  /**
   * Analyze the change request and generate impact report
   */
  public async analyze(rootPath: string): Promise<ImpactAnalysisResult> {
    const session = this.ensureSession();
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Update session status
      this.session = {
        ...session,
        status: 'analyzing',
        updatedAt: new Date().toISOString(),
      };

      // Step 1: Check and load available inputs
      const inputs = await this.checkAvailableInputs(session.projectId, rootPath);
      if (!inputs.hasCurrentState && !inputs.hasArchitectureOverview && !inputs.hasDependencyGraph) {
        throw new NoInputsAvailableError(session.projectId, [
          inputs.paths.currentState ?? 'current_state.yaml',
          inputs.paths.architectureOverview ?? 'architecture_overview.yaml',
          inputs.paths.dependencyGraph ?? 'dependency_graph.json',
        ]);
      }

      // Step 2: Load inputs
      const currentStatePath = inputs.paths.currentState;
      const architecturePath = inputs.paths.architectureOverview;
      const dependencyPath = inputs.paths.dependencyGraph;

      const currentState =
        inputs.hasCurrentState && currentStatePath !== undefined
          ? await this.loadCurrentState(currentStatePath)
          : null;
      const architectureOverview =
        inputs.hasArchitectureOverview && architecturePath !== undefined
          ? await this.loadArchitectureOverview(architecturePath)
          : null;
      const dependencyGraph =
        inputs.hasDependencyGraph && dependencyPath !== undefined
          ? await this.loadDependencyGraph(dependencyPath)
          : null;

      if (!inputs.hasCurrentState) {
        warnings.push('Current state not available - traceability analysis limited');
      }
      if (!inputs.hasArchitectureOverview) {
        warnings.push('Architecture overview not available - pattern analysis limited');
      }
      if (!inputs.hasDependencyGraph) {
        warnings.push('Dependency graph not available - dependency chain analysis limited');
      }

      // Get change request (guaranteed to exist by startSession validation)
      const changeRequest = session.changeRequest;
      if (changeRequest === null) {
        throw new Error('Change request is required for analysis');
      }

      // Step 3: Classify the change
      const changeScope = this.classifyChange(changeRequest);

      // Step 4: Identify affected components
      const affectedComponents = this.identifyAffectedComponents(
        changeRequest,
        currentState,
        dependencyGraph,
        architectureOverview
      );

      // Step 5: Identify affected files
      const affectedFiles = this.identifyAffectedFiles(
        changeRequest,
        affectedComponents,
        architectureOverview
      );

      // Step 6: Identify affected requirements
      const affectedRequirements = this.identifyAffectedRequirements(
        changeRequest,
        affectedComponents,
        currentState
      );

      // Step 7: Build dependency chain
      const dependencyChain = this.buildDependencyChain(
        affectedComponents,
        dependencyGraph
      );

      // Step 8: Assess risks
      const riskAssessment = this.assessRisks(
        changeScope,
        affectedComponents,
        dependencyChain,
        architectureOverview
      );

      // Step 9: Predict regression risks
      const regressionRisks = this.predictRegressionRisks(
        affectedComponents,
        dependencyChain,
        architectureOverview
      );

      // Step 10: Generate recommendations
      const recommendations = this.generateRecommendations(
        changeScope,
        riskAssessment,
        affectedComponents,
        regressionRisks
      );

      // Step 11: Calculate statistics
      const endTime = Date.now();
      const statistics: AnalysisStatistics = {
        totalAffectedComponents: affectedComponents.length,
        totalAffectedFiles: affectedFiles.length,
        totalAffectedRequirements: affectedRequirements.length,
        directImpacts: affectedComponents.filter((c) => c.type === 'direct').length,
        indirectImpacts: affectedComponents.filter((c) => c.type === 'indirect').length,
        analysisDurationMs: endTime - startTime,
      };

      // Build impact analysis
      const impactAnalysis: ImpactAnalysis = {
        requestSummary: changeRequest.description,
        analysisDate: new Date().toISOString(),
        analysisVersion: '1.0.0',
        changeScope,
        affectedComponents,
        affectedFiles,
        affectedRequirements,
        dependencyChain,
        riskAssessment,
        regressionRisks,
        recommendations,
        statistics,
      };

      // Write output
      const outputPath = await this.writeImpactReport(session.projectId, impactAnalysis, rootPath);

      // Update session
      this.session = {
        ...session,
        status: 'completed',
        impactAnalysis,
        updatedAt: new Date().toISOString(),
        warnings,
      };

      return {
        success: true,
        projectId: session.projectId,
        outputPath,
        impactAnalysis,
        warnings,
      };
    } catch (error) {
      // Update session with error
      this.session = {
        ...session,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        errors: [
          ...(this.session?.errors ?? []),
          error instanceof Error ? error.message : String(error),
        ],
        warnings,
      };
      throw error;
    }
  }

  /**
   * Get current session
   */
  public getSession(): ImpactAnalysisSession | null {
    return this.session;
  }

  /**
   * Parse change request from text
   */
  public parseChangeRequest(input: string): ChangeRequest {
    if (!input || input.trim().length === 0) {
      throw new ChangeRequestParseError('Empty input', input);
    }

    const trimmed = input.trim();

    // Try to parse as YAML
    if (trimmed.startsWith('change_request:') || trimmed.includes('description:')) {
      try {
        const parsed = yaml?.load(trimmed);
        if (parsed !== null && typeof parsed === 'object') {
          if ('change_request' in parsed) {
            return (parsed as { change_request: ChangeRequest }).change_request;
          }
          if ('description' in parsed) {
            return parsed as ChangeRequest;
          }
        }
      } catch {
        // Fall through to text parsing
      }
    }

    // Treat as plain text description
    return {
      description: trimmed,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureSession(): ImpactAnalysisSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  private validateChangeRequest(request: ChangeRequest): string[] {
    const errors: string[] = [];

    if (!request.description || request.description.trim().length === 0) {
      errors.push('Change request description is required');
    }

    if (request.description && request.description.length > 10000) {
      errors.push('Change request description exceeds maximum length (10000 characters)');
    }

    return errors;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadCurrentState(filePath: string): Promise<CurrentState> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml?.load(content);

      if (parsed !== null && typeof parsed === 'object' && 'current_state' in parsed) {
        return (parsed as { current_state: CurrentState }).current_state;
      }

      return parsed as CurrentState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileReadError(filePath, 'File not found');
      }
      throw new InputParseError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async loadArchitectureOverview(filePath: string): Promise<ArchitectureOverview> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml?.load(content);

      if (parsed !== null && typeof parsed === 'object' && 'architecture' in parsed) {
        return (parsed as { architecture: ArchitectureOverview }).architecture;
      }

      return parsed as ArchitectureOverview;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileReadError(filePath, 'File not found');
      }
      throw new InputParseError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async loadDependencyGraph(filePath: string): Promise<DependencyGraph> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as DependencyGraph;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileReadError(filePath, 'File not found');
      }
      throw new InputParseError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private classifyChange(request: ChangeRequest): ChangeScope {
    const description = request.description.toLowerCase();

    // Classify type
    let type: ChangeType = 'feature_modify';
    let typeConfidence = 0.5;

    if (this.matchesPatterns(description, ['add', 'new', 'create', 'implement', 'introduce'])) {
      type = 'feature_add';
      typeConfidence = 0.8;
    } else if (this.matchesPatterns(description, ['fix', 'bug', 'issue', 'error', 'crash', 'resolve'])) {
      type = 'bug_fix';
      typeConfidence = 0.85;
    } else if (this.matchesPatterns(description, ['refactor', 'clean', 'reorganize', 'restructure', 'simplify'])) {
      type = 'refactor';
      typeConfidence = 0.8;
    } else if (this.matchesPatterns(description, ['document', 'readme', 'comment', 'docs', 'docstring'])) {
      type = 'documentation';
      typeConfidence = 0.9;
    } else if (this.matchesPatterns(description, ['config', 'build', 'ci', 'deploy', 'infrastructure', 'pipeline'])) {
      type = 'infrastructure';
      typeConfidence = 0.85;
    } else if (this.matchesPatterns(description, ['update', 'change', 'modify', 'enhance', 'improve'])) {
      type = 'feature_modify';
      typeConfidence = 0.7;
    }

    // Estimate size
    let estimatedSize: ChangeSize = 'medium';
    let sizeConfidence = 0.6;

    const wordCount = description.split(/\s+/).length;
    const mentionedComponents = (request.targetComponents ?? []).length;
    const mentionedFiles = (request.targetFiles ?? []).length;

    if (wordCount < 20 && mentionedComponents <= 1 && mentionedFiles <= 2) {
      estimatedSize = 'small';
      sizeConfidence = 0.7;
    } else if (wordCount > 100 || mentionedComponents > 3 || mentionedFiles > 5) {
      estimatedSize = 'large';
      sizeConfidence = 0.75;
    }

    // Also consider keywords for size
    if (this.matchesPatterns(description, ['minor', 'small', 'simple', 'quick', 'trivial'])) {
      estimatedSize = 'small';
      sizeConfidence = Math.max(sizeConfidence, 0.75);
    } else if (this.matchesPatterns(description, ['major', 'large', 'complex', 'comprehensive', 'significant'])) {
      estimatedSize = 'large';
      sizeConfidence = Math.max(sizeConfidence, 0.75);
    }

    const confidence = (typeConfidence + sizeConfidence) / 2;

    return { type, estimatedSize, confidence };
  }

  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern));
  }

  private identifyAffectedComponents(
    request: ChangeRequest,
    currentState: CurrentState | null,
    dependencyGraph: DependencyGraph | null,
    _architecture: ArchitectureOverview | null
  ): AffectedComponent[] {
    const components: AffectedComponent[] = [];
    const description = request.description.toLowerCase();

    // Direct components from request
    if (request.targetComponents) {
      for (const compId of request.targetComponents) {
        components.push({
          componentId: compId,
          componentName: compId,
          type: 'direct',
          impactLevel: 'high',
          reason: 'Explicitly mentioned in change request',
          source: 'code',
        });
      }
    }

    // Components from current state
    if (currentState?.components) {
      for (const comp of currentState.components) {
        // Check if component is mentioned in description
        if (
          description.includes(comp.name.toLowerCase()) ||
          description.includes(comp.id.toLowerCase())
        ) {
          if (!components.some((c) => c.componentId === comp.id)) {
            components.push({
              componentId: comp.id,
              componentName: comp.name,
              type: 'direct',
              impactLevel: 'high',
              reason: `Component name "${comp.name}" mentioned in change request`,
              source: 'documentation',
            });
          }
        }
      }
    }

    // Find indirect impacts through dependencies
    if (dependencyGraph) {
      const directIds = new Set(components.map((c) => c.componentId));
      const visited = new Set<string>();

      for (const directComp of [...components]) {
        this.traceIndirectImpacts(
          directComp.componentId,
          dependencyGraph,
          visited,
          directIds,
          components,
          0
        );
      }
    }

    // If no components found, infer from keywords
    if (components.length === 0) {
      const inferredComponents = this.inferComponentsFromDescription(description, currentState);
      components.push(...inferredComponents);
    }

    return components;
  }

  private traceIndirectImpacts(
    componentId: string,
    graph: DependencyGraph,
    visited: Set<string>,
    directIds: Set<string>,
    components: AffectedComponent[],
    depth: number
  ): void {
    if (depth >= this.config.maxDependencyDepth || visited.has(componentId)) {
      return;
    }
    visited.add(componentId);

    // Find edges where this component is the target (things that depend on it)
    const dependents = graph.edges.filter((e) => e.to === componentId);

    for (const edge of dependents) {
      const fromId = edge.from;
      if (!directIds.has(fromId) && !components.some((c) => c.componentId === fromId)) {
        const impactLevel = this.calculateIndirectImpactLevel(depth);
        components.push({
          componentId: fromId,
          componentName: fromId,
          type: 'indirect',
          impactLevel,
          reason: `Depends on ${componentId} (depth: ${String(depth + 1)})`,
          source: 'code',
        });

        // Continue tracing
        this.traceIndirectImpacts(fromId, graph, visited, directIds, components, depth + 1);
      }
    }
  }

  private calculateIndirectImpactLevel(depth: number): ImpactLevel {
    if (depth <= 1) return 'medium';
    if (depth <= 2) return 'low';
    return 'low';
  }

  private inferComponentsFromDescription(
    description: string,
    currentState: CurrentState | null
  ): AffectedComponent[] {
    const components: AffectedComponent[] = [];

    // Common component keywords
    const componentPatterns: { pattern: string; componentName: string }[] = [
      { pattern: 'auth', componentName: 'AuthenticationService' },
      { pattern: 'login', componentName: 'AuthenticationService' },
      { pattern: 'user', componentName: 'UserService' },
      { pattern: 'api', componentName: 'APIController' },
      { pattern: 'database', componentName: 'DatabaseService' },
      { pattern: 'cache', componentName: 'CacheService' },
      { pattern: 'storage', componentName: 'StorageService' },
      { pattern: 'upload', componentName: 'FileUploadService' },
      { pattern: 'notification', componentName: 'NotificationService' },
      { pattern: 'email', componentName: 'EmailService' },
      { pattern: 'payment', componentName: 'PaymentService' },
      { pattern: 'search', componentName: 'SearchService' },
      { pattern: 'logging', componentName: 'LoggingService' },
      { pattern: 'config', componentName: 'ConfigurationService' },
    ];

    for (const { pattern, componentName } of componentPatterns) {
      if (description.includes(pattern)) {
        // Check if this matches something in current state
        const existingComp = currentState?.components?.find(
          (c) => c.name.toLowerCase().includes(pattern)
        );

        components.push({
          componentId: existingComp?.id ?? `CMP-${componentName.toUpperCase().slice(0, 3)}`,
          componentName: existingComp?.name ?? componentName,
          type: 'direct',
          impactLevel: 'medium',
          reason: `Inferred from keyword "${pattern}" in change request`,
          source: existingComp ? 'both' : 'code',
        });
      }
    }

    return components;
  }

  private identifyAffectedFiles(
    request: ChangeRequest,
    components: readonly AffectedComponent[],
    architecture: ArchitectureOverview | null
  ): AffectedFile[] {
    const files: AffectedFile[] = [];

    // Direct files from request
    if (request.targetFiles) {
      for (const filePath of request.targetFiles) {
        files.push({
          path: filePath,
          changeType: 'modify',
          confidence: 0.95,
          reason: 'Explicitly mentioned in change request',
        });
      }
    }

    // Infer files from components
    if (this.config.includeFilePredictions) {
      for (const comp of components) {
        if (comp.type === 'direct') {
          // Generate potential file paths
          const potentialPaths = this.generatePotentialFilePaths(comp.componentName, architecture);
          for (const pathInfo of potentialPaths) {
            if (!files.some((f) => f.path === pathInfo.path)) {
              files.push({
                path: pathInfo.path,
                changeType: 'modify',
                confidence: pathInfo.confidence,
                reason: `Associated with component ${comp.componentName}`,
              });
            }
          }
        }
      }
    }

    return files;
  }

  private generatePotentialFilePaths(
    componentName: string,
    architecture: ArchitectureOverview | null
  ): { path: string; confidence: number }[] {
    const baseName = this.componentToFileName(componentName);

    // Determine source directory
    const srcDir = architecture?.structure?.sourceDirs?.[0]?.path ?? 'src';

    // Common file patterns
    const patterns = [
      { path: `${srcDir}/${baseName}.ts`, confidence: 0.6 },
      { path: `${srcDir}/${baseName}.js`, confidence: 0.5 },
      { path: `${srcDir}/services/${baseName}.ts`, confidence: 0.55 },
      { path: `${srcDir}/controllers/${baseName}.ts`, confidence: 0.55 },
      { path: `${srcDir}/${baseName.toLowerCase()}/${baseName}.ts`, confidence: 0.5 },
    ];

    return patterns;
  }

  private componentToFileName(componentName: string): string {
    // Convert PascalCase to kebab-case
    return componentName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])(?=[a-z])/g, '$1-$2')
      .toLowerCase();
  }

  private identifyAffectedRequirements(
    request: ChangeRequest,
    components: readonly AffectedComponent[],
    currentState: CurrentState | null
  ): AffectedRequirement[] {
    const requirements: AffectedRequirement[] = [];

    if (!currentState) {
      return requirements;
    }

    const description = request.description.toLowerCase();

    // Check functional requirements
    if (currentState.requirements?.functional) {
      for (const req of currentState.requirements.functional) {
        const title = req.title.toLowerCase();
        const desc = (req.description ?? '').toLowerCase();

        // Check if requirement is related to change
        if (
          this.textsAreRelated(description, title) ||
          this.textsAreRelated(description, desc)
        ) {
          requirements.push({
            requirementId: req.id,
            type: 'functional',
            impact: 'modify',
            reason: `Related to change request based on content similarity`,
          });
        }
      }
    }

    // Check non-functional requirements
    if (currentState.requirements?.nonFunctional) {
      for (const req of currentState.requirements.nonFunctional) {
        const title = req.title.toLowerCase();

        if (this.textsAreRelated(description, title)) {
          requirements.push({
            requirementId: req.id,
            type: 'non_functional',
            impact: 'modify',
            reason: `Related to change request based on content similarity`,
          });
        }
      }
    }

    // Use traceability to find requirements linked to affected components
    if (currentState.traceability) {
      const affectedCompIds = new Set(components.map((c) => c.componentId));

      // Trace SDS -> SRS -> PRD
      if (currentState.traceability.srsToSds) {
        for (const mapping of currentState.traceability.srsToSds) {
          const hasAffectedSds = mapping.sdsIds.some((id) => affectedCompIds.has(id));
          if (hasAffectedSds) {
            if (!requirements.some((r) => r.requirementId === mapping.srsId)) {
              requirements.push({
                requirementId: mapping.srsId,
                type: 'functional',
                impact: 'modify',
                reason: `Traced from affected component through SRS-SDS traceability`,
              });
            }
          }
        }
      }
    }

    return requirements;
  }

  private textsAreRelated(text1: string, text2: string): boolean {
    // Simple word overlap check
    const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 3));

    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        overlap++;
      }
    }

    return overlap >= 2;
  }

  private buildDependencyChain(
    components: readonly AffectedComponent[],
    graph: DependencyGraph | null
  ): DependencyChainEntry[] {
    const chain: DependencyChainEntry[] = [];

    if (!graph) {
      return chain;
    }

    const affectedIds = new Set(components.map((c) => c.componentId));

    for (const edge of graph.edges) {
      if (affectedIds.has(edge.from) || affectedIds.has(edge.to)) {
        const propagation = this.calculateImpactPropagation(edge, components);
        chain.push({
          fromComponent: edge.from,
          toComponent: edge.to,
          relationship: edge.type,
          impactPropagation: propagation,
        });
      }
    }

    return chain;
  }

  private calculateImpactPropagation(
    edge: { from: string; to: string; weight?: number },
    components: readonly AffectedComponent[]
  ): ImpactPropagation {
    const fromComp = components.find((c) => c.componentId === edge.from);
    const toComp = components.find((c) => c.componentId === edge.to);

    if (fromComp?.type === 'direct' && toComp?.type === 'direct') {
      return 'high';
    }
    if (fromComp?.type === 'direct' || toComp?.type === 'direct') {
      return 'medium';
    }
    return 'low';
  }

  private assessRisks(
    changeScope: ChangeScope,
    components: readonly AffectedComponent[],
    dependencyChain: readonly DependencyChainEntry[],
    architecture: ArchitectureOverview | null
  ): RiskAssessment {
    const factors: RiskFactor[] = [];

    // Complexity risk
    const complexityScore = this.calculateComplexityScore(components, changeScope);
    factors.push({
      name: 'Complexity',
      level: this.scoreToRiskLevel(complexityScore),
      description: `Change affects ${String(components.length)} components with ${changeScope.estimatedSize} scope`,
      mitigation: components.length > 5
        ? 'Consider breaking down into smaller, incremental changes'
        : 'Proceed with standard review process',
    });

    // Coupling risk
    const couplingScore = this.calculateCouplingScore(dependencyChain, components);
    factors.push({
      name: 'Coupling',
      level: this.scoreToRiskLevel(couplingScore),
      description: `${String(dependencyChain.length)} dependency relationships affected`,
      mitigation: couplingScore > 0.5
        ? 'Carefully review all dependent components'
        : 'Standard dependency verification sufficient',
    });

    // Scope risk
    const scopeScore = this.calculateScopeScore(changeScope);
    factors.push({
      name: 'Scope',
      level: this.scoreToRiskLevel(scopeScore),
      description: `${changeScope.type} change with ${changeScope.estimatedSize} estimated size`,
      mitigation: scopeScore > 0.5
        ? 'Implement in phases with intermediate validation'
        : 'Direct implementation appropriate',
    });

    // Architecture risk
    if (architecture) {
      const archRisk = this.assessArchitectureRisk(components, architecture);
      factors.push(archRisk);
    }

    // Calculate overall risk
    const overallScore =
      complexityScore * this.config.riskWeights.complexity +
      couplingScore * this.config.riskWeights.coupling +
      scopeScore * this.config.riskWeights.scope;

    const overallRisk = this.scoreToRiskLevel(overallScore);

    return {
      overallRisk,
      confidence: changeScope.confidence,
      factors,
    };
  }

  private calculateComplexityScore(
    components: readonly AffectedComponent[],
    changeScope: ChangeScope
  ): number {
    let score = 0;

    // Component count factor
    if (components.length > 10) score += 0.4;
    else if (components.length > 5) score += 0.25;
    else if (components.length > 2) score += 0.15;

    // High impact components
    const highImpact = components.filter((c) => c.impactLevel === 'high').length;
    score += highImpact * 0.1;

    // Size factor
    if (changeScope.estimatedSize === 'large') score += 0.3;
    else if (changeScope.estimatedSize === 'medium') score += 0.15;

    return Math.min(score, 1.0);
  }

  private calculateCouplingScore(
    chain: readonly DependencyChainEntry[],
    components: readonly AffectedComponent[]
  ): number {
    if (chain.length === 0) return 0;

    // High propagation edges
    const highProp = chain.filter((e) => e.impactPropagation === 'high').length;
    const mediumProp = chain.filter((e) => e.impactPropagation === 'medium').length;

    let score = 0;
    score += highProp * 0.2;
    score += mediumProp * 0.1;
    score += (chain.length / Math.max(components.length, 1)) * 0.2;

    return Math.min(score, 1.0);
  }

  private calculateScopeScore(changeScope: ChangeScope): number {
    let score = 0;

    // Type factor
    switch (changeScope.type) {
      case 'feature_add':
        score += 0.4;
        break;
      case 'feature_modify':
        score += 0.3;
        break;
      case 'refactor':
        score += 0.35;
        break;
      case 'bug_fix':
        score += 0.2;
        break;
      case 'documentation':
        score += 0.1;
        break;
      case 'infrastructure':
        score += 0.45;
        break;
    }

    // Size factor
    switch (changeScope.estimatedSize) {
      case 'large':
        score += 0.3;
        break;
      case 'medium':
        score += 0.15;
        break;
      case 'small':
        score += 0.05;
        break;
    }

    return Math.min(score, 1.0);
  }

  private assessArchitectureRisk(
    components: readonly AffectedComponent[],
    architecture: ArchitectureOverview
  ): RiskFactor {
    let riskLevel: RiskLevel = 'low';
    let description = 'Changes align with existing architecture patterns';
    let mitigation = 'Standard architectural review';

    // Check if changes span multiple architectural boundaries
    const patterns = architecture.patterns ?? [];
    const affectedPatterns = patterns.filter((p) => {
      const locations = p.locations;
      if (locations === undefined || locations.length === 0) {
        return false;
      }
      return locations.some((loc) =>
        components.some((c) => loc.path.includes(c.componentName.toLowerCase()))
      );
    });

    if (affectedPatterns.length > 2) {
      riskLevel = 'high';
      description = `Changes span ${String(affectedPatterns.length)} architectural patterns`;
      mitigation = 'Conduct architecture review before implementation';
    } else if (affectedPatterns.length > 1) {
      riskLevel = 'medium';
      description = `Changes affect ${String(affectedPatterns.length)} architectural boundaries`;
      mitigation = 'Verify pattern consistency after changes';
    }

    return {
      name: 'Architecture',
      level: riskLevel,
      description,
      mitigation,
    };
  }

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 0.75) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.25) return 'medium';
    return 'low';
  }

  private predictRegressionRisks(
    components: readonly AffectedComponent[],
    dependencyChain: readonly DependencyChainEntry[],
    architecture: ArchitectureOverview | null
  ): RegressionRisk[] {
    if (!this.config.includeRegressionAnalysis) {
      return [];
    }

    const risks: RegressionRisk[] = [];

    // Direct component regressions
    for (const comp of components.filter((c) => c.type === 'direct')) {
      const deps = dependencyChain.filter(
        (d) => d.fromComponent === comp.componentId || d.toComponent === comp.componentId
      );

      const probability = Math.min(0.3 + deps.length * 0.1, 0.9);

      risks.push({
        area: comp.componentName,
        probability,
        severity: comp.impactLevel === 'high' ? 'high' : 'medium',
        testsToRun: [
          `${comp.componentName}.test.ts`,
          `${comp.componentName}.spec.ts`,
          `integration/${comp.componentName}.test.ts`,
        ],
        reason: `Direct modification of ${comp.componentName} may affect ${String(deps.length)} dependencies`,
      });
    }

    // High propagation areas
    const highPropEdges = dependencyChain.filter((e) => e.impactPropagation === 'high');
    for (const edge of highPropEdges) {
      if (!risks.some((r) => r.area === edge.toComponent)) {
        risks.push({
          area: edge.toComponent,
          probability: 0.4,
          severity: 'medium',
          testsToRun: [`${edge.toComponent}.test.ts`],
          reason: `High impact propagation from ${edge.fromComponent}`,
        });
      }
    }

    // Test directory coverage - append test directory path to each risk's tests
    if (architecture?.structure?.testDirs) {
      const testDir = architecture.structure.testDirs[0]?.path ?? 'tests';
      return risks.map((risk) => ({
        ...risk,
        testsToRun: [...risk.testsToRun, `${testDir}/${risk.area.toLowerCase()}`],
      }));
    }

    return risks;
  }

  private generateRecommendations(
    changeScope: ChangeScope,
    riskAssessment: RiskAssessment,
    components: readonly AffectedComponent[],
    regressionRisks: readonly RegressionRisk[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Critical risk blockers
    if (riskAssessment.overallRisk === 'critical') {
      recommendations.push({
        type: 'blocker',
        priority: 1,
        message: 'Critical risk level detected - requires senior review',
        action: 'Schedule architecture review meeting before proceeding',
      });
    }

    // High coupling warning
    const couplingFactor = riskAssessment.factors.find((f) => f.name === 'Coupling');
    if (couplingFactor?.level === 'high' || couplingFactor?.level === 'critical') {
      recommendations.push({
        type: 'warning',
        priority: 2,
        message: 'High coupling detected between affected components',
        action: 'Review all dependency chains and consider decoupling strategies',
      });
    }

    // Large change suggestions
    if (changeScope.estimatedSize === 'large') {
      recommendations.push({
        type: 'suggestion',
        priority: 3,
        message: 'Large change scope detected',
        action: 'Consider breaking down into smaller, incremental pull requests',
      });
    }

    // Regression test requirements
    if (regressionRisks.length > 0) {
      const highRiskAreas = regressionRisks.filter(
        (r) => r.severity === 'high' || r.severity === 'critical'
      );
      if (highRiskAreas.length > 0) {
        recommendations.push({
          type: 'warning',
          priority: 2,
          message: `${String(highRiskAreas.length)} high-risk regression areas identified`,
          action: `Run comprehensive tests for: ${highRiskAreas.map((r) => r.area).join(', ')}`,
        });
      }
    }

    // Component impact info
    const directComponents = components.filter((c) => c.type === 'direct');
    const indirectComponents = components.filter((c) => c.type === 'indirect');

    recommendations.push({
      type: 'info',
      priority: 4,
      message: `Impact analysis complete: ${String(directComponents.length)} direct, ${String(indirectComponents.length)} indirect components`,
      action: 'Review impact report for detailed component analysis',
    });

    // Documentation update suggestion
    if (changeScope.type === 'feature_add' || changeScope.type === 'feature_modify') {
      recommendations.push({
        type: 'suggestion',
        priority: 3,
        message: 'Feature change detected',
        action: 'Update PRD/SRS/SDS documentation to reflect changes',
      });
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private async writeImpactReport(
    projectId: string,
    analysis: ImpactAnalysis,
    rootPath: string
  ): Promise<string> {
    const outputDir = path.join(
      rootPath,
      this.config.scratchpadBasePath,
      'impact',
      projectId
    );

    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      throw new OutputWriteError(
        outputDir,
        error instanceof Error ? error.message : String(error)
      );
    }

    const outputPath = path.join(outputDir, 'impact_report.yaml');

    // Convert to YAML-friendly format with snake_case keys
    const yamlContent = this.formatImpactReportForYaml(analysis);

    try {
      const yamlString = yaml?.dump(yamlContent);
      if (yamlString === undefined || yamlString === '') {
        throw new Error('YAML dump failed');
      }
      await fs.writeFile(outputPath, yamlString, 'utf-8');
      return outputPath;
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private formatImpactReportForYaml(analysis: ImpactAnalysis): Record<string, unknown> {
    return {
      impact_analysis: {
        request_summary: analysis.requestSummary,
        analysis_date: analysis.analysisDate,
        analysis_version: analysis.analysisVersion,

        change_scope: {
          type: analysis.changeScope.type,
          estimated_size: analysis.changeScope.estimatedSize,
          confidence: analysis.changeScope.confidence,
        },

        affected_components: analysis.affectedComponents.map((c) => ({
          component_id: c.componentId,
          component_name: c.componentName,
          type: c.type,
          impact_level: c.impactLevel,
          reason: c.reason,
          source: c.source,
        })),

        affected_files: analysis.affectedFiles.map((f) => ({
          path: f.path,
          change_type: f.changeType,
          confidence: f.confidence,
          reason: f.reason,
        })),

        affected_requirements: analysis.affectedRequirements.map((r) => ({
          requirement_id: r.requirementId,
          type: r.type,
          impact: r.impact,
          reason: r.reason,
        })),

        dependency_chain: analysis.dependencyChain.map((d) => ({
          from_component: d.fromComponent,
          to_component: d.toComponent,
          relationship: d.relationship,
          impact_propagation: d.impactPropagation,
        })),

        risk_assessment: {
          overall_risk: analysis.riskAssessment.overallRisk,
          confidence: analysis.riskAssessment.confidence,
          factors: analysis.riskAssessment.factors.map((f) => ({
            name: f.name,
            level: f.level,
            description: f.description,
            mitigation: f.mitigation,
          })),
        },

        regression_risks: analysis.regressionRisks.map((r) => ({
          area: r.area,
          probability: r.probability,
          severity: r.severity,
          tests_to_run: r.testsToRun,
          reason: r.reason,
        })),

        recommendations: analysis.recommendations.map((r) => ({
          type: r.type,
          priority: r.priority,
          message: r.message,
          action: r.action,
        })),

        statistics: {
          total_affected_components: analysis.statistics.totalAffectedComponents,
          total_affected_files: analysis.statistics.totalAffectedFiles,
          total_affected_requirements: analysis.statistics.totalAffectedRequirements,
          direct_impacts: analysis.statistics.directImpacts,
          indirect_impacts: analysis.statistics.indirectImpacts,
          analysis_duration_ms: analysis.statistics.analysisDurationMs,
        },
      },
    };
  }
}

// Singleton instance
let agentInstance: ImpactAnalyzerAgent | null = null;

/**
 * Get singleton instance of ImpactAnalyzerAgent
 */
export function getImpactAnalyzerAgent(
  config?: ImpactAnalyzerConfig
): ImpactAnalyzerAgent {
  if (agentInstance === null) {
    agentInstance = new ImpactAnalyzerAgent(config);
  }
  return agentInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetImpactAnalyzerAgent(): void {
  agentInstance = null;
}
