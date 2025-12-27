/**
 * SDS Parser module
 *
 * Parses Software Design Specification (SDS) markdown documents
 * and extracts components, interfaces, and metadata.
 */

import type {
  ParsedSDS,
  SDSComponent,
  SDSInterface,
  SDSMetadata,
  SDSMethod,
  SDSParserOptions,
  TechnologyEntry,
  TraceabilityEntry,
  Priority,
} from './types.js';
import { SDSParseError } from './errors.js';

/**
 * Default parser options
 */
const DEFAULT_OPTIONS: Required<SDSParserOptions> = {
  strict: false,
  extractInterfaces: true,
  parseTraceability: true,
};

/**
 * Regular expressions for parsing SDS sections
 */
const PATTERNS = {
  /** Document metadata table row */
  metadataRow: /^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|$/,
  /** Component header (e.g., ### CMP-001: Component Name) */
  componentHeader: /^###\s+(CMP-\d{3}):\s*(.+)$/,
  /** Component attribute row */
  attributeRow: /^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|$/,
  /** Priority value (P0-P3) */
  priority: /^P[0-3]$/,
  /** Source feature reference */
  sourceFeature: /^SF-\d{3}$/,
  /** Interface code block start */
  interfaceStart: /^```typescript\s*$/,
  /** Code block end */
  codeBlockEnd: /^```\s*$/,
  /** Interface definition */
  interfaceDefinition: /^interface\s+(\w+)\s*\{/,
  /** Method signature */
  methodSignature: /^\s*(\w+)\s*\([^)]*\)\s*:\s*([^;]+);?\s*$/,
  /** Technology stack row */
  techStackRow: /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/,
  /** Traceability matrix row */
  traceabilityRow: /^\|\s*(CMP-\d{3})\s*\|\s*(SF-\d{3})\s*\|\s*([^|]+)\s*\|\s*(FR-\d{3})\s*\|$/,
  /** Dependencies list item */
  dependencyItem: /^-\s*(CMP-\d{3}|[^-\s].*)/,
  /** Section header */
  sectionHeader: /^##\s+\d+\.\s+(.+)$/,
  /** Subsection header */
  subsectionHeader: /^###\s+\d+\.\d+\s+(.+)$/,
} as const;

/**
 * Parser for SDS markdown documents
 */
export class SDSParser {
  private readonly options: Required<SDSParserOptions>;

  constructor(options: SDSParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse an SDS markdown document
   * @param content - The markdown content to parse
   * @returns Parsed SDS structure
   * @throws SDSParseError if parsing fails in strict mode
   */
  public parse(content: string): ParsedSDS {
    const lines = content.split('\n');
    const metadata = this.parseMetadata(lines);
    const components = this.parseComponents(lines);
    const technologyStack = this.parseTechnologyStack(lines);
    const traceabilityMatrix = this.options.parseTraceability
      ? this.parseTraceabilityMatrix(lines)
      : [];

    return {
      metadata,
      components,
      technologyStack,
      traceabilityMatrix,
    };
  }

  /**
   * Parse document metadata from the header table
   */
  private parseMetadata(lines: readonly string[]): SDSMetadata {
    const metadata: Record<string, string> = {};

    for (const line of lines) {
      const match = PATTERNS.metadataRow.exec(line);
      if (match) {
        const [, key, value] = match;
        if (key !== undefined && key !== '' && value !== undefined && value !== '') {
          metadata[key.trim().toLowerCase().replace(/\s+/g, '_')] = value.trim();
        }
      }
      // Stop after the metadata table
      if (line.startsWith('---') && Object.keys(metadata).length > 0) {
        break;
      }
    }

    return {
      documentId: metadata['document_id'] ?? '',
      sourceSRS: metadata['source_srs'] ?? '',
      sourcePRD: metadata['source_prd'] ?? '',
      version: metadata['version'] ?? '1.0.0',
      status: metadata['status'] ?? 'Draft',
      createdDate: metadata['created'] ?? '',
      updatedDate: metadata['last_updated'] ?? '',
    };
  }

  /**
   * Mutable parsing state for a component
   */
  private createEmptyParsingState(): {
    id: string;
    name: string;
    sourceFeature: string | null;
    priority: Priority;
  } {
    return {
      id: '',
      name: '',
      sourceFeature: null,
      priority: 'P1' as Priority,
    };
  }

  /**
   * Parse components from the Component Design section
   */
  private parseComponents(lines: readonly string[]): readonly SDSComponent[] {
    const components: SDSComponent[] = [];
    let inComponentSection = false;
    let parsingState: ReturnType<typeof this.createEmptyParsingState> | null = null;
    let currentSection = '';
    let interfaceBuffer: string[] = [];
    let inCodeBlock = false;
    let descriptionLines: string[] = [];
    let implNotesLines: string[] = [];
    let dependencies: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Check for Component Design section
      if (line.match(/^##\s+3\.\s+Component Design/)) {
        inComponentSection = true;
        continue;
      }

      // Check for next major section (end of Component Design)
      if (inComponentSection && line.match(/^##\s+4\./)) {
        // Save current component if exists
        if (parsingState !== null && parsingState.id !== '') {
          components.push(
            this.finalizeComponent(
              parsingState,
              descriptionLines,
              implNotesLines,
              dependencies,
              interfaceBuffer
            )
          );
          parsingState = null; // Prevent double-save at loop end
        }
        break;
      }

      if (!inComponentSection) continue;

      // Check for component header
      const headerMatch = PATTERNS.componentHeader.exec(line);
      if (headerMatch) {
        // Save previous component
        if (parsingState !== null && parsingState.id !== '') {
          components.push(
            this.finalizeComponent(
              parsingState,
              descriptionLines,
              implNotesLines,
              dependencies,
              interfaceBuffer
            )
          );
        }

        // Start new component
        parsingState = this.createEmptyParsingState();
        parsingState.id = headerMatch[1] ?? '';
        parsingState.name = headerMatch[2]?.trim() ?? '';
        currentSection = '';
        descriptionLines = [];
        implNotesLines = [];
        dependencies = [];
        interfaceBuffer = [];
        inCodeBlock = false;
        continue;
      }

      if (!parsingState) continue;

      // Parse attribute rows
      const attrMatch = PATTERNS.attributeRow.exec(line);
      if (attrMatch) {
        const [, key, value] = attrMatch;
        const normalizedKey = key?.trim().toLowerCase() ?? '';
        const normalizedValue = value?.trim() ?? '';

        if (normalizedKey === 'source feature' && normalizedValue !== '') {
          parsingState.sourceFeature = PATTERNS.sourceFeature.test(normalizedValue)
            ? normalizedValue
            : null;
        } else if (normalizedKey === 'priority' && normalizedValue !== '') {
          parsingState.priority = this.parsePriority(normalizedValue);
        }
        continue;
      }

      // Track current subsection
      if (line.startsWith('**Description:**')) {
        currentSection = 'description';
        continue;
      } else if (line.startsWith('**Interfaces:**')) {
        currentSection = 'interfaces';
        continue;
      } else if (line.startsWith('**Dependencies:**')) {
        currentSection = 'dependencies';
        continue;
      } else if (line.startsWith('**Implementation Notes:**')) {
        currentSection = 'implementation';
        continue;
      } else if (line.startsWith('---')) {
        currentSection = '';
        continue;
      }

      // Handle code blocks
      if (PATTERNS.interfaceStart.test(line)) {
        inCodeBlock = true;
        interfaceBuffer = [];
        continue;
      }
      if (PATTERNS.codeBlockEnd.test(line) && inCodeBlock) {
        inCodeBlock = false;
        continue;
      }

      // Collect content based on section
      if (inCodeBlock && currentSection === 'interfaces') {
        interfaceBuffer.push(line);
      } else if (currentSection === 'description' && line.trim()) {
        descriptionLines.push(line);
      } else if (currentSection === 'implementation' && line.trim()) {
        implNotesLines.push(line);
      } else if (currentSection === 'dependencies') {
        const depMatch = PATTERNS.dependencyItem.exec(line);
        const depValue = depMatch?.[1];
        if (depValue !== undefined && depValue !== '') {
          dependencies.push(depValue.trim());
        }
      }
    }

    // Don't forget the last component
    if (parsingState !== null && parsingState.id !== '') {
      components.push(
        this.finalizeComponent(
          parsingState,
          descriptionLines,
          implNotesLines,
          dependencies,
          interfaceBuffer
        )
      );
    }

    return components;
  }

  /**
   * Finalize a component with all its collected data
   */
  private finalizeComponent(
    state: { id: string; name: string; sourceFeature: string | null; priority: Priority },
    descriptionLines: string[],
    implNotesLines: string[],
    dependencies: string[],
    interfaceBuffer: string[]
  ): SDSComponent {
    const interfaces = this.options.extractInterfaces ? this.parseInterfaces(interfaceBuffer) : [];

    return {
      id: state.id,
      name: state.name,
      responsibility: '',
      sourceFeature: state.sourceFeature,
      priority: state.priority,
      description: descriptionLines.join('\n').trim(),
      interfaces,
      dependencies: this.extractComponentDependencies(dependencies),
      implementationNotes: implNotesLines.join('\n').trim(),
    };
  }

  /**
   * Parse interface definitions from TypeScript code
   */
  private parseInterfaces(lines: readonly string[]): readonly SDSInterface[] {
    const interfaces: SDSInterface[] = [];
    const code = lines.join('\n');
    const rawCode = code.trim();

    if (!rawCode) return interfaces;

    // Simple interface extraction
    const interfaceMatch = PATTERNS.interfaceDefinition.exec(code);
    if (interfaceMatch) {
      const name = interfaceMatch[1] ?? 'Unknown';
      const methods = this.parseMethods(lines);

      interfaces.push({
        name,
        methods,
        rawCode,
      });
    }

    return interfaces;
  }

  /**
   * Parse method signatures from interface code
   */
  private parseMethods(lines: readonly string[]): readonly SDSMethod[] {
    const methods: SDSMethod[] = [];

    for (const line of lines) {
      const match = PATTERNS.methodSignature.exec(line);
      if (match) {
        const fullMatch = match[0];
        const name = match[1];
        const returnType = match[2];
        if (name !== undefined && name !== '' && returnType !== undefined && returnType !== '') {
          methods.push({
            name: name.trim(),
            signature: fullMatch.trim(),
            returnType: returnType.trim(),
          });
        }
      }
    }

    return methods;
  }

  /**
   * Extract component IDs from dependency list
   */
  private extractComponentDependencies(dependencies: readonly string[]): readonly string[] {
    return dependencies
      .map((dep) => {
        const match = /CMP-\d{3}/.exec(dep);
        return match ? match[0] : null;
      })
      .filter((dep): dep is string => dep !== null);
  }

  /**
   * Parse priority value
   */
  private parsePriority(value: string): Priority {
    const normalized = value.trim().toUpperCase();
    if (PATTERNS.priority.test(normalized)) {
      return normalized as Priority;
    }
    // Try to extract from longer string (e.g., "P0 / P1 / P2 / P3")
    const match = /P[0-3]/.exec(normalized);
    if (match !== null) {
      return match[0] as Priority;
    }
    return 'P1';
  }

  /**
   * Parse technology stack from Section 2.3
   */
  private parseTechnologyStack(lines: readonly string[]): readonly TechnologyEntry[] {
    const stack: TechnologyEntry[] = [];
    let inTechSection = false;
    let headerSkipped = false;

    for (const line of lines) {
      if (line.match(/^###\s+2\.3\s+Technology Stack/)) {
        inTechSection = true;
        continue;
      }
      if (inTechSection && line.match(/^###?\s+\d+\.\d+/)) {
        break;
      }

      if (!inTechSection) continue;

      // Skip header row and separator
      if (line.includes('Layer') || line.match(/^\|[-\s|]+\|$/)) {
        headerSkipped = true;
        continue;
      }

      if (headerSkipped) {
        const match = PATTERNS.techStackRow.exec(line);
        if (match) {
          const layer = match[1];
          const technology = match[2];
          const version = match[3];
          const rationale = match[4];
          if (
            layer !== undefined &&
            layer !== '' &&
            technology !== undefined &&
            technology !== '' &&
            version !== undefined &&
            version !== '' &&
            rationale !== undefined &&
            rationale !== ''
          ) {
            stack.push({
              layer: layer.trim(),
              technology: technology.trim(),
              version: version.trim(),
              rationale: rationale.trim(),
            });
          }
        }
      }
    }

    return stack;
  }

  /**
   * Parse traceability matrix from Section 9
   */
  private parseTraceabilityMatrix(lines: readonly string[]): readonly TraceabilityEntry[] {
    const matrix: TraceabilityEntry[] = [];
    let inMatrixSection = false;
    let headerSkipped = false;

    for (const line of lines) {
      if (line.match(/^##\s+9\.\s+Traceability Matrix/)) {
        inMatrixSection = true;
        continue;
      }
      if (inMatrixSection && line.match(/^##\s+10\./)) {
        break;
      }

      if (!inMatrixSection) continue;

      // Skip header row and separator
      if (line.includes('Component') || line.match(/^\|[-\s|]+\|$/)) {
        headerSkipped = true;
        continue;
      }

      if (headerSkipped) {
        const match = PATTERNS.traceabilityRow.exec(line);
        if (match) {
          const componentId = match[1];
          const srsFeature = match[2];
          const useCases = match[3];
          const prdRequirement = match[4];
          if (
            componentId !== undefined &&
            componentId !== '' &&
            srsFeature !== undefined &&
            srsFeature !== '' &&
            useCases !== undefined &&
            useCases !== '' &&
            prdRequirement !== undefined &&
            prdRequirement !== ''
          ) {
            matrix.push({
              componentId,
              srsFeature,
              useCases: this.parseUseCases(useCases),
              prdRequirement,
            });
          }
        }
      }
    }

    return matrix;
  }

  /**
   * Parse use case references from a cell value
   */
  private parseUseCases(value: string): readonly string[] {
    const matches = value.match(/UC-\d{3}/g);
    return matches ?? [];
  }

  /**
   * Validate parsed SDS structure
   * @throws SDSParseError if validation fails in strict mode
   */
  public validate(sds: ParsedSDS): readonly string[] {
    const errors: string[] = [];

    // Check metadata
    if (!sds.metadata.documentId) {
      errors.push('Missing document ID in metadata');
    }

    // Check components
    if (sds.components.length === 0) {
      errors.push('No components found in SDS');
    }

    // Check for duplicate component IDs
    const componentIds = new Set<string>();
    for (const component of sds.components) {
      if (componentIds.has(component.id)) {
        errors.push(`Duplicate component ID: ${component.id}`);
      }
      componentIds.add(component.id);
    }

    // Validate component references
    for (const component of sds.components) {
      for (const dep of component.dependencies) {
        if (!componentIds.has(dep)) {
          errors.push(`Component ${component.id} references unknown dependency: ${dep}`);
        }
      }
    }

    if (this.options.strict && errors.length > 0) {
      throw new SDSParseError(errors.join('; '));
    }

    return errors;
  }
}
