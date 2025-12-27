/**
 * Directory Structure Generator for Architecture Generator
 *
 * Generates directory structure specifications based on
 * architecture patterns and technology stack.
 *
 * @module architecture-generator/DirectoryStructureGenerator
 */

import { DirectoryStructureError } from './errors.js';
import type {
  ParsedSRS,
  ArchitectureAnalysis,
  TechnologyStack,
  DirectoryStructure,
  DirectoryEntry,
  ArchitecturePattern,
} from './types.js';

// ============================================================
// Directory Templates
// ============================================================

interface DirectoryTemplate {
  root: string;
  entries: DirectoryEntry[];
  description: string;
}

const PATTERN_TEMPLATES: Record<ArchitecturePattern, DirectoryTemplate> = {
  'hierarchical-multi-agent': {
    root: 'project-root',
    description: 'Multi-agent architecture with orchestrator and worker separation',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'orchestrator',
            type: 'directory',
            description: 'Orchestrator agent components',
            children: [
              { name: 'index.ts', type: 'file', description: 'Orchestrator exports', children: [] },
              {
                name: 'Orchestrator.ts',
                type: 'file',
                description: 'Main orchestrator class',
                children: [],
              },
              {
                name: 'TaskQueue.ts',
                type: 'file',
                description: 'Task queue management',
                children: [],
              },
              { name: 'types.ts', type: 'file', description: 'Type definitions', children: [] },
            ],
          },
          {
            name: 'workers',
            type: 'directory',
            description: 'Worker agent implementations',
            children: [
              { name: 'index.ts', type: 'file', description: 'Worker exports', children: [] },
              {
                name: 'WorkerAgent.ts',
                type: 'file',
                description: 'Base worker agent class',
                children: [],
              },
              {
                name: 'WorkerPool.ts',
                type: 'file',
                description: 'Worker pool management',
                children: [],
              },
              { name: 'types.ts', type: 'file', description: 'Worker types', children: [] },
            ],
          },
          {
            name: 'state',
            type: 'directory',
            description: 'Shared state management',
            children: [
              { name: 'index.ts', type: 'file', description: 'State exports', children: [] },
              {
                name: 'StateManager.ts',
                type: 'file',
                description: 'State management class',
                children: [],
              },
              {
                name: 'Scratchpad.ts',
                type: 'file',
                description: 'File-based scratchpad',
                children: [],
              },
            ],
          },
          {
            name: 'common',
            type: 'directory',
            description: 'Shared utilities and types',
            children: [
              { name: 'errors.ts', type: 'file', description: 'Error definitions', children: [] },
              { name: 'utils.ts', type: 'file', description: 'Utility functions', children: [] },
              { name: 'types.ts', type: 'file', description: 'Common types', children: [] },
            ],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      {
        name: 'tests',
        type: 'directory',
        description: 'Test files',
        children: [
          {
            name: 'orchestrator',
            type: 'directory',
            description: 'Orchestrator tests',
            children: [],
          },
          { name: 'workers', type: 'directory', description: 'Worker tests', children: [] },
          {
            name: 'integration',
            type: 'directory',
            description: 'Integration tests',
            children: [],
          },
        ],
      },
      {
        name: 'config',
        type: 'directory',
        description: 'Configuration files',
        children: [
          { name: 'agents.yaml', type: 'file', description: 'Agent definitions', children: [] },
          {
            name: 'default.yaml',
            type: 'file',
            description: 'Default configuration',
            children: [],
          },
        ],
      },
      {
        name: 'docs',
        type: 'directory',
        description: 'Documentation',
        children: [
          {
            name: 'architecture.md',
            type: 'file',
            description: 'Architecture guide',
            children: [],
          },
          { name: 'agents.md', type: 'file', description: 'Agent documentation', children: [] },
        ],
      },
    ],
  },

  pipeline: {
    root: 'project-root',
    description: 'Pipeline architecture with sequential stage processing',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'pipeline',
            type: 'directory',
            description: 'Pipeline core',
            children: [
              { name: 'index.ts', type: 'file', description: 'Pipeline exports', children: [] },
              { name: 'Pipeline.ts', type: 'file', description: 'Pipeline runner', children: [] },
              {
                name: 'PipelineBuilder.ts',
                type: 'file',
                description: 'Pipeline builder',
                children: [],
              },
              { name: 'types.ts', type: 'file', description: 'Pipeline types', children: [] },
            ],
          },
          {
            name: 'stages',
            type: 'directory',
            description: 'Pipeline stages',
            children: [
              { name: 'index.ts', type: 'file', description: 'Stage exports', children: [] },
              { name: 'Stage.ts', type: 'file', description: 'Base stage class', children: [] },
              { name: 'InputStage.ts', type: 'file', description: 'Input handling', children: [] },
              {
                name: 'TransformStage.ts',
                type: 'file',
                description: 'Data transformation',
                children: [],
              },
              {
                name: 'OutputStage.ts',
                type: 'file',
                description: 'Output handling',
                children: [],
              },
            ],
          },
          {
            name: 'transforms',
            type: 'directory',
            description: 'Transform implementations',
            children: [],
          },
          {
            name: 'common',
            type: 'directory',
            description: 'Shared utilities',
            children: [],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      { name: 'tests', type: 'directory', description: 'Test files', children: [] },
      { name: 'config', type: 'directory', description: 'Configuration', children: [] },
      { name: 'docs', type: 'directory', description: 'Documentation', children: [] },
    ],
  },

  'event-driven': {
    root: 'project-root',
    description: 'Event-driven architecture with publishers and subscribers',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'events',
            type: 'directory',
            description: 'Event definitions and bus',
            children: [
              { name: 'index.ts', type: 'file', description: 'Event exports', children: [] },
              {
                name: 'EventBus.ts',
                type: 'file',
                description: 'Event bus implementation',
                children: [],
              },
              { name: 'events.ts', type: 'file', description: 'Event definitions', children: [] },
              { name: 'types.ts', type: 'file', description: 'Event types', children: [] },
            ],
          },
          {
            name: 'publishers',
            type: 'directory',
            description: 'Event publishers',
            children: [],
          },
          {
            name: 'subscribers',
            type: 'directory',
            description: 'Event subscribers',
            children: [],
          },
          {
            name: 'handlers',
            type: 'directory',
            description: 'Event handlers',
            children: [],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      { name: 'tests', type: 'directory', description: 'Test files', children: [] },
      { name: 'config', type: 'directory', description: 'Configuration', children: [] },
    ],
  },

  microservices: {
    root: 'project-root',
    description: 'Microservices architecture with independent services',
    entries: [
      {
        name: 'services',
        type: 'directory',
        description: 'Individual microservices',
        children: [
          {
            name: 'api-gateway',
            type: 'directory',
            description: 'API Gateway service',
            children: [
              { name: 'src', type: 'directory', description: 'Source code', children: [] },
              {
                name: 'Dockerfile',
                type: 'file',
                description: 'Docker configuration',
                children: [],
              },
              { name: 'package.json', type: 'file', description: 'Dependencies', children: [] },
            ],
          },
          {
            name: 'service-a',
            type: 'directory',
            description: 'Service A',
            children: [
              { name: 'src', type: 'directory', description: 'Source code', children: [] },
              {
                name: 'Dockerfile',
                type: 'file',
                description: 'Docker configuration',
                children: [],
              },
              { name: 'package.json', type: 'file', description: 'Dependencies', children: [] },
            ],
          },
          {
            name: 'service-b',
            type: 'directory',
            description: 'Service B',
            children: [
              { name: 'src', type: 'directory', description: 'Source code', children: [] },
              {
                name: 'Dockerfile',
                type: 'file',
                description: 'Docker configuration',
                children: [],
              },
              { name: 'package.json', type: 'file', description: 'Dependencies', children: [] },
            ],
          },
        ],
      },
      {
        name: 'shared',
        type: 'directory',
        description: 'Shared libraries',
        children: [
          { name: 'types', type: 'directory', description: 'Shared types', children: [] },
          { name: 'utils', type: 'directory', description: 'Shared utilities', children: [] },
        ],
      },
      {
        name: 'infrastructure',
        type: 'directory',
        description: 'Infrastructure configuration',
        children: [
          { name: 'docker-compose.yml', type: 'file', description: 'Docker Compose', children: [] },
          { name: 'k8s', type: 'directory', description: 'Kubernetes manifests', children: [] },
        ],
      },
    ],
  },

  layered: {
    root: 'project-root',
    description: 'Layered architecture with presentation, business, and data layers',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'presentation',
            type: 'directory',
            description: 'Presentation layer (controllers, views)',
            children: [
              {
                name: 'controllers',
                type: 'directory',
                description: 'HTTP controllers',
                children: [],
              },
              {
                name: 'middleware',
                type: 'directory',
                description: 'HTTP middleware',
                children: [],
              },
              { name: 'routes', type: 'directory', description: 'Route definitions', children: [] },
            ],
          },
          {
            name: 'business',
            type: 'directory',
            description: 'Business logic layer',
            children: [
              {
                name: 'services',
                type: 'directory',
                description: 'Business services',
                children: [],
              },
              {
                name: 'validators',
                type: 'directory',
                description: 'Input validators',
                children: [],
              },
            ],
          },
          {
            name: 'data',
            type: 'directory',
            description: 'Data access layer',
            children: [
              {
                name: 'repositories',
                type: 'directory',
                description: 'Data repositories',
                children: [],
              },
              { name: 'models', type: 'directory', description: 'Data models', children: [] },
              {
                name: 'migrations',
                type: 'directory',
                description: 'Database migrations',
                children: [],
              },
            ],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      { name: 'tests', type: 'directory', description: 'Test files', children: [] },
      { name: 'config', type: 'directory', description: 'Configuration', children: [] },
    ],
  },

  hexagonal: {
    root: 'project-root',
    description: 'Hexagonal (ports and adapters) architecture',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'core',
            type: 'directory',
            description: 'Domain core',
            children: [
              { name: 'domain', type: 'directory', description: 'Domain entities', children: [] },
              { name: 'ports', type: 'directory', description: 'Port interfaces', children: [] },
              {
                name: 'usecases',
                type: 'directory',
                description: 'Use case implementations',
                children: [],
              },
            ],
          },
          {
            name: 'adapters',
            type: 'directory',
            description: 'Adapters for external systems',
            children: [
              {
                name: 'inbound',
                type: 'directory',
                description: 'Inbound adapters (HTTP, CLI)',
                children: [],
              },
              {
                name: 'outbound',
                type: 'directory',
                description: 'Outbound adapters (DB, API)',
                children: [],
              },
            ],
          },
          {
            name: 'infrastructure',
            type: 'directory',
            description: 'Infrastructure concerns',
            children: [],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      { name: 'tests', type: 'directory', description: 'Test files', children: [] },
    ],
  },

  cqrs: {
    root: 'project-root',
    description: 'CQRS architecture with command and query separation',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'commands',
            type: 'directory',
            description: 'Command side',
            children: [
              {
                name: 'handlers',
                type: 'directory',
                description: 'Command handlers',
                children: [],
              },
              {
                name: 'commands',
                type: 'directory',
                description: 'Command definitions',
                children: [],
              },
            ],
          },
          {
            name: 'queries',
            type: 'directory',
            description: 'Query side',
            children: [
              { name: 'handlers', type: 'directory', description: 'Query handlers', children: [] },
              {
                name: 'queries',
                type: 'directory',
                description: 'Query definitions',
                children: [],
              },
            ],
          },
          {
            name: 'events',
            type: 'directory',
            description: 'Domain events',
            children: [],
          },
          {
            name: 'projections',
            type: 'directory',
            description: 'Read model projections',
            children: [],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      { name: 'tests', type: 'directory', description: 'Test files', children: [] },
    ],
  },

  scratchpad: {
    root: 'project-root',
    description: 'Scratchpad pattern with file-based state sharing',
    entries: [
      {
        name: 'src',
        type: 'directory',
        description: 'Source code directory',
        children: [
          {
            name: 'scratchpad',
            type: 'directory',
            description: 'Scratchpad implementation',
            children: [
              { name: 'index.ts', type: 'file', description: 'Scratchpad exports', children: [] },
              {
                name: 'Scratchpad.ts',
                type: 'file',
                description: 'Scratchpad class',
                children: [],
              },
              { name: 'FileStore.ts', type: 'file', description: 'File storage', children: [] },
            ],
          },
          {
            name: 'agents',
            type: 'directory',
            description: 'Agent implementations',
            children: [],
          },
          { name: 'index.ts', type: 'file', description: 'Main entry point', children: [] },
        ],
      },
      {
        name: '.scratchpad',
        type: 'directory',
        description: 'Scratchpad data directory',
        children: [
          { name: 'state', type: 'directory', description: 'State files', children: [] },
          { name: 'temp', type: 'directory', description: 'Temporary files', children: [] },
        ],
      },
      { name: 'tests', type: 'directory', description: 'Test files', children: [] },
    ],
  },
};

// ============================================================
// Directory Structure Generator Class
// ============================================================

/**
 * Generates directory structure based on architecture pattern
 */
export class DirectoryStructureGenerator {
  /**
   * Generate directory structure
   */
  public generate(
    srs: ParsedSRS,
    analysis: ArchitectureAnalysis,
    stack: TechnologyStack
  ): DirectoryStructure {
    try {
      const baseTemplate = this.getTemplate(analysis.primaryPattern);
      const customizedStructure = this.customizeStructure(baseTemplate, srs, stack);
      const withFeatures = this.addFeatureDirectories(customizedStructure, srs);

      return withFeatures;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new DirectoryStructureError(analysis.primaryPattern, message);
    }
  }

  /**
   * Get template for pattern
   */
  private getTemplate(pattern: ArchitecturePattern): DirectoryTemplate {
    return PATTERN_TEMPLATES[pattern];
  }

  /**
   * Customize structure based on technology stack
   */
  private customizeStructure(
    template: DirectoryTemplate,
    _srs: ParsedSRS,
    stack: TechnologyStack
  ): DirectoryStructure {
    const entries = [...template.entries];

    // Add configuration files based on technology stack
    const runtime = stack.layers.find((l) => l.layer === 'runtime')?.technology;
    const testing = stack.layers.find((l) => l.layer === 'testing')?.technology;

    // Add root-level config files
    const configFiles: DirectoryEntry[] = [];

    if (runtime === 'Node.js') {
      configFiles.push({
        name: 'package.json',
        type: 'file',
        description: 'Node.js package manifest',
        children: [],
      });
      configFiles.push({
        name: 'tsconfig.json',
        type: 'file',
        description: 'TypeScript configuration',
        children: [],
      });
      configFiles.push({
        name: '.eslintrc.js',
        type: 'file',
        description: 'ESLint configuration',
        children: [],
      });
    } else if (runtime === 'Python') {
      configFiles.push({
        name: 'pyproject.toml',
        type: 'file',
        description: 'Python project configuration',
        children: [],
      });
      configFiles.push({
        name: 'requirements.txt',
        type: 'file',
        description: 'Python dependencies',
        children: [],
      });
    } else if (runtime === 'Go') {
      configFiles.push({
        name: 'go.mod',
        type: 'file',
        description: 'Go module definition',
        children: [],
      });
      configFiles.push({
        name: 'go.sum',
        type: 'file',
        description: 'Go dependency checksums',
        children: [],
      });
    }

    if (testing === 'Vitest') {
      configFiles.push({
        name: 'vitest.config.ts',
        type: 'file',
        description: 'Vitest configuration',
        children: [],
      });
    } else if (testing === 'Jest') {
      configFiles.push({
        name: 'jest.config.js',
        type: 'file',
        description: 'Jest configuration',
        children: [],
      });
    }

    // Add common files
    configFiles.push({
      name: 'README.md',
      type: 'file',
      description: 'Project documentation',
      children: [],
    });
    configFiles.push({
      name: '.gitignore',
      type: 'file',
      description: 'Git ignore patterns',
      children: [],
    });
    configFiles.push({ name: 'LICENSE', type: 'file', description: 'License file', children: [] });

    return {
      root: template.root,
      entries: [...entries, ...configFiles],
      description: template.description,
    };
  }

  /**
   * Add feature-specific directories
   */
  private addFeatureDirectories(structure: DirectoryStructure, srs: ParsedSRS): DirectoryStructure {
    // Find the src directory
    const srcDir = structure.entries.find((e) => e.name === 'src' && e.type === 'directory');
    if (!srcDir) {
      return structure;
    }

    // Add feature directories based on SRS features
    const featureEntries: DirectoryEntry[] = [];

    for (const feature of srs.features.slice(0, 5)) {
      const featureName = this.toDirectoryName(feature.name);
      featureEntries.push({
        name: featureName,
        type: 'directory',
        description: feature.description.substring(0, 100),
        children: [
          { name: 'index.ts', type: 'file', description: `${feature.name} exports`, children: [] },
          { name: 'types.ts', type: 'file', description: `${feature.name} types`, children: [] },
        ],
      });
    }

    // Add features directory if we have features
    if (featureEntries.length > 0) {
      const featuresDir: DirectoryEntry = {
        name: 'features',
        type: 'directory',
        description: 'Feature-specific modules',
        children: featureEntries,
      };

      const updatedSrc: DirectoryEntry = {
        ...srcDir,
        children: [...srcDir.children, featuresDir],
      };

      return {
        ...structure,
        entries: structure.entries.map((e) => (e.name === 'src' ? updatedSrc : e)),
      };
    }

    return structure;
  }

  /**
   * Convert feature name to directory name
   */
  private toDirectoryName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }

  /**
   * Generate ASCII tree representation
   */
  public static toAsciiTree(structure: DirectoryStructure): string {
    const lines: string[] = [`${structure.root}/`];
    DirectoryStructureGenerator.buildTree(structure.entries, '', lines);
    return lines.join('\n');
  }

  /**
   * Recursively build ASCII tree
   */
  private static buildTree(
    entries: readonly DirectoryEntry[],
    prefix: string,
    lines: string[]
  ): void {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const suffix = entry.type === 'directory' ? '/' : '';

      lines.push(`${prefix}${connector}${entry.name}${suffix}`);

      if (entry.type === 'directory' && entry.children.length > 0) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        DirectoryStructureGenerator.buildTree(entry.children, newPrefix, lines);
      }
    }
  }
}
