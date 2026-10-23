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

/*
 * Section headings and their bodies.
 *
 * The original expressions captured a section body with a lazy `([\s\S]*?)`
 * right after a whitespace run (`\s*\n([\s\S]*?)(?=\n##\s|$)`). Both quantifiers
 * could match the same whitespace, which made matching polynomial on long
 * whitespace runs (CodeQL js/polynomial-redos). The headings below end at the
 * last line break of that whitespace run, exactly where the old body started,
 * and {@link sectionBody} finds the end of the body with a separate search.
 * `##\s*(?:\d+\.\s*)?X` matches the same text as `##\s*(?:\d+\.)?\s*X`.
 */
const EXECUTIVE_SUMMARY_HEADING =
  /##\s*(?:Executive\s*Summary|Product\s*Overview|1\.\s*Introduction)(?:[^\S\n]*\n)+/i;
const EXECUTIVE_SUMMARY_END = /\n##|\n#\s/g;
const FUNCTIONAL_SECTION_HEADING = /##\s*(?:\d+\.\s*)?Functional\s*Requirements(?:[^\S\n]*\n)+/i;
const NON_FUNCTIONAL_SECTION_HEADING =
  /##\s*(?:\d+\.\s*)?Non[- ]?Functional\s*Requirements(?:[^\S\n]*\n)+/i;
const CONSTRAINT_SECTION_HEADING =
  /##\s*(?:\d+\.\s*)?Constraints?(?:\s*and\s*Assumptions)?(?:[^\S\n]*\n)+/i;
const ASSUMPTION_SECTION_HEADING = /##\s*(?:\d+\.\s*)?Assumptions?(?:[^\S\n]*\n)+/i;
const ASSUMPTION_SUBSECTION_HEADING = /###?\s*(?:\d+\.\d+\s*)?Assumptions?(?:[^\S\n]*\n)+/i;
const ASSUMPTION_SUBSECTION_END = /###|##\s/g;
const PERSONA_SECTION_HEADING = /##\s*(?:\d+\.\s*)?(?:User\s*)?Personas?(?:[^\S\n]*\n)+/i;
const GOAL_SECTION_HEADING =
  /##\s*(?:\d+\.\s*)?(?:Goals?\s*(?:(?:and|&)\s*)?)?(?:Success\s*)?Metrics?(?:[^\S\n]*\n)+/i;
const NEXT_LEVEL_TWO_HEADING = /\n##\s/g;
const ACCEPTANCE_CRITERIA_HEADING = /\*?\*?Acceptance\s*Criteria\*?\*?(?:(?:[^\S\n]|:)*\n)+/i;
const ACCEPTANCE_CRITERIA_END = /\n\*?\*?[A-Z][a-z]+\*?\*?[:\s]|\n##/gi;
const PERSONA_GOALS_FIELD = /\*?\*?Goals?\*?\*?[:\s]*/i;
const PERSONA_GOALS_END = /\n\*?\*?[A-Z]/gi;

/*
 * Requirement sections such as `### FR-001: Title`. The heading prefix ends with
 * the separator run; the title and body are located by
 * {@link PRDParser.requirementSections}.
 */
const FUNCTIONAL_REQUIREMENT_PREFIX = /###?\s*(FR-\d{3})([:\s]+)/gi;
const FUNCTIONAL_REQUIREMENT_END = /###?\s*FR-\d{3}|##\s/gi;
const NON_FUNCTIONAL_REQUIREMENT_PREFIX = /###?\s*(NFR-\d{3})([:\s]+)/gi;
const NON_FUNCTIONAL_REQUIREMENT_END = /###?\s*NFR-\d{3}|##\s/gi;

/**
 * `###` subsection heading with an optional `1.2` number, anchored at the
 * heading. Unambiguous form of `###\s*(?:\d+\.\d+\s*)?([^\n]+)\n`: the heading
 * text starts with a non-space character, or is a single space before the line
 * break when only whitespace follows. Directly after a number it starts with a
 * non-digit; the lone `(\d)` alternative reproduces the old fallback that took
 * the last digit of the number as the heading text.
 */
const SUBSECTION_HEADING =
  /^###\s*(?:\d+\.\d+(?:\s+(\S[^\n]*|[^\S\n])|([^\d\s][^\n]*|[^\S\n])|(\d))|(\S[^\n]*|[^\S\n]))\n/;

/*
 * Constraint list items (`- Type: description` or `- description`), anchored at
 * the list marker. Together they replace `[-*]\s+\*?\*?(?:([^:]+):)?\*?\*?\s*([^\n]+)`,
 * whose whitespace runs overlapped and whose type group rescanned the rest of the
 * section from every list marker.
 */
const LIST_MARKER = /[-*]/g;
const CONSTRAINT_ITEM_HEAD = /^[-*]\s+\*?\*?/;
const CONSTRAINT_ITEM_TYPED = /^([^:]+):\*?\*?\s*(\S[^\n]*|[^\S\n])/;
const CONSTRAINT_ITEM_UNTYPED = /^\*?\*?\s*(\S[^\n]*|[^\S\n])/;
const CONSTRAINT_ITEM_FALLBACK = /^[-*]\s+(?:\*{1,4}\s*)?(\S[^\n]*|[^\S\n])/;

/**
 * Goal text split at the first `:`, `–`, or `-` that is followed by more text,
 * anchored at the start. The unanchored original was retried at every position.
 */
const GOAL_METRIC = /^(.+?)(?::|–|-)\s*(\S.*|[^\S\n\r\u2028\u2029])/;
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/g;

/**
 * Body of a section that starts at `start`: the text up to the first match of
 * `terminator` at or after `start`, or to the end of the content.
 * @param content - Text that contains the section
 * @param start - Index where the body starts
 * @param terminator - Global expression for the text that ends the body
 * @returns Section body
 */
function sectionBody(content: string, start: number, terminator: RegExp): string {
  terminator.lastIndex = start;
  const end = terminator.exec(content)?.index ?? content.length;
  return content.slice(start, end);
}

/**
 * Find a section by its heading and return its body.
 * @param content - Text to search
 * @param heading - Non-global heading expression that ends where the body starts
 * @param terminator - Global expression for the text that ends the body
 * @returns Section body, or undefined when the heading is absent
 */
function findSection(content: string, heading: RegExp, terminator: RegExp): string | undefined {
  const match = heading.exec(content);
  return match === null
    ? undefined
    : sectionBody(content, match.index + match[0].length, terminator);
}

/**
 * `# PRD<separators>` title: group 1 is the separator run, group 2 the
 * whitespace after it (which may span lines). Neighbouring parts cannot match
 * the same character, so every part is matched in one way only.
 */
const PRD_TITLE_PREFIX = /^#\s*PRD\s*([-–:]+)(\s*)/m;
const LINE_TERMINATOR_CHARACTER = /[\n\r\u2028\u2029]/;

/**
 * Read the product name of the first `# PRD<separators> <name>` title.
 *
 * Same capture as `content.match(/^#\s*PRD\s*[-–:]+\s*(\S.*|[^\S\n\r\u2028\u2029])$/m)?.[1]`.
 * There `\S` could also match a separator, so the separator run could end at
 * any of its characters (CodeQL js/polynomial-redos). Here both runs are matched
 * once, and the fallbacks the old expression reached by backtracking are explicit.
 * @param content - PRD markdown content
 * @returns The captured text (untrimmed), or undefined when no title matches
 */
function matchPrdTitle(content: string): string | undefined {
  const match = PRD_TITLE_PREFIX.exec(content);
  if (match === null) {
    return undefined;
  }
  const separators = match[1] ?? '';
  const whitespace = match[2] ?? '';
  const end = match.index + match[0].length;
  // A non-space character follows: `\S.*` reads the rest of its line.
  if (end < content.length) {
    return sectionBody(content, end, LINE_TERMINATOR);
  }
  // Only whitespace follows: `[^\S\n\r\u2028\u2029]$` takes the last space that
  // ends a line.
  for (let index = end - 1; index >= end - whitespace.length; index--) {
    if (
      !LINE_TERMINATOR_CHARACTER.test(content.charAt(index)) &&
      (index + 1 === end || LINE_TERMINATOR_CHARACTER.test(content.charAt(index + 1)))
    ) {
      return content.charAt(index);
    }
  }
  // Otherwise the separator run gives its last character to `\S.*`; a single
  // separator cannot, and no later title can start in the trailing whitespace.
  return separators.length > 1
    ? sectionBody(content, end - whitespace.length - 1, LINE_TERMINATOR)
    : undefined;
}

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
    // Strip YAML frontmatter (delimited by --- markers) if present
    const stripped = PRDParser.stripFrontmatter(content);
    const metadata = this.parseMetadata(stripped, projectId);
    const productName = this.extractProductName(stripped, projectId);
    const productDescription = this.extractProductDescription(stripped);
    const functionalRequirements = this.parseFunctionalRequirements(stripped);
    const nonFunctionalRequirements = this.parseNonFunctionalRequirements(stripped);
    const constraints = this.parseConstraints(stripped);
    const assumptions = this.parseAssumptions(stripped);
    const userPersonas = this.options.parsePersonas ? this.parseUserPersonas(stripped) : [];
    const goals = this.options.parseGoals ? this.parseGoals(stripped) : [];

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
   * @param content - Raw PRD markdown content
   * @param projectId - Unique project identifier
   * @returns Extracted document metadata
   */
  private parseMetadata(content: string, projectId: string): PRDDocumentMetadata {
    // Try to extract from metadata table (the cell keeps its padding until trim())
    const documentIdMatch = content.match(/\|\s*Document\s*ID\s*\|([^|]+)\|/i);
    const versionMatch = content.match(/\|\s*Version\s*\|([^|]+)\|/i);
    const statusMatch = content.match(/\|\s*Status\s*\|([^|]+)\|/i);

    return {
      documentId: documentIdMatch?.[1]?.trim() ?? `PRD-${projectId}`,
      version: versionMatch?.[1]?.trim() ?? '1.0.0',
      status: statusMatch?.[1]?.trim() ?? 'Draft',
      projectId,
    };
  }

  /**
   * Common document title prefixes to strip when extracting product name
   */
  private static readonly DOCUMENT_TITLE_PREFIXES = [
    /^Product\s+Requirements?\s+Document\s*(?:\(PRD\))?\s*[-–:]*\s*/i,
    /^PRD\s*[-–:]+\s*/i,
    /^Software\s+Requirements?\s+Specification\s*(?:\(SRS\))?\s*[-–:]*\s*/i,
    /^SRS\s*[-–:]+\s*/i,
    /^Requirements?\s+Document\s*[-–:]*\s*/i,
  ];

  /**
   * Extract product name from PRD
   * @param content - Raw PRD markdown content
   * @param projectId - Project identifier used as fallback
   * @returns Product name extracted from metadata table, title, or projectId
   */
  private extractProductName(content: string, projectId: string): string {
    // 1. Try from metadata table (most explicit source)
    // `Product(?:\s*Name\*?\*?|\s*\*\*?)?` matches the same text as the original
    // `Product\s*(?:Name)?\*?\*?` without two adjacent whitespace quantifiers
    const productMatch = content.match(
      /\|\s*\*?\*?(?:Product(?:\s*Name\*?\*?|\s*\*\*?)?|Project\*?\*?)\s*\|([^|]+)\|/i
    );
    if (productMatch !== null && productMatch[1] !== undefined) {
      const value = productMatch[1].trim();
      if (value.length > 0) {
        return value;
      }
    }

    // 2. Try from "# PRD: <name>" format
    const prdTitle = matchPrdTitle(content);
    if (prdTitle !== undefined) {
      const name = prdTitle.trim();
      if (name.length > 0) {
        return name;
      }
    }

    // 3. Try heading with common document title prefix stripping
    const headingMatch = content.match(/^#\s+(\S.*|[^\S\n\r\u2028\u2029])$/m);
    if (headingMatch !== null && headingMatch[1] !== undefined) {
      const rawTitle = headingMatch[1].trim();

      // Strip known document title prefixes
      for (const prefix of PRDParser.DOCUMENT_TITLE_PREFIXES) {
        const stripped = rawTitle.replace(prefix, '').trim();
        if (stripped.length === 0) {
          // Entire heading is a document title — fall through to projectId
          return projectId.length > 0 ? projectId : 'Unknown Product';
        }
        if (stripped !== rawTitle) {
          return stripped;
        }
      }

      // If no prefix matched, the heading itself may be the product name
      // But only if it doesn't look like a generic document title
      if (!/^(?:Product\s+Requirements?\s+Document|PRD|SRS)\s*$/i.test(rawTitle)) {
        return rawTitle;
      }
    }

    // 4. Fallback to projectId
    if (projectId.length > 0) {
      return projectId;
    }

    return 'Unknown Product';
  }

  /**
   * Extract product description from PRD
   * @param content - Raw PRD markdown content
   * @returns First paragraph of the executive summary or product overview
   */
  private extractProductDescription(content: string): string {
    // Look for Executive Summary or Product Overview section
    const summary = findSection(content, EXECUTIVE_SUMMARY_HEADING, EXECUTIVE_SUMMARY_END);
    if (summary !== undefined) {
      // Get first paragraph
      const paragraphs = summary.trim().split(/\n\n+/);
      const firstParagraph = paragraphs[0];
      return firstParagraph !== undefined ? firstParagraph.replace(/^#+\s*/gm, '').trim() : '';
    }

    return '';
  }

  /**
   * Parse functional requirements from PRD
   * @param content - Raw PRD markdown content
   * @returns Array of parsed functional requirements
   */
  private parseFunctionalRequirements(content: string): ParsedPRDRequirement[] {
    const requirements: ParsedPRDRequirement[] = [];

    // FR-XXX requirement sections
    for (const { id, title, body } of PRDParser.requirementSections(
      content,
      FUNCTIONAL_REQUIREMENT_PREFIX,
      FUNCTIONAL_REQUIREMENT_END
    )) {
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
   * @param id - Requirement identifier (e.g., FR-001)
   * @param title - Requirement title text
   * @param body - Markdown body containing priority, description, and acceptance criteria
   * @returns Fully parsed requirement with extracted fields
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
   * @param priority - Raw priority string (e.g., "p1", "P2")
   * @returns Normalized priority value (P0-P3), defaults to P2
   */
  private normalizePriority(priority: string): Priority {
    const upper = priority.toUpperCase();
    if (upper === 'P0' || upper === 'P1' || upper === 'P2' || upper === 'P3') {
      return upper;
    }
    return 'P2';
  }

  /**
   * Extract acceptance criteria from requirement body
   * @param body - Requirement body containing an acceptance criteria section
   * @returns List of acceptance criteria strings
   */
  private extractAcceptanceCriteria(body: string): string[] {
    const criteria: string[] = [];

    // Look for Acceptance Criteria section
    const acSection = findSection(body, ACCEPTANCE_CRITERIA_HEADING, ACCEPTANCE_CRITERIA_END);

    if (acSection !== undefined) {
      // Extract list items
      const listPattern = /[-*]\s*\[?\s*[xX ]?\s*\]?\s*(.+)/g;
      let listMatch: RegExpExecArray | null;
      while ((listMatch = listPattern.exec(acSection)) !== null) {
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
   * @param body - Requirement body containing dependency references
   * @returns Deduplicated list of dependency IDs (e.g., FR-001)
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
   * @param content - Raw PRD markdown content without FR-XXX patterns
   * @returns Array of requirements parsed from numbered or bulleted lists
   */
  private parseFunctionalRequirementsAlternative(content: string): ParsedPRDRequirement[] {
    const requirements: ParsedPRDRequirement[] = [];

    // Look for Functional Requirements section
    const frSection = findSection(content, FUNCTIONAL_SECTION_HEADING, NEXT_LEVEL_TWO_HEADING);

    if (frSection === undefined) {
      return requirements;
    }

    // Parse numbered or bulleted items
    const itemPattern =
      /(?:^|\n)(?:[-*]|\d+\.)\s+\*?\*?([^:\n]+)\*?\*?[:\s]*([^\n]*(?:\n(?![-*]|\d+\.).*)*)/g;
    let counter = 1;

    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemPattern.exec(frSection)) !== null) {
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
   * @param content - Raw PRD markdown content
   * @returns Array of parsed non-functional requirements
   */
  private parseNonFunctionalRequirements(content: string): ParsedNFR[] {
    const nfrs: ParsedNFR[] = [];

    // NFR-XXX requirement sections
    for (const { id, title, body } of PRDParser.requirementSections(
      content,
      NON_FUNCTIONAL_REQUIREMENT_PREFIX,
      NON_FUNCTIONAL_REQUIREMENT_END
    )) {
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
   * @param title - NFR title text used for keyword-based classification
   * @returns Inferred category string (e.g., "performance", "security")
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
   * @param content - Raw PRD markdown content without NFR-XXX patterns
   * @returns Array of NFRs parsed from category subsections
   */
  private parseNFRAlternative(content: string): ParsedNFR[] {
    const nfrs: ParsedNFR[] = [];

    const nfrSection = findSection(content, NON_FUNCTIONAL_SECTION_HEADING, NEXT_LEVEL_TWO_HEADING);

    if (nfrSection === undefined) {
      return nfrs;
    }

    // Parse subsections by category
    let counter = 1;

    for (const { heading: category, body: items } of PRDParser.subsections(nfrSection)) {
      const itemPattern = /[-*]\s+([^\n]+)/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemPattern.exec(items)) !== null) {
        const item = itemMatch[1];
        if (item !== undefined) {
          nfrs.push({
            id: `NFR-${String(counter).padStart(3, '0')}`,
            // (?<!\s) starts the match at the beginning of a whitespace run only
            category: category
              .trim()
              .toLowerCase()
              .replace(/(?<!\s)\s+requirements?/i, ''),
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
   * @param content - Raw PRD markdown content
   * @returns Array of parsed constraints with type classification
   */
  private parseConstraints(content: string): ParsedConstraint[] {
    const constraints: ParsedConstraint[] = [];

    // Look for Constraints section
    const sectionContent = findSection(content, CONSTRAINT_SECTION_HEADING, NEXT_LEVEL_TWO_HEADING);

    if (sectionContent === undefined) {
      return constraints;
    }

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
      let counter = 1;
      for (const item of PRDParser.constraintItems(sectionContent)) {
        const type = item.type?.toLowerCase().trim() ?? 'technical';
        constraints.push({
          id: `CON-${String(counter).padStart(3, '0')}`,
          type: this.normalizeConstraintType(type),
          description: item.description.trim(),
        });
        counter++;
      }
    }

    return constraints;
  }

  /**
   * Normalize constraint type
   * @param type - Raw constraint type string
   * @returns Normalized type (technical, business, regulatory, resource, or timeline)
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
   * @param content - Raw PRD markdown content
   * @returns List of assumption strings
   */
  private parseAssumptions(content: string): string[] {
    const assumptions: string[] = [];

    // Look for Assumptions section
    const assumptionSection = findSection(
      content,
      ASSUMPTION_SECTION_HEADING,
      NEXT_LEVEL_TWO_HEADING
    );

    if (assumptionSection === undefined) {
      // Try within Constraints and Assumptions section
      const combinedSection = findSection(
        content,
        ASSUMPTION_SUBSECTION_HEADING,
        ASSUMPTION_SUBSECTION_END
      );
      if (combinedSection !== undefined) {
        return this.extractListItems(combinedSection);
      }
      return assumptions;
    }

    return this.extractListItems(assumptionSection);
  }

  /**
   * Extract list items from text
   * @param text - Markdown text containing bulleted list items
   * @returns Array of trimmed list item strings
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
   * @param content - Raw PRD markdown content
   * @returns Array of user persona objects with name, role, and goals
   */
  private parseUserPersonas(content: string): UserPersona[] {
    const personas: UserPersona[] = [];

    const personaSection = findSection(content, PERSONA_SECTION_HEADING, NEXT_LEVEL_TWO_HEADING);

    if (personaSection === undefined) {
      return personas;
    }

    // Parse persona blocks
    for (const { heading: name, body } of PRDParser.subsections(personaSection)) {
      const nameTrimmed = name.trim();
      const roleMatch = body.match(/\*?\*?Role\*?\*?[:\s]+([^\n]+)/i);
      const descMatch = body.match(/\*?\*?Description\*?\*?[:\s]+([^\n]+)/i);
      // The old `[:\s]*\n?` before the goals body always matched an empty `\n?`
      const goalsContent = findSection(body, PERSONA_GOALS_FIELD, PERSONA_GOALS_END);
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
   * @param content - Raw PRD markdown content
   * @returns Array of goal objects with descriptions and optional metrics
   */
  private parseGoals(content: string): Goal[] {
    const goals: Goal[] = [];

    const goalSection = findSection(content, GOAL_SECTION_HEADING, NEXT_LEVEL_TWO_HEADING);

    if (goalSection === undefined) {
      return goals;
    }

    // Parse goal items
    const itemPattern = /[-*]\s+([^\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(goalSection)) !== null) {
      const item = match[1];
      if (item === undefined) {
        continue;
      }

      const text = item.trim();

      // Try to extract metric and target
      const metricMatch = PRDParser.splitGoalMetric(text);
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

  /**
   * Iterate requirement sections such as `### FR-001: Title` and their bodies.
   *
   * Same matches as repeated `exec` of
   * `/###?\s*(ID-\d{3})[:\s]+([^\n]+)\n([\s\S]*?)(?=###?\s*ID-\d{3}|##\s|$)/gi`,
   * whose separator run and title overlapped and whose title was rescanned from
   * every heading when the last line had no line break.
   * @param content - PRD content
   * @param prefix - Global heading expression; group 1 is the ID, group 2 the separator run
   * @param terminator - Global expression for the text that ends a section body
   * @yields ID, untrimmed title, and body of each section
   */
  private static *requirementSections(
    content: string,
    prefix: RegExp,
    terminator: RegExp
  ): Generator<{ id: string; title: string; body: string }> {
    prefix.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = prefix.exec(content)) !== null) {
      const runEnd = match.index + match[0].length;
      const runStart = runEnd - (match[2]?.length ?? 0);
      const lineEnd = content.indexOf('\n', runEnd);
      let titleStart = runEnd;
      let titleEnd = lineEnd;
      if (lineEnd === -1) {
        // No line break after the separator: the old expression backtracked into
        // the separator run and took the last character before a line break.
        titleEnd = -1;
        for (let i = runEnd - 2; i > runStart; i--) {
          if (content[i] !== '\n' && content[i + 1] === '\n') {
            titleStart = i;
            titleEnd = i + 1;
            break;
          }
        }
        if (titleEnd === -1) {
          // No later heading can be followed by a line break either
          return;
        }
      }
      const body = sectionBody(content, titleEnd + 1, terminator);
      yield { id: match[1] ?? '', title: content.slice(titleStart, titleEnd), body };
      prefix.lastIndex = titleEnd + 1 + body.length;
    }
  }

  /**
   * Iterate `###` subsections (heading text and body up to the next `###`).
   *
   * Same matches as repeated `exec` of
   * `/###\s*(?:\d+\.\d+\s*)?([^\n]+)\n([\s\S]*?)(?=###|$)/g` in linear time.
   * @param text - Section text
   * @yields Untrimmed heading text and body of each subsection
   */
  private static *subsections(text: string): Generator<{ heading: string; body: string }> {
    const lastLineBreak = text.lastIndexOf('\n');
    let start = text.indexOf('###');
    // A heading needs a line break after it
    while (start !== -1 && start < lastLineBreak) {
      const match = SUBSECTION_HEADING.exec(text.slice(start));
      let position = start + 1;
      if (match !== null) {
        const bodyStart = start + match[0].length;
        const next = text.indexOf('###', bodyStart);
        position = next === -1 ? text.length : next;
        yield {
          heading: match[1] ?? match[2] ?? match[3] ?? match[4] ?? '',
          body: text.slice(bodyStart, position),
        };
      }
      start = text.indexOf('###', position);
    }
  }

  /**
   * Iterate constraint list items (`- Type: description` or `- description`).
   *
   * Same matches as repeated `exec` of
   * `/[-*]\s+\*?\*?(?:([^:]+):)?\*?\*?\s*([^\n]+)/g` in linear time.
   * @param text - Constraints section text
   * @yields Optional untrimmed type and untrimmed description of each item
   */
  private static *constraintItems(text: string): Generator<{ type?: string; description: string }> {
    let position = 0;
    let nextColon = text.indexOf(':');
    // Colon whose `Type:` form already failed: the text after it is the same
    let failedColon = -1;
    for (;;) {
      LIST_MARKER.lastIndex = position;
      const marker = LIST_MARKER.exec(text);
      if (marker === null) {
        return;
      }
      const start = marker.index;
      const head = CONSTRAINT_ITEM_HEAD.exec(text.slice(start));
      if (head === null) {
        position = start + 1;
        continue;
      }
      const afterHead = start + head[0].length;
      if (nextColon !== -1 && nextColon < afterHead) {
        nextColon = text.indexOf(':', afterHead);
      }
      if (nextColon > afterHead && nextColon !== failedColon) {
        const typed = CONSTRAINT_ITEM_TYPED.exec(text.slice(afterHead));
        if (typed !== null) {
          yield { type: typed[1] ?? '', description: typed[2] ?? '' };
          position = afterHead + typed[0].length;
          continue;
        }
        failedColon = nextColon;
      }
      const untyped = CONSTRAINT_ITEM_UNTYPED.exec(text.slice(afterHead));
      if (untyped !== null) {
        yield { description: untyped[1] ?? '' };
        position = afterHead + untyped[0].length;
        continue;
      }
      // Only line breaks follow the marker: retry with less of the marker's padding
      const fallback = CONSTRAINT_ITEM_FALLBACK.exec(text.slice(start));
      if (fallback !== null) {
        yield { description: fallback[1] ?? '' };
        position = start + fallback[0].length;
      } else {
        position = start + 1;
      }
    }
  }

  /**
   * Split goal text into description and metric at the first `:`, `–`, or `-`.
   *
   * Same result as `text.match(/(.+?)(?::|–|-)\s*(.+)/)`, which was retried at
   * every position. A match can only start at the beginning of the text or right
   * after a line terminator, so the anchored expression is tried only there.
   * @param text - Goal text
   * @returns Match with the description in group 1 and the metric in group 2, or null
   */
  private static splitGoalMetric(text: string): RegExpExecArray | null {
    let start = 0;
    for (;;) {
      const match = GOAL_METRIC.exec(text.slice(start));
      if (match !== null) {
        return match;
      }
      LINE_TERMINATOR.lastIndex = start;
      const lineBreak = LINE_TERMINATOR.exec(text);
      if (lineBreak === null) {
        return null;
      }
      start = lineBreak.index + 1;
    }
  }

  /**
   * Strip YAML frontmatter from content if present.
   * Frontmatter is delimited by `---` on its own line at the start of the document.
   * @param content
   */
  private static stripFrontmatter(content: string): string {
    if (!content.startsWith('---')) {
      return content;
    }
    const endIndex = content.indexOf('\n---', 3);
    if (endIndex === -1) {
      return content;
    }
    const afterFrontmatter = endIndex + 4;
    return content.slice(afterFrontmatter).replace(/^\n/, '');
  }
}
