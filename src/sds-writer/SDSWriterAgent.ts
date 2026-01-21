/**
 * SDS Writer Agent
 *
 * Main orchestrator for generating Software Design Specification (SDS) documents
 * from Software Requirements Specification (SRS) documents.
 *
 * This agent coordinates the parsing of SRS documents, component design,
 * API specification, data modeling, and traceability mapping.
 *
 * Implements IAgent interface for AgentFactory integration
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IAgent } from '../agents/types.js';

import type {
  SDSWriterAgentConfig,
  SDSGenerationSession,
  SDSGenerationResult,
  SDSGenerationStats,
  ParsedSRS,
  GeneratedSDS,
  SDSMetadata,
  SDSComponent,
  APIEndpoint,
  DataModel,
  TraceabilityMatrix,
  SecuritySpec,
  DeploymentSpec,
} from './types.js';
import {
  SRSNotFoundError,
  GenerationError,
  FileWriteError,
  SessionStateError,
  ValidationError,
} from './errors.js';
import { SRSParser } from './SRSParser.js';
import { ComponentDesigner } from './ComponentDesigner.js';
import { APISpecifier } from './APISpecifier.js';
import { DataDesigner } from './DataDesigner.js';
import { TraceabilityMapper } from './TraceabilityMapper.js';

/**
 * Default configuration for the SDS Writer Agent
 */
const DEFAULT_CONFIG: Required<SDSWriterAgentConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  templatePath: '.ad-sdlc/templates/sds-template.md',
  publicDocsPath: 'docs/sds',
  generateAPIs: true,
  generateDataModels: true,
  generateSecuritySpecs: true,
  failOnLowCoverage: false,
  coverageThreshold: 80,
  includeTraceability: true,
  defaultTechnologyStack: [
    {
      layer: 'Runtime',
      technology: 'Node.js',
      version: '20.x',
      rationale: 'LTS version with modern features',
    },
    {
      layer: 'Language',
      technology: 'TypeScript',
      version: '5.x',
      rationale: 'Type safety and developer experience',
    },
    {
      layer: 'Framework',
      technology: 'Express.js',
      version: '4.x',
      rationale: 'Mature and widely adopted',
    },
    {
      layer: 'Database',
      technology: 'PostgreSQL',
      version: '15.x',
      rationale: 'Reliable RDBMS with JSON support',
    },
    {
      layer: 'Testing',
      technology: 'Vitest',
      version: '1.x',
      rationale: 'Fast and compatible with TypeScript',
    },
  ],
};

/**
 * Agent ID for SDSWriterAgent used in AgentFactory
 */
export const SDS_WRITER_AGENT_ID = 'sds-writer-agent';

/**
 * SDS Writer Agent class
 *
 * Orchestrates the generation of SDS documents from SRS.
 * Implements IAgent interface for unified agent instantiation through AgentFactory
 */
export class SDSWriterAgent implements IAgent {
  public readonly agentId = SDS_WRITER_AGENT_ID;
  public readonly name = 'SDS Writer Agent';

  private readonly config: Required<SDSWriterAgentConfig>;
  private readonly srsParser: SRSParser;
  private readonly componentDesigner: ComponentDesigner;
  private readonly apiSpecifier: APISpecifier;
  private readonly dataDesigner: DataDesigner;
  private readonly traceabilityMapper: TraceabilityMapper;
  private session: SDSGenerationSession | null = null;
  private initialized = false;

  constructor(config: SDSWriterAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.srsParser = new SRSParser();
    this.componentDesigner = new ComponentDesigner();
    this.apiSpecifier = new APISpecifier();
    this.dataDesigner = new DataDesigner();
    this.traceabilityMapper = new TraceabilityMapper({
      coverageThreshold: this.config.coverageThreshold,
      failOnLowCoverage: this.config.failOnLowCoverage,
    });
  }

  /**
   * Initialize the agent (IAgent interface)
   * Called after construction, before first use
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // SDSWriterAgent doesn't require async initialization
    // but the interface requires this method
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources (IAgent interface)
   * Called when the agent is no longer needed
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  /**
   * Get the current session
   */
  public getSession(): SDSGenerationSession | null {
    return this.session;
  }

  /**
   * Start a new SDS generation session
   * @param projectId - Project identifier
   * @returns The new session
   */
  public async startSession(projectId: string): Promise<SDSGenerationSession> {
    // Ensure async function has await expression
    await Promise.resolve();

    // Load SRS document
    const srsPath = path.join(this.config.scratchpadBasePath, 'documents', projectId, 'srs.md');

    if (!fs.existsSync(srsPath)) {
      throw new SRSNotFoundError(projectId, srsPath);
    }

    const srsContent = fs.readFileSync(srsPath, 'utf-8');
    const parsedSRS = this.srsParser.parse(srsContent);

    // Validate SRS
    const validationErrors = this.srsParser.validate(parsedSRS);
    if (validationErrors.length > 0) {
      throw new ValidationError(validationErrors);
    }

    // Create session
    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedSRS,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.session;
  }

  /**
   * Generate SDS from a project
   * @param projectId - Project identifier
   * @returns Generation result
   */
  public async generateFromProject(projectId: string): Promise<SDSGenerationResult> {
    const startTime = Date.now();

    // Start session if not already started
    if (!this.session || this.session.projectId !== projectId) {
      await this.startSession(projectId);
    }

    if (!this.session) {
      throw new GenerationError(projectId, 'initialization', 'Failed to create session');
    }

    try {
      // Update status
      this.updateSession({ status: 'parsing' });

      const { parsedSRS } = this.session;

      // Design components
      this.updateSession({ status: 'designing' });
      const componentResult = this.componentDesigner.design(
        parsedSRS.features,
        parsedSRS.useCases,
        parsedSRS.nfrs,
        parsedSRS.constraints
      );

      // Specify APIs
      this.updateSession({ status: 'specifying' });
      let apis: readonly APIEndpoint[] = [];
      if (this.config.generateAPIs) {
        const apiResult = this.apiSpecifier.specify(
          componentResult.components,
          parsedSRS.useCases,
          parsedSRS.nfrs
        );
        apis = apiResult.endpoints;
      }

      // Design data models
      let dataModels: readonly DataModel[] = [];
      if (this.config.generateDataModels) {
        const dataResult = this.dataDesigner.design(componentResult.components, parsedSRS.features);
        dataModels = dataResult.models;
      }

      // Build traceability matrix
      const traceabilityAnalysis = this.traceabilityMapper.build(
        parsedSRS,
        componentResult.components
      );

      // Update session with intermediate results
      this.updateSession({
        components: componentResult.components,
        apis,
        dataModels,
        traceabilityMatrix: traceabilityAnalysis.matrix,
      });

      // Generate security spec
      let security: SecuritySpec | undefined;
      if (this.config.generateSecuritySpecs) {
        security = this.generateSecuritySpec(parsedSRS.nfrs);
      }

      // Generate deployment spec
      const deployment = this.generateDeploymentSpec(parsedSRS.nfrs);

      // Generate SDS content
      this.updateSession({ status: 'generating' });
      const generatedSDS = this.generateSDSDocument(
        projectId,
        parsedSRS,
        componentResult.components,
        apis,
        dataModels,
        traceabilityAnalysis.matrix,
        security,
        deployment
      );

      // Finalize session
      this.updateSession({
        status: 'completed',
        generatedSDS,
      });

      // Write output files
      const { scratchpadPath, publicPath } = await this.writeOutputFiles(projectId, generatedSDS);

      // Calculate stats
      const stats: SDSGenerationStats = {
        srsFeatureCount: parsedSRS.features.length,
        componentsGenerated: componentResult.components.length,
        interfacesGenerated: componentResult.components.reduce(
          (sum, c) => sum + c.interfaces.length,
          0
        ),
        apisGenerated: apis.length,
        dataModelsGenerated: dataModels.length,
        traceabilityCoverage: traceabilityAnalysis.matrix.forwardCoverage,
        processingTimeMs: Date.now() - startTime,
      };

      return {
        success: true,
        projectId,
        scratchpadPath,
        publicPath,
        generatedSDS,
        stats,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateSession({
        status: 'failed',
        errorMessage,
      });
      throw error;
    }
  }

  /**
   * Generate SDS from already parsed SRS
   * @param parsedSRS - Parsed SRS document
   * @returns Generation result
   */
  public async generateFromParsedSRS(parsedSRS: ParsedSRS): Promise<SDSGenerationResult> {
    const projectId = parsedSRS.metadata.projectId || 'unknown';

    // Create session with parsed SRS
    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'pending',
      parsedSRS,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.generateFromProject(projectId);
  }

  /**
   * Finalize the current session
   * @returns Generation result
   */
  public async finalize(): Promise<SDSGenerationResult> {
    if (!this.session) {
      throw new SessionStateError('null', 'active', 'finalize');
    }

    if (this.session.status !== 'completed') {
      throw new SessionStateError(this.session.status, 'completed', 'finalize');
    }

    if (!this.session.generatedSDS) {
      throw new GenerationError(this.session.projectId, 'finalization', 'No generated SDS');
    }

    const { scratchpadPath, publicPath } = await this.writeOutputFiles(
      this.session.projectId,
      this.session.generatedSDS
    );

    return {
      success: true,
      projectId: this.session.projectId,
      scratchpadPath,
      publicPath,
      generatedSDS: this.session.generatedSDS,
      stats: {
        srsFeatureCount: this.session.parsedSRS.features.length,
        componentsGenerated: this.session.components?.length ?? 0,
        interfacesGenerated:
          this.session.components?.reduce((sum, c) => sum + c.interfaces.length, 0) ?? 0,
        apisGenerated: this.session.apis?.length ?? 0,
        dataModelsGenerated: this.session.dataModels?.length ?? 0,
        traceabilityCoverage: this.session.traceabilityMatrix?.forwardCoverage ?? 0,
        processingTimeMs: 0,
      },
    };
  }

  /**
   * Update session with partial data
   */
  private updateSession(updates: Partial<SDSGenerationSession>): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate security specification from NFRs
   */
  private generateSecuritySpec(
    nfrs: readonly { id: string; category: string; description: string; metric?: string }[]
  ): SecuritySpec {
    const securityNfrs = nfrs.filter((n) => n.category === 'Security');

    // Determine authentication type from NFRs
    let authType: 'jwt' | 'oauth2' | 'api_key' | 'session' | 'none' = 'jwt';
    for (const nfr of securityNfrs) {
      const desc = nfr.description.toLowerCase();
      if (desc.includes('oauth')) authType = 'oauth2';
      else if (desc.includes('api key') || desc.includes('api-key')) authType = 'api_key';
      else if (desc.includes('session')) authType = 'session';
    }

    return {
      authentication: {
        type: authType,
        ...(authType === 'jwt' && { tokenExpiry: '24h' }),
        ...(authType === 'jwt' && { refreshMechanism: 'refresh_token' }),
      },
      authorization: {
        model: 'rbac',
        roles: [
          { name: 'admin', description: 'Full system access', permissions: ['*'] },
          { name: 'user', description: 'Standard user access', permissions: ['read', 'write:own'] },
          { name: 'guest', description: 'Read-only access', permissions: ['read:public'] },
        ],
      },
      dataProtection: [
        { type: 'encryption', appliesTo: ['passwords'], method: 'bcrypt' },
        { type: 'encryption', appliesTo: ['sensitive_data'], method: 'AES-256' },
      ],
    };
  }

  /**
   * Generate deployment specification from NFRs
   */
  private generateDeploymentSpec(
    nfrs: readonly { id: string; category: string; description: string; metric?: string }[]
  ): DeploymentSpec {
    const scalabilityNfrs = nfrs.filter((n) => n.category === 'Scalability');

    // Determine deployment pattern
    let pattern: 'monolith' | 'microservices' | 'serverless' | 'hybrid' = 'monolith';
    for (const nfr of scalabilityNfrs) {
      const desc = nfr.description.toLowerCase();
      if (desc.includes('microservice')) pattern = 'microservices';
      else if (desc.includes('serverless')) pattern = 'serverless';
    }

    const baseSpec = {
      pattern,
      environments: [
        { name: 'development', infrastructure: 'Local Docker / Docker Compose' },
        { name: 'staging', infrastructure: 'Cloud container service (e.g., ECS, GKE)' },
        { name: 'production', infrastructure: 'Cloud container service with auto-scaling' },
      ],
    } as const;

    if (pattern === 'monolith') {
      return baseSpec;
    }

    return {
      ...baseSpec,
      scaling: {
        type: 'auto',
        metrics: ['cpu_utilization', 'memory_utilization', 'request_count'],
        minInstances: 2,
        maxInstances: 10,
      },
    };
  }

  /**
   * Generate complete SDS document
   */
  private generateSDSDocument(
    projectId: string,
    srs: ParsedSRS,
    components: readonly SDSComponent[],
    apis: readonly APIEndpoint[],
    dataModels: readonly DataModel[],
    traceabilityMatrix: TraceabilityMatrix,
    security?: SecuritySpec,
    deployment?: DeploymentSpec
  ): GeneratedSDS {
    const now = new Date().toISOString().split('T')[0] ?? '';

    const metadata: SDSMetadata = {
      documentId: `SDS-${projectId}`,
      sourceSRS: srs.metadata.documentId,
      sourcePRD: srs.metadata.sourcePRD,
      version: '1.0.0',
      status: 'Draft',
      createdDate: now,
      updatedDate: now,
    };

    // Generate markdown content
    const content = this.generateMarkdownContent(
      metadata,
      srs,
      components,
      apis,
      dataModels,
      traceabilityMatrix,
      security,
      deployment
    );

    return {
      metadata,
      content,
      components,
      technologyStack: [...this.config.defaultTechnologyStack],
      apis,
      dataModels,
      ...(security !== undefined && { security }),
      ...(deployment !== undefined && { deployment }),
      traceabilityMatrix,
    };
  }

  /**
   * Generate markdown content for SDS
   */
  private generateMarkdownContent(
    metadata: SDSMetadata,
    srs: ParsedSRS,
    components: readonly SDSComponent[],
    apis: readonly APIEndpoint[],
    dataModels: readonly DataModel[],
    traceabilityMatrix: TraceabilityMatrix,
    security?: SecuritySpec,
    deployment?: DeploymentSpec
  ): string {
    const lines: string[] = [];

    // Title
    lines.push(`# Software Design Specification: ${srs.productName}`);
    lines.push('');

    // Metadata table
    lines.push('| **Document ID** | **Source SRS** | **Version** | **Status** |');
    lines.push('|-----------------|----------------|-------------|------------|');
    lines.push(
      `| ${metadata.documentId} | ${metadata.sourceSRS} | ${metadata.version} | ${metadata.status} |`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    // Table of Contents
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [Introduction](#1-introduction)');
    lines.push('2. [System Architecture](#2-system-architecture)');
    lines.push('3. [Component Design](#3-component-design)');
    lines.push('4. [Data Design](#4-data-design)');
    lines.push('5. [Interface Design](#5-interface-design)');
    lines.push('6. [Security Design](#6-security-design)');
    lines.push('7. [Deployment Architecture](#7-deployment-architecture)');
    lines.push('8. [Error Handling](#8-error-handling)');
    lines.push('9. [Traceability Matrix](#9-traceability-matrix)');
    lines.push('10. [Appendix](#10-appendix)');
    lines.push('');

    // Section 1: Introduction
    lines.push('## 1. Introduction');
    lines.push('');
    lines.push('### 1.1 Purpose');
    lines.push('');
    lines.push(
      `This Software Design Specification (SDS) describes the detailed design for ${srs.productName}.`
    );
    lines.push(
      'It provides the technical blueprint for implementing the system as specified in the SRS.'
    );
    lines.push('');
    lines.push('### 1.2 Scope');
    lines.push('');
    lines.push(srs.productDescription || 'See referenced SRS for scope details.');
    lines.push('');

    // Section 2: System Architecture
    lines.push('## 2. System Architecture');
    lines.push('');
    lines.push('### 2.1 Overview');
    lines.push('');
    lines.push('```mermaid');
    lines.push('graph TB');
    lines.push('    subgraph Client');
    lines.push('        UI[User Interface]');
    lines.push('    end');
    lines.push('    subgraph API');
    lines.push('        GW[API Gateway]');
    for (const component of components.slice(0, 5)) {
      lines.push(`        ${component.id}[${component.name}]`);
    }
    lines.push('    end');
    lines.push('    subgraph Data');
    lines.push('        DB[(Database)]');
    lines.push('    end');
    lines.push('    UI --> GW');
    for (const component of components.slice(0, 5)) {
      lines.push(`    GW --> ${component.id}`);
    }
    for (const component of components.slice(0, 5)) {
      lines.push(`    ${component.id} --> DB`);
    }
    lines.push('```');
    lines.push('');

    // 2.3 Technology Stack
    lines.push('### 2.3 Technology Stack');
    lines.push('');
    lines.push('| Layer | Technology | Version | Rationale |');
    lines.push('|-------|------------|---------|-----------|');
    for (const tech of this.config.defaultTechnologyStack) {
      lines.push(`| ${tech.layer} | ${tech.technology} | ${tech.version} | ${tech.rationale} |`);
    }
    lines.push('');

    // Section 3: Component Design
    lines.push('## 3. Component Design');
    lines.push('');
    for (const component of components) {
      lines.push(`### ${component.id}: ${component.name}`);
      lines.push('');
      lines.push('| **Source Feature** | **Priority** |');
      lines.push('|--------------------|--------------|');
      lines.push(`| ${component.sourceFeature} | ${component.priority} |`);
      lines.push('');
      lines.push('**Description:**');
      lines.push('');
      lines.push(component.description);
      lines.push('');

      if (component.interfaces.length > 0) {
        lines.push('**Interfaces:**');
        lines.push('');
        for (const iface of component.interfaces) {
          lines.push('```typescript');
          lines.push(iface.rawCode);
          lines.push('```');
          lines.push('');
        }
      }

      if (component.dependencies.length > 0) {
        lines.push('**Dependencies:**');
        lines.push('');
        for (const dep of component.dependencies) {
          lines.push(`- ${dep}`);
        }
        lines.push('');
      }

      if (component.implementationNotes) {
        lines.push('**Implementation Notes:**');
        lines.push('');
        lines.push(component.implementationNotes);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // Section 4: Data Design
    lines.push('## 4. Data Design');
    lines.push('');
    if (dataModels.length > 0) {
      lines.push('### 4.1 Data Models');
      lines.push('');
      for (const model of dataModels) {
        lines.push(`#### ${model.id}: ${model.name}`);
        lines.push('');
        lines.push(`**Category:** ${model.category}`);
        lines.push('');
        lines.push(`**Description:** ${model.description}`);
        lines.push('');
        lines.push('**Properties:**');
        lines.push('');
        lines.push('| Property | Type | Required | Description |');
        lines.push('|----------|------|----------|-------------|');
        for (const prop of model.properties) {
          lines.push(
            `| ${prop.name} | ${prop.type} | ${prop.required ? 'Yes' : 'No'} | ${prop.description ?? ''} |`
          );
        }
        lines.push('');

        if (model.relationships.length > 0) {
          lines.push('**Relationships:**');
          lines.push('');
          for (const rel of model.relationships) {
            lines.push(
              `- ${rel.type} with ${rel.target}${rel.foreignKey != null && rel.foreignKey !== '' ? ` (FK: ${rel.foreignKey})` : ''}`
            );
          }
          lines.push('');
        }
      }
    } else {
      lines.push('Data models are defined in external database schema documentation.');
      lines.push('');
    }

    // Section 5: Interface Design (APIs)
    lines.push('## 5. Interface Design');
    lines.push('');
    if (apis.length > 0) {
      lines.push('### 5.1 API Endpoints');
      lines.push('');
      for (const api of apis) {
        lines.push(`#### ${api.method} ${api.path}`);
        lines.push('');
        lines.push(`**Name:** ${api.name}`);
        lines.push('');
        lines.push(`**Security:** ${api.security}`);
        lines.push('');
        lines.push(`**Source:** ${api.sourceComponent} / ${api.sourceUseCase}`);
        lines.push('');
        lines.push(api.description.split('\n')[0] ?? '');
        lines.push('');
      }
    } else {
      lines.push('API endpoints are documented in the OpenAPI specification.');
      lines.push('');
    }

    // Section 6: Security Design
    lines.push('## 6. Security Design');
    lines.push('');
    if (security) {
      lines.push('### 6.1 Authentication');
      lines.push('');
      lines.push(`**Type:** ${security.authentication.type.toUpperCase()}`);
      if (
        security.authentication.tokenExpiry != null &&
        security.authentication.tokenExpiry !== ''
      ) {
        lines.push(`**Token Expiry:** ${security.authentication.tokenExpiry}`);
      }
      lines.push('');

      lines.push('### 6.2 Authorization');
      lines.push('');
      lines.push(`**Model:** ${security.authorization.model.toUpperCase()}`);
      lines.push('');
      if (security.authorization.roles) {
        lines.push('**Roles:**');
        lines.push('');
        for (const role of security.authorization.roles) {
          lines.push(`- **${role.name}**: ${role.description}`);
        }
        lines.push('');
      }

      lines.push('### 6.3 Data Protection');
      lines.push('');
      for (const measure of security.dataProtection) {
        lines.push(
          `- **${measure.type}**: ${measure.appliesTo.join(', ')} using ${measure.method}`
        );
      }
      lines.push('');
    }

    // Section 7: Deployment Architecture
    lines.push('## 7. Deployment Architecture');
    lines.push('');
    if (deployment) {
      lines.push(`**Pattern:** ${deployment.pattern}`);
      lines.push('');
      lines.push('### 7.1 Environments');
      lines.push('');
      for (const env of deployment.environments) {
        lines.push(`- **${env.name}**: ${env.infrastructure}`);
      }
      lines.push('');

      if (deployment.scaling) {
        lines.push('### 7.2 Scaling Strategy');
        lines.push('');
        lines.push(`- **Type:** ${deployment.scaling.type}`);
        lines.push(`- **Min Instances:** ${String(deployment.scaling.minInstances ?? 'N/A')}`);
        lines.push(`- **Max Instances:** ${String(deployment.scaling.maxInstances ?? 'N/A')}`);
        lines.push('');
      }
    }

    // Section 8: Error Handling
    lines.push('## 8. Error Handling');
    lines.push('');
    lines.push(
      'Standard error handling patterns apply as defined in the error handling guidelines.'
    );
    lines.push('');

    // Section 9: Traceability Matrix
    if (this.config.includeTraceability) {
      lines.push('## 9. Traceability Matrix');
      lines.push('');
      lines.push(this.traceabilityMapper.toMarkdownTable(traceabilityMatrix));
      lines.push('');
    }

    // Section 10: Appendix
    lines.push('## 10. Appendix');
    lines.push('');
    lines.push('### 10.1 Related Documents');
    lines.push('');
    lines.push(`- SRS: ${metadata.sourceSRS}`);
    lines.push(`- PRD: ${metadata.sourcePRD}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Write output files
   */
  private async writeOutputFiles(
    projectId: string,
    sds: GeneratedSDS
  ): Promise<{ scratchpadPath: string; publicPath: string }> {
    // Ensure async function has await expression
    await Promise.resolve();

    // Scratchpad path
    const scratchpadDir = path.join(this.config.scratchpadBasePath, 'documents', projectId);
    const scratchpadPath = path.join(scratchpadDir, 'sds.md');

    // Public path
    const publicDir = this.config.publicDocsPath;
    const publicPath = path.join(publicDir, `SDS-${projectId}.md`);

    try {
      // Ensure directories exist
      fs.mkdirSync(scratchpadDir, { recursive: true });
      fs.mkdirSync(publicDir, { recursive: true });

      // Write files
      fs.writeFileSync(scratchpadPath, sds.content, 'utf-8');
      fs.writeFileSync(publicPath, sds.content, 'utf-8');

      return { scratchpadPath, publicPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileWriteError(scratchpadPath, message);
    }
  }
}

// Singleton pattern
let instance: SDSWriterAgent | null = null;

/**
 * Get the singleton instance of SDSWriterAgent
 * @param config - Optional configuration
 * @returns The singleton instance
 */
export function getSDSWriterAgent(config?: SDSWriterAgentConfig): SDSWriterAgent {
  if (!instance) {
    instance = new SDSWriterAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetSDSWriterAgent(): void {
  instance = null;
}
