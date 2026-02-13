/**
 * Component Generator
 *
 * Main class that orchestrates the component design generation process.
 * Coordinates SRS parsing, component generation, interface specification,
 * and API endpoint design.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 *
 * @module component-generator/ComponentGenerator
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IAgent } from '../agents/types.js';
import { InterfaceGenerator } from './InterfaceGenerator.js';
import { APISpecificationGenerator } from './APISpecificationGenerator.js';
import type { Logger } from '../logging/index.js';
import { getLogger } from '../logging/index.js';
import {
  InvalidSRSError,
  ComponentGenerationError,
  DependencyAnalysisError,
  OutputWriteError,
} from './errors.js';
import { COMPONENT_SCHEMA_VERSION, LAYER_DESCRIPTIONS } from './schemas.js';
import type { ParsedSRS } from '../architecture-generator/types.js';
import type {
  SRSFeature,
  ComponentDefinition,
  ComponentDesign,
  ComponentGeneratorOptions,
  TraceabilityEntry,
  UseCaseMapping,
  ComponentDependency,
  ComponentLayer,
} from './types.js';

// ============================================================
// Singleton Instance
// ============================================================

let instance: ComponentGenerator | null = null;

// ============================================================
// Configuration
// ============================================================

export interface ComponentGeneratorConfig {
  /** Base directory for scratchpad */
  readonly scratchpadDir?: string;
  /** Output directory for generated files */
  readonly outputDir?: string;
  /** Default options for generation */
  readonly defaultOptions?: ComponentGeneratorOptions;
  /** Optional logger instance */
  readonly logger?: Logger;
}

const DEFAULT_CONFIG: Required<Omit<ComponentGeneratorConfig, 'logger'>> = {
  scratchpadDir: '.ad-sdlc/scratchpad/documents',
  outputDir: 'docs/sds',
  defaultOptions: {
    defaultLayer: 'application',
    generateAPISpecs: true,
    includeNotes: true,
    verbose: false,
  },
};

// ============================================================
// Component Generator Class
// ============================================================

/**
 * Agent ID for ComponentGenerator used in AgentFactory
 */
export const COMPONENT_GENERATOR_AGENT_ID = 'component-generator-agent';

/**
 * Main component generator that orchestrates the design process
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class ComponentGenerator implements IAgent {
  public readonly agentId = COMPONENT_GENERATOR_AGENT_ID;
  public readonly name = 'Component Generator Agent';

  private readonly config: Required<Omit<ComponentGeneratorConfig, 'logger'>>;
  private readonly interfaceGenerator: InterfaceGenerator;
  private readonly apiSpecGenerator: APISpecificationGenerator;
  private readonly logger: Logger;
  private componentCounter: number;
  private initialized = false;

  constructor(config: ComponentGeneratorConfig = {}) {
    this.config = {
      scratchpadDir: config.scratchpadDir ?? DEFAULT_CONFIG.scratchpadDir,
      outputDir: config.outputDir ?? DEFAULT_CONFIG.outputDir,
      defaultOptions: {
        ...DEFAULT_CONFIG.defaultOptions,
        ...config.defaultOptions,
      },
    };

    this.logger = config.logger ?? getLogger().child({ agent: 'ComponentGenerator' });
    this.interfaceGenerator = new InterfaceGenerator();
    this.apiSpecGenerator = new APISpecificationGenerator();
    this.componentCounter = 0;
  }

  /**
   *
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   *
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.componentCounter = 0;
    this.interfaceGenerator.reset();
    this.initialized = false;
  }

  /**
   * Generate complete component design from parsed SRS
   * @param srs
   * @param options
   */
  public generate(srs: ParsedSRS, options?: ComponentGeneratorOptions): ComponentDesign {
    const mergedOptions = { ...this.config.defaultOptions, ...options };

    // Validate SRS input
    this.validateSRS(srs);

    // Reset counters
    this.componentCounter = 0;
    this.interfaceGenerator.reset();

    if (mergedOptions.verbose === true) {
      this.log('Starting component generation...');
      this.log(`Features: ${String(srs.features.length)}`);
    }

    // Generate components from features
    const components = this.generateComponents(srs, mergedOptions);

    if (mergedOptions.verbose === true) {
      this.log(`Generated ${String(components.length)} component(s)`);
    }

    // Extract API endpoints
    const apiSpecification =
      mergedOptions.generateAPISpecs === true
        ? this.apiSpecGenerator.extractAPIEndpoints(components)
        : [];

    if (mergedOptions.verbose === true) {
      this.log(`Extracted ${String(apiSpecification.length)} API endpoint(s)`);
    }

    // Generate traceability matrix
    const traceabilityMatrix = this.generateTraceabilityMatrix(srs.features, components);

    if (mergedOptions.verbose === true) {
      this.log(`Created traceability matrix with ${String(traceabilityMatrix.length)} entries`);
    }

    // Analyze dependencies
    const dependencies = this.analyzeDependencies(components, srs);

    if (mergedOptions.verbose === true) {
      this.log(`Identified ${String(dependencies.length)} dependencies`);
    }

    // Build metadata
    const metadata = {
      sourceSRS: srs.metadata.documentId,
      generatedAt: new Date().toISOString(),
      version: COMPONENT_SCHEMA_VERSION,
    };

    return {
      components,
      apiSpecification,
      traceabilityMatrix,
      dependencies,
      metadata,
    };
  }

  /**
   * Generate components from SRS features
   * @param srs
   * @param options
   */
  private generateComponents(
    srs: ParsedSRS,
    options: ComponentGeneratorOptions
  ): ComponentDefinition[] {
    const components: ComponentDefinition[] = [];

    for (const feature of srs.features) {
      try {
        const component = this.generateComponentFromFeature(feature, srs, options);
        components.push(component);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new ComponentGenerationError(
          `CMP-${String(this.componentCounter + 1).padStart(3, '0')}`,
          'feature-mapping',
          message
        );
      }
    }

    return components;
  }

  /**
   * Generate a component from a feature
   * @param feature
   * @param srs
   * @param options
   */
  private generateComponentFromFeature(
    feature: SRSFeature,
    srs: ParsedSRS,
    options: ComponentGeneratorOptions
  ): ComponentDefinition {
    this.componentCounter++;
    const id = `CMP-${String(this.componentCounter).padStart(3, '0')}`;
    const name = this.deriveComponentName(feature);
    const layer = this.determineLayer(feature, options.defaultLayer ?? 'application');
    const interfaces = this.interfaceGenerator.generateInterfaces(feature.useCases);
    const dependencies = this.extractDependencies(feature, srs);
    const implementationNotes =
      options.includeNotes === true ? this.generateImplementationNotes(feature, layer) : '';

    return {
      id,
      name,
      responsibility: feature.description,
      sourceFeature: feature.id,
      interfaces,
      dependencies,
      implementationNotes,
      layer,
    };
  }

  /**
   * Derive component name from feature
   * @param feature
   */
  private deriveComponentName(feature: SRSFeature): string {
    // Convert feature name to PascalCase component name
    const words = feature.name.split(/[\s-_]+/);
    const pascalCase = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    // Add appropriate suffix based on feature context
    if (this.isServiceComponent(feature)) {
      return `${pascalCase}Service`;
    }
    if (this.isControllerComponent(feature)) {
      return `${pascalCase}Controller`;
    }
    if (this.isManagerComponent(feature)) {
      return `${pascalCase}Manager`;
    }

    return `${pascalCase}Component`;
  }

  /**
   * Check if feature suggests a service component
   * @param feature
   */
  private isServiceComponent(feature: SRSFeature): boolean {
    const text = `${feature.name} ${feature.description}`.toLowerCase();
    return (
      text.includes('process') ||
      text.includes('execute') ||
      text.includes('perform') ||
      text.includes('service')
    );
  }

  /**
   * Check if feature suggests a controller component
   * @param feature
   */
  private isControllerComponent(feature: SRSFeature): boolean {
    const text = `${feature.name} ${feature.description}`.toLowerCase();
    return (
      text.includes('control') ||
      text.includes('orchestrat') ||
      text.includes('coordinat') ||
      text.includes('manag')
    );
  }

  /**
   * Check if feature suggests a manager component
   * @param feature
   */
  private isManagerComponent(feature: SRSFeature): boolean {
    const text = `${feature.name} ${feature.description}`.toLowerCase();
    return text.includes('manage') || text.includes('handle') || text.includes('track');
  }

  /**
   * Determine component layer from feature
   * @param feature
   * @param defaultLayer
   */
  private determineLayer(feature: SRSFeature, defaultLayer: ComponentLayer): ComponentLayer {
    const text = `${feature.name} ${feature.description}`.toLowerCase();

    if (text.includes('ui') || text.includes('interface') || text.includes('display')) {
      return 'presentation';
    }
    if (text.includes('workflow') || text.includes('orchestrat') || text.includes('process')) {
      return 'application';
    }
    if (
      text.includes('business') ||
      text.includes('rule') ||
      text.includes('policy') ||
      text.includes('validation')
    ) {
      return 'domain';
    }
    if (
      text.includes('database') ||
      text.includes('storage') ||
      text.includes('persist') ||
      text.includes('cache')
    ) {
      return 'infrastructure';
    }
    if (
      text.includes('external') ||
      text.includes('api') ||
      text.includes('integration') ||
      text.includes('third-party')
    ) {
      return 'integration';
    }

    return defaultLayer;
  }

  /**
   * Extract dependencies from feature
   * @param feature
   * @param srs
   */
  private extractDependencies(feature: SRSFeature, srs: ParsedSRS): string[] {
    const dependencies: string[] = [];
    const text = `${feature.name} ${feature.description}`.toLowerCase();

    // Look for references to other features
    for (const otherFeature of srs.features) {
      if (otherFeature.id === feature.id) continue;

      const otherName = otherFeature.name.toLowerCase();
      if (text.includes(otherName) || this.hasUseCaseReference(feature, otherFeature)) {
        dependencies.push(otherFeature.id);
      }
    }

    return dependencies;
  }

  /**
   * Check if feature references another feature's use cases
   * @param feature
   * @param otherFeature
   */
  private hasUseCaseReference(feature: SRSFeature, otherFeature: SRSFeature): boolean {
    const featureText = feature.useCases
      .map((uc) => `${uc.description} ${uc.mainFlow.join(' ')}`)
      .join(' ')
      .toLowerCase();

    for (const uc of otherFeature.useCases) {
      if (featureText.includes(uc.name.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate implementation notes
   * @param feature
   * @param layer
   */
  private generateImplementationNotes(feature: SRSFeature, layer: ComponentLayer): string {
    const notes: string[] = [];
    const layerDescription = LAYER_DESCRIPTIONS[layer] ?? '';

    notes.push(`This component belongs to the ${layer} layer.`);
    if (layerDescription) {
      notes.push(layerDescription);
    }

    // Add priority-based notes
    if (feature.priority === 'P0') {
      notes.push('This is a critical component and should be implemented with high priority.');
    }

    // Add NFR-related notes
    if (feature.nfrs.length > 0) {
      notes.push(`Consider NFRs: ${feature.nfrs.join(', ')}`);
    }

    return notes.join(' ');
  }

  /**
   * Generate traceability matrix
   * @param features
   * @param components
   */
  private generateTraceabilityMatrix(
    features: readonly SRSFeature[],
    components: readonly ComponentDefinition[]
  ): TraceabilityEntry[] {
    const entries: TraceabilityEntry[] = [];

    for (const feature of features) {
      const component = components.find((c) => c.sourceFeature === feature.id);
      if (!component) continue;

      const useCases: UseCaseMapping[] = feature.useCases.map((uc) => ({
        useCaseId: uc.id,
        useCaseName: uc.name,
        interfaceIds: component.interfaces
          .filter((i) => i.sourceUseCase === uc.id)
          .map((i) => i.interfaceId),
      }));

      entries.push({
        featureId: feature.id,
        featureName: feature.name,
        componentId: component.id,
        componentName: component.name,
        useCases,
        interfaces: component.interfaces.map((i) => i.interfaceId),
      });
    }

    return entries;
  }

  /**
   * Analyze component dependencies
   * @param components
   * @param _srs
   */
  private analyzeDependencies(
    components: readonly ComponentDefinition[],
    _srs: ParsedSRS
  ): ComponentDependency[] {
    const dependencies: ComponentDependency[] = [];

    try {
      for (const component of components) {
        for (const depFeatureId of component.dependencies) {
          const targetComponent = components.find((c) => c.sourceFeature === depFeatureId);
          if (targetComponent) {
            dependencies.push({
              sourceId: component.id,
              targetId: targetComponent.id,
              type: 'uses',
              description: `${component.name} depends on ${targetComponent.name}`,
            });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new DependencyAnalysisError(
        components.map((c) => c.id),
        message
      );
    }

    return dependencies;
  }

  /**
   * Validate SRS input
   * @param srs
   */
  private validateSRS(srs: ParsedSRS): void {
    const errors: string[] = [];

    if (srs.features.length === 0) {
      errors.push('SRS must contain at least one feature');
    }

    if (srs.metadata.documentId === '') {
      errors.push('SRS must have valid metadata with document ID');
    }

    if (errors.length > 0) {
      throw new InvalidSRSError(errors);
    }
  }

  /**
   * Generate component design and save to files
   * @param srs
   * @param projectId
   * @param options
   */
  public generateAndSave(
    srs: ParsedSRS,
    projectId: string,
    options?: ComponentGeneratorOptions
  ): { design: ComponentDesign; outputPath: string } {
    const design = this.generate(srs, options);
    const outputPath = this.saveDesign(design, projectId);

    return { design, outputPath };
  }

  /**
   * Save component design to markdown file
   * @param design
   * @param projectId
   */
  public saveDesign(design: ComponentDesign, projectId: string): string {
    const markdown = this.designToMarkdown(design);
    const outputPath = path.join(this.config.outputDir, `SDS-${projectId}-components.md`);

    try {
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
   * Convert component design to markdown format
   * @param design
   */
  public designToMarkdown(design: ComponentDesign): string {
    const lines: string[] = [];

    // Header
    lines.push('# Component Design');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| **Source SRS** | ${design.metadata.sourceSRS} |`);
    lines.push(`| **Generated** | ${design.metadata.generatedAt} |`);
    lines.push(`| **Version** | ${design.metadata.version} |`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Component Overview
    lines.push('## 1. Component Overview');
    lines.push('');
    lines.push('| ID | Name | Layer | Source Feature |');
    lines.push('|----|------|-------|----------------|');
    for (const component of design.components) {
      lines.push(
        `| ${component.id} | ${component.name} | ${component.layer} | ${component.sourceFeature} |`
      );
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Component Details
    lines.push('## 2. Component Definitions');
    lines.push('');
    for (const component of design.components) {
      lines.push(`### ${component.id}: ${component.name}`);
      lines.push('');
      lines.push(`**Layer**: ${component.layer}`);
      lines.push('');
      lines.push(`**Source Feature**: ${component.sourceFeature}`);
      lines.push('');
      lines.push(`**Responsibility**: ${component.responsibility}`);
      lines.push('');

      if (component.dependencies.length > 0) {
        lines.push(`**Dependencies**: ${component.dependencies.join(', ')}`);
        lines.push('');
      }

      if (component.implementationNotes) {
        lines.push(`**Implementation Notes**: ${component.implementationNotes}`);
        lines.push('');
      }

      // Interfaces
      if (component.interfaces.length > 0) {
        lines.push('#### Interfaces');
        lines.push('');
        lines.push('| ID | Type | Source Use Case |');
        lines.push('|----|------|-----------------|');
        for (const iface of component.interfaces) {
          lines.push(`| ${iface.interfaceId} | ${iface.type} | ${iface.sourceUseCase} |`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // API Specification
    if (design.apiSpecification.length > 0) {
      lines.push('## 3. API Specification');
      lines.push('');
      lines.push(this.apiSpecGenerator.generateSpecificationTable(design.apiSpecification));
      lines.push('');

      // Detailed API documentation
      const allInterfaces = design.components.flatMap((c) => c.interfaces);
      lines.push(
        this.apiSpecGenerator.generateDetailedDocumentation(design.apiSpecification, allInterfaces)
      );
      lines.push('---');
      lines.push('');
    }

    // Traceability Matrix
    lines.push('## 4. Traceability Matrix');
    lines.push('');
    lines.push('| Feature | Component | Use Cases | Interfaces |');
    lines.push('|---------|-----------|-----------|------------|');
    for (const entry of design.traceabilityMatrix) {
      const useCases = entry.useCases.map((uc) => uc.useCaseId).join(', ');
      const interfaces = entry.interfaces.join(', ');
      lines.push(`| ${entry.featureId} | ${entry.componentId} | ${useCases} | ${interfaces} |`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Dependencies
    if (design.dependencies.length > 0) {
      lines.push('## 5. Component Dependencies');
      lines.push('');
      lines.push('```mermaid');
      lines.push('graph TD');
      for (const dep of design.dependencies) {
        lines.push(`    ${dep.sourceId}[${dep.sourceId}] --> ${dep.targetId}[${dep.targetId}]`);
      }
      lines.push('```');
      lines.push('');
      lines.push('| Source | Target | Type | Description |');
      lines.push('|--------|--------|------|-------------|');
      for (const dep of design.dependencies) {
        lines.push(`| ${dep.sourceId} | ${dep.targetId} | ${dep.type} | ${dep.description} |`);
      }
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('_Auto-generated by AD-SDLC Component Generator_');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate TypeScript interface definitions
   * @param design
   */
  public generateTypeScriptInterfaces(design: ComponentDesign): string {
    return this.apiSpecGenerator.generateTypeScriptInterfaces(design.apiSpecification);
  }

  /**
   * Log message if verbose mode is enabled
   * @param message
   */
  private log(message: string): void {
    this.logger.debug(message);
  }
}

// ============================================================
// Factory Functions
// ============================================================

/**
 * Get singleton instance of ComponentGenerator
 * @param config
 */
export function getComponentGenerator(config?: ComponentGeneratorConfig): ComponentGenerator {
  if (!instance) {
    instance = new ComponentGenerator(config);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetComponentGenerator(): void {
  instance = null;
}
