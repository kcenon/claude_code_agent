/**
 * Diagram Generator for Architecture Generator
 *
 * Generates Mermaid diagrams for architecture overview,
 * component interaction, deployment, and data flow.
 *
 * @module architecture-generator/DiagramGenerator
 */

import { DiagramGenerationError } from './errors.js';
import type {
  ParsedSRS,
  ArchitectureAnalysis,
  ArchitecturePattern,
  MermaidDiagram,
  DiagramComponent,
  SRSFeature,
} from './types.js';

// ============================================================
// Diagram Generator Class
// ============================================================

/**
 * Generates Mermaid diagrams based on architecture analysis
 */
export class DiagramGenerator {
  private readonly generateAllTypes: boolean;

  constructor(generateAllTypes: boolean = false) {
    this.generateAllTypes = generateAllTypes;
  }

  /**
   * Generate all diagrams for the architecture
   * @param srs - Parsed SRS document containing features and requirements
   * @param analysis - Architecture analysis results with pattern recommendations
   * @returns Array of generated Mermaid diagrams
   */
  public generate(srs: ParsedSRS, analysis: ArchitectureAnalysis): MermaidDiagram[] {
    const diagrams: MermaidDiagram[] = [];

    try {
      // Always generate architecture overview
      diagrams.push(this.generateArchitectureOverview(srs, analysis));

      // Always generate component interaction
      diagrams.push(this.generateComponentInteraction(srs, analysis));

      if (this.generateAllTypes) {
        // Generate additional diagrams
        diagrams.push(this.generateDeploymentDiagram(analysis));
        diagrams.push(this.generateDataFlowDiagram(srs, analysis));
      }

      return diagrams;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new DiagramGenerationError('all', message);
    }
  }

  /**
   * Generate architecture overview diagram
   * @param srs - Parsed SRS document containing features and requirements
   * @param analysis - Architecture analysis results with pattern recommendations
   * @returns Mermaid flowchart showing system architecture with layered components
   */
  public generateArchitectureOverview(
    srs: ParsedSRS,
    analysis: ArchitectureAnalysis
  ): MermaidDiagram {
    const components = this.extractComponents(srs, analysis);
    const layers = this.groupByLayer(components);

    let code = 'flowchart TB\n';

    // Generate subgraphs for each layer
    for (const [layerName, layerComponents] of Object.entries(layers)) {
      code += this.generateLayerSubgraph(layerName, layerComponents);
    }

    // Generate connections
    code += this.generateConnections(components);

    // Add pattern-specific styling
    code += this.generatePatternStyling(analysis.primaryPattern);

    return {
      type: 'architecture-overview',
      title: 'System Architecture Overview',
      code: this.wrapInCodeBlock(code),
      description: `High-level architecture diagram showing ${analysis.primaryPattern} pattern with ${String(components.length)} components.`,
    };
  }

  /**
   * Generate component interaction diagram
   * @param srs - Parsed SRS document containing features and requirements
   * @param analysis - Architecture analysis results with pattern recommendations
   * @returns Mermaid flowchart showing component interactions and communication patterns
   */
  public generateComponentInteraction(
    srs: ParsedSRS,
    analysis: ArchitectureAnalysis
  ): MermaidDiagram {
    const components = this.extractComponents(srs, analysis);

    let code = 'flowchart LR\n';

    // Generate component nodes
    for (const component of components) {
      const shape = this.getComponentShape(component.type);
      code += `    ${component.id}${shape.open}"${component.name}"${shape.close}\n`;
    }

    code += '\n';

    // Generate interactions with labels
    for (const component of components) {
      for (const connection of component.connections) {
        const arrow = this.getConnectionArrow(connection.type);
        const label = connection.label ? `|${connection.label}|` : '';
        code += `    ${component.id} ${arrow}${label} ${connection.targetId}\n`;
      }
    }

    return {
      type: 'component-interaction',
      title: 'Component Interaction Diagram',
      code: this.wrapInCodeBlock(code),
      description: `Shows interactions between ${String(components.length)} components and their communication patterns.`,
    };
  }

  /**
   * Generate deployment diagram
   * @param analysis - Architecture analysis results with pattern recommendations
   * @returns Mermaid graph showing deployment architecture for the selected pattern
   */
  public generateDeploymentDiagram(analysis: ArchitectureAnalysis): MermaidDiagram {
    let code = 'graph TB\n';

    // Generate environment subgraphs based on pattern
    if (analysis.primaryPattern === 'microservices') {
      code += this.generateMicroservicesDeployment();
    } else if (analysis.primaryPattern === 'hierarchical-multi-agent') {
      code += this.generateAgentDeployment();
    } else {
      code += this.generateStandardDeployment();
    }

    return {
      type: 'deployment',
      title: 'Deployment Architecture',
      code: this.wrapInCodeBlock(code),
      description: `Deployment diagram for ${analysis.primaryPattern} architecture pattern.`,
    };
  }

  /**
   * Generate data flow diagram
   * @param srs - Parsed SRS document containing features and requirements
   * @param _analysis - Architecture analysis results (unused but kept for interface consistency)
   * @returns Mermaid flowchart showing data flow from sources through processing to sinks
   */
  public generateDataFlowDiagram(srs: ParsedSRS, _analysis: ArchitectureAnalysis): MermaidDiagram {
    let code = 'flowchart LR\n';

    // Extract data flows from use cases
    const dataFlows = this.extractDataFlows(srs);

    // Generate data source nodes
    code += '    subgraph Sources["Data Sources"]\n';
    for (const source of dataFlows.sources) {
      code += `        ${source.id}[("${source.name}")]\n`;
    }
    code += '    end\n\n';

    // Generate processing nodes
    code += '    subgraph Processing["Processing"]\n';
    for (const processor of dataFlows.processors) {
      code += `        ${processor.id}[["${processor.name}"]]\n`;
    }
    code += '    end\n\n';

    // Generate sink nodes
    code += '    subgraph Sinks["Data Sinks"]\n';
    for (const sink of dataFlows.sinks) {
      code += `        ${sink.id}[("${sink.name}")]\n`;
    }
    code += '    end\n\n';

    // Generate flow connections
    for (const flow of dataFlows.flows) {
      code += `    ${flow.from} -->|${flow.label}| ${flow.to}\n`;
    }

    return {
      type: 'data-flow',
      title: 'Data Flow Diagram',
      code: this.wrapInCodeBlock(code),
      description: 'Shows how data flows through the system from sources to sinks.',
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Extract components from SRS features
   * @param srs - Parsed SRS document containing features and requirements
   * @param analysis - Architecture analysis results with pattern recommendations
   * @returns Array of diagram components with validated connections
   */
  private extractComponents(srs: ParsedSRS, analysis: ArchitectureAnalysis): DiagramComponent[] {
    const components: DiagramComponent[] = [];
    const patternComponents = this.getPatternComponents(analysis.primaryPattern);

    // Add pattern-specific components
    for (const pc of patternComponents) {
      components.push(pc);
    }

    // Add feature-derived components
    for (const feature of srs.features) {
      const component = this.featureToComponent(feature, components);
      if (component && !components.find((c) => c.id === component.id)) {
        components.push(component);
      }
    }

    // Ensure connections are valid
    return this.validateConnections(components);
  }

  /**
   * Get default components for architecture pattern
   * @param pattern - Architecture pattern to get components for
   * @returns Array of pattern-specific default components with predefined connections
   */
  private getPatternComponents(pattern: ArchitecturePattern): DiagramComponent[] {
    const patterns: Record<ArchitecturePattern, DiagramComponent[]> = {
      'hierarchical-multi-agent': [
        {
          id: 'ORCH',
          name: 'Orchestrator',
          layer: 'Control',
          type: 'controller',
          connections: [
            { targetId: 'WORKER', label: 'delegates', type: 'async' },
            { targetId: 'STATE', label: 'manages', type: 'data' },
          ],
        },
        {
          id: 'WORKER',
          name: 'Worker Agent',
          layer: 'Processing',
          type: 'service',
          connections: [{ targetId: 'STATE', label: 'reads/writes', type: 'data' }],
        },
        {
          id: 'STATE',
          name: 'State Manager',
          layer: 'Data',
          type: 'repository',
          connections: [],
        },
      ],
      pipeline: [
        {
          id: 'INPUT',
          name: 'Input Handler',
          layer: 'Input',
          type: 'controller',
          connections: [{ targetId: 'STAGE1', label: 'feeds', type: 'sync' }],
        },
        {
          id: 'STAGE1',
          name: 'Stage 1',
          layer: 'Processing',
          type: 'service',
          connections: [{ targetId: 'STAGE2', label: 'transforms', type: 'sync' }],
        },
        {
          id: 'STAGE2',
          name: 'Stage 2',
          layer: 'Processing',
          type: 'service',
          connections: [{ targetId: 'OUTPUT', label: 'outputs', type: 'sync' }],
        },
        {
          id: 'OUTPUT',
          name: 'Output Handler',
          layer: 'Output',
          type: 'controller',
          connections: [],
        },
      ],
      'event-driven': [
        {
          id: 'PRODUCER',
          name: 'Event Producer',
          layer: 'Presentation',
          type: 'controller',
          connections: [{ targetId: 'BROKER', label: 'publishes', type: 'event' }],
        },
        {
          id: 'BROKER',
          name: 'Message Broker',
          layer: 'Infrastructure',
          type: 'external',
          connections: [{ targetId: 'CONSUMER', label: 'delivers', type: 'event' }],
        },
        {
          id: 'CONSUMER',
          name: 'Event Consumer',
          layer: 'Business',
          type: 'service',
          connections: [{ targetId: 'STORE', label: 'persists', type: 'data' }],
        },
        {
          id: 'STORE',
          name: 'Data Store',
          layer: 'Data',
          type: 'repository',
          connections: [],
        },
      ],
      microservices: [
        {
          id: 'GATEWAY',
          name: 'API Gateway',
          layer: 'Edge',
          type: 'controller',
          connections: [
            { targetId: 'SVC1', label: 'routes', type: 'sync' },
            { targetId: 'SVC2', label: 'routes', type: 'sync' },
          ],
        },
        {
          id: 'SVC1',
          name: 'Service A',
          layer: 'Business',
          type: 'service',
          connections: [{ targetId: 'DB1', label: 'queries', type: 'data' }],
        },
        {
          id: 'SVC2',
          name: 'Service B',
          layer: 'Business',
          type: 'service',
          connections: [{ targetId: 'DB2', label: 'queries', type: 'data' }],
        },
        { id: 'DB1', name: 'Database A', layer: 'Data', type: 'repository', connections: [] },
        { id: 'DB2', name: 'Database B', layer: 'Data', type: 'repository', connections: [] },
      ],
      layered: [
        {
          id: 'UI',
          name: 'Presentation',
          layer: 'Presentation',
          type: 'controller',
          connections: [{ targetId: 'BIZ', label: 'calls', type: 'sync' }],
        },
        {
          id: 'BIZ',
          name: 'Business Logic',
          layer: 'Business',
          type: 'service',
          connections: [{ targetId: 'DATA', label: 'accesses', type: 'data' }],
        },
        {
          id: 'DATA',
          name: 'Data Access',
          layer: 'Data',
          type: 'repository',
          connections: [],
        },
      ],
      hexagonal: [
        {
          id: 'CORE',
          name: 'Domain Core',
          layer: 'Core',
          type: 'service',
          connections: [],
        },
        {
          id: 'INPORT',
          name: 'Input Port',
          layer: 'Ports',
          type: 'controller',
          connections: [{ targetId: 'CORE', label: 'invokes', type: 'sync' }],
        },
        {
          id: 'OUTPORT',
          name: 'Output Port',
          layer: 'Ports',
          type: 'controller',
          connections: [],
        },
        {
          id: 'INADAPT',
          name: 'Input Adapter',
          layer: 'Adapters',
          type: 'controller',
          connections: [{ targetId: 'INPORT', label: 'uses', type: 'sync' }],
        },
        {
          id: 'OUTADAPT',
          name: 'Output Adapter',
          layer: 'Adapters',
          type: 'repository',
          connections: [{ targetId: 'OUTPORT', label: 'implements', type: 'sync' }],
        },
      ],
      cqrs: [
        {
          id: 'CMD',
          name: 'Command Handler',
          layer: 'Command',
          type: 'controller',
          connections: [{ targetId: 'WRITE', label: 'writes', type: 'data' }],
        },
        {
          id: 'QRY',
          name: 'Query Handler',
          layer: 'Query',
          type: 'controller',
          connections: [{ targetId: 'READ', label: 'reads', type: 'data' }],
        },
        {
          id: 'WRITE',
          name: 'Write Store',
          layer: 'Data',
          type: 'repository',
          connections: [{ targetId: 'SYNC', label: 'events', type: 'event' }],
        },
        {
          id: 'SYNC',
          name: 'Sync Processor',
          layer: 'Sync',
          type: 'service',
          connections: [{ targetId: 'READ', label: 'updates', type: 'data' }],
        },
        {
          id: 'READ',
          name: 'Read Store',
          layer: 'Data',
          type: 'repository',
          connections: [],
        },
      ],
      scratchpad: [
        {
          id: 'AGENT',
          name: 'Agent',
          layer: 'Processing',
          type: 'service',
          connections: [{ targetId: 'SCRATCH', label: 'reads/writes', type: 'data' }],
        },
        {
          id: 'SCRATCH',
          name: 'Scratchpad',
          layer: 'State',
          type: 'repository',
          connections: [],
        },
        {
          id: 'FS',
          name: 'File System',
          layer: 'Storage',
          type: 'external',
          connections: [],
        },
      ],
    };

    return patterns[pattern];
  }

  /**
   * Convert SRS feature to diagram component
   * @param feature - SRS feature to convert
   * @param existingComponents - List of existing components to check for duplicates and create connections
   * @returns Diagram component derived from feature, or null if component cannot be created
   */
  private featureToComponent(
    feature: SRSFeature,
    existingComponents: DiagramComponent[]
  ): DiagramComponent | null {
    const id = feature.id.replace('-', '');
    const name = this.truncateName(feature.name, 20);

    // Determine component type based on feature content
    let type: DiagramComponent['type'] = 'service';
    const descLower = feature.description.toLowerCase();

    if (descLower.includes('api') || descLower.includes('interface')) {
      type = 'controller';
    } else if (descLower.includes('data') || descLower.includes('storage')) {
      type = 'repository';
    } else if (descLower.includes('external') || descLower.includes('integration')) {
      type = 'external';
    }

    // Generate connections based on feature relationships
    const connections = existingComponents
      .filter((c) => c.type === 'repository' || c.type === 'service')
      .slice(0, 2)
      .map((c) => ({
        targetId: c.id,
        label: 'uses',
        type: 'sync' as const,
      }));

    return {
      id,
      name,
      layer: 'Business',
      type,
      connections,
    };
  }

  /**
   * Validate and fix component connections
   * @param components - Components to validate
   * @returns Components with only valid connections (targets exist in component list)
   */
  private validateConnections(components: DiagramComponent[]): DiagramComponent[] {
    const componentIds = new Set(components.map((c) => c.id));

    return components.map((component) => ({
      ...component,
      connections: component.connections.filter((conn) => componentIds.has(conn.targetId)),
    }));
  }

  /**
   * Group components by layer
   * @param components - Components to group
   * @returns Map of layer names to arrays of components in each layer
   */
  private groupByLayer(components: DiagramComponent[]): Record<string, DiagramComponent[]> {
    const groups: Record<string, DiagramComponent[]> = {};

    for (const component of components) {
      if (!groups[component.layer]) {
        groups[component.layer] = [];
      }
      const layerGroup = groups[component.layer];
      if (layerGroup) {
        layerGroup.push(component);
      }
    }

    return groups;
  }

  /**
   * Generate Mermaid subgraph for a layer
   * @param layerName - Name of the layer for the subgraph
   * @param components - Components to include in the layer subgraph
   * @returns Mermaid subgraph code with component nodes
   */
  private generateLayerSubgraph(layerName: string, components: DiagramComponent[]): string {
    let code = `    subgraph ${this.sanitizeId(layerName)}["${layerName} Layer"]\n`;

    for (const component of components) {
      const shape = this.getComponentShape(component.type);
      code += `        ${component.id}${shape.open}"${component.name}"${shape.close}\n`;
    }

    code += '    end\n\n';
    return code;
  }

  /**
   * Generate connections between components
   * @param components - Components with connection definitions
   * @returns Mermaid code for all component connections with appropriate arrows
   */
  private generateConnections(components: DiagramComponent[]): string {
    let code = '';

    for (const component of components) {
      for (const connection of component.connections) {
        const arrow = this.getConnectionArrow(connection.type);
        code += `    ${component.id} ${arrow} ${connection.targetId}\n`;
      }
    }

    return code;
  }

  /**
   * Get Mermaid shape for component type
   * @param type - Type of component (service, controller, repository, etc.)
   * @returns Object with open and close shape delimiters for Mermaid syntax
   */
  private getComponentShape(type: DiagramComponent['type']): { open: string; close: string } {
    const shapes: Record<DiagramComponent['type'], { open: string; close: string }> = {
      service: { open: '[', close: ']' },
      controller: { open: '([', close: '])' },
      repository: { open: '[(', close: ')]' },
      utility: { open: '{{', close: '}}' },
      external: { open: '[[', close: ']]' },
    };

    return shapes[type];
  }

  /**
   * Get Mermaid arrow for connection type
   * @param type - Type of connection (sync, async, event, or data)
   * @returns Mermaid arrow syntax appropriate for the connection type
   */
  private getConnectionArrow(type: 'sync' | 'async' | 'event' | 'data'): string {
    const arrows: Record<string, string> = {
      sync: '-->',
      async: '-. async .->',
      event: '-- event -->',
      data: '-.->',
    };

    return arrows[type] ?? '-->';
  }

  /**
   * Generate pattern-specific styling
   * @param pattern - Architecture pattern to generate styles for
   * @returns Mermaid classDef styling code specific to the pattern
   */
  private generatePatternStyling(pattern: ArchitecturePattern): string {
    let code = '\n';

    switch (pattern) {
      case 'hierarchical-multi-agent':
        code += '    classDef orchestrator fill:#f9f,stroke:#333\n';
        code += '    classDef worker fill:#bbf,stroke:#333\n';
        break;
      case 'event-driven':
        code += '    classDef broker fill:#fbb,stroke:#333\n';
        code += '    classDef consumer fill:#bfb,stroke:#333\n';
        break;
      case 'microservices':
        code += '    classDef gateway fill:#ff9,stroke:#333\n';
        code += '    classDef service fill:#9ff,stroke:#333\n';
        break;
      default:
        code += '    classDef default fill:#fff,stroke:#333\n';
    }

    return code;
  }

  /**
   * Generate microservices deployment diagram
   * @returns Mermaid code for Kubernetes-based microservices deployment architecture
   */
  private generateMicroservicesDeployment(): string {
    return `    subgraph Cloud["Cloud Environment"]
        subgraph K8S["Kubernetes Cluster"]
            LB[Load Balancer]
            subgraph Pods["Service Pods"]
                P1[Pod 1]
                P2[Pod 2]
                P3[Pod 3]
            end
        end
        subgraph Data["Data Layer"]
            DB[(Database)]
            CACHE[(Cache)]
        end
    end

    LB --> P1
    LB --> P2
    LB --> P3
    P1 --> DB
    P2 --> DB
    P3 --> CACHE
`;
  }

  /**
   * Generate agent deployment diagram
   * @returns Mermaid code for hierarchical multi-agent deployment architecture
   */
  private generateAgentDeployment(): string {
    return `    subgraph Host["Host Environment"]
        subgraph Controller["Controller Process"]
            ORCH[Orchestrator]
            POOL[Worker Pool]
        end
        subgraph Workers["Worker Processes"]
            W1[Worker 1]
            W2[Worker 2]
        end
        subgraph Storage["Storage"]
            FS[File System]
            STATE[State Store]
        end
    end

    ORCH --> POOL
    POOL --> W1
    POOL --> W2
    W1 --> FS
    W2 --> STATE
`;
  }

  /**
   * Generate standard deployment diagram
   * @returns Mermaid code for standard monolithic application deployment architecture
   */
  private generateStandardDeployment(): string {
    return `    subgraph Server["Application Server"]
        APP[Application]
        subgraph Services["Services"]
            SVC1[Service 1]
            SVC2[Service 2]
        end
    end
    subgraph Data["Data Tier"]
        DB[(Database)]
    end

    APP --> SVC1
    APP --> SVC2
    SVC1 --> DB
    SVC2 --> DB
`;
  }

  /**
   * Extract data flows from SRS
   * @param srs - Parsed SRS document containing features and requirements
   * @returns Object containing data sources, processors, sinks, and flow connections
   */
  private extractDataFlows(srs: ParsedSRS): {
    sources: { id: string; name: string }[];
    processors: { id: string; name: string }[];
    sinks: { id: string; name: string }[];
    flows: { from: string; to: string; label: string }[];
  } {
    const sources: { id: string; name: string }[] = [
      { id: 'USER', name: 'User Input' },
      { id: 'FILE', name: 'File System' },
    ];

    const processors: { id: string; name: string }[] = srs.features.slice(0, 3).map((f, i) => ({
      id: `PROC${String(i + 1)}`,
      name: this.truncateName(f.name, 15),
    }));

    const sinks: { id: string; name: string }[] = [
      { id: 'DB', name: 'Database' },
      { id: 'OUT', name: 'Output' },
    ];

    const flows: { from: string; to: string; label: string }[] = [
      { from: 'USER', to: processors[0]?.id ?? 'PROC1', label: 'input' },
    ];

    for (let i = 0; i < processors.length - 1; i++) {
      flows.push({
        from: processors[i]?.id ?? `PROC${String(i + 1)}`,
        to: processors[i + 1]?.id ?? `PROC${String(i + 2)}`,
        label: 'process',
      });
    }

    const lastProcessor = processors[processors.length - 1]?.id ?? 'PROC1';
    flows.push({ from: lastProcessor, to: 'DB', label: 'store' });
    flows.push({ from: lastProcessor, to: 'OUT', label: 'output' });

    return { sources, processors, sinks, flows };
  }

  /**
   * Wrap code in Mermaid code block
   * @param code - Mermaid diagram code to wrap
   * @returns Code wrapped in markdown mermaid code fence
   */
  private wrapInCodeBlock(code: string): string {
    return '```mermaid\n' + code + '```';
  }

  /**
   * Sanitize ID for Mermaid
   * @param name - Raw name to sanitize
   * @returns Sanitized identifier safe for use in Mermaid diagrams (alphanumeric and underscores only)
   */
  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Truncate name to max length
   * @param name - Name to truncate
   * @param maxLength - Maximum allowed length for the name
   * @returns Truncated name with ellipsis if exceeds max length, original name otherwise
   */
  private truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength - 3) + '...';
  }
}
