/**
 * PRD Parser for SRS Writer Agent
 *
 * Parses Product Requirements Documents to extract structured data
 * for SRS generation. Handles various PRD formats and extracts
 * requirements, NFRs, constraints, and other relevant information.
 */

import type {
  ParsedPRD,
  ParsedPRDRequirement,
  ParsedNFR,
  ParsedConstraint,
  UserPersona,
  Goal,
  PRDDocumentMetadata,
  Priority,
} from './types.js';

/**
 * PRD Parser options
 */
export interface PRDParserOptions {
  /** Strict mode throws on parsing errors */
  readonly strict?: boolean;
  /** Parse user personas */
  readonly parsePersonas?: boolean;
  /** Parse goals and metrics */
  readonly parseGoals?: boolean;
}

/**
 * Default parser options
 */
const DEFAULT_OPTIONS: Required<PRDParserOptions> = {
  strict: false,
  parsePersonas: true,
  parseGoals: true,
};

/**
 * PRD Parser class
 */
export class PRDParser {
  private readonly options: Required<PRDParserOptions>;

  constructor(options: PRDParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse a PRD markdown document
   *
   * @param content - The PRD markdown content
   * @param projectId - The project identifier
   * @returns Parsed PRD structure
   */
  public parse(content: string, projectId: string): ParsedPRD {
    const metadata = this.parseMetadata(content, projectId);
    const productName = this.extractProductName(content);
    const productDescription = this.extractProductDescription(content);
    const functionalRequirements = this.parseFunctionalRequirements(content);
    const nonFunctionalRequirements = this.parseNonFunctionalRequirements(content);
    const constraints = this.parseConstraints(content);
    const assumptions = this.parseAssumptions(content);
    const userPersonas = this.options.parsePersonas ? this.parseUserPersonas(content) : [];
    const goals = this.options.parseGoals ? this.parseGoals(content) : [];

    return {
      metadata,
      productName,
      productDescription,
      functionalRequirements,
      nonFunctionalRequirements,
      constraints,
      assumptions,
      userPersonas,
      goals,
    };
  }

  /**
   * Parse document metadata from PRD
   */
  private parseMetadata(content: string, projectId: string): PRDDocumentMetadata {
    // Try to extract from metadata table
    const documentIdMatch = content.match(/\|\s*Document\s*ID\s*\|\s*([^|]+)\s*\|/i);
    const versionMatch = content.match(/\|\s*Version\s*\|\s*([^|]+)\s*\|/i);
    const statusMatch = content.match(/\|\s*Status\s*\|\s*([^|]+)\s*\|/i);

    return {
      documentId: documentIdMatch?.[1]?.trim() ?? `PRD-${projectId}`,
      version: versionMatch?.[1]?.trim() ?? '1.0.0',
      status: statusMatch?.[1]?.trim() ?? 'Draft',
      projectId,
    };
  }

  /**
   * Extract product name from PRD
   */
  private extractProductName(content: string): string {
    // Try from title (# PRD: Product Name)
    const titleMatch = content.match(/^#\s*(?:PRD:?\s*)?(.+)$/m);
    if (titleMatch !== null && titleMatch[1] !== undefined) {
      const title = titleMatch[1].trim();
      // Remove "PRD" prefix if present
      return title.replace(/^PRD[:\s-]*\s*/i, '').trim();
    }

    // Try from metadata table
    const productMatch = content.match(/\|\s*Product\s*(?:Name)?\s*\|\s*([^|]+)\s*\|/i);
    if (productMatch !== null && productMatch[1] !== undefined) {
      return productMatch[1].trim();
    }

    return 'Unknown Product';
  }

  /**
   * Extract product description from PRD
   */
  private extractProductDescription(content: string): string {
    // Look for Executive Summary or Product Overview section
    const summaryMatch = content.match(
      /##\s*(?:Executive\s*Summary|Product\s*Overview|1\.\s*Introduction)\s*\n+([\s\S]*?)(?=\n##|\n#\s|$)/i
    );
    if (summaryMatch !== null && summaryMatch[1] !== undefined) {
      // Get first paragraph
      const paragraphs = summaryMatch[1].trim().split(/\n\n+/);
      const firstParagraph = paragraphs[0];
      return firstParagraph !== undefined ? firstParagraph.replace(/^#+\s*/gm, '').trim() : '';
    }

    return '';
  }

  /**
   * Parse functional requirements from PRD
   */
  private parseFunctionalRequirements(content: string): ParsedPRDRequirement[] {
    const requirements: ParsedPRDRequirement[] = [];

    // Pattern for FR-XXX requirements
    const frPattern = /###?\s*(FR-\d{3})[:\s]+([^\n]+)\n([\s\S]*?)(?=###?\s*FR-\d{3}|##\s|$)/gi;

    let match: RegExpExecArray | null;
    while ((match = frPattern.exec(content)) !== null) {
      const id = match[1];
      const title = match[2];
      const body = match[3];

      if (id === undefined || title === undefined || body === undefined) {
        continue;
      }

      try {
        const requirement = this.parseRequirementBody(id, title.trim(), body);
        requirements.push(requirement);
      } catch (error) {
        if (this.options.strict) {
          throw error;
        }
        // In non-strict mode, create a basic requirement
        const firstLine = body.trim().split('\n')[0];
        requirements.push({
          id,
          title: title.trim(),
          description: firstLine ?? '',
          priority: 'P2',
          acceptanceCriteria: [],
          dependencies: [],
        });
      }
    }

    // If no FR-XXX pattern found, try alternative formats
    if (requirements.length === 0) {
      return this.parseFunctionalRequirementsAlternative(content);
    }

    return requirements;
  }

  /**
   * Parse requirement body to extract details
   */
  private parseRequirementBody(id: string, title: string, body: string): ParsedPRDRequirement {
    // Extract priority
    const priorityMatch = body.match(/\*?\*?Priority\*?\*?[:\s]+([Pp][0-3])/i);
    const priority = this.normalizePriority(priorityMatch?.[1] ?? 'P2');

    // Extract description
    const descMatch = body.match(/\*?\*?Description\*?\*?[:\s]+([^\n]+(?:\n(?![*#-])[^\n]+)*)/i);
    const firstLine = body.trim().split('\n')[0];
    const description = descMatch?.[1]?.trim() ?? firstLine ?? '';

    // Extract acceptance criteria
    const acceptanceCriteria = this.extractAcceptanceCriteria(body);

    // Extract dependencies
    const dependencies = this.extractDependencies(body);

    // Extract user story
    const userStoryMatch = body.match(
      /\*?\*?User\s*Story\*?\*?[:\s]+(As\s+a[^\n]+(?:\n(?![*#-])[^\n]+)*)/i
    );
    const userStoryValue = userStoryMatch?.[1]?.trim();

    // Build result object conditionally to satisfy exactOptionalPropertyTypes
    const result: ParsedPRDRequirement = {
      id,
      title,
      description,
      priority,
      acceptanceCriteria,
      dependencies,
    };

    if (userStoryValue !== undefined) {
      return { ...result, userStory: userStoryValue };
    }

    return result;
  }

  /**
   * Normalize priority string to Priority type
   */
  private normalizePriority(priority: string): Priority {
    const upper = priority.toUpperCase();
    if (upper === 'P0' || upper === 'P1' || upper === 'P2' || upper === 'P3') {
      return upper as Priority;
    }
    return 'P2';
  }

  /**
   * Extract acceptance criteria from requirement body
   */
  private extractAcceptanceCriteria(body: string): string[] {
    const criteria: string[] = [];

    // Look for Acceptance Criteria section
    const acSection = body.match(
      /\*?\*?Acceptance\s*Criteria\*?\*?[:\s]*\n([\s\S]*?)(?=\n\*?\*?[A-Z][a-z]+\*?\*?[:\s]|\n##|$)/i
    );

    if (acSection !== null && acSection[1] !== undefined) {
      // Extract list items
      const listPattern = /[-*]\s*\[?\s*[xX ]?\s*\]?\s*(.+)/g;
      let listMatch: RegExpExecArray | null;
      while ((listMatch = listPattern.exec(acSection[1])) !== null) {
        const item = listMatch[1];
        if (item !== undefined) {
          criteria.push(item.trim());
        }
      }
    }

    return criteria;
  }

  /**
   * Extract dependencies from requirement body
   */
  private extractDependencies(body: string): string[] {
    const dependencies: string[] = [];

    // Look for dependencies section or inline references
    const depPattern = /(?:depends\s*on|requires|blocked\s*by)[:\s]*((?:FR-\d{3}(?:\s*,\s*)?)+)/gi;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depPattern.exec(body)) !== null) {
      const depGroup = depMatch[1];
      if (depGroup !== undefined) {
        const refs = depGroup.match(/FR-\d{3}/g);
        if (refs !== null) {
          dependencies.push(...refs);
        }
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * Parse functional requirements using alternative format
   */
  private parseFunctionalRequirementsAlternative(content: string): ParsedPRDRequirement[] {
    const requirements: ParsedPRDRequirement[] = [];

    // Look for Functional Requirements section
    const frSection = content.match(
      /##\s*(?:\d+\.)?\s*Functional\s*Requirements\s*\n([\s\S]*?)(?=\n##\s|$)/i
    );

    if (frSection === null || frSection[1] === undefined) {
      return requirements;
    }

    // Parse numbered or bulleted items
    const itemPattern =
      /(?:^|\n)(?:[-*]|\d+\.)\s+\*?\*?([^:\n]+)\*?\*?[:\s]*([^\n]*(?:\n(?![-*]|\d+\.).*)*)/g;
    let counter = 1;

    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemPattern.exec(frSection[1])) !== null) {
      const title = itemMatch[1];
      const description = itemMatch[2];

      if (title !== undefined && description !== undefined) {
        requirements.push({
          id: `FR-${String(counter).padStart(3, '0')}`,
          title: title.trim(),
          description: description.trim(),
          priority: 'P2',
          acceptanceCriteria: [],
          dependencies: [],
        });
        counter++;
      }
    }

    return requirements;
  }

  /**
   * Parse non-functional requirements from PRD
   */
  private parseNonFunctionalRequirements(content: string): ParsedNFR[] {
    const nfrs: ParsedNFR[] = [];

    // Pattern for NFR-XXX
    const nfrPattern = /###?\s*(NFR-\d{3})[:\s]+([^\n]+)\n([\s\S]*?)(?=###?\s*NFR-\d{3}|##\s|$)/gi;

    let match: RegExpExecArray | null;
    while ((match = nfrPattern.exec(content)) !== null) {
      const id = match[1];
      const title = match[2];
      const body = match[3];

      if (id === undefined || title === undefined || body === undefined) {
        continue;
      }

      const titleTrimmed = title.trim();
      const categoryMatch = body.match(/\*?\*?Category\*?\*?[:\s]+([^\n]+)/i);
      const metricMatch = body.match(/\*?\*?(?:Metric|Target)\*?\*?[:\s]+([^\n]+)/i);
      const priorityMatch = body.match(/\*?\*?Priority\*?\*?[:\s]+([Pp][0-3])/i);

      const metricValue = metricMatch?.[1]?.trim();
      const nfr: ParsedNFR = {
        id,
        category: categoryMatch?.[1]?.trim() ?? this.inferNFRCategory(titleTrimmed),
        description: titleTrimmed,
        priority: this.normalizePriority(priorityMatch?.[1] ?? 'P2'),
      };

      if (metricValue !== undefined) {
        nfrs.push({ ...nfr, metric: metricValue });
      } else {
        nfrs.push(nfr);
      }
    }

    // If no NFR-XXX pattern, try alternative
    if (nfrs.length === 0) {
      return this.parseNFRAlternative(content);
    }

    return nfrs;
  }

  /**
   * Infer NFR category from title
   */
  private inferNFRCategory(title: string): string {
    const lower = title.toLowerCase();
    if (/performance|speed|latency|throughput/.test(lower)) return 'performance';
    if (/security|auth|encrypt/.test(lower)) return 'security';
    if (/scalab|scale/.test(lower)) return 'scalability';
    if (/reliab|uptime|availability/.test(lower)) return 'reliability';
    if (/maintain|modular|test/.test(lower)) return 'maintainability';
    if (/usab|user\s*experience|ux/.test(lower)) return 'usability';
    return 'other';
  }

  /**
   * Parse NFRs using alternative format
   */
  private parseNFRAlternative(content: string): ParsedNFR[] {
    const nfrs: ParsedNFR[] = [];

    const nfrSection = content.match(
      /##\s*(?:\d+\.)?\s*Non[- ]?Functional\s*Requirements\s*\n([\s\S]*?)(?=\n##\s|$)/i
    );

    if (nfrSection === null || nfrSection[1] === undefined) {
      return nfrs;
    }

    // Parse subsections by category
    const categoryPattern = /###\s*(?:\d+\.\d+\s*)?([^\n]+)\n([\s\S]*?)(?=###|$)/g;
    let counter = 1;

    let catMatch: RegExpExecArray | null;
    while ((catMatch = categoryPattern.exec(nfrSection[1])) !== null) {
      const category = catMatch[1];
      const items = catMatch[2];

      if (category === undefined || items === undefined) {
        continue;
      }

      const itemPattern = /[-*]\s+([^\n]+)/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemPattern.exec(items)) !== null) {
        const item = itemMatch[1];
        if (item !== undefined) {
          nfrs.push({
            id: `NFR-${String(counter).padStart(3, '0')}`,
            category: category
              .trim()
              .toLowerCase()
              .replace(/\s+requirements?/i, ''),
            description: item.trim(),
            priority: 'P2',
          });
          counter++;
        }
      }
    }

    return nfrs;
  }

  /**
   * Parse constraints from PRD
   */
  private parseConstraints(content: string): ParsedConstraint[] {
    const constraints: ParsedConstraint[] = [];

    // Look for Constraints section
    const constraintSection = content.match(
      /##\s*(?:\d+\.)?\s*Constraints?\s*(?:and\s*Assumptions)?\s*\n([\s\S]*?)(?=\n##\s|$)/i
    );

    if (constraintSection === null || constraintSection[1] === undefined) {
      return constraints;
    }

    const sectionContent = constraintSection[1];

    // Parse CON-XXX pattern
    const conPattern = /###?\s*(CON-\d{3})[:\s]+([^\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = conPattern.exec(sectionContent)) !== null) {
      const id = match[1];
      const description = match[2];
      if (id !== undefined && description !== undefined) {
        constraints.push({
          id,
          type: 'technical',
          description: description.trim(),
        });
      }
    }

    // If no CON-XXX, parse list items
    if (constraints.length === 0) {
      const itemPattern = /[-*]\s+\*?\*?(?:([^:]+):)?\*?\*?\s*([^\n]+)/g;
      let counter = 1;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemPattern.exec(sectionContent)) !== null) {
        const description = itemMatch[2];
        if (description !== undefined) {
          const type = itemMatch[1]?.toLowerCase().trim() ?? 'technical';
          constraints.push({
            id: `CON-${String(counter).padStart(3, '0')}`,
            type: this.normalizeConstraintType(type),
            description: description.trim(),
          });
          counter++;
        }
      }
    }

    return constraints;
  }

  /**
   * Normalize constraint type
   */
  private normalizeConstraintType(type: string): string {
    const lower = type.toLowerCase();
    if (/tech|system|platform/.test(lower)) return 'technical';
    if (/business|budget|cost/.test(lower)) return 'business';
    if (/regul|legal|compliance/.test(lower)) return 'regulatory';
    if (/resource|team|staff/.test(lower)) return 'resource';
    if (/time|schedule|deadline/.test(lower)) return 'timeline';
    return 'technical';
  }

  /**
   * Parse assumptions from PRD
   */
  private parseAssumptions(content: string): string[] {
    const assumptions: string[] = [];

    // Look for Assumptions section
    const assumptionSection = content.match(
      /##\s*(?:\d+\.)?\s*Assumptions?\s*\n([\s\S]*?)(?=\n##\s|$)/i
    );

    if (assumptionSection === null || assumptionSection[1] === undefined) {
      // Try within Constraints and Assumptions section
      const combinedSection = content.match(
        /###?\s*(?:\d+\.\d+\s*)?Assumptions?\s*\n([\s\S]*?)(?=###|##\s|$)/i
      );
      if (combinedSection !== null && combinedSection[1] !== undefined) {
        return this.extractListItems(combinedSection[1]);
      }
      return assumptions;
    }

    return this.extractListItems(assumptionSection[1]);
  }

  /**
   * Extract list items from text
   */
  private extractListItems(text: string): string[] {
    const items: string[] = [];
    const pattern = /[-*]\s+([^\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const item = match[1];
      if (item !== undefined) {
        items.push(item.trim());
      }
    }
    return items;
  }

  /**
   * Parse user personas from PRD
   */
  private parseUserPersonas(content: string): UserPersona[] {
    const personas: UserPersona[] = [];

    const personaSection = content.match(
      /##\s*(?:\d+\.)?\s*(?:User\s*)?Personas?\s*\n([\s\S]*?)(?=\n##\s|$)/i
    );

    if (personaSection === null || personaSection[1] === undefined) {
      return personas;
    }

    // Parse persona blocks
    const personaPattern = /###\s*(?:\d+\.\d+\s*)?([^\n]+)\n([\s\S]*?)(?=###|$)/g;
    let match: RegExpExecArray | null;
    while ((match = personaPattern.exec(personaSection[1])) !== null) {
      const name = match[1];
      const body = match[2];

      if (name === undefined || body === undefined) {
        continue;
      }

      const nameTrimmed = name.trim();
      const roleMatch = body.match(/\*?\*?Role\*?\*?[:\s]+([^\n]+)/i);
      const descMatch = body.match(/\*?\*?Description\*?\*?[:\s]+([^\n]+)/i);
      const goalsMatch = body.match(/\*?\*?Goals?\*?\*?[:\s]*\n?([\s\S]*?)(?=\n\*?\*?[A-Z]|$)/i);

      const goalsContent = goalsMatch?.[1];
      personas.push({
        name: nameTrimmed,
        role: roleMatch?.[1]?.trim() ?? nameTrimmed,
        description: descMatch?.[1]?.trim() ?? '',
        goals: goalsContent !== undefined ? this.extractListItems(goalsContent) : [],
      });
    }

    return personas;
  }

  /**
   * Parse goals and metrics from PRD
   */
  private parseGoals(content: string): Goal[] {
    const goals: Goal[] = [];

    const goalSection = content.match(
      /##\s*(?:\d+\.)?\s*(?:Goals?\s*(?:and|&)?\s*)?(?:Success\s*)?Metrics?\s*\n([\s\S]*?)(?=\n##\s|$)/i
    );

    if (goalSection === null || goalSection[1] === undefined) {
      return goals;
    }

    // Parse goal items
    const itemPattern = /[-*]\s+([^\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(goalSection[1])) !== null) {
      const item = match[1];
      if (item === undefined) {
        continue;
      }

      const text = item.trim();

      // Try to extract metric and target
      const metricMatch = text.match(/(.+?)(?::|–|-)\s*(.+)/);
      if (metricMatch !== null && metricMatch[1] !== undefined && metricMatch[2] !== undefined) {
        goals.push({
          description: metricMatch[1].trim(),
          metric: metricMatch[2].trim(),
        });
      } else {
        goals.push({
          description: text,
        });
      }
    }

    return goals;
  }
}
