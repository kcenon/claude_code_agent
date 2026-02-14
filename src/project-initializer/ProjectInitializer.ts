/**
 * Project initialization and scaffolding implementation
 *
 * Uses tryGetProjectRoot() for consistent directory resolution
 * when targetDir is not explicitly provided.
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';

import { tryGetProjectRoot } from '../utils/index.js';

import yaml from 'js-yaml';

import { FileSystemError, ProjectExistsError } from './errors.js';
import { getPrerequisiteValidator } from './PrerequisiteValidator.js';
import type {
  InitOptions,
  InitResult,
  QualityGateConfig,
  TemplateConfig,
  TemplateType,
  WorkflowConfig,
} from './types.js';
import { QUALITY_GATE_CONFIGS, TEMPLATE_CONFIGS } from './types.js';

/**
 * Resolve the target directory using ProjectContext when available.
 *
 * Priority:
 * 1. Explicitly provided targetDir
 * 2. Initialized project root from ProjectContext
 * 3. Current working directory (fallback)
 * @param targetDir - Optional target directory path to use
 * @returns Resolved target directory path
 */
function resolveTargetDir(targetDir?: string): string {
  if (targetDir !== undefined && targetDir !== '') {
    return targetDir;
  }
  return tryGetProjectRoot() ?? process.cwd();
}

/**
 * Handles project initialization and scaffolding
 */
export class ProjectInitializer {
  private readonly options: InitOptions;

  constructor(options: InitOptions) {
    this.options = {
      ...options,
      targetDir: resolveTargetDir(options.targetDir),
    };
  }

  /**
   * Initialize a new AD-SDLC project
   * @returns Initialization result containing success status and created files
   */
  async initialize(): Promise<InitResult> {
    const createdFiles: string[] = [];
    const warnings: string[] = [];
    const projectPath = path.resolve(
      this.options.targetDir ?? resolveTargetDir(),
      this.options.projectName
    );

    try {
      // Validate prerequisites unless skipped
      if (this.options.skipValidation !== true) {
        const validator = getPrerequisiteValidator();
        const validationResult = await validator.validate();

        if (!validationResult.valid) {
          const failed = validationResult.checks
            .filter((c) => !c.passed && c.required)
            .map(
              (c) => `${c.name}: ${c.fix !== undefined && c.fix.length > 0 ? c.fix : 'Unknown fix'}`
            );
          return {
            success: false,
            projectPath,
            createdFiles: [],
            warnings: [],
            error: `Prerequisite validation failed:\n${failed.join('\n')}`,
          };
        }

        // Collect warnings for optional checks that failed
        for (const check of validationResult.checks) {
          if (!check.passed && !check.required && check.fix !== undefined && check.fix.length > 0) {
            warnings.push(`${check.name}: ${check.fix}`);
          }
        }
      }

      // Check if project already exists
      if (fs.existsSync(projectPath)) {
        const adSdlcPath = path.join(projectPath, '.ad-sdlc');
        if (fs.existsSync(adSdlcPath)) {
          throw new ProjectExistsError(projectPath);
        }
      }

      // Create directory structure
      const directories = this.getDirectoryStructure(projectPath);
      for (const dir of directories) {
        await this.createDirectory(dir);
        createdFiles.push(dir);
      }

      // Generate configuration files
      const configFiles = await this.generateConfigFiles(projectPath);
      createdFiles.push(...configFiles);

      // Generate template files
      const templateFiles = await this.generateTemplateFiles(projectPath);
      createdFiles.push(...templateFiles);

      // Generate agent definitions
      const agentFiles = await this.generateAgentDefinitions(projectPath);
      createdFiles.push(...agentFiles);

      // Update .gitignore
      const gitignoreUpdated = await this.updateGitignore(projectPath);
      if (gitignoreUpdated) {
        createdFiles.push(path.join(projectPath, '.gitignore'));
      }

      // Create README if it doesn't exist
      const readmePath = path.join(projectPath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        await this.createReadme(projectPath);
        createdFiles.push(readmePath);
      }

      return {
        success: true,
        projectPath,
        createdFiles,
        warnings,
      };
    } catch (error) {
      if (error instanceof ProjectExistsError) {
        return {
          success: false,
          projectPath,
          createdFiles,
          warnings,
          error: error.message,
        };
      }
      throw error;
    }
  }

  /**
   * Get the directory structure to create
   * @param projectPath - The root path of the project
   * @returns Array of directory paths to create
   */
  private getDirectoryStructure(projectPath: string): string[] {
    return [
      // Root project directory
      projectPath,

      // .ad-sdlc structure
      path.join(projectPath, '.ad-sdlc'),
      path.join(projectPath, '.ad-sdlc', 'config'),
      path.join(projectPath, '.ad-sdlc', 'scratchpad'),
      path.join(projectPath, '.ad-sdlc', 'scratchpad', 'info'),
      path.join(projectPath, '.ad-sdlc', 'scratchpad', 'documents'),
      path.join(projectPath, '.ad-sdlc', 'scratchpad', 'issues'),
      path.join(projectPath, '.ad-sdlc', 'scratchpad', 'progress'),
      path.join(projectPath, '.ad-sdlc', 'templates'),
      path.join(projectPath, '.ad-sdlc', 'logs'),

      // .claude structure
      path.join(projectPath, '.claude'),
      path.join(projectPath, '.claude', 'agents'),

      // docs structure
      path.join(projectPath, 'docs'),
      path.join(projectPath, 'docs', 'prd'),
      path.join(projectPath, 'docs', 'srs'),
      path.join(projectPath, 'docs', 'sds'),
    ];
  }

  /**
   * Create a directory if it doesn't exist
   * @param dirPath - The directory path to create
   * @returns Promise that resolves when directory is created
   */
  private createDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return Promise.resolve();
    } catch (error) {
      throw new FileSystemError(dirPath, 'create directory', error as Error);
    }
  }

  /**
   * Generate configuration files
   * @param projectPath - The root path of the project
   * @returns Array of created configuration file paths
   */
  private async generateConfigFiles(projectPath: string): Promise<string[]> {
    const createdFiles: string[] = [];
    const templateConfig = TEMPLATE_CONFIGS[this.options.template];
    const qualityGateConfig = QUALITY_GATE_CONFIGS[templateConfig.qualityGates];

    // Generate workflow.yaml
    const workflowPath = path.join(projectPath, '.ad-sdlc', 'config', 'workflow.yaml');
    const workflowContent = this.generateWorkflowConfig(templateConfig, qualityGateConfig);
    await this.writeFile(workflowPath, yaml.dump(workflowContent, { lineWidth: 100 }));
    createdFiles.push(workflowPath);

    // Generate agents.yaml
    const agentsPath = path.join(projectPath, '.ad-sdlc', 'config', 'agents.yaml');
    const agentsContent = this.generateAgentsConfig();
    await this.writeFile(agentsPath, yaml.dump(agentsContent, { lineWidth: 100 }));
    createdFiles.push(agentsPath);

    return createdFiles;
  }

  /**
   * Generate workflow configuration
   * @param templateConfig - The template configuration to use
   * @param qualityGates - The quality gate configuration to apply
   * @returns Generated workflow configuration object
   */
  private generateWorkflowConfig(
    templateConfig: TemplateConfig,
    qualityGates: QualityGateConfig
  ): WorkflowConfig {
    return {
      version: '1.0.0',
      pipeline: {
        stages: [
          { name: 'collect', agent: 'collector', timeout_ms: 300000 },
          { name: 'prd', agent: 'prd-writer', timeout_ms: 300000 },
          { name: 'srs', agent: 'srs-writer', timeout_ms: 300000 },
          { name: 'sds', agent: 'sds-writer', timeout_ms: 300000 },
          { name: 'issues', agent: 'issue-generator', timeout_ms: 300000 },
          { name: 'implement', agent: 'controller', timeout_ms: 600000 },
          { name: 'review', agent: 'pr-reviewer', timeout_ms: 300000 },
        ],
      },
      quality_gates: qualityGates,
      execution: {
        max_parallel_workers: templateConfig.parallelWorkers,
        retry_attempts: 3,
        retry_delay_ms: 5000,
      },
    };
  }

  /**
   * Generate agents configuration
   * @returns Agent configuration object with definitions
   */
  private generateAgentsConfig(): Record<string, unknown> {
    return {
      version: '1.0.0',
      agents: {
        collector: {
          description: 'Collects and organizes project requirements',
          model: 'sonnet',
          definition: '.claude/agents/collector.md',
        },
        'prd-writer': {
          description: 'Generates Product Requirements Document',
          model: 'sonnet',
          definition: '.claude/agents/prd-writer.md',
        },
        'srs-writer': {
          description: 'Generates Software Requirements Specification',
          model: 'sonnet',
          definition: '.claude/agents/srs-writer.md',
        },
        'sds-writer': {
          description: 'Generates Software Design Specification',
          model: 'sonnet',
          definition: '.claude/agents/sds-writer.md',
        },
        'issue-generator': {
          description: 'Generates GitHub issues from SDS',
          model: 'sonnet',
          definition: '.claude/agents/issue-generator.md',
        },
        controller: {
          description: 'Orchestrates parallel implementation',
          model: 'sonnet',
          definition: '.claude/agents/controller.md',
        },
        worker: {
          description: 'Implements individual issues',
          model: 'sonnet',
          definition: '.claude/agents/worker.md',
        },
        'pr-reviewer': {
          description: 'Reviews pull requests',
          model: 'sonnet',
          definition: '.claude/agents/pr-reviewer.md',
        },
      },
    };
  }

  /**
   * Generate template files
   * @param projectPath - The root path of the project
   * @returns Array of created template file paths
   */
  private async generateTemplateFiles(projectPath: string): Promise<string[]> {
    const createdFiles: string[] = [];
    const templatesDir = path.join(projectPath, '.ad-sdlc', 'templates');

    // PRD template
    const prdTemplate = this.getPrdTemplate();
    const prdPath = path.join(templatesDir, 'prd-template.md');
    await this.writeFile(prdPath, prdTemplate);
    createdFiles.push(prdPath);

    // SRS template
    const srsTemplate = this.getSrsTemplate();
    const srsPath = path.join(templatesDir, 'srs-template.md');
    await this.writeFile(srsPath, srsTemplate);
    createdFiles.push(srsPath);

    // SDS template
    const sdsTemplate = this.getSdsTemplate();
    const sdsPath = path.join(templatesDir, 'sds-template.md');
    await this.writeFile(sdsPath, sdsTemplate);
    createdFiles.push(sdsPath);

    // Issue template
    const issueTemplate = this.getIssueTemplate();
    const issuePath = path.join(templatesDir, 'issue-template.md');
    await this.writeFile(issuePath, issueTemplate);
    createdFiles.push(issuePath);

    return createdFiles;
  }

  /**
   * Generate agent definition files
   * @param projectPath - The root path of the project
   * @returns Array of created agent definition file paths
   */
  private async generateAgentDefinitions(projectPath: string): Promise<string[]> {
    const createdFiles: string[] = [];
    const agentsDir = path.join(projectPath, '.claude', 'agents');

    const agents = [
      { name: 'collector', content: this.getCollectorAgentDef() },
      { name: 'prd-writer', content: this.getPrdWriterAgentDef() },
      { name: 'srs-writer', content: this.getSrsWriterAgentDef() },
      { name: 'sds-writer', content: this.getSdsWriterAgentDef() },
      { name: 'issue-generator', content: this.getIssueGeneratorAgentDef() },
      { name: 'controller', content: this.getControllerAgentDef() },
      { name: 'worker', content: this.getWorkerAgentDef() },
      { name: 'pr-reviewer', content: this.getPrReviewerAgentDef() },
    ];

    for (const agent of agents) {
      const agentPath = path.join(agentsDir, `${agent.name}.md`);
      await this.writeFile(agentPath, agent.content);
      createdFiles.push(agentPath);
    }

    return createdFiles;
  }

  /**
   * Write content to a file
   * @param filePath - The path where the file should be written
   * @param content - The content to write to the file
   * @returns Promise that resolves when file is written
   */
  private writeFile(filePath: string, content: string): Promise<void> {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return Promise.resolve();
    } catch (error) {
      throw new FileSystemError(filePath, 'write file', error as Error);
    }
  }

  /**
   * Update .gitignore with AD-SDLC entries
   * @param projectPath - The root path of the project
   * @returns True if .gitignore was updated, false if already contained entries
   */
  private async updateGitignore(projectPath: string): Promise<boolean> {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const entries = ['', '# AD-SDLC', '.ad-sdlc/scratchpad/', '.ad-sdlc/logs/', '*.log', ''];

    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
      if (content.includes('# AD-SDLC')) {
        return false; // Already updated
      }
    }

    content += entries.join('\n');
    await this.writeFile(gitignorePath, content);
    return true;
  }

  /**
   * Create a basic README file
   * @param projectPath - The root path of the project
   * @returns Promise that resolves when README is created
   */
  private async createReadme(projectPath: string): Promise<void> {
    const content = `# ${this.options.projectName}

${this.options.description ?? 'An AD-SDLC managed project.'}

## Getting Started

This project uses AD-SDLC (Agent-Driven Software Development Lifecycle) for automated development workflow.

### Prerequisites

- Node.js 18+
- Claude API Key (set \`CLAUDE_API_KEY\` or \`ANTHROPIC_API_KEY\`)
- GitHub CLI (optional, for issue/PR management)

### Running AD-SDLC

\`\`\`bash
# Start the development pipeline
npx ad-sdlc run "Your requirements here"

# Check status
npx ad-sdlc status

# Resume from checkpoint
npx ad-sdlc resume
\`\`\`

## Project Structure

- \`.ad-sdlc/\` - AD-SDLC configuration and runtime data
- \`.claude/agents/\` - Agent definitions
- \`docs/\` - Generated documentation (PRD, SRS, SDS)

## Documentation

- [AD-SDLC Documentation](https://github.com/kcenon/claude_code_agent)
`;

    await this.writeFile(path.join(projectPath, 'README.md'), content);
  }

  // Template content methods
  private getPrdTemplate(): string {
    return `# Product Requirements Document (PRD)

## Document Information
- **Project**: {{PROJECT_NAME}}
- **Version**: 1.0.0
- **Status**: Draft

## 1. Overview

### 1.1 Purpose
<!-- Describe the purpose of this product -->

### 1.2 Scope
<!-- Define the scope of the project -->

## 2. Goals and Objectives

### 2.1 Business Goals
<!-- List business goals -->

### 2.2 Success Metrics
<!-- Define measurable success criteria -->

## 3. User Requirements

### 3.1 User Personas
<!-- Define target users -->

### 3.2 User Stories
<!-- List user stories in format: As a [user], I want [goal] so that [benefit] -->

## 4. Functional Requirements

### 4.1 Core Features
<!-- List core features with IDs: FR-001, FR-002, etc. -->

### 4.2 Feature Priorities
<!-- Priority: Must Have, Should Have, Could Have, Won't Have -->

## 5. Non-Functional Requirements

### 5.1 Performance
<!-- Performance requirements -->

### 5.2 Security
<!-- Security requirements -->

### 5.3 Scalability
<!-- Scalability requirements -->

## 6. Constraints and Assumptions

### 6.1 Constraints
<!-- Technical, resource, time constraints -->

### 6.2 Assumptions
<!-- Assumptions made during planning -->
`;
  }

  private getSrsTemplate(): string {
    return `# Software Requirements Specification (SRS)

## Document Information
- **Project**: {{PROJECT_NAME}}
- **Version**: 1.0.0
- **Status**: Draft

## 1. Introduction

### 1.1 Purpose
<!-- Purpose of this SRS document -->

### 1.2 Scope
<!-- System scope and boundaries -->

### 1.3 References
<!-- Reference to PRD and other documents -->

## 2. System Overview

### 2.1 System Context
<!-- High-level system context diagram -->

### 2.2 System Functions
<!-- Main system functions -->

## 3. Functional Requirements

### 3.1 Feature Specifications
<!-- Detailed feature specifications with IDs -->

### 3.2 Use Cases
<!-- Detailed use case descriptions -->

## 4. External Interface Requirements

### 4.1 User Interfaces
<!-- UI requirements -->

### 4.2 API Interfaces
<!-- API specifications -->

### 4.3 Hardware Interfaces
<!-- Hardware interface requirements -->

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
<!-- Specific performance metrics -->

### 5.2 Security Requirements
<!-- Security specifications -->

### 5.3 Reliability Requirements
<!-- Reliability and availability requirements -->

## 6. System Models

### 6.1 Data Models
<!-- Data structure diagrams -->

### 6.2 Process Models
<!-- Process flow diagrams -->
`;
  }

  private getSdsTemplate(): string {
    return `# Software Design Specification (SDS)

## Document Information
- **Project**: {{PROJECT_NAME}}
- **Version**: 1.0.0
- **Status**: Draft

## 1. Introduction

### 1.1 Purpose
<!-- Purpose of this design document -->

### 1.2 Scope
<!-- Design scope -->

### 1.3 References
<!-- Reference to SRS -->

## 2. System Architecture

### 2.1 Architecture Overview
<!-- High-level architecture diagram -->

### 2.2 Component Diagram
<!-- Component relationships -->

## 3. Component Design

### 3.1 Component: [CMP-001]
<!-- Component specification -->
#### 3.1.1 Purpose
#### 3.1.2 Interfaces
#### 3.1.3 Dependencies
#### 3.1.4 Implementation Notes

## 4. Data Design

### 4.1 Data Structures
<!-- Key data structures -->

### 4.2 Database Design
<!-- Database schema if applicable -->

## 5. Interface Design

### 5.1 API Specifications
<!-- API endpoint specifications -->

### 5.2 Message Formats
<!-- Message/payload formats -->

## 6. Security Design

### 6.1 Authentication
<!-- Authentication mechanism -->

### 6.2 Authorization
<!-- Authorization model -->

## 7. Error Handling

### 7.1 Error Codes
<!-- Error code definitions -->

### 7.2 Recovery Procedures
<!-- Error recovery strategies -->
`;
  }

  private getIssueTemplate(): string {
    return `## Description

<!-- Brief description of the task -->

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes

<!-- Implementation details, considerations -->

## Dependencies

- Blocked by: <!-- List blocking issues -->
- Related to: <!-- List related issues -->

## Source References

- SDS: <!-- Component ID -->
- SRS: <!-- Requirement ID -->

## Estimation

- **Effort**: <!-- XS/S/M/L/XL -->
- **Phase**: <!-- Development phase -->
`;
  }

  private getCollectorAgentDef(): string {
    return `# Collector Agent

## Role
You are the Collector agent responsible for gathering and organizing project requirements.

## Responsibilities
1. Collect user requirements from input
2. Clarify ambiguous requirements
3. Organize requirements into structured format
4. Output to scratchpad for next stage

## Input
- User's project description and requirements

## Output
- Structured requirements in \`.ad-sdlc/scratchpad/info/{projectId}/collected_info.yaml\`
`;
  }

  private getPrdWriterAgentDef(): string {
    return `# PRD Writer Agent

## Role
You are the PRD Writer agent responsible for creating the Product Requirements Document.

## Responsibilities
1. Read collected requirements from scratchpad
2. Generate comprehensive PRD following template
3. Include all functional and non-functional requirements
4. Output PRD to docs/prd/

## Input
- Collected info from \`.ad-sdlc/scratchpad/info/{projectId}/collected_info.yaml\`

## Output
- PRD document in \`docs/prd/{projectId}.md\`
`;
  }

  private getSrsWriterAgentDef(): string {
    return `# SRS Writer Agent

## Role
You are the SRS Writer agent responsible for creating the Software Requirements Specification.

## Responsibilities
1. Read PRD document
2. Generate detailed SRS with technical specifications
3. Define use cases and system requirements
4. Output SRS to docs/srs/

## Input
- PRD from \`docs/prd/{projectId}.md\`

## Output
- SRS document in \`docs/srs/{projectId}.md\`
`;
  }

  private getSdsWriterAgentDef(): string {
    return `# SDS Writer Agent

## Role
You are the SDS Writer agent responsible for creating the Software Design Specification.

## Responsibilities
1. Read SRS document
2. Design system architecture and components
3. Define interfaces and data structures
4. Output SDS to docs/sds/

## Input
- SRS from \`docs/srs/{projectId}.md\`

## Output
- SDS document in \`docs/sds/{projectId}.md\`
`;
  }

  private getIssueGeneratorAgentDef(): string {
    return `# Issue Generator Agent

## Role
You are the Issue Generator agent responsible for creating GitHub issues from the SDS.

## Responsibilities
1. Parse SDS document
2. Generate issues for each component
3. Set priorities and dependencies
4. Create issues on GitHub

## Input
- SDS from \`docs/sds/{projectId}.md\`

## Output
- Issue list in \`.ad-sdlc/scratchpad/issues/{projectId}/\`
- GitHub issues created
`;
  }

  private getControllerAgentDef(): string {
    return `# Controller Agent

## Role
You are the Controller agent responsible for orchestrating parallel implementation.

## Responsibilities
1. Read issue list and dependency graph
2. Assign work to worker agents
3. Monitor progress and handle failures
4. Coordinate PR reviews

## Input
- Issues from \`.ad-sdlc/scratchpad/issues/{projectId}/\`

## Output
- Work orders in \`.ad-sdlc/scratchpad/progress/{projectId}/\`
`;
  }

  private getWorkerAgentDef(): string {
    return `# Worker Agent

## Role
You are a Worker agent responsible for implementing individual issues.

## Responsibilities
1. Read assigned work order
2. Implement the required changes
3. Write tests
4. Create pull request

## Input
- Work order from Controller

## Output
- Code implementation
- Pull request
`;
  }

  private getPrReviewerAgentDef(): string {
    return `# PR Reviewer Agent

## Role
You are the PR Reviewer agent responsible for reviewing pull requests.

## Responsibilities
1. Review code changes
2. Check against requirements
3. Verify test coverage
4. Approve or request changes

## Input
- Pull request details

## Output
- Review comments
- Approval/rejection decision
`;
  }

  /**
   * Get template configuration
   * @param template - The template type to retrieve configuration for
   * @returns Template configuration object
   */
  getTemplateConfig(template: TemplateType): TemplateConfig {
    return TEMPLATE_CONFIGS[template];
  }
}

// Singleton instance
let initializerInstance: ProjectInitializer | null = null;

/**
 * Create a new ProjectInitializer with given options
 * @param options - The initialization options for the project
 * @returns New instance of ProjectInitializer
 */
export function createProjectInitializer(options: InitOptions): ProjectInitializer {
  initializerInstance = new ProjectInitializer(options);
  return initializerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetProjectInitializer(): void {
  initializerInstance = null;
}
