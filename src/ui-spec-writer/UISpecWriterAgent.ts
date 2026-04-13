/**
 * UI Specification Writer Agent
 *
 * Generates UI screen specifications, user flow documents, and a design
 * system reference from SRS use cases. Produces structured wireframe
 * descriptions and interaction flows for web/mobile projects.
 *
 * Auto-skips for CLI, API, and library projects that do not have UI surfaces.
 *
 * Implements IAgent interface for AgentFactory integration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';

import type {
  UISpecWriterAgentConfig,
  UISpecGenerationSession,
  UISpecGenerationResult,
  UISpecGenerationStats,
  ParsedSRSForUI,
  ParsedUseCase,
  ParsedFeature,
  ProjectType,
  ScreenSpec,
  FlowSpec,
  DesignSystem,
} from './types.js';
import { SRSNotFoundError, GenerationError, FileWriteError, SessionStateError } from './errors.js';
import { detectScreens } from './ScreenDetector.js';
import { mapFlows } from './FlowMapper.js';
import { generateDesignSystem } from './DesignSystemGenerator.js';

/**
 * Default configuration for the UI Spec Writer Agent
 */
const DEFAULT_CONFIG: Required<UISpecWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/ui',
};

/**
 * Project types that should be auto-skipped (no UI surface)
 */
const SKIP_PROJECT_TYPES: ReadonlySet<ProjectType> = new Set(['cli', 'api', 'library']);

/**
 * Agent ID for UISpecWriterAgent used in AgentFactory
 */
export const UI_SPEC_WRITER_AGENT_ID = 'ui-spec-writer-agent';

/**
 * UI Specification Writer Agent class
 *
 * Orchestrates the generation of UI screen specs, flow docs, and design
 * system references from SRS input. Implements IAgent for unified
 * instantiation through AgentFactory.
 */
export class UISpecWriterAgent implements IAgent {
  public readonly agentId = UI_SPEC_WRITER_AGENT_ID;
  public readonly name = 'UI Specification Writer Agent';

  private readonly config: Required<UISpecWriterAgentConfig>;
  private session: UISpecGenerationSession | null = null;
  private initialized = false;

  constructor(config: UISpecWriterAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the agent (IAgent interface)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources (IAgent interface)
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  /**
   * Get the current session
   * @returns Current UI spec generation session or null if no session is active
   */
  public getSession(): UISpecGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new UI spec generation session
   * @param projectId - Project identifier
   * @returns The new session
   */
  public async startSession(projectId: string): Promise<UISpecGenerationSession> {
    await Promise.resolve();

    const docsDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const srsPath = path.join(docsDir, 'srs.md');

    if (!fs.existsSync(srsPath)) {
      throw new SRSNotFoundError(projectId, srsPath);
    }

    const srsContent = fs.readFileSync(srsPath, 'utf-8');
    const parsedSRS = this.extractSRS(srsContent, projectId);

    const warnings: string[] = [];
    if (parsedSRS.useCases.length === 0 && parsedSRS.features.length === 0) {
      warnings.push(
        'No use cases or features detected in SRS — generated UI spec will be minimal.'
      );
    }

    const shouldSkip = SKIP_PROJECT_TYPES.has(parsedSRS.projectType);
    const skipReason = shouldSkip
      ? `Project type "${parsedSRS.projectType}" does not have a UI surface — stage skipped.`
      : undefined;

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: shouldSkip ? 'completed' : 'pending',
      parsedSRS,
      skipped: shouldSkip,
      ...(skipReason !== undefined && { skipReason }),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(warnings.length > 0 && { warnings }),
    };

    return this.session;
  }

  /**
   * Generate UI specifications from a project
   * @param projectId - Project identifier
   * @returns Generation result
   */
  public async generateFromProject(projectId: string): Promise<UISpecGenerationResult> {
    const startTime = Date.now();

    if (!this.session || this.session.projectId !== projectId) {
      await this.startSession(projectId);
    }

    if (!this.session) {
      throw new GenerationError(projectId, 'initialization', 'Failed to create session');
    }

    // Handle auto-skip for non-UI projects
    if (this.session.skipped) {
      return {
        success: true,
        skipped: true,
        ...(this.session.skipReason !== undefined && { skipReason: this.session.skipReason }),
        projectId,
        screenPaths: [],
        flowPaths: [],
        designSystemPath: '',
        readmePath: '',
        stats: {
          useCasesProcessed: 0,
          screensGenerated: 0,
          flowsGenerated: 0,
          designTokensGenerated: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    try {
      this.updateSession({ status: 'parsing' });

      const { parsedSRS } = this.session;

      this.updateSession({ status: 'generating' });

      const warnings: string[] = this.session.warnings ? [...this.session.warnings] : [];

      // Step 1: Detect screens from use cases and features
      const screens = detectScreens(parsedSRS.useCases, parsedSRS.features);

      // Step 2: Map flows from use cases
      const flows = mapFlows(parsedSRS.useCases, screens);

      // Step 3: Generate design system
      const designSystem = generateDesignSystem(parsedSRS.projectType, screens);

      if (screens.length === 0) {
        warnings.push('No screens detected from SRS content — UI spec is empty.');
      }

      this.updateSession({
        status: 'completed',
        screens,
        flows,
        designSystem,
        ...(warnings.length > 0 && { warnings }),
      });

      const paths = await this.writeOutputFiles(projectId, screens, flows, designSystem);

      const stats: UISpecGenerationStats = {
        useCasesProcessed: parsedSRS.useCases.length,
        screensGenerated: screens.length,
        flowsGenerated: flows.length,
        designTokensGenerated: designSystem.tokens.length,
        processingTimeMs: Date.now() - startTime,
      };

      return {
        success: true,
        skipped: false,
        projectId,
        screenPaths: paths.screenPaths,
        flowPaths: paths.flowPaths,
        designSystemPath: paths.designSystemPath,
        readmePath: paths.readmePath,
        stats,
        ...(warnings.length > 0 && { warnings }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateSession({
        status: 'failed',
        errorMessage,
      });
      throw error;
    }
  }

  /**
   * Finalize the current session and write output files
   * @returns Generation result based on the cached session data
   */
  public async finalize(): Promise<UISpecGenerationResult> {
    if (!this.session) {
      throw new SessionStateError('null', 'active', 'finalize');
    }

    if (this.session.status !== 'completed') {
      throw new SessionStateError(this.session.status, 'completed', 'finalize');
    }

    if (this.session.skipped) {
      return {
        success: true,
        skipped: true,
        ...(this.session.skipReason !== undefined && { skipReason: this.session.skipReason }),
        projectId: this.session.projectId,
        screenPaths: [],
        flowPaths: [],
        designSystemPath: '',
        readmePath: '',
        stats: {
          useCasesProcessed: 0,
          screensGenerated: 0,
          flowsGenerated: 0,
          designTokensGenerated: 0,
          processingTimeMs: 0,
        },
      };
    }

    const screens = this.session.screens ?? [];
    const flows = this.session.flows ?? [];
    const designSystem = this.session.designSystem;

    if (!designSystem) {
      throw new GenerationError(this.session.projectId, 'finalization', 'No generated UI spec');
    }

    const paths = await this.writeOutputFiles(this.session.projectId, screens, flows, designSystem);

    return {
      success: true,
      skipped: false,
      projectId: this.session.projectId,
      screenPaths: paths.screenPaths,
      flowPaths: paths.flowPaths,
      designSystemPath: paths.designSystemPath,
      readmePath: paths.readmePath,
      stats: {
        useCasesProcessed: this.session.parsedSRS.useCases.length,
        screensGenerated: screens.length,
        flowsGenerated: flows.length,
        designTokensGenerated: designSystem.tokens.length,
        processingTimeMs: 0,
      },
    };
  }

  /**
   * Update session with partial data
   * @param updates - Partial session fields to merge
   */
  private updateSession(updates: Partial<UISpecGenerationSession>): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract SRS content for UI specification generation.
   *
   * Parses use cases, features, and detects the project type.
   *
   * @param content - Raw SRS markdown
   * @param projectId - Project identifier
   */
  private extractSRS(content: string, projectId: string): ParsedSRSForUI {
    const docIdMatch =
      content.match(/^doc_id:\s*['"]?([^'"\n]+)['"]?/m) ??
      content.match(/\|\s*\*\*Document ID\*\*\s*\|\s*([^|]+)\s*\|/);
    const documentId = docIdMatch?.[1]?.trim() ?? `SRS-${projectId}`;

    const titleMatch =
      content.match(/^#\s+(?:Software Requirements Specification:\s*)?(.+)$/m) ??
      content.match(/^title:\s*['"]?([^'"\n]+)['"]?/m);
    const productName = titleMatch?.[1]?.trim() ?? projectId;

    const useCases = this.extractUseCases(content);
    const features = this.extractFeatures(content);
    const projectType = this.detectProjectType(content);

    return {
      documentId,
      productName,
      useCases,
      features,
      projectType,
    };
  }

  /**
   * Extract use cases from SRS markdown content.
   *
   * Recognizes headings like `### UC-001: Login` and extracts
   * description, actors, steps, preconditions, postconditions.
   *
   * @param content - Raw SRS markdown
   */
  private extractUseCases(content: string): readonly ParsedUseCase[] {
    const useCases: ParsedUseCase[] = [];

    // Match use case headings: ### UC-001: Title or #### UC-001: Title
    const ucRegex = /^#{2,4}\s+(UC-\d+):\s*(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = ucRegex.exec(content)) !== null) {
      const id = match[1]?.trim() ?? '';
      const title = match[2]?.trim() ?? '';

      if (id.length === 0) continue;

      // Extract the body between this heading and the next heading
      const startIndex = match.index + match[0].length;
      const nextHeading = content.slice(startIndex).search(/^#{2,4}\s/m);
      const body =
        nextHeading !== -1
          ? content.slice(startIndex, startIndex + nextHeading)
          : content.slice(startIndex);

      const description = this.extractSection(body, /description|설명/i) || title;
      const actors = this.extractListItems(body, /actors?|행위자/i);
      const steps = this.extractListItems(body, /steps?|main\s+flow|주요\s*흐름/i);
      const preconditions = this.extractListItems(body, /preconditions?|사전\s*조건/i);
      const postconditions = this.extractListItems(body, /postconditions?|사후\s*조건/i);

      useCases.push({
        id,
        title,
        description,
        actors: actors.length > 0 ? actors : ['User'],
        steps,
        preconditions,
        postconditions,
      });
    }

    return useCases;
  }

  /**
   * Extract features from SRS markdown content.
   *
   * Recognizes headings like `### SF-001: User Authentication`
   *
   * @param content - Raw SRS markdown
   */
  private extractFeatures(content: string): readonly ParsedFeature[] {
    const features: ParsedFeature[] = [];

    const featureRegex = /^#{2,4}\s+(SF-\d+):\s*(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = featureRegex.exec(content)) !== null) {
      const id = match[1]?.trim() ?? '';
      const title = match[2]?.trim() ?? '';

      if (id.length === 0) continue;

      const startIndex = match.index + match[0].length;
      const nextHeading = content.slice(startIndex).search(/^#{2,4}\s/m);
      const body =
        nextHeading !== -1
          ? content.slice(startIndex, startIndex + nextHeading)
          : content.slice(startIndex);

      // First non-empty line is treated as description
      const descLine = body
        .split('\n')
        .find((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
      const description = descLine?.trim() ?? '';

      features.push({ id, title, description });
    }

    return features;
  }

  /**
   * Detect the project type from SRS content.
   *
   * Uses keyword analysis to classify the project as web, mobile,
   * desktop, CLI, API, or library.
   *
   * @param content - Raw SRS markdown
   */
  private detectProjectType(content: string): ProjectType {
    const lower = content.toLowerCase();

    // CLI indicators
    if (
      lower.includes('command-line') ||
      lower.includes('command line') ||
      lower.includes('cli tool') ||
      lower.includes('terminal')
    ) {
      return 'cli';
    }

    // API-only indicators
    if (
      (lower.includes('rest api') ||
        lower.includes('api server') ||
        lower.includes('api service')) &&
      !lower.includes('web app') &&
      !lower.includes('frontend') &&
      !lower.includes('user interface')
    ) {
      return 'api';
    }

    // Library indicators
    if (
      lower.includes('library') ||
      lower.includes('sdk') ||
      lower.includes('npm package') ||
      lower.includes('pip package')
    ) {
      return 'library';
    }

    // Mobile indicators
    if (
      lower.includes('mobile app') ||
      lower.includes('ios') ||
      lower.includes('android') ||
      lower.includes('react native') ||
      lower.includes('flutter')
    ) {
      return 'mobile';
    }

    // Desktop indicators
    if (
      lower.includes('desktop app') ||
      lower.includes('electron') ||
      lower.includes('native app')
    ) {
      return 'desktop';
    }

    // Web indicators (most common default)
    if (
      lower.includes('web') ||
      lower.includes('browser') ||
      lower.includes('frontend') ||
      lower.includes('dashboard') ||
      lower.includes('user interface') ||
      lower.includes('html') ||
      lower.includes('react') ||
      lower.includes('vue') ||
      lower.includes('angular')
    ) {
      return 'web';
    }

    return 'unknown';
  }

  /**
   * Extract a section's text content from markdown body.
   *
   * @param body - Markdown body (after the heading)
   * @param labelPattern - Pattern to match the section label
   */
  private extractSection(body: string, labelPattern: RegExp): string {
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      if (labelPattern.test(line)) {
        // Return the next non-empty line as the section content
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]?.trim();
          if (nextLine !== undefined && nextLine.length > 0 && !nextLine.startsWith('#')) {
            return nextLine.replace(/^[-*]\s*/, '');
          }
        }
      }
    }

    return '';
  }

  /**
   * Extract list items from a section in markdown body.
   *
   * @param body - Markdown body
   * @param labelPattern - Pattern to match the section label
   */
  private extractListItems(body: string, labelPattern: RegExp): readonly string[] {
    const items: string[] = [];
    const lines = body.split('\n');

    let inSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (labelPattern.test(trimmed)) {
        inSection = true;
        continue;
      }

      if (inSection) {
        // Stop at empty lines or new sections
        if (trimmed.length === 0 || /^#+\s/.test(trimmed) || /^\*\*[^*]+\*\*/.test(trimmed)) {
          if (items.length > 0) break;
          continue;
        }

        // Match list items
        const listMatch = trimmed.match(/^(?:\d+[.)]\s*|[-*]\s+)(.+)/);
        if (listMatch?.[1] !== undefined) {
          items.push(listMatch[1].trim());
        }
      }
    }

    return items;
  }

  /**
   * Render a screen specification as markdown.
   *
   * @param screen - Screen specification
   */
  private renderScreenMarkdown(screen: ScreenSpec): string {
    const lines: string[] = [];

    lines.push('---');
    lines.push(`doc_id: ${screen.id}-${screen.nameSlug}`);
    lines.push(`title: "${screen.title}"`);
    lines.push('version: 1.0.0');
    lines.push('status: Draft');
    lines.push('---');
    lines.push('');
    lines.push(`# ${screen.id}: ${screen.title}`);
    lines.push('');
    lines.push('## Purpose');
    lines.push('');
    lines.push(screen.purpose);
    lines.push('');

    if (screen.relatedUseCases.length > 0) {
      lines.push('## Related Use Cases');
      lines.push('');
      for (const ucId of screen.relatedUseCases) {
        lines.push(`- ${ucId}`);
      }
      lines.push('');
    }

    if (screen.relatedFeatures.length > 0) {
      lines.push('## Related Features');
      lines.push('');
      for (const fId of screen.relatedFeatures) {
        lines.push(`- ${fId}`);
      }
      lines.push('');
    }

    if (screen.elements.length > 0) {
      lines.push('## UI Elements');
      lines.push('');
      lines.push('| ID | Type | Label | Data Source | Behavior |');
      lines.push('|----|------|-------|------------|----------|');
      for (const el of screen.elements) {
        lines.push(`| ${el.id} | ${el.type} | ${el.label} | ${el.dataSource} | ${el.behavior} |`);
      }
      lines.push('');
    }

    if (screen.navigationTargets.length > 0) {
      lines.push('## Navigation');
      lines.push('');
      lines.push('Navigates to:');
      for (const target of screen.navigationTargets) {
        lines.push(`- ${target}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Render a flow specification as markdown.
   *
   * @param flow - Flow specification
   */
  private renderFlowMarkdown(flow: FlowSpec): string {
    const lines: string[] = [];

    lines.push('---');
    lines.push(`doc_id: ${flow.id}-${flow.nameSlug}`);
    lines.push(`title: "${flow.title}"`);
    lines.push('version: 1.0.0');
    lines.push('status: Draft');
    lines.push('---');
    lines.push('');
    lines.push(`# ${flow.id}: ${flow.title}`);
    lines.push('');
    lines.push('## Description');
    lines.push('');
    lines.push(flow.description);
    lines.push('');

    if (flow.relatedUseCases.length > 0) {
      lines.push('## Related Use Cases');
      lines.push('');
      for (const ucId of flow.relatedUseCases) {
        lines.push(`- ${ucId}`);
      }
      lines.push('');
    }

    if (flow.preconditions.length > 0) {
      lines.push('## Preconditions');
      lines.push('');
      for (const pre of flow.preconditions) {
        lines.push(`- ${pre}`);
      }
      lines.push('');
    }

    if (flow.steps.length > 0) {
      lines.push('## Flow Steps');
      lines.push('');
      lines.push('| Step | From | To | Action | Condition |');
      lines.push('|------|------|----|--------|-----------|');
      for (const step of flow.steps) {
        lines.push(
          `| ${String(step.stepNumber)} | ${step.fromScreen} | ${step.toScreen} | ${step.action} | ${step.condition || '-'} |`
        );
      }
      lines.push('');

      // Mermaid flow diagram
      lines.push('## Flow Diagram');
      lines.push('');
      lines.push('```mermaid');
      lines.push('graph LR');
      const seenEdges = new Set<string>();
      for (const step of flow.steps) {
        if (step.fromScreen === step.toScreen) continue;
        const edgeKey = `${step.fromScreen}-->${step.toScreen}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);
        lines.push(`    ${step.fromScreen} --> ${step.toScreen}`);
      }
      lines.push('```');
      lines.push('');
    }

    if (flow.outcomes.length > 0) {
      lines.push('## Expected Outcomes');
      lines.push('');
      for (const outcome of flow.outcomes) {
        lines.push(`- ${outcome}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Render the design system document as markdown.
   *
   * @param designSystem - Design system specification
   */
  private renderDesignSystemMarkdown(designSystem: DesignSystem): string {
    const lines: string[] = [];

    lines.push('---');
    lines.push('doc_id: design-system');
    lines.push('title: "Design System"');
    lines.push('version: 1.0.0');
    lines.push('status: Draft');
    lines.push('---');
    lines.push('');
    lines.push('# Design System');
    lines.push('');
    lines.push(`Technology Stack: ${designSystem.technologyStack}`);
    lines.push('');

    // Group tokens by category
    const tokensByCategory = new Map<string, (typeof designSystem.tokens)[number][]>();
    for (const token of designSystem.tokens) {
      const existing = tokensByCategory.get(token.category) ?? [];
      existing.push(token);
      tokensByCategory.set(token.category, existing);
    }

    lines.push('## Design Tokens');
    lines.push('');

    for (const [category, tokens] of tokensByCategory) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      lines.push('');
      lines.push('| Name | Value | Description |');
      lines.push('|------|-------|-------------|');
      for (const token of tokens) {
        lines.push(`| ${token.name} | \`${token.value}\` | ${token.description} |`);
      }
      lines.push('');
    }

    if (designSystem.components.length > 0) {
      lines.push('## Component Library');
      lines.push('');
      for (const component of designSystem.components) {
        lines.push(`### ${component.name}`);
        lines.push('');
        lines.push(component.description);
        lines.push('');
        if (component.variants.length > 0) {
          lines.push('**Variants:**');
          for (const variant of component.variants) {
            lines.push(`- ${variant}`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Render the UI README index as markdown.
   *
   * @param screens - Generated screens
   * @param flows - Generated flows
   * @param productName - Product name
   */
  private renderReadmeMarkdown(
    screens: readonly ScreenSpec[],
    flows: readonly FlowSpec[],
    productName: string
  ): string {
    const lines: string[] = [];

    lines.push('---');
    lines.push('doc_id: ui-readme');
    lines.push('title: "UI Specifications"');
    lines.push('version: 1.0.0');
    lines.push('status: Draft');
    lines.push('---');
    lines.push('');
    lines.push(`# UI Specifications: ${productName}`);
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push(
      `This directory contains UI specifications for ${productName}, including screen definitions, user flows, and design system tokens.`
    );
    lines.push('');

    if (screens.length > 0) {
      lines.push('## Screens');
      lines.push('');
      lines.push('| ID | Screen | Related Use Cases |');
      lines.push('|----|--------|-------------------|');
      for (const screen of screens) {
        const ucList = screen.relatedUseCases.join(', ') || '-';
        lines.push(
          `| [${screen.id}](screens/${screen.id}-${screen.nameSlug}.md) | ${screen.title} | ${ucList} |`
        );
      }
      lines.push('');
    }

    if (flows.length > 0) {
      lines.push('## User Flows');
      lines.push('');
      lines.push('| ID | Flow | Related Use Cases |');
      lines.push('|----|------|-------------------|');
      for (const flow of flows) {
        const ucList = flow.relatedUseCases.join(', ') || '-';
        lines.push(
          `| [${flow.id}](flows/${flow.id}-${flow.nameSlug}.md) | ${flow.title} | ${ucList} |`
        );
      }
      lines.push('');
    }

    lines.push('## Design System');
    lines.push('');
    lines.push(
      '- [Design System](design-system.md) — Design tokens and component library reference'
    );
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Write all output files for screens, flows, design system, and README.
   *
   * @param projectId - Project identifier
   * @param screens - Screen specifications
   * @param flows - Flow specifications
   * @param designSystem - Design system specification
   * @returns Paths to all written files
   */
  private async writeOutputFiles(
    projectId: string,
    screens: readonly ScreenSpec[],
    flows: readonly FlowSpec[],
    designSystem: DesignSystem
  ): Promise<{
    screenPaths: readonly string[];
    flowPaths: readonly string[];
    designSystemPath: string;
    readmePath: string;
  }> {
    await Promise.resolve();

    const publicDir = this.config.publicDocsPath;
    const screensDir = path.join(publicDir, 'screens');
    const flowsDir = path.join(publicDir, 'flows');

    try {
      fs.mkdirSync(screensDir, { recursive: true });
      fs.mkdirSync(flowsDir, { recursive: true });

      // Write screen files
      const screenPaths: string[] = [];
      for (const screen of screens) {
        const filename = `${screen.id}-${screen.nameSlug}.md`;
        const filePath = path.join(screensDir, filename);
        fs.writeFileSync(filePath, this.renderScreenMarkdown(screen), 'utf-8');
        screenPaths.push(filePath);
      }

      // Write flow files
      const flowPaths: string[] = [];
      for (const flow of flows) {
        const filename = `${flow.id}-${flow.nameSlug}.md`;
        const filePath = path.join(flowsDir, filename);
        fs.writeFileSync(filePath, this.renderFlowMarkdown(flow), 'utf-8');
        flowPaths.push(filePath);
      }

      // Write design system
      const designSystemPath = path.join(publicDir, 'design-system.md');
      fs.writeFileSync(designSystemPath, this.renderDesignSystemMarkdown(designSystem), 'utf-8');

      // Write README
      const productName = this.session?.parsedSRS.productName ?? projectId;
      const readmePath = path.join(publicDir, 'README.md');
      fs.writeFileSync(readmePath, this.renderReadmeMarkdown(screens, flows, productName), 'utf-8');

      return { screenPaths, flowPaths, designSystemPath, readmePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileWriteError(publicDir, message);
    }
  }
}

// Singleton pattern
let instance: UISpecWriterAgent | null = null;

/**
 * Get the singleton instance of UISpecWriterAgent
 * @param config - Optional configuration (used only for the first call)
 * @returns The singleton instance
 */
export function getUISpecWriterAgent(config?: UISpecWriterAgentConfig): UISpecWriterAgent {
  if (!instance) {
    instance = new UISpecWriterAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetUISpecWriterAgent(): void {
  instance = null;
}
