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

import * as yaml from 'js-yaml';

import { validateAgentsConfig, validateWorkflowConfig } from '../config/validation.js';
import type { AgentsConfig } from '../config/types.js';

import { ConfigurationError, FileSystemError, ProjectExistsError } from './errors.js';
import { generateAgentsConfig, generateWorkflowConfig } from './generatedConfig.js';
import { loadAssetBundle } from './AgentAssets.js';
import {
  ASSET_LOCK_PATH,
  atomicAssetWrite,
  createAssetLock,
  preflightAssetInstallation,
} from './AssetUpdater.js';
import { getPrerequisiteValidator } from './PrerequisiteValidator.js';
import type {
  InitOptions,
  InitResult,
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

  constructor(
    options: InitOptions,
    private readonly assetPackageRoot?: string
  ) {
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

      // Always validate generated configuration, even when prerequisites are skipped.
      const templateConfig = TEMPLATE_CONFIGS[this.options.template];
      const qualityGateConfig = QUALITY_GATE_CONFIGS[templateConfig.qualityGates];
      const workflowContent = generateWorkflowConfig(templateConfig, qualityGateConfig);
      const bundle = loadAssetBundle(this.assetPackageRoot);
      warnings.push(...bundle.warnings);
      preflightAssetInstallation(projectPath, bundle);
      const agentsContent = generateAgentsConfig(bundle);
      const validations = [
        { filename: 'workflow.yaml', result: validateWorkflowConfig(workflowContent) },
        { filename: 'agents.yaml', result: validateAgentsConfig(agentsContent) },
      ];
      for (const { filename, result } of validations) {
        if (!result.success) {
          const reason = result.errors
            ?.map((error) => `${error.path}: ${error.message}`)
            .join('\n');
          throw new ConfigurationError(filename, reason ?? 'Generated configuration is invalid');
        }
      }

      // Create directory structure
      const directories = this.getDirectoryStructure(projectPath);
      for (const dir of directories) {
        await this.createDirectory(dir);
      }

      // Generate configuration files
      const configFiles = await this.generateConfigFiles(
        projectPath,
        workflowContent,
        agentsContent
      );
      createdFiles.push(...configFiles);

      // Generate template files
      const templateFiles = await this.generateTemplateFiles(projectPath);
      createdFiles.push(...templateFiles);

      // Copy the actual packaged bytes. Identical preexisting files remain untouched.
      for (const asset of bundle.assets) {
        const target = path.join(projectPath, asset.path);
        if (!fs.existsSync(target)) {
          atomicAssetWrite(target, asset.bytes);
          createdFiles.push(target);
        }
      }

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

      const lockPath = path.join(projectPath, ASSET_LOCK_PATH);
      atomicAssetWrite(
        lockPath,
        `${JSON.stringify(createAssetLock(projectPath, bundle), null, 2)}\n`
      );
      createdFiles.push(lockPath);

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
      path.join(projectPath, '.claude', 'commands'),

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
   * Write the original validated objects, preserving settings stripped by schema parsing.
   * @param projectPath - The root path of the project
   * @param workflowContent - The validated workflow configuration
   * @param agentsContent - The validated agents configuration
   * @returns Array of created configuration file paths
   */
  private async generateConfigFiles(
    projectPath: string,
    workflowContent: WorkflowConfig,
    agentsContent: AgentsConfig
  ): Promise<string[]> {
    const createdFiles: string[] = [];

    // Generate workflow.yaml
    const workflowPath = path.join(projectPath, '.ad-sdlc', 'config', 'workflow.yaml');
    await this.writeFile(workflowPath, yaml.dump(workflowContent, { lineWidth: 100 }));
    createdFiles.push(workflowPath);

    // Generate agents.yaml
    const agentsPath = path.join(projectPath, '.ad-sdlc', 'config', 'agents.yaml');
    await this.writeFile(agentsPath, yaml.dump(agentsContent, { lineWidth: 100 }));
    createdFiles.push(agentsPath);

    return createdFiles;
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

- Node.js 22.22.1+
- Claude API Key (set \`ANTHROPIC_API_KEY\`)
- GitHub CLI (optional, for issue/PR management)

### Running AD-SDLC

\`\`\`bash
# Start the development pipeline
ad-sdlc run "Your requirements here" --project-dir .

# Check status
ad-sdlc status

# Resume from checkpoint
ad-sdlc run "Your original requirements" --resume <session-id> --project-dir .
\`\`\`

## Project Structure

- \`.ad-sdlc/\` - AD-SDLC configuration and runtime data
- \`.claude/agents/\` - Canonical agent definitions
- \`.claude/commands/\` - Project commands
- \`.ad-sdlc/asset-lock.json\` - Installed asset ownership baselines
- \`docs/\` - Generated documentation (PRD, SRS, SDS)

Review asset updates with \`ad-sdlc assets update --project-dir . --dry-run\`.
Run without \`--dry-run\` to apply. Customized files are preserved and reported as conflicts.
Optional claude-config plugin skills are not installed by this scaffold.

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

## 3. Goals & Success Metrics

### 3.1 Primary Goals
<!-- List primary goals -->

### 3.2 Key Performance Indicators (KPIs)
<!-- Define measurable success criteria -->

## 4. User Personas

### 4.1 Primary Persona
<!-- Define target users -->

## 5. Functional Requirements

<!-- Repeat FR-XXX section for each functional requirement -->

## 6. Non-Functional Requirements

### NFR-001: Performance

| Attribute | Value |
|-----------|-------|
| **Category** | Performance |
| **Priority** | High |

**Description:**
Performance requirements for the system.

**Target Metric:**
TBD

---

## 7. Constraints & Assumptions

### 7.1 Constraints

| ID | Constraint | Reason |
|----|------------|--------|
| CON-001 | Constraint description | Reason |

### 7.2 Assumptions

| ID | Assumption | Risk if Wrong |
|----|------------|---------------|
| ASM-001 | Assumption description | Risk description |

## 8. Dependencies

### 8.1 External Dependencies

| Name | Type | Version | Purpose |
|------|------|---------|---------|
| \${dep_name} | Type | Version | Purpose |

### 8.2 Internal Dependencies
<!-- Internal module dependencies -->
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

// ============================================================
// Scaffold Cleanup Utilities
// ============================================================

/**
 * Check if a directory is effectively empty.
 *
 * A directory is considered "empty" if it contains no files at any depth.
 * A directory with only empty subdirectories is also considered empty.
 * README.md files are preserved (not counted as making a directory non-empty
 * for cleanup purposes) — callers should handle README preservation separately.
 *
 * @param dirPath - Absolute path to the directory to check
 * @returns True if the directory is empty or contains only empty subdirectories
 */
export async function isEmptyDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return false;
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) return true;
    // Check recursively: a dir with only empty subdirs is also "empty"
    for (const entry of entries) {
      const childPath = path.join(dirPath, entry);
      const childStat = fs.statSync(childPath);
      if (!childStat.isDirectory()) return false;
      if (!(await isEmptyDirectory(childPath))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up pre-created empty scaffold directories under the scratchpad.
 *
 * Scans the `issues`, `progress`, and `documents` sections of the scratchpad
 * and removes any project directories that are effectively empty (no files
 * at any depth). Directories with actual content are preserved.
 *
 * This is intended as a migration step for projects that were initialized
 * with pre-allocated numbered directories (e.g., 002-099) that were never used.
 *
 * @param scratchpadDir - Absolute path to the `.ad-sdlc/scratchpad` directory
 * @returns Number of empty directories removed
 */
export async function cleanupEmptyScaffolds(scratchpadDir: string): Promise<number> {
  let removed = 0;
  for (const prefix of ['issues', 'progress', 'documents']) {
    const dir = path.join(scratchpadDir, prefix);
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        if (await isEmptyDirectory(fullPath)) {
          fs.rmSync(fullPath, { recursive: true });
          removed++;
        }
      }
    } catch {
      // Directory may not exist — skip silently
    }
  }
  return removed;
}
