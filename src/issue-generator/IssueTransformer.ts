/**
 * Issue Transformer module
 *
 * Transforms SDS components into GitHub Issue structures
 * with proper formatting, labels, and traceability.
 */

import type {
  SDSComponent,
  ParsedSDS,
  GeneratedIssue,
  IssueLabels,
  IssueDependencies,
  IssueTraceability,
  IssueTechnical,
  IssueEstimation,
  IssueGeneratorOptions,
  TraceabilityEntry,
  IssueType,
  EffortSize,
} from './types.js';
import { EffortEstimator } from './EffortEstimator.js';
import { IssueTransformError } from './errors.js';

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<IssueGeneratorOptions> = {
  maxIssueSize: 'L',
  defaultPriority: 'P1',
  defaultType: 'feature',
  milestone: '',
  phasePrefix: 'phase',
  includeHints: true,
  includeTraceability: true,
};

/**
 * Transforms SDS components into GitHub Issues
 */
export class IssueTransformer {
  private readonly options: Required<IssueGeneratorOptions>;
  private readonly estimator: EffortEstimator;
  private issueCounter: number = 0;

  constructor(
    options: IssueGeneratorOptions = {},
    estimator?: EffortEstimator
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.estimator = estimator ?? new EffortEstimator();
  }

  /**
   * Transform all components in an SDS to issues
   * @param sds - Parsed SDS document
   * @returns Array of generated issues
   */
  public transformAll(sds: ParsedSDS): readonly GeneratedIssue[] {
    this.issueCounter = 0;
    const issues: GeneratedIssue[] = [];

    for (const component of sds.components) {
      const estimation = this.estimator.estimate(component);

      // Check if decomposition is needed
      if (this.estimator.shouldDecompose(component, this.options.maxIssueSize)) {
        const subIssues = this.decomposeComponent(
          component,
          sds.traceabilityMatrix
        );
        issues.push(...subIssues);
      } else {
        const issue = this.transformComponent(
          component,
          sds.traceabilityMatrix,
          estimation
        );
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Transform a single component to an issue
   */
  public transformComponent(
    component: SDSComponent,
    traceabilityMatrix: readonly TraceabilityEntry[],
    estimation?: IssueEstimation
  ): GeneratedIssue {
    const issueId = this.generateIssueId();
    const finalEstimation = estimation ?? this.estimator.estimate(component);

    try {
      const traceability = this.buildTraceability(component, traceabilityMatrix);
      const labels = this.buildLabels(component, finalEstimation);
      const technical = this.buildTechnical(component);
      const dependencies = this.buildDependencies(component);
      const body = this.generateBody(
        component,
        traceability,
        technical,
        finalEstimation
      );

      return {
        issueId,
        githubNumber: null,
        title: this.generateTitle(component),
        body,
        labels,
        milestone: this.options.milestone || null,
        assignees: [],
        dependencies,
        traceability,
        technical,
        estimation: finalEstimation,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new IssueTransformError(component.id, message);
    }
  }

  /**
   * Decompose a large component into multiple issues
   */
  private decomposeComponent(
    component: SDSComponent,
    traceabilityMatrix: readonly TraceabilityEntry[]
  ): readonly GeneratedIssue[] {
    const issues: GeneratedIssue[] = [];
    const suggestions = this.estimator.suggestDecomposition(component);

    if (!suggestions || suggestions.length === 0) {
      // Fall back to single issue if no suggestions
      const estimation = this.estimator.estimate(component);
      return [
        this.transformComponent(component, traceabilityMatrix, estimation),
      ];
    }

    // Create a parent issue for tracking
    const parentId = this.generateIssueId();
    const parentEstimation: IssueEstimation = {
      size: 'L' as EffortSize,
      hours: 16,
      factors: {
        complexity: 7,
        interfaceCount: component.interfaces.length,
        dependencyCount: component.dependencies.length,
        methodCount: component.interfaces.reduce(
          (sum, i) => sum + i.methods.length,
          0
        ),
      },
    };

    const parentTraceability = this.buildTraceability(
      component,
      traceabilityMatrix
    );
    const parentLabels = this.buildLabels(component, parentEstimation);
    const parentTechnical = this.buildTechnical(component);
    const parentDependencies = this.buildDependencies(component);

    issues.push({
      issueId: parentId,
      githubNumber: null,
      title: `[Epic] ${this.generateTitle(component)}`,
      body: this.generateEpicBody(component, suggestions, parentTraceability),
      labels: { ...parentLabels, type: 'feature' as IssueType },
      milestone: this.options.milestone || null,
      assignees: [],
      dependencies: parentDependencies,
      traceability: parentTraceability,
      technical: parentTechnical,
      estimation: parentEstimation,
    });

    // Create sub-issues for each suggestion
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      if (suggestion === undefined) continue;

      const subIssueId = this.generateIssueId();
      const subEstimation: IssueEstimation = {
        size: 'S' as EffortSize,
        hours: 4,
        factors: {
          complexity: 3,
          interfaceCount: 1,
          dependencyCount: 0,
          methodCount: 2,
        },
      };

      const subLabels = this.buildLabels(component, subEstimation);
      const subBody = this.generateSubTaskBody(
        component,
        suggestion,
        parentId,
        parentTraceability
      );

      issues.push({
        issueId: subIssueId,
        githubNumber: null,
        title: `${component.id}: ${suggestion}`,
        body: subBody,
        labels: { ...subLabels, size: subEstimation.size },
        milestone: this.options.milestone || null,
        assignees: [],
        dependencies: {
          blockedBy: i === 0 ? [] : [issues[issues.length - 1]?.issueId ?? ''],
          blocks: [],
        },
        traceability: {
          ...parentTraceability,
          sdsComponent: `${component.id} (sub-task ${String(i + 1)})`,
        },
        technical: {
          suggestedApproach: [suggestion],
          relatedFiles: [],
          considerations: `Part of ${parentId}`,
        },
        estimation: subEstimation,
      });
    }

    return issues;
  }

  /**
   * Generate a unique issue ID
   */
  private generateIssueId(): string {
    this.issueCounter++;
    return `ISS-${String(this.issueCounter).padStart(3, '0')}`;
  }

  /**
   * Generate issue title from component
   */
  private generateTitle(component: SDSComponent): string {
    if (component.name) {
      return `Implement ${component.name}`;
    }
    return `Implement ${component.id}`;
  }

  /**
   * Build traceability links
   */
  private buildTraceability(
    component: SDSComponent,
    matrix: readonly TraceabilityEntry[]
  ): IssueTraceability {
    const entry = matrix.find((e) => e.componentId === component.id);

    if (entry) {
      return {
        sdsComponent: component.id,
        srsFeature: entry.srsFeature,
        prdRequirement: entry.prdRequirement,
        useCases: entry.useCases,
      };
    }

    return {
      sdsComponent: component.id,
      srsFeature: component.sourceFeature,
      prdRequirement: null,
      useCases: [],
    };
  }

  /**
   * Build issue labels
   */
  private buildLabels(
    component: SDSComponent,
    estimation: IssueEstimation
  ): IssueLabels {
    return {
      type: this.options.defaultType,
      priority: component.priority,
      component: component.name || component.id,
      size: estimation.size,
      autoGenerated: true,
      phase: this.options.phasePrefix
        ? `${this.options.phasePrefix}-3`
        : null,
    };
  }

  /**
   * Build technical guidance
   */
  private buildTechnical(component: SDSComponent): IssueTechnical {
    const suggestedApproach: string[] = [];

    // Build approach from component structure
    if (component.interfaces.length > 0) {
      suggestedApproach.push('Define interface contracts');
      for (const iface of component.interfaces) {
        suggestedApproach.push(`Implement ${iface.name} interface`);
      }
    }

    if (component.dependencies.length > 0) {
      suggestedApproach.push('Integrate with dependent components');
    }

    suggestedApproach.push('Write unit tests');
    suggestedApproach.push('Update documentation');

    return {
      suggestedApproach,
      relatedFiles: [],
      considerations: component.implementationNotes || '',
    };
  }

  /**
   * Build dependency relationships
   */
  private buildDependencies(component: SDSComponent): IssueDependencies {
    // Note: Actual issue IDs will be resolved later by IssueGenerator
    return {
      blockedBy: [...component.dependencies],
      blocks: [],
    };
  }

  /**
   * Generate the issue body in markdown
   */
  private generateBody(
    component: SDSComponent,
    traceability: IssueTraceability,
    technical: IssueTechnical,
    estimation: IssueEstimation
  ): string {
    const sections: string[] = [];

    // Description
    sections.push('## Description\n');
    sections.push(component.description || component.responsibility || '');
    sections.push('\n');

    // Context
    sections.push('## Context\n');
    sections.push(
      'This issue implements part of the AD-SDLC automated pipeline.\n'
    );

    // Source References
    if (this.options.includeTraceability) {
      sections.push('### Source References\n');
      sections.push('| Document | Reference |');
      sections.push('|----------|-----------|');
      sections.push(`| SDS Component | ${traceability.sdsComponent} |`);
      if (traceability.srsFeature !== null && traceability.srsFeature !== '') {
        sections.push(`| SRS Feature | ${traceability.srsFeature} |`);
      }
      if (traceability.prdRequirement !== null && traceability.prdRequirement !== '') {
        sections.push(`| PRD Requirement | ${traceability.prdRequirement} |`);
      }
      sections.push('\n');
    }

    // Acceptance Criteria
    sections.push('## Acceptance Criteria\n');
    sections.push(this.generateAcceptanceCriteria(component));
    sections.push('\n');

    // Technical Notes
    if (this.options.includeHints && technical.considerations) {
      sections.push('## Technical Notes\n');
      sections.push(technical.considerations);
      sections.push('\n');
    }

    // Suggested Approach
    if (this.options.includeHints && technical.suggestedApproach.length > 0) {
      sections.push('### Suggested Approach\n');
      for (let i = 0; i < technical.suggestedApproach.length; i++) {
        const approach = technical.suggestedApproach[i] ?? '';
        sections.push(`${String(i + 1)}. ${approach}`);
      }
      sections.push('\n');
    }

    // Interfaces
    if (component.interfaces.length > 0) {
      sections.push('### Interfaces\n');
      for (const iface of component.interfaces) {
        sections.push('```typescript');
        sections.push(iface.rawCode);
        sections.push('```\n');
      }
    }

    // Dependencies
    if (component.dependencies.length > 0) {
      sections.push('## Dependencies\n');
      for (const dep of component.dependencies) {
        sections.push(`- **Blocked by**: ${dep}`);
      }
      sections.push('\n');
    }

    // Effort Estimation
    sections.push('## Effort Estimation\n');
    sections.push('| Size | Estimated Time |');
    sections.push('|------|----------------|');
    sections.push('| XS | < 2 hours |');
    sections.push('| S | 2-4 hours |');
    sections.push('| M | 4-8 hours |');
    sections.push('| L | 1-2 days |');
    sections.push('| XL | > 2 days (consider splitting) |');
    sections.push('\n');
    sections.push(`**This issue**: ${estimation.size}\n`);

    // Footer
    sections.push('---');
    sections.push('_Auto-generated by AD-SDLC Issue Generator Agent_');
    sections.push(
      `_Traceability: ${traceability.sdsComponent} → ${traceability.srsFeature ?? 'N/A'} → ${traceability.prdRequirement ?? 'N/A'}_`
    );

    return sections.join('\n');
  }

  /**
   * Generate acceptance criteria from component
   */
  private generateAcceptanceCriteria(component: SDSComponent): string {
    const criteria: string[] = [];

    // From interfaces
    for (const iface of component.interfaces) {
      criteria.push(`- [ ] ${iface.name} interface implemented`);
      for (const method of iface.methods) {
        criteria.push(`  - [ ] ${method.name} method working`);
      }
    }

    // Standard criteria
    if (component.dependencies.length > 0) {
      criteria.push('- [ ] Integration with dependencies verified');
    }
    criteria.push('- [ ] Unit tests written with >80% coverage');
    criteria.push('- [ ] Documentation updated');

    return criteria.join('\n');
  }

  /**
   * Generate body for epic (parent) issue
   */
  private generateEpicBody(
    component: SDSComponent,
    subTasks: readonly string[],
    traceability: IssueTraceability
  ): string {
    const sections: string[] = [];

    sections.push('## Description\n');
    sections.push(`Epic for implementing ${component.name || component.id}.\n`);
    sections.push(component.description || component.responsibility || '');
    sections.push('\n');

    sections.push('## Sub-Tasks\n');
    for (const task of subTasks) {
      sections.push(`- [ ] ${task}`);
    }
    sections.push('\n');

    if (this.options.includeTraceability) {
      sections.push('### Source References\n');
      sections.push(`- SDS Component: ${traceability.sdsComponent}`);
      if (traceability.srsFeature !== null && traceability.srsFeature !== '') {
        sections.push(`- SRS Feature: ${traceability.srsFeature}`);
      }
      sections.push('\n');
    }

    sections.push('---');
    sections.push('_Auto-generated by AD-SDLC Issue Generator Agent_');

    return sections.join('\n');
  }

  /**
   * Generate body for sub-task issue
   */
  private generateSubTaskBody(
    component: SDSComponent,
    task: string,
    parentId: string,
    traceability: IssueTraceability
  ): string {
    const sections: string[] = [];

    sections.push('## Description\n');
    sections.push(`${task} for ${component.name || component.id}.\n`);
    sections.push(`Parent: ${parentId}\n`);

    sections.push('## Acceptance Criteria\n');
    sections.push(`- [ ] ${task} completed`);
    sections.push('- [ ] Unit tests passing');
    sections.push('- [ ] Code review approved\n');

    sections.push('### Source References\n');
    sections.push(`- SDS Component: ${traceability.sdsComponent}`);
    sections.push('\n');

    sections.push('---');
    sections.push('_Auto-generated by AD-SDLC Issue Generator Agent_');

    return sections.join('\n');
  }

  /**
   * Get component ID to issue ID mapping
   * @param issues - Generated issues
   * @returns Map of component ID to issue ID
   */
  public getComponentToIssueMap(
    issues: readonly GeneratedIssue[]
  ): Map<string, string> {
    const map = new Map<string, string>();

    for (const issue of issues) {
      // Extract component ID from traceability
      const componentId = issue.traceability.sdsComponent.split(' ')[0];
      if (componentId !== undefined && componentId !== '' && !map.has(componentId)) {
        map.set(componentId, issue.issueId);
      }
    }

    return map;
  }
}
