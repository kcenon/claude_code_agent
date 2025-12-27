/**
 * SRS Parser for Architecture Generator
 *
 * Parses Software Requirements Specification (SRS) documents
 * to extract features, use cases, and requirements for architecture analysis.
 *
 * @module architecture-generator/SRSParser
 */

import * as fs from 'fs';
import { SRSNotFoundError, SRSValidationError } from './errors.js';
import type {
  ParsedSRS,
  SRSMetadata,
  SRSFeature,
  SRSUseCase,
  NonFunctionalRequirement,
  Constraint,
  NFRCategory,
  ConstraintType,
  SRSParserOptions,
} from './types.js';

// ============================================================
// Constants
// ============================================================

const METADATA_TABLE_REGEX = /\|\s*\*\*([^|]+)\*\*\s*\|\s*([^|]+)\s*\|/g;
const FEATURE_HEADER_REGEX = /^###\s+SF-(\d{3}):\s*(.+)$/m;
const USE_CASE_HEADER_REGEX = /^####\s+UC-(\d{3}):\s*(.+)$/m;
const NFR_HEADER_REGEX = /^###\s+NFR-(\d{3}):\s*(.+)$/m;
const CONSTRAINT_HEADER_REGEX = /^###\s+CON-(\d{3}):\s*(.+)$/m;
const PRIORITY_REGEX = /\*\*Priority\*\*:\s*(P[0-3])/i;

const NFR_CATEGORY_KEYWORDS: Record<string, NFRCategory> = {
  performance: 'performance',
  latency: 'performance',
  throughput: 'performance',
  response: 'performance',
  scalability: 'scalability',
  scale: 'scalability',
  load: 'scalability',
  reliability: 'reliability',
  uptime: 'reliability',
  fault: 'reliability',
  recovery: 'reliability',
  security: 'security',
  authentication: 'security',
  authorization: 'security',
  encryption: 'security',
  maintainability: 'maintainability',
  testability: 'maintainability',
  modularity: 'maintainability',
  usability: 'usability',
  accessibility: 'usability',
  user: 'usability',
  availability: 'availability',
  redundancy: 'availability',
  failover: 'availability',
};

const CONSTRAINT_TYPE_KEYWORDS: Record<string, ConstraintType> = {
  technical: 'technical',
  technology: 'technical',
  platform: 'technical',
  business: 'business',
  budget: 'business',
  cost: 'business',
  regulatory: 'regulatory',
  compliance: 'regulatory',
  legal: 'regulatory',
  gdpr: 'regulatory',
  resource: 'resource',
  team: 'resource',
  staff: 'resource',
  timeline: 'timeline',
  deadline: 'timeline',
  schedule: 'timeline',
};

// ============================================================
// SRS Parser Class
// ============================================================

/**
 * Parses SRS documents to extract structured data for architecture analysis
 */
export class SRSParser {
  private readonly options: Required<SRSParserOptions>;

  constructor(options: SRSParserOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      extractUseCases: options.extractUseCases ?? true,
      parseNFRs: options.parseNFRs ?? true,
    };
  }

  /**
   * Parse an SRS file from the given path
   */
  public parseFile(filePath: string): ParsedSRS {
    if (!fs.existsSync(filePath)) {
      throw new SRSNotFoundError(filePath);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parse SRS content string
   */
  public parse(content: string): ParsedSRS {
    const errors: string[] = [];

    const metadata = this.parseMetadata(content, errors);
    const features = this.parseFeatures(content, errors);
    const nfrs = this.options.parseNFRs ? this.parseNFRs(content, errors) : [];
    const constraints = this.parseConstraints(content, errors);
    const assumptions = this.parseAssumptions(content);

    if (this.options.strict && errors.length > 0) {
      throw new SRSValidationError(errors);
    }

    return {
      metadata,
      features,
      nfrs,
      constraints,
      assumptions,
    };
  }

  /**
   * Parse document metadata from the header table
   */
  private parseMetadata(content: string, errors: string[]): SRSMetadata {
    const metadataSection = this.extractSection(content, '# SRS:', '## ') ?? '';
    const metadata: Record<string, string> = {};

    let match;
    while ((match = METADATA_TABLE_REGEX.exec(metadataSection)) !== null) {
      const key = match[1]?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';
      const value = match[2]?.trim() ?? '';
      metadata[key] = value;
    }

    const documentId = metadata['document_id'] ?? this.extractDocumentId(content) ?? 'SRS-UNKNOWN';
    const sourcePRD = metadata['source_prd'] ?? metadata['prd'] ?? 'PRD-UNKNOWN';
    const version = metadata['version'] ?? '1.0.0';
    const status = metadata['status'] ?? 'Draft';
    const productName = this.extractProductName(content) ?? 'Unknown Product';

    if (documentId === 'SRS-UNKNOWN') {
      errors.push('Document ID not found in metadata');
    }

    return {
      documentId,
      sourcePRD,
      version,
      status,
      productName,
    };
  }

  /**
   * Extract document ID from content
   */
  private extractDocumentId(content: string): string | undefined {
    const match = content.match(/SRS-(\w+)/);
    return match !== null && match[1] !== undefined ? `SRS-${match[1]}` : undefined;
  }

  /**
   * Extract product name from title
   */
  private extractProductName(content: string): string | undefined {
    const match = content.match(/^#\s+SRS:\s*(.+)$/m);
    return match?.[1]?.trim();
  }

  /**
   * Parse system features from the document
   */
  private parseFeatures(content: string, errors: string[]): SRSFeature[] {
    const features: SRSFeature[] = [];
    const featureSection = this.extractSection(content, '## System Features', '## ');

    if (featureSection === undefined) {
      if (this.options.strict) {
        errors.push('System Features section not found');
      }
      return features;
    }

    const featureBlocks = this.splitByHeaders(featureSection, /^###\s+SF-\d{3}/m);

    for (const block of featureBlocks) {
      const feature = this.parseFeatureBlock(block, errors);
      if (feature) {
        features.push(feature);
      }
    }

    return features;
  }

  /**
   * Parse a single feature block
   */
  private parseFeatureBlock(block: string, errors: string[]): SRSFeature | null {
    const headerMatch = block.match(FEATURE_HEADER_REGEX);
    if (!headerMatch) {
      return null;
    }

    const id = `SF-${headerMatch[1] ?? '000'}`;
    const name = headerMatch[2]?.trim() ?? '';
    const description = this.extractDescription(block);
    const priority = this.extractPriority(block);
    const useCases = this.options.extractUseCases ? this.parseUseCases(block, errors) : [];
    const nfrs = this.extractNFRReferences(block);

    return {
      id,
      name,
      description,
      priority,
      useCases,
      nfrs,
    };
  }

  /**
   * Parse use cases from a feature block
   */
  private parseUseCases(featureBlock: string, errors: string[]): SRSUseCase[] {
    const useCases: SRSUseCase[] = [];
    const useCaseBlocks = this.splitByHeaders(featureBlock, /^####\s+UC-\d{3}/m);

    for (const block of useCaseBlocks) {
      const useCase = this.parseUseCaseBlock(block, errors);
      if (useCase) {
        useCases.push(useCase);
      }
    }

    return useCases;
  }

  /**
   * Parse a single use case block
   */
  private parseUseCaseBlock(block: string, _errors: string[]): SRSUseCase | null {
    const headerMatch = block.match(USE_CASE_HEADER_REGEX);
    if (!headerMatch) {
      return null;
    }

    const id = `UC-${headerMatch[1] ?? '000'}`;
    const name = headerMatch[2]?.trim() ?? '';
    const description = this.extractDescription(block);
    const actor = this.extractField(block, 'Actor') ?? 'User';
    const preconditions = this.extractList(block, 'Preconditions');
    const mainFlow = this.extractList(block, 'Main Flow');
    const alternativeFlows = this.extractList(block, 'Alternative Flow');
    const postconditions = this.extractList(block, 'Postconditions');

    return {
      id,
      name,
      description,
      actor,
      preconditions,
      mainFlow,
      alternativeFlows,
      postconditions,
    };
  }

  /**
   * Parse non-functional requirements
   */
  private parseNFRs(content: string, errors: string[]): NonFunctionalRequirement[] {
    const nfrs: NonFunctionalRequirement[] = [];
    const nfrSection = this.extractSection(content, '## Non-Functional Requirements', '## ');

    if (nfrSection === undefined) {
      return nfrs;
    }

    const nfrBlocks = this.splitByHeaders(nfrSection, /^###\s+NFR-\d{3}/m);

    for (const block of nfrBlocks) {
      const nfr = this.parseNFRBlock(block, errors);
      if (nfr) {
        nfrs.push(nfr);
      }
    }

    return nfrs;
  }

  /**
   * Parse a single NFR block
   */
  private parseNFRBlock(block: string, _errors: string[]): NonFunctionalRequirement | null {
    const headerMatch = block.match(NFR_HEADER_REGEX);
    if (!headerMatch) {
      return null;
    }

    const id = `NFR-${headerMatch[1] ?? '000'}`;
    const name = headerMatch[2]?.trim() ?? '';
    const description = this.extractDescription(block);
    const target = this.extractField(block, 'Target') ?? this.extractField(block, 'Metric') ?? '';
    const priority = this.extractPriority(block);
    const category = this.inferNFRCategory(name, description);

    return {
      id,
      category,
      description,
      target,
      priority,
    };
  }

  /**
   * Infer NFR category from name and description
   */
  private inferNFRCategory(name: string, description: string): NFRCategory {
    const text = `${name} ${description}`.toLowerCase();

    for (const [keyword, category] of Object.entries(NFR_CATEGORY_KEYWORDS)) {
      if (text.includes(keyword)) {
        return category;
      }
    }

    return 'maintainability';
  }

  /**
   * Parse constraints
   */
  private parseConstraints(content: string, errors: string[]): Constraint[] {
    const constraints: Constraint[] = [];
    const constraintSection = this.extractSection(content, '## Constraints', '## ');

    if (constraintSection === undefined) {
      return constraints;
    }

    const constraintBlocks = this.splitByHeaders(constraintSection, /^###\s+CON-\d{3}/m);

    for (const block of constraintBlocks) {
      const constraint = this.parseConstraintBlock(block, errors);
      if (constraint) {
        constraints.push(constraint);
      }
    }

    return constraints;
  }

  /**
   * Parse a single constraint block
   */
  private parseConstraintBlock(block: string, _errors: string[]): Constraint | null {
    const headerMatch = block.match(CONSTRAINT_HEADER_REGEX);
    if (!headerMatch) {
      return null;
    }

    const id = `CON-${headerMatch[1] ?? '000'}`;
    const name = headerMatch[2]?.trim() ?? '';
    const description = this.extractDescription(block);
    const architectureImpact =
      this.extractField(block, 'Architecture Impact') ?? this.extractField(block, 'Impact') ?? '';
    const type = this.inferConstraintType(name, description);

    return {
      id,
      type,
      description,
      architectureImpact,
    };
  }

  /**
   * Infer constraint type from name and description
   */
  private inferConstraintType(name: string, description: string): ConstraintType {
    const text = `${name} ${description}`.toLowerCase();

    for (const [keyword, type] of Object.entries(CONSTRAINT_TYPE_KEYWORDS)) {
      if (text.includes(keyword)) {
        return type;
      }
    }

    return 'technical';
  }

  /**
   * Parse assumptions section
   */
  private parseAssumptions(content: string): string[] {
    const assumptionSection = this.extractSection(content, '## Assumptions', '## ');

    if (assumptionSection === undefined) {
      return [];
    }

    return this.extractBulletList(assumptionSection);
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Extract a section between two headers
   */
  private extractSection(
    content: string,
    startHeader: string,
    endPattern: string
  ): string | undefined {
    const startIndex = content.indexOf(startHeader);
    if (startIndex === -1) {
      return undefined;
    }

    const afterStart = content.substring(startIndex + startHeader.length);
    const endMatch = afterStart.match(new RegExp(`^${endPattern}`, 'm'));
    const endIndex = endMatch?.index ?? afterStart.length;

    return afterStart.substring(0, endIndex).trim();
  }

  /**
   * Split content by header pattern
   */
  private splitByHeaders(content: string, headerPattern: RegExp): string[] {
    const blocks: string[] = [];
    const lines = content.split('\n');
    let currentBlock: string[] = [];

    for (const line of lines) {
      if (headerPattern.test(line) && currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    return blocks.filter((block) => headerPattern.test(block));
  }

  /**
   * Extract description (first paragraph after header)
   */
  private extractDescription(block: string): string {
    const lines = block.split('\n');
    const descriptionLines: string[] = [];
    let foundHeader = false;

    for (const line of lines) {
      if (line.startsWith('#')) {
        foundHeader = true;
        continue;
      }

      if (!foundHeader) {
        continue;
      }

      const trimmed = line.trim();
      if (trimmed === '') {
        if (descriptionLines.length > 0) {
          break;
        }
        continue;
      }

      if (trimmed.startsWith('**') || trimmed.startsWith('-') || trimmed.startsWith('|')) {
        break;
      }

      descriptionLines.push(trimmed);
    }

    return descriptionLines.join(' ');
  }

  /**
   * Extract priority from block
   */
  private extractPriority(block: string): 'P0' | 'P1' | 'P2' | 'P3' {
    const match = block.match(PRIORITY_REGEX);
    if (match !== null && match[1] !== undefined && match[1] !== '') {
      return match[1] as 'P0' | 'P1' | 'P2' | 'P3';
    }
    return 'P2';
  }

  /**
   * Extract a specific field value
   */
  private extractField(block: string, fieldName: string): string | undefined {
    const regex = new RegExp(`\\*\\*${fieldName}\\*\\*[:\\s]+(.+)`, 'i');
    const match = block.match(regex);
    return match?.[1]?.trim();
  }

  /**
   * Extract a list under a specific header
   */
  private extractList(block: string, headerName: string): string[] {
    const regex = new RegExp(`\\*\\*${headerName}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*|$)`, 'i');
    const match = block.match(regex);

    if (match === null || match[1] === undefined || match[1] === '') {
      return [];
    }

    return this.extractBulletList(match[1]);
  }

  /**
   * Extract bullet list items
   */
  private extractBulletList(content: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        const item = trimmed.replace(/^[-*\d.]+\s*/, '').trim();
        if (item) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Extract NFR references from feature block
   */
  private extractNFRReferences(block: string): string[] {
    const references: string[] = [];
    const regex = /NFR-\d{3}/g;
    let match;

    while ((match = regex.exec(block)) !== null) {
      if (!references.includes(match[0])) {
        references.push(match[0]);
      }
    }

    return references;
  }
}
