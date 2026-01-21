/**
 * Architecture Generator
 *
 * Main class that orchestrates the architecture design generation process.
 * Coordinates SRS parsing, architecture analysis, diagram generation,
 * technology stack selection, and directory structure generation.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 *
 * @module architecture-generator/ArchitectureGenerator
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IAgent } from '../agents/types.js';
import { SRSParser } from './SRSParser.js';
import { ArchitectureAnalyzer } from './ArchitectureAnalyzer.js';
import { DiagramGenerator } from './DiagramGenerator.js';
import { TechnologyStackGenerator } from './TechnologyStackGenerator.js';
import { DirectoryStructureGenerator } from './DirectoryStructureGenerator.js';
import { OutputWriteError } from './errors.js';
import type {
  ParsedSRS,
  ArchitectureDesign,
  ArchitectureGeneratorOptions,
  SRSParserOptions,
  ArchitecturePattern,
} from './types.js';
import { ARCHITECTURE_SCHEMA_VERSION } from './schemas.js';

// ============================================================
// Singleton Instance
// ============================================================

let instance: ArchitectureGenerator | null = null;

// ============================================================
// Configuration
// ============================================================

export interface ArchitectureGeneratorConfig {
  /** Base directory for scratchpad */
  readonly scratchpadDir?: string;
  /** Output directory for generated files */
  readonly outputDir?: string;
  /** Default options for generation */
  readonly defaultOptions?: ArchitectureGeneratorOptions;
}

const DEFAULT_CONFIG: Required<ArchitectureGeneratorConfig> = {
  scratchpadDir: '.ad-sdlc/scratchpad/documents',
  outputDir: 'docs/sds',
  defaultOptions: {
    defaultPattern: 'layered',
    includeAlternatives: true,
    generateAllDiagrams: false,
    verbose: false,
  },
};

// ============================================================
// Architecture Generator Class
// ============================================================

/**
 * Agent ID for ArchitectureGenerator used in AgentFactory
 */
export const ARCHITECTURE_GENERATOR_AGENT_ID = 'architecture-generator-agent';

/**
 * Main architecture generator that orchestrates the design process
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class ArchitectureGenerator implements IAgent {
  public readonly agentId = ARCHITECTURE_GENERATOR_AGENT_ID;
  public readonly name = 'Architecture Generator Agent';

  private readonly config: Required<ArchitectureGeneratorConfig>;
  private readonly srsParser: SRSParser;
  private readonly analyzer: ArchitectureAnalyzer;
  private readonly diagramGenerator: DiagramGenerator;
  private readonly techStackGenerator: TechnologyStackGenerator;
  private readonly directoryGenerator: DirectoryStructureGenerator;
  private initialized = false;

  constructor(config: ArchitectureGeneratorConfig = {}) {
    this.config = {
      scratchpadDir: config.scratchpadDir ?? DEFAULT_CONFIG.scratchpadDir,
      outputDir: config.outputDir ?? DEFAULT_CONFIG.outputDir,
      defaultOptions: {
        ...DEFAULT_CONFIG.defaultOptions,
        ...config.defaultOptions,
      },
    };

    const parserOptions: SRSParserOptions = {
      strict: false,
      extractUseCases: true,
      parseNFRs: true,
    };

    this.srsParser = new SRSParser(parserOptions);
    this.analyzer = new ArchitectureAnalyzer(
      this.config.defaultOptions.defaultPattern as ArchitecturePattern
    );
    this.diagramGenerator = new DiagramGenerator(
      this.config.defaultOptions.generateAllDiagrams ?? false
    );
    this.techStackGenerator = new TechnologyStackGenerator(
      this.config.defaultOptions.includeAlternatives ?? true
    );
    this.directoryGenerator = new DirectoryStructureGenerator();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.resolve();
    this.initialized = true;
  }

  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.initialized = false;
  }

  /**
   * Generate complete architecture design from SRS file
   */
  public generateFromFile(
    srsPath: string,
    options?: ArchitectureGeneratorOptions
  ): ArchitectureDesign {
    const mergedOptions = { ...this.config.defaultOptions, ...options };

    // Parse SRS document
    const srs = this.srsParser.parseFile(srsPath);

    return this.generateFromParsedSRS(srs, mergedOptions);
  }

  /**
   * Generate complete architecture design from SRS content
   */
  public generateFromContent(
    srsContent: string,
    options?: ArchitectureGeneratorOptions
  ): ArchitectureDesign {
    const mergedOptions = { ...this.config.defaultOptions, ...options };

    // Parse SRS content
    const srs = this.srsParser.parse(srsContent);

    return this.generateFromParsedSRS(srs, mergedOptions);
  }

  /**
   * Generate complete architecture design from parsed SRS
   */
  public generateFromParsedSRS(
    srs: ParsedSRS,
    options?: ArchitectureGeneratorOptions
  ): ArchitectureDesign {
    const mergedOptions = { ...this.config.defaultOptions, ...options };

    if (mergedOptions.verbose === true) {
      this.log('Starting architecture generation...');
      this.log(`Features: ${String(srs.features.length)}, NFRs: ${String(srs.nfrs.length)}`);
    }

    // Analyze architecture
    const analysis = this.analyzer.analyze(srs);

    if (mergedOptions.verbose === true) {
      this.log(`Primary pattern: ${analysis.primaryPattern}`);
      this.log(`Supporting patterns: ${analysis.supportingPatterns.join(', ')}`);
    }

    // Generate technology stack
    const technologyStack = this.techStackGenerator.generate(srs, analysis);

    if (mergedOptions.verbose === true) {
      const tech = technologyStack.layers.map((l) => `${l.layer}: ${l.technology}`).join(', ');
      this.log(`Technology stack: ${tech}`);
    }

    // Generate diagrams
    const diagrams = this.diagramGenerator.generate(srs, analysis);

    if (mergedOptions.verbose === true) {
      this.log(`Generated ${String(diagrams.length)} diagram(s)`);
    }

    // Generate directory structure
    const directoryStructure = this.directoryGenerator.generate(srs, analysis, technologyStack);

    if (mergedOptions.verbose === true) {
      this.log(`Directory structure generated for ${analysis.primaryPattern}`);
    }

    // Build metadata
    const metadata = {
      sourceSRS: srs.metadata.documentId,
      generatedAt: new Date().toISOString(),
      version: ARCHITECTURE_SCHEMA_VERSION,
    };

    return {
      analysis,
      technologyStack,
      diagrams,
      directoryStructure,
      metadata,
    };
  }

  /**
   * Generate architecture and save to files
   */
  public generateAndSave(
    srsPath: string,
    projectId: string,
    options?: ArchitectureGeneratorOptions
  ): { design: ArchitectureDesign; outputPath: string } {
    const design = this.generateFromFile(srsPath, options);
    const outputPath = this.saveDesign(design, projectId);

    return { design, outputPath };
  }

  /**
   * Save architecture design to markdown file
   */
  public saveDesign(design: ArchitectureDesign, projectId: string): string {
    const markdown = this.designToMarkdown(design);
    const outputPath = path.join(this.config.outputDir, `SDS-${projectId}-architecture.md`);

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, markdown, 'utf-8');
      return outputPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new OutputWriteError(outputPath, message);
    }
  }

  /**
   * Convert architecture design to markdown format
   */
  public designToMarkdown(design: ArchitectureDesign): string {
    const lines: string[] = [];

    // Header
    lines.push('# System Architecture Design');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| **Source SRS** | ${design.metadata.sourceSRS} |`);
    lines.push(`| **Generated** | ${design.metadata.generatedAt} |`);
    lines.push(`| **Version** | ${design.metadata.version} |`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Architecture Overview
    lines.push('## 1. Architecture Overview');
    lines.push('');
    lines.push(`**Primary Pattern**: ${design.analysis.primaryPattern}`);
    lines.push('');
    if (design.analysis.supportingPatterns.length > 0) {
      lines.push(`**Supporting Patterns**: ${design.analysis.supportingPatterns.join(', ')}`);
      lines.push('');
    }
    lines.push('### Rationale');
    lines.push('');
    lines.push(design.analysis.rationale);
    lines.push('');

    // Architecture Diagram
    const overviewDiagram = design.diagrams.find((d) => d.type === 'architecture-overview');
    if (overviewDiagram) {
      lines.push('### Architecture Diagram');
      lines.push('');
      lines.push(overviewDiagram.code);
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Pattern Recommendations
    lines.push('## 2. Pattern Analysis');
    lines.push('');
    lines.push('| Pattern | Score | Key Reasons |');
    lines.push('|---------|-------|-------------|');
    for (const rec of design.analysis.recommendations) {
      const reasons = rec.reasons.slice(0, 2).join('; ');
      lines.push(`| ${rec.pattern} | ${String(rec.score)}% | ${reasons} |`);
    }
    lines.push('');

    lines.push('---');
    lines.push('');

    // Technology Stack
    lines.push('## 3. Technology Stack');
    lines.push('');
    lines.push(design.technologyStack.rationale);
    lines.push('');
    lines.push('| Layer | Technology | Version | Rationale |');
    lines.push('|-------|------------|---------|-----------|');
    for (const layer of design.technologyStack.layers) {
      lines.push(
        `| ${layer.layer} | ${layer.technology} | ${layer.version} | ${layer.rationale} |`
      );
    }
    lines.push('');

    if (design.technologyStack.compatibilityNotes.length > 0) {
      lines.push('### Compatibility Notes');
      lines.push('');
      for (const note of design.technologyStack.compatibilityNotes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Component Interaction
    const interactionDiagram = design.diagrams.find((d) => d.type === 'component-interaction');
    if (interactionDiagram) {
      lines.push('## 4. Component Interaction');
      lines.push('');
      lines.push(interactionDiagram.description);
      lines.push('');
      lines.push(interactionDiagram.code);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Directory Structure
    lines.push('## 5. Directory Structure');
    lines.push('');
    lines.push(design.directoryStructure.description);
    lines.push('');
    lines.push('```');
    lines.push(DirectoryStructureGenerator.toAsciiTree(design.directoryStructure));
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Architectural Concerns
    if (design.analysis.concerns.length > 0) {
      lines.push('## 6. Architectural Concerns');
      lines.push('');
      lines.push('| Priority | Category | Concern | Mitigation |');
      lines.push('|----------|----------|---------|------------|');
      for (const concern of design.analysis.concerns) {
        lines.push(
          `| ${concern.priority} | ${concern.category} | ${concern.description} | ${concern.mitigation} |`
        );
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Additional Diagrams
    const additionalDiagrams = design.diagrams.filter(
      (d) => d.type !== 'architecture-overview' && d.type !== 'component-interaction'
    );

    if (additionalDiagrams.length > 0) {
      lines.push('## 7. Additional Diagrams');
      lines.push('');
      for (const diagram of additionalDiagrams) {
        lines.push(`### ${diagram.title}`);
        lines.push('');
        lines.push(diagram.description);
        lines.push('');
        lines.push(diagram.code);
        lines.push('');
      }
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('_Auto-generated by AD-SDLC Architecture Generator_');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get SRS file path for a project
   */
  public getSRSPath(projectId: string): string {
    return path.join(this.config.scratchpadDir, projectId, 'srs.md');
  }

  /**
   * Check if SRS exists for a project
   */
  public srsExists(projectId: string): boolean {
    return fs.existsSync(this.getSRSPath(projectId));
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    console.log(`[ArchitectureGenerator] ${message}`);
  }
}

// ============================================================
// Factory Functions
// ============================================================

/**
 * Get singleton instance of ArchitectureGenerator
 */
export function getArchitectureGenerator(
  config?: ArchitectureGeneratorConfig
): ArchitectureGenerator {
  if (!instance) {
    instance = new ArchitectureGenerator(config);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetArchitectureGenerator(): void {
  instance = null;
}
