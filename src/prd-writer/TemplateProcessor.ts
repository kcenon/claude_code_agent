/**
 * TemplateProcessor - Handles PRD template loading and processing
 *
 * Loads the PRD template and substitutes variables with
 * actual values from collected information.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CollectedInfo } from '../scratchpad/index.js';
import type { TemplateProcessingResult, PRDMetadata } from './types.js';
import { TemplateNotFoundError, TemplateProcessingError } from './errors.js';

/**
 * Configuration for template processing
 */
export interface TemplateProcessorOptions {
  /** Path to the PRD template file */
  readonly templatePath?: string;
  /** Whether to remove unsubstituted variables */
  readonly removeUnsubstituted?: boolean;
  /** Default author name */
  readonly defaultAuthor?: string;
}

/**
 * Default template processor options
 */
const DEFAULT_OPTIONS: Required<TemplateProcessorOptions> = {
  templatePath: '.ad-sdlc/templates/prd-template.md',
  removeUnsubstituted: false,
  defaultAuthor: 'AD-SDLC PRD Writer Agent',
};

/**
 * TemplateProcessor class for PRD template handling
 */
export class TemplateProcessor {
  private readonly options: Required<TemplateProcessorOptions>;
  private templateContent: string | null = null;

  constructor(options: TemplateProcessorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Load the PRD template from file
   *
   * @returns The template content
   */
  public loadTemplate(): string {
    if (this.templateContent !== null) {
      return this.templateContent;
    }

    const templatePath = path.resolve(this.options.templatePath);

    try {
      this.templateContent = fs.readFileSync(templatePath, 'utf8');
      return this.templateContent;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new TemplateNotFoundError(templatePath);
      }
      throw new TemplateProcessingError('load', `Failed to read template: ${String(error)}`);
    }
  }

  /**
   * Process the template with collected info
   *
   * @param collectedInfo - The collected information
   * @param metadata - PRD metadata
   * @returns Processed template result
   */
  public process(collectedInfo: CollectedInfo, metadata: PRDMetadata): TemplateProcessingResult {
    const template = this.loadTemplate();
    const warnings: string[] = [];
    const substitutedVariables: string[] = [];
    const missingVariables: string[] = [];

    // Build variable map from collected info
    const variables = this.buildVariableMap(collectedInfo, metadata);

    // Process the template
    let content = template;

    // Replace simple variables ${variable_name}
    content = content.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
      const value = variables.get(varName);
      if (value !== undefined) {
        substitutedVariables.push(varName);
        return value;
      } else {
        missingVariables.push(varName);
        if (this.options.removeUnsubstituted) {
          return '';
        }
        return match;
      }
    });

    // Generate dynamic sections
    content = this.generateFunctionalRequirementsSection(content, collectedInfo);
    content = this.generateNonFunctionalRequirementsSection(content, collectedInfo);
    content = this.generateConstraintsSection(content, collectedInfo);
    content = this.generateAssumptionsSection(content, collectedInfo);
    content = this.generateDependenciesSection(content, collectedInfo);

    // Clean up template placeholders
    content = this.cleanupPlaceholders(content);

    // Add generation footer
    content = this.addGenerationFooter(content);

    return {
      content,
      substitutedVariables,
      missingVariables,
      warnings,
    };
  }

  /**
   * Generate PRD content without using a template file
   *
   * @param collectedInfo - The collected information
   * @param metadata - PRD metadata
   * @returns Generated PRD markdown content
   */
  public generateWithoutTemplate(collectedInfo: CollectedInfo, metadata: PRDMetadata): string {
    const lines: string[] = [];

    // Header
    lines.push(`# PRD: ${collectedInfo.project.name}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| **Document ID** | ${metadata.documentId} |`);
    lines.push(`| **Version** | ${metadata.version} |`);
    lines.push(`| **Status** | ${metadata.status} |`);
    lines.push(`| **Created** | ${metadata.createdAt.split('T')[0] ?? metadata.createdAt} |`);
    lines.push(`| **Last Updated** | ${metadata.updatedAt.split('T')[0] ?? metadata.updatedAt} |`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Executive Summary
    lines.push('## 1. Executive Summary');
    lines.push('');
    lines.push('### 1.1 Product Overview');
    lines.push('');
    lines.push(collectedInfo.project.description);
    lines.push('');
    lines.push('### 1.2 Key Value Propositions');
    lines.push('');
    lines.push(...this.extractValuePropositions(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // Problem Statement
    lines.push('## 2. Problem Statement');
    lines.push('');
    lines.push('### 2.1 Current State');
    lines.push('');
    lines.push('*To be defined based on stakeholder input.*');
    lines.push('');
    lines.push('### 2.2 Pain Points');
    lines.push('');
    lines.push('| Challenge | Description | Impact |');
    lines.push('|-----------|-------------|--------|');
    lines.push('| *To be defined* | *Based on requirements analysis* | *TBD* |');
    lines.push('');
    lines.push('### 2.3 Target State');
    lines.push('');
    lines.push(
      '*The system will address the identified pain points through the requirements outlined below.*'
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    // Goals & Success Metrics
    lines.push('## 3. Goals & Success Metrics');
    lines.push('');
    lines.push('### 3.1 Primary Goals');
    lines.push('');
    lines.push('| Goal ID | Goal | Measurement |');
    lines.push('|---------|------|-------------|');
    lines.push(...this.generateGoalsFromRequirements(collectedInfo));
    lines.push('');
    lines.push('### 3.2 Key Performance Indicators (KPIs)');
    lines.push('');
    lines.push(...this.generateKPIsFromNFRs(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // User Personas
    lines.push('## 4. User Personas');
    lines.push('');
    lines.push('### 4.1 Primary Persona');
    lines.push('');
    lines.push('| Attribute | Description |');
    lines.push('|-----------|-------------|');
    lines.push('| **Name** | Primary User |');
    lines.push('| **Role** | System User |');
    lines.push('| **Goals** | Efficiently accomplish tasks using this system |');
    lines.push('| **Pain Points** | Manual processes, lack of automation |');
    lines.push('| **Needs** | Intuitive interface, reliable performance |');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Functional Requirements
    lines.push('## 5. Functional Requirements');
    lines.push('');
    lines.push(...this.generateFunctionalRequirements(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // Non-Functional Requirements
    lines.push('## 6. Non-Functional Requirements');
    lines.push('');
    lines.push(...this.generateNonFunctionalRequirements(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // Constraints & Assumptions
    lines.push('## 7. Constraints & Assumptions');
    lines.push('');
    lines.push('### 7.1 Constraints');
    lines.push('');
    lines.push(...this.generateConstraints(collectedInfo));
    lines.push('');
    lines.push('### 7.2 Assumptions');
    lines.push('');
    lines.push(...this.generateAssumptions(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // Dependencies
    lines.push('## 8. Dependencies');
    lines.push('');
    lines.push('### 8.1 External Dependencies');
    lines.push('');
    lines.push(...this.generateExternalDependencies(collectedInfo));
    lines.push('');
    lines.push('### 8.2 Internal Dependencies');
    lines.push('');
    lines.push(...this.generateInternalDependencies(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // Timeline & Milestones
    lines.push('## 9. Timeline & Milestones');
    lines.push('');
    lines.push('| Phase | Milestone | Target Date | Status |');
    lines.push('|-------|-----------|-------------|--------|');
    lines.push('| Phase 1 | Requirements Finalization | TBD | In Progress |');
    lines.push('| Phase 2 | Design Complete | TBD | Not Started |');
    lines.push('| Phase 3 | Implementation | TBD | Not Started |');
    lines.push('| Phase 4 | Testing & QA | TBD | Not Started |');
    lines.push('| Phase 5 | Release | TBD | Not Started |');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Risks & Mitigations
    lines.push('## 10. Risks & Mitigations');
    lines.push('');
    lines.push('| Risk ID | Risk | Probability | Impact | Mitigation |');
    lines.push('|---------|------|-------------|--------|------------|');
    lines.push(...this.generateRisksFromAssumptions(collectedInfo));
    lines.push('');
    lines.push('---');
    lines.push('');

    // Out of Scope
    lines.push('## 11. Out of Scope');
    lines.push('');
    lines.push('The following items are explicitly **NOT** included in this release:');
    lines.push('');
    lines.push('- Features not listed in the functional requirements section');
    lines.push('- Integration with systems not mentioned in dependencies');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Appendix
    lines.push('## 12. Appendix');
    lines.push('');
    lines.push('### 12.1 Glossary');
    lines.push('');
    lines.push('| Term | Definition |');
    lines.push('|------|------------|');
    lines.push('| PRD | Product Requirements Document |');
    lines.push('| FR | Functional Requirement |');
    lines.push('| NFR | Non-Functional Requirement |');
    lines.push('');
    lines.push('### 12.2 References');
    lines.push('');
    lines.push(...this.generateReferences(collectedInfo));
    lines.push('');
    lines.push('### 12.3 Document History');
    lines.push('');
    lines.push('| Version | Date | Author | Changes |');
    lines.push('|---------|------|--------|---------|');
    lines.push(
      `| 1.0.0 | ${metadata.createdAt.split('T')[0] ?? metadata.createdAt} | ${this.options.defaultAuthor} | Initial draft |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('_Auto-generated by AD-SDLC PRD Writer Agent_');

    return lines.join('\n');
  }

  /**
   * Build variable map from collected info and metadata
   * @param info
   * @param metadata
   */
  private buildVariableMap(info: CollectedInfo, metadata: PRDMetadata): Map<string, string> {
    const vars = new Map<string, string>();

    // Metadata variables
    vars.set('product_name', info.project.name);
    vars.set('project_id', info.projectId);
    vars.set('document_id', metadata.documentId);
    vars.set('version', metadata.version);
    vars.set('status', metadata.status);
    vars.set('created_date', metadata.createdAt.split('T')[0] ?? metadata.createdAt);
    vars.set('updated_date', metadata.updatedAt.split('T')[0] ?? metadata.updatedAt);
    vars.set('author', this.options.defaultAuthor);

    // Project info
    vars.set('project_description', info.project.description);

    return vars;
  }

  /**
   * Generate functional requirements section
   * @param content
   * @param info
   */
  private generateFunctionalRequirementsSection(content: string, info: CollectedInfo): string {
    const marker = '<!-- Repeat FR-XXX section for each functional requirement -->';
    const frLines = this.generateFunctionalRequirements(info);
    return content.replace(marker, frLines.join('\n'));
  }

  /**
   * Generate non-functional requirements section
   * @param content
   * @param info
   */
  private generateNonFunctionalRequirementsSection(content: string, info: CollectedInfo): string {
    const nfrLines = this.generateNonFunctionalRequirements(info);
    // Replace the NFR template section
    const nfrPattern = /### NFR-001:[\s\S]*?(?=---\n\n## 7|$)/;
    if (nfrPattern.test(content)) {
      return content.replace(nfrPattern, nfrLines.join('\n') + '\n\n');
    }
    return content;
  }

  /**
   * Generate constraints section content
   * @param content
   * @param info
   */
  private generateConstraintsSection(content: string, info: CollectedInfo): string {
    const constraintLines = this.generateConstraints(info);
    const pattern = /\| CON-001 \|[\s\S]*?\|[\s\S]*?\|/;
    if (pattern.test(content)) {
      return content.replace(pattern, constraintLines.join('\n'));
    }
    return content;
  }

  /**
   * Generate assumptions section content
   * @param content
   * @param info
   */
  private generateAssumptionsSection(content: string, info: CollectedInfo): string {
    const assumptionLines = this.generateAssumptions(info);
    const pattern = /\| ASM-001 \|[\s\S]*?\|[\s\S]*?\|/;
    if (pattern.test(content)) {
      return content.replace(pattern, assumptionLines.join('\n'));
    }
    return content;
  }

  /**
   * Generate dependencies section content
   * @param content
   * @param info
   */
  private generateDependenciesSection(content: string, info: CollectedInfo): string {
    const extDepLines = this.generateExternalDependencies(info);
    const pattern = /\| \$\{dep_name\} \|[\s\S]*?\|[\s\S]*?\|[\s\S]*?\|/;
    if (pattern.test(content)) {
      return content.replace(pattern, extDepLines.join('\n'));
    }
    return content;
  }

  /**
   * Generate functional requirements content
   * @param info
   */
  private generateFunctionalRequirements(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const reqs = info.requirements?.functional ?? [];

    if (reqs.length === 0) {
      lines.push('*No functional requirements defined yet.*');
      return lines;
    }

    for (const req of reqs) {
      lines.push(`### ${req.id}: ${req.title}`);
      lines.push('');
      lines.push('| Attribute | Value |');
      lines.push('|-----------|-------|');
      lines.push(`| **Priority** | ${req.priority} |`);
      lines.push(`| **Status** | ${req.status ?? 'Proposed'} |`);
      lines.push('');
      lines.push('**Description:**');
      lines.push(req.description);
      lines.push('');
      lines.push('**User Story:**');
      lines.push('As a user, I want this functionality so that I can accomplish my goals.');
      lines.push('');
      lines.push('**Acceptance Criteria:**');
      const criteria = req.acceptanceCriteria ?? [];
      if (criteria.length > 0) {
        for (const ac of criteria) {
          lines.push(`- [ ] ${ac.description}`);
        }
      } else {
        lines.push('- [ ] The requirement is implemented as described');
        lines.push('- [ ] The feature passes all relevant tests');
      }
      lines.push('');
      const deps = req.dependencies ?? [];
      if (deps.length > 0) {
        lines.push('**Dependencies:**');
        for (const dep of deps) {
          lines.push(`- ${dep}`);
        }
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    return lines;
  }

  /**
   * Generate non-functional requirements content
   * @param info
   */
  private generateNonFunctionalRequirements(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const nfrs = info.requirements?.nonFunctional ?? [];

    if (nfrs.length === 0) {
      lines.push('*No non-functional requirements defined yet.*');
      return lines;
    }

    for (const nfr of nfrs) {
      lines.push(`### ${nfr.id}: ${nfr.title}`);
      lines.push('');
      lines.push('| Attribute | Value |');
      lines.push('|-----------|-------|');
      lines.push(`| **Category** | ${this.capitalizeFirst(nfr.category)} |`);
      lines.push(`| **Priority** | ${nfr.priority} |`);
      lines.push('');
      lines.push('**Description:**');
      lines.push(nfr.description);
      lines.push('');
      if (nfr.metric !== undefined || nfr.target !== undefined) {
        lines.push('**Target Metric:**');
        lines.push(nfr.metric ?? nfr.target ?? 'TBD');
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    return lines;
  }

  /**
   * Generate constraints table rows
   * @param info
   */
  private generateConstraints(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const constraints = info.constraints ?? [];

    if (constraints.length === 0) {
      lines.push('| *None defined* | *N/A* | *N/A* |');
      return lines;
    }

    lines.push('| ID | Constraint | Reason |');
    lines.push('|----|------------|--------|');
    for (const con of constraints) {
      lines.push(`| ${con.id} | ${con.description} | ${con.reason ?? 'TBD'} |`);
    }

    return lines;
  }

  /**
   * Generate assumptions table rows
   * @param info
   */
  private generateAssumptions(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const assumptions = info.assumptions ?? [];

    if (assumptions.length === 0) {
      lines.push('| *None defined* | *N/A* | *N/A* |');
      return lines;
    }

    lines.push('| ID | Assumption | Risk if Wrong |');
    lines.push('|----|------------|---------------|');
    for (const asm of assumptions) {
      lines.push(`| ${asm.id} | ${asm.description} | ${asm.riskIfWrong ?? 'TBD'} |`);
    }

    return lines;
  }

  /**
   * Generate external dependencies table rows
   * @param info
   */
  private generateExternalDependencies(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const deps = (info.dependencies ?? []).filter(
      (d) => d.type === 'api' || d.type === 'library' || d.type === 'service'
    );

    if (deps.length === 0) {
      lines.push('| *None defined* | *N/A* | *N/A* | *N/A* |');
      return lines;
    }

    lines.push('| Name | Type | Version | Purpose |');
    lines.push('|------|------|---------|---------|');
    for (const dep of deps) {
      lines.push(
        `| ${dep.name} | ${this.capitalizeFirst(dep.type)} | ${dep.version ?? 'Latest'} | ${dep.purpose ?? 'TBD'} |`
      );
    }

    return lines;
  }

  /**
   * Generate internal dependencies table rows
   * @param info
   */
  private generateInternalDependencies(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const deps = (info.dependencies ?? []).filter((d) => d.type === 'tool');

    if (deps.length === 0) {
      lines.push('| *None defined* | *N/A* |');
      return lines;
    }

    lines.push('| Module | Dependency Reason |');
    lines.push('|--------|-------------------|');
    for (const dep of deps) {
      lines.push(`| ${dep.name} | ${dep.purpose ?? 'TBD'} |`);
    }

    return lines;
  }

  /**
   * Extract value propositions from collected info
   * @param info
   */
  private extractValuePropositions(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const reqs = info.requirements?.functional ?? [];

    // Extract top 3 P0/P1 requirements as value propositions
    const highPriority = reqs.filter((r) => r.priority === 'P0' || r.priority === 'P1').slice(0, 3);

    if (highPriority.length > 0) {
      for (const req of highPriority) {
        lines.push(`- ${req.title}: ${this.truncate(req.description, 80)}`);
      }
    } else {
      lines.push('- Addresses key business needs identified in requirements');
      lines.push('- Provides structured approach to solution development');
      lines.push('- Enables measurable outcomes through defined success criteria');
    }

    return lines;
  }

  /**
   * Generate goals from requirements
   * @param info
   */
  private generateGoalsFromRequirements(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const reqs = info.requirements?.functional ?? [];

    const p0Reqs = reqs.filter((r) => r.priority === 'P0').slice(0, 3);

    if (p0Reqs.length > 0) {
      for (let i = 0; i < p0Reqs.length; i++) {
        const req = p0Reqs[i];
        if (req !== undefined) {
          lines.push(
            `| G-${String(i + 1).padStart(3, '0')} | ${req.title} | Completion of ${req.id} |`
          );
        }
      }
    } else {
      lines.push('| G-001 | Deliver core functionality | All P0 requirements implemented |');
    }

    return lines;
  }

  /**
   * Generate KPIs from NFRs
   * @param info
   */
  private generateKPIsFromNFRs(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const nfrs = info.requirements?.nonFunctional ?? [];

    lines.push('```yaml');

    const perfNFRs = nfrs.filter((n) => n.category === 'performance');
    const secNFRs = nfrs.filter((n) => n.category === 'security');

    if (perfNFRs.length > 0) {
      lines.push('Efficiency Metrics:');
      for (const nfr of perfNFRs.slice(0, 2)) {
        lines.push(`  - ${nfr.title}: ${nfr.metric ?? nfr.target ?? 'TBD'}`);
      }
    } else {
      lines.push('Efficiency Metrics:');
      lines.push('  - Response time: < 200ms');
    }

    lines.push('');

    if (secNFRs.length > 0) {
      lines.push('Quality Metrics:');
      for (const nfr of secNFRs.slice(0, 2)) {
        lines.push(`  - ${nfr.title}: ${nfr.metric ?? nfr.target ?? 'TBD'}`);
      }
    } else {
      lines.push('Quality Metrics:');
      lines.push('  - Test coverage: > 80%');
    }

    lines.push('');
    lines.push('User Satisfaction:');
    lines.push('  - Usability score: TBD');

    lines.push('```');

    return lines;
  }

  /**
   * Generate risks from assumptions
   * @param info
   */
  private generateRisksFromAssumptions(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const assumptions = info.assumptions ?? [];

    if (assumptions.length > 0) {
      for (let i = 0; i < Math.min(assumptions.length, 3); i++) {
        const asm = assumptions[i];
        if (asm !== undefined) {
          lines.push(
            `| R-${String(i + 1).padStart(3, '0')} | ${asm.description} (${asm.id}) | Medium | Medium | ${asm.riskIfWrong ?? 'Validate assumption early'} |`
          );
        }
      }
    } else {
      lines.push(
        '| R-001 | Requirements may change | Medium | Medium | Regular stakeholder reviews |'
      );
      lines.push('| R-002 | Technical constraints discovered | Low | High | Prototype early |');
    }

    return lines;
  }

  /**
   * Generate references from sources
   * @param info
   */
  private generateReferences(info: CollectedInfo): string[] {
    const lines: string[] = [];
    const sources = info.sources ?? [];

    if (sources.length > 0) {
      for (const source of sources) {
        if (source.type === 'url') {
          lines.push(`- [${source.summary ?? source.reference}](${source.reference})`);
        } else {
          lines.push(
            `- ${source.reference}${source.summary !== undefined ? `: ${source.summary}` : ''}`
          );
        }
      }
    } else {
      lines.push('- Collected information from AD-SDLC Collector Agent');
    }

    return lines;
  }

  /**
   * Clean up remaining template placeholders
   * @param content
   */
  private cleanupPlaceholders(content: string): string {
    // Remove lines with only placeholders
    return content
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        // Keep lines that don't have unsubstituted variables or are not just placeholders
        return !trimmed.match(/^\$\{[^}]+\}$/);
      })
      .join('\n');
  }

  /**
   * Add generation footer
   * @param content
   */
  private addGenerationFooter(content: string): string {
    if (!content.includes('Auto-generated by AD-SDLC')) {
      return content + '\n\n---\n\n_Auto-generated by AD-SDLC PRD Writer Agent_\n';
    }
    return content;
  }

  /**
   * Capitalize first letter
   * @param str
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Truncate string to max length
   * @param str
   * @param maxLength
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}
