/**
 * SRS Parser module
 *
 * Parses Software Requirements Specification (SRS) markdown documents
 * and extracts features, use cases, NFRs, and metadata for SDS generation.
 */

import type {
  ParsedSRS,
  ParsedSRSFeature,
  ParsedUseCase,
  ParsedNFR,
  ParsedConstraint,
  SRSDocumentMetadata,
  AlternativeScenario,
  Priority,
  MutableParsedFeature,
  MutableParsedUseCase,
  MutableParsedNFR,
  MutableParsedConstraint,
} from './types.js';
import { SRSParseError } from './errors.js';

/**
 * SRS parser options
 */
export interface SRSParserOptions {
  /** Enable strict mode (throw on parse errors) */
  readonly strict?: boolean;
  /** Parse use cases */
  readonly parseUseCases?: boolean;
  /** Parse NFRs */
  readonly parseNFRs?: boolean;
}

/**
 * Default parser options
 */
const DEFAULT_OPTIONS: Required<SRSParserOptions> = {
  strict: false,
  parseUseCases: true,
  parseNFRs: true,
};

/**
 * Regular expressions for parsing SRS sections
 */
const PATTERNS = {
  /** Document metadata table row */
  metadataRow: /^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|$/,
  /** Feature header (e.g., ### SF-001: Feature Name) */
  featureHeader: /^###\s+(SF-\d{3}):\s*(.+)$/,
  /** Use case header (e.g., #### UC-001: Use Case Name) */
  useCaseHeader: /^####\s+(UC-\d{3}):\s*(.+)$/,
  /** NFR header (e.g., ### NFR-001: NFR Name) */
  nfrHeader: /^###\s+(NFR-\d{3}):\s*(.+)$/,
  /** Constraint header */
  constraintHeader: /^###\s+(CON-\d{3}):\s*(.+)$/,
  /** Priority value (P0-P3) */
  priority: /^P[0-3]$/,
  /** Source requirement reference (e.g., FR-001) */
  sourceRequirement: /FR-\d{3}/g,
  /** Section header */
  sectionHeader: /^##\s+\d+\.?\s*(.+)$/,
  /** Subsection header */
  subsectionHeader: /^###\s+\d+\.?\d*\s*(.+)$/,
  /** List item */
  listItem: /^[-*]\s+(.+)$/,
  /** Numbered list item */
  numberedListItem: /^\d+\.\s+(.+)$/,
  /** Attribute row in table */
  attributeRow: /^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|$/,
  /** Use case ID reference */
  useCaseRef: /UC-\d{3}/g,
} as const;

/**
 * Parser for SRS markdown documents
 */
export class SRSParser {
  private readonly options: Required<SRSParserOptions>;

  constructor(options: SRSParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse an SRS markdown document
   * @param content - The markdown content to parse
   * @returns Parsed SRS structure
   * @throws SRSParseError if parsing fails in strict mode
   */
  public parse(content: string): ParsedSRS {
    const lines = content.split('\n');
    const metadata = this.parseMetadata(lines);
    const { productName, productDescription } = this.parseProductInfo(lines);
    const features = this.parseFeatures(lines);
    const useCases = this.options.parseUseCases ? this.parseUseCases(lines) : [];
    const nfrs = this.options.parseNFRs ? this.parseNFRs(lines) : [];
    const constraints = this.parseConstraints(lines);
    const assumptions = this.parseAssumptions(lines);

    return {
      metadata,
      productName,
      productDescription,
      features,
      useCases,
      nfrs,
      constraints,
      assumptions,
    };
  }

  /**
   * Parse document metadata from the header table
   */
  private parseMetadata(lines: readonly string[]): SRSDocumentMetadata {
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
      sourcePRD: metadata['source_prd'] ?? metadata['source'] ?? '',
      version: metadata['version'] ?? '1.0.0',
      status: metadata['status'] ?? 'Draft',
      projectId: metadata['project_id'] ?? this.extractProjectId(metadata['document_id'] ?? ''),
      createdDate: metadata['created'] ?? metadata['created_date'] ?? '',
      updatedDate: metadata['last_updated'] ?? metadata['updated_date'] ?? '',
    };
  }

  /**
   * Extract project ID from document ID
   */
  private extractProjectId(documentId: string): string {
    // SRS-001 -> 001, SRS-agent-driven-sdlc -> agent-driven-sdlc
    const match = /^SRS-(.+)$/.exec(documentId);
    return match?.[1] ?? documentId;
  }

  /**
   * Parse product information
   */
  private parseProductInfo(lines: readonly string[]): {
    productName: string;
    productDescription: string;
  } {
    let productName = '';
    let productDescription = '';
    let inIntroduction = false;
    const descriptionLines: string[] = [];

    for (const line of lines) {
      // Check for Introduction or Overview section
      if (line.match(/^##\s+1\.?\s*(Introduction|Overview)/i)) {
        inIntroduction = true;
        continue;
      }

      // Check for next section
      if (inIntroduction && line.match(/^##\s+\d/)) {
        break;
      }

      if (inIntroduction) {
        // Extract product name from Purpose subsection or first heading
        if (line.match(/^###\s+.*Purpose/i) || line.match(/^###\s+.*Product/i)) {
          continue;
        }

        // Look for product name in bold or as first significant text
        const boldMatch = /\*\*([^*]+)\*\*/.exec(line);
        if (boldMatch && !productName) {
          productName = boldMatch[1] ?? '';
        }

        // Collect description lines
        if (line.trim() && !line.startsWith('#')) {
          descriptionLines.push(line.trim());
        }
      }
    }

    productDescription = descriptionLines.join(' ').slice(0, 500);

    // Fallback: try to extract from title
    if (!productName) {
      for (const line of lines) {
        if (line.startsWith('# ')) {
          const titleMatch = /^#\s+(.+?)\s*(SRS|Software Requirements|Specification)?$/i.exec(line);
          if (titleMatch) {
            productName = titleMatch[1]?.trim() ?? '';
            break;
          }
        }
      }
    }

    return { productName, productDescription };
  }

  /**
   * Parse features from the Features section
   */
  private parseFeatures(lines: readonly string[]): readonly ParsedSRSFeature[] {
    const features: ParsedSRSFeature[] = [];
    let inFeaturesSection = false;
    let currentFeature: MutableParsedFeature | null = null;
    let currentSection = '';
    let acceptanceCriteria: string[] = [];
    let descriptionLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Check for Features section
      if (line.match(/^##\s+\d*\.?\s*(Software\s+)?Features/i)) {
        inFeaturesSection = true;
        continue;
      }

      // Check for next major section (end of Features)
      if (inFeaturesSection && line.match(/^##\s+\d+\./) && !line.match(/Features/i)) {
        // Save current feature if exists
        if (currentFeature != null && currentFeature.id !== '') {
          features.push(this.finalizeFeature(currentFeature, descriptionLines, acceptanceCriteria));
          currentFeature = null; // Prevent double-push at end of function
        }
        break;
      }

      if (!inFeaturesSection) continue;

      // Check for feature header
      const headerMatch = PATTERNS.featureHeader.exec(line);
      if (headerMatch) {
        // Save previous feature
        if (currentFeature != null && currentFeature.id !== '') {
          features.push(this.finalizeFeature(currentFeature, descriptionLines, acceptanceCriteria));
        }

        // Start new feature
        currentFeature = {
          id: headerMatch[1] ?? '',
          name: headerMatch[2]?.trim() ?? '',
          priority: 'P1',
          sourceRequirements: [],
          useCaseIds: [],
        };
        currentSection = '';
        descriptionLines = [];
        acceptanceCriteria = [];
        continue;
      }

      if (!currentFeature) continue;

      // Parse attribute rows
      const attrMatch = PATTERNS.attributeRow.exec(line);
      if (attrMatch) {
        const [, key, value] = attrMatch;
        const normalizedKey = key?.trim().toLowerCase() ?? '';
        const normalizedValue = value?.trim() ?? '';

        if (normalizedKey === 'priority' && normalizedValue) {
          currentFeature.priority = this.parsePriority(normalizedValue);
        } else if (normalizedKey.includes('source') && normalizedValue) {
          const reqs = normalizedValue.match(PATTERNS.sourceRequirement);
          if (reqs) {
            currentFeature.sourceRequirements = reqs;
          }
        } else if (normalizedKey.includes('use case') && normalizedValue) {
          const ucs = normalizedValue.match(PATTERNS.useCaseRef);
          if (ucs) {
            currentFeature.useCaseIds = ucs;
          }
        }
        continue;
      }

      // Track current subsection
      if (line.match(/\*\*Description:?\*\*/i) || line.match(/^####\s+Description/i)) {
        currentSection = 'description';
        continue;
      } else if (
        line.match(/\*\*Acceptance Criteria:?\*\*/i) ||
        line.match(/^####\s+Acceptance/i)
      ) {
        currentSection = 'acceptance';
        continue;
      } else if (line.startsWith('---') || line.match(/^###\s+SF-/)) {
        currentSection = '';
        continue;
      }

      // Collect content based on section
      if (currentSection === 'description' && line.trim()) {
        descriptionLines.push(line.trim());
      } else if (currentSection === 'acceptance') {
        const listMatch = PATTERNS.listItem.exec(line) ?? PATTERNS.numberedListItem.exec(line);
        if (listMatch != null && listMatch[1] != null && listMatch[1] !== '') {
          acceptanceCriteria.push(listMatch[1].trim());
        }
      }
    }

    // Don't forget the last feature
    if (currentFeature != null && currentFeature.id !== '') {
      features.push(this.finalizeFeature(currentFeature, descriptionLines, acceptanceCriteria));
    }

    return features;
  }

  /**
   * Finalize a feature with all collected data
   */
  private finalizeFeature(
    feature: Partial<ParsedSRSFeature>,
    descriptionLines: string[],
    acceptanceCriteria: string[]
  ): ParsedSRSFeature {
    return {
      id: feature.id ?? '',
      name: feature.name ?? '',
      description: descriptionLines.join(' ').trim(),
      priority: feature.priority ?? 'P1',
      sourceRequirements: feature.sourceRequirements ?? [],
      useCaseIds: feature.useCaseIds ?? [],
      acceptanceCriteria,
    };
  }

  /**
   * Parse use cases from the Use Cases section
   */
  private parseUseCases(lines: readonly string[]): readonly ParsedUseCase[] {
    const useCases: ParsedUseCase[] = [];
    let inUseCasesSection = false;
    let currentUseCase: MutableParsedUseCase | null = null;
    let currentSection = '';
    let preconditions: string[] = [];
    let mainScenario: string[] = [];
    let postconditions: string[] = [];
    let alternativeScenarios: AlternativeScenario[] = [];
    let currentAltScenario: { name: string; steps?: string[] } | null = null;
    let currentAltSteps: string[] = [];

    for (const line of lines) {
      // Check for Use Cases section
      if (line.match(/^##\s+\d*\.?\s*Use Cases/i)) {
        inUseCasesSection = true;
        continue;
      }

      // Check for next major section
      if (inUseCasesSection && line.match(/^##\s+\d+\./) && !line.match(/Use Cases/i)) {
        // Save current use case
        if (currentUseCase != null && currentUseCase.id !== '') {
          if (
            currentAltScenario != null &&
            currentAltScenario.name !== '' &&
            currentAltSteps.length > 0
          ) {
            alternativeScenarios.push({ name: currentAltScenario.name, steps: currentAltSteps });
          }
          useCases.push(
            this.finalizeUseCase(
              currentUseCase,
              preconditions,
              mainScenario,
              postconditions,
              alternativeScenarios
            )
          );
          currentUseCase = null; // Prevent double-push at end of function
        }
        break;
      }

      if (!inUseCasesSection) continue;

      // Check for use case header
      const headerMatch = PATTERNS.useCaseHeader.exec(line);
      if (headerMatch) {
        // Save previous use case
        if (currentUseCase != null && currentUseCase.id !== '') {
          if (
            currentAltScenario != null &&
            currentAltScenario.name !== '' &&
            currentAltSteps.length > 0
          ) {
            alternativeScenarios.push({ name: currentAltScenario.name, steps: currentAltSteps });
          }
          useCases.push(
            this.finalizeUseCase(
              currentUseCase,
              preconditions,
              mainScenario,
              postconditions,
              alternativeScenarios
            )
          );
        }

        // Start new use case
        currentUseCase = {
          id: headerMatch[1] ?? '',
          name: headerMatch[2]?.trim() ?? '',
          primaryActor: '',
          sourceFeatureId: '',
        };
        currentSection = '';
        preconditions = [];
        mainScenario = [];
        postconditions = [];
        alternativeScenarios = [];
        currentAltScenario = null;
        currentAltSteps = [];
        continue;
      }

      if (!currentUseCase) continue;

      // Parse attribute rows
      const attrMatch = PATTERNS.attributeRow.exec(line);
      if (attrMatch) {
        const [, key, value] = attrMatch;
        const normalizedKey = key?.trim().toLowerCase() ?? '';
        const normalizedValue = value?.trim() ?? '';

        if (normalizedKey.includes('actor') && normalizedValue) {
          currentUseCase.primaryActor = normalizedValue;
        } else if (normalizedKey.includes('feature') && normalizedValue) {
          const sfMatch = /SF-\d{3}/.exec(normalizedValue);
          if (sfMatch) {
            currentUseCase.sourceFeatureId = sfMatch[0];
          }
        }
        continue;
      }

      // Track sections
      if (line.match(/\*\*Preconditions?:?\*\*/i) || line.match(/^#####?\s+Preconditions?/i)) {
        currentSection = 'preconditions';
        continue;
      } else if (
        line.match(/\*\*Main (Success )?Scenario:?\*\*/i) ||
        line.match(/^#####?\s+Main/i)
      ) {
        currentSection = 'main';
        continue;
      } else if (
        line.match(/\*\*Postconditions?:?\*\*/i) ||
        line.match(/^#####?\s+Postconditions?/i)
      ) {
        currentSection = 'postconditions';
        continue;
      } else if (
        line.match(/\*\*Alternative/i) ||
        line.match(/\*\*Extensions?:?\*\*/i) ||
        line.match(/^#####?\s+Alternative/i)
      ) {
        currentSection = 'alternative';
        continue;
      } else if (line.match(/^#####\s+(.+)$/) && currentSection === 'alternative') {
        // New alternative scenario
        if (
          currentAltScenario != null &&
          currentAltScenario.name !== '' &&
          currentAltSteps.length > 0
        ) {
          alternativeScenarios.push({ name: currentAltScenario.name, steps: currentAltSteps });
        }
        const altMatch = /^#####\s+(.+)$/.exec(line);
        currentAltScenario = { name: altMatch?.[1] ?? '' };
        currentAltSteps = [];
        continue;
      }

      // Collect content based on section
      const listMatch = PATTERNS.listItem.exec(line) ?? PATTERNS.numberedListItem.exec(line);
      if (listMatch != null && listMatch[1] != null && listMatch[1] !== '') {
        const item = listMatch[1].trim();
        switch (currentSection) {
          case 'preconditions':
            preconditions.push(item);
            break;
          case 'main':
            mainScenario.push(item);
            break;
          case 'postconditions':
            postconditions.push(item);
            break;
          case 'alternative':
            if (currentAltScenario) {
              currentAltSteps.push(item);
            } else {
              // Start implicit alternative scenario
              currentAltScenario = { name: 'Alternative Flow' };
              currentAltSteps = [item];
            }
            break;
        }
      }
    }

    // Don't forget the last use case
    if (currentUseCase != null && currentUseCase.id !== '') {
      if (
        currentAltScenario != null &&
        currentAltScenario.name !== '' &&
        currentAltSteps.length > 0
      ) {
        alternativeScenarios.push({ name: currentAltScenario.name, steps: currentAltSteps });
      }
      useCases.push(
        this.finalizeUseCase(
          currentUseCase,
          preconditions,
          mainScenario,
          postconditions,
          alternativeScenarios
        )
      );
    }

    return useCases;
  }

  /**
   * Finalize a use case with all collected data
   */
  private finalizeUseCase(
    useCase: Partial<ParsedUseCase>,
    preconditions: string[],
    mainScenario: string[],
    postconditions: string[],
    alternativeScenarios: AlternativeScenario[]
  ): ParsedUseCase {
    return {
      id: useCase.id ?? '',
      name: useCase.name ?? '',
      primaryActor: useCase.primaryActor ?? 'User',
      preconditions,
      mainScenario,
      postconditions,
      alternativeScenarios,
      sourceFeatureId: useCase.sourceFeatureId ?? '',
    };
  }

  /**
   * Parse NFRs from the Non-Functional Requirements section
   */
  private parseNFRs(lines: readonly string[]): readonly ParsedNFR[] {
    const nfrs: ParsedNFR[] = [];
    let inNFRSection = false;
    let currentNFR: MutableParsedNFR | null = null;
    let descriptionLines: string[] = [];

    for (const line of lines) {
      // Check for NFR section
      if (line.match(/^##\s+\d*\.?\s*Non-?Functional Requirements?/i)) {
        inNFRSection = true;
        continue;
      }

      // Check for next major section
      if (inNFRSection && line.match(/^##\s+\d+\./) && !line.match(/Non-?Functional/i)) {
        if (currentNFR != null && currentNFR.id !== '') {
          nfrs.push(this.finalizeNFR(currentNFR, descriptionLines));
          currentNFR = null; // Prevent double-push at end of function
        }
        break;
      }

      if (!inNFRSection) continue;

      // Check for NFR header
      const headerMatch = PATTERNS.nfrHeader.exec(line);
      if (headerMatch) {
        if (currentNFR != null && currentNFR.id !== '') {
          nfrs.push(this.finalizeNFR(currentNFR, descriptionLines));
        }

        currentNFR = {
          id: headerMatch[1] ?? '',
          category: this.extractNFRCategory(headerMatch[2] ?? ''),
          priority: 'P1',
        };
        descriptionLines = [];
        continue;
      }

      if (!currentNFR) continue;

      // Parse attribute rows
      const attrMatch = PATTERNS.attributeRow.exec(line);
      if (attrMatch) {
        const [, key, value] = attrMatch;
        const normalizedKey = key?.trim().toLowerCase() ?? '';
        const normalizedValue = value?.trim() ?? '';

        if (normalizedKey === 'priority' && normalizedValue) {
          currentNFR.priority = this.parsePriority(normalizedValue);
        } else if (normalizedKey.includes('metric') || normalizedKey.includes('target')) {
          currentNFR.metric = normalizedValue;
        } else if (normalizedKey.includes('category')) {
          currentNFR.category = normalizedValue;
        }
        continue;
      }

      // Collect description
      if (line.trim() && !line.startsWith('#') && !line.startsWith('|')) {
        descriptionLines.push(line.trim());
      }
    }

    // Don't forget the last NFR
    if (currentNFR != null && currentNFR.id !== '') {
      nfrs.push(this.finalizeNFR(currentNFR, descriptionLines));
    }

    return nfrs;
  }

  /**
   * Extract NFR category from name
   */
  private extractNFRCategory(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('performance')) return 'Performance';
    if (lowerName.includes('security')) return 'Security';
    if (lowerName.includes('scalab')) return 'Scalability';
    if (lowerName.includes('reliab') || lowerName.includes('availab')) return 'Reliability';
    if (lowerName.includes('maintain')) return 'Maintainability';
    if (lowerName.includes('usab')) return 'Usability';
    if (lowerName.includes('compat')) return 'Compatibility';
    return 'General';
  }

  /**
   * Finalize an NFR with collected data
   */
  private finalizeNFR(nfr: MutableParsedNFR, descriptionLines: string[]): ParsedNFR {
    const base = {
      id: nfr.id,
      category: nfr.category,
      description: descriptionLines.join(' ').trim(),
      priority: nfr.priority,
    };

    if (nfr.metric !== undefined) {
      return { ...base, metric: nfr.metric };
    }

    return base;
  }

  /**
   * Parse constraints from the Constraints section
   */
  private parseConstraints(lines: readonly string[]): readonly ParsedConstraint[] {
    const constraints: ParsedConstraint[] = [];
    let inConstraintsSection = false;
    let currentConstraint: MutableParsedConstraint | null = null;
    let descriptionLines: string[] = [];

    for (const line of lines) {
      // Check for Constraints section
      if (line.match(/^##\s+\d*\.?\s*Constraints?/i)) {
        inConstraintsSection = true;
        continue;
      }

      // Check for next major section
      if (inConstraintsSection && line.match(/^##\s+\d+\./) && !line.match(/Constraints?/i)) {
        if (currentConstraint != null && currentConstraint.id !== '') {
          constraints.push(this.finalizeConstraint(currentConstraint, descriptionLines));
          currentConstraint = null; // Prevent double-push at end of function
        }
        break;
      }

      if (!inConstraintsSection) continue;

      // Check for constraint header
      const headerMatch = PATTERNS.constraintHeader.exec(line);
      if (headerMatch) {
        if (currentConstraint != null && currentConstraint.id !== '') {
          constraints.push(this.finalizeConstraint(currentConstraint, descriptionLines));
        }

        currentConstraint = {
          id: headerMatch[1] ?? '',
          type: this.extractConstraintType(headerMatch[2] ?? ''),
        };
        descriptionLines = [];
        continue;
      }

      if (!currentConstraint) continue;

      // Parse attribute rows
      const attrMatch = PATTERNS.attributeRow.exec(line);
      if (attrMatch) {
        const [, key, value] = attrMatch;
        const normalizedKey = key?.trim().toLowerCase() ?? '';
        const normalizedValue = value?.trim() ?? '';

        if (normalizedKey.includes('type')) {
          currentConstraint.type = normalizedValue;
        }
        continue;
      }

      // Collect description
      if (line.trim() && !line.startsWith('#') && !line.startsWith('|')) {
        descriptionLines.push(line.trim());
      }
    }

    // Don't forget the last constraint
    if (currentConstraint != null && currentConstraint.id !== '') {
      constraints.push(this.finalizeConstraint(currentConstraint, descriptionLines));
    }

    return constraints;
  }

  /**
   * Extract constraint type from name
   */
  private extractConstraintType(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('tech')) return 'Technical';
    if (lowerName.includes('business')) return 'Business';
    if (lowerName.includes('regulat') || lowerName.includes('legal')) return 'Regulatory';
    if (lowerName.includes('resource')) return 'Resource';
    if (lowerName.includes('time') || lowerName.includes('schedule')) return 'Schedule';
    return 'General';
  }

  /**
   * Finalize a constraint with collected data
   */
  private finalizeConstraint(
    constraint: Partial<ParsedConstraint>,
    descriptionLines: string[]
  ): ParsedConstraint {
    return {
      id: constraint.id ?? '',
      type: constraint.type ?? 'General',
      description: descriptionLines.join(' ').trim(),
    };
  }

  /**
   * Parse assumptions from the Assumptions section
   */
  private parseAssumptions(lines: readonly string[]): readonly string[] {
    const assumptions: string[] = [];
    let inAssumptionsSection = false;

    for (const line of lines) {
      // Check for Assumptions section
      if (line.match(/^##\s+\d*\.?\s*Assumptions?/i)) {
        inAssumptionsSection = true;
        continue;
      }

      // Check for next major section
      if (inAssumptionsSection && line.match(/^##\s+\d+\./) && !line.match(/Assumptions?/i)) {
        break;
      }

      if (!inAssumptionsSection) continue;

      // Collect list items
      const listMatch = PATTERNS.listItem.exec(line) ?? PATTERNS.numberedListItem.exec(line);
      if (listMatch != null && listMatch[1] != null && listMatch[1] !== '') {
        assumptions.push(listMatch[1].trim());
      }
    }

    return assumptions;
  }

  /**
   * Parse priority value
   */
  private parsePriority(value: string): Priority {
    const normalized = value.trim().toUpperCase();
    if (PATTERNS.priority.test(normalized)) {
      return normalized as Priority;
    }
    // Try to extract from longer string
    const match = /P[0-3]/.exec(normalized);
    if (match !== null) {
      return match[0] as Priority;
    }
    return 'P1';
  }

  /**
   * Validate parsed SRS structure
   * @throws SRSParseError if validation fails in strict mode
   */
  public validate(srs: ParsedSRS): readonly string[] {
    const errors: string[] = [];

    // Check metadata
    if (!srs.metadata.documentId) {
      errors.push('Missing document ID in metadata');
    }

    // Check features
    if (srs.features.length === 0) {
      errors.push('No features found in SRS');
    }

    // Check for duplicate feature IDs
    const featureIds = new Set<string>();
    for (const feature of srs.features) {
      if (featureIds.has(feature.id)) {
        errors.push(`Duplicate feature ID: ${feature.id}`);
      }
      featureIds.add(feature.id);
    }

    // Check for duplicate use case IDs
    const useCaseIds = new Set<string>();
    for (const useCase of srs.useCases) {
      if (useCaseIds.has(useCase.id)) {
        errors.push(`Duplicate use case ID: ${useCase.id}`);
      }
      useCaseIds.add(useCase.id);

      // Check use case has source feature
      if (useCase.sourceFeatureId && !featureIds.has(useCase.sourceFeatureId)) {
        errors.push(
          `Use case ${useCase.id} references unknown feature: ${useCase.sourceFeatureId}`
        );
      }
    }

    if (this.options.strict && errors.length > 0) {
      throw new SRSParseError('validation', errors.join('; '));
    }

    return errors;
  }
}
