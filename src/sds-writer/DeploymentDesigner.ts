/**
 * Deployment Designer module
 *
 * Designs deployment architecture from components and NFRs, generating
 * deployment patterns, environment specifications, scaling strategies,
 * and configuration specifications.
 */

import type {
  ParsedNFR,
  SDSComponent,
  DeploymentSpec,
  EnvironmentSpec,
  ScalingSpec,
} from './types.js';

/**
 * Configuration specification for deployment
 */
export interface ConfigurationSpec {
  /** Configuration key */
  readonly key: string;
  /** Description */
  readonly description: string;
  /** Default value */
  readonly defaultValue?: string;
  /** Whether required */
  readonly required: boolean;
  /** Environment variable name */
  readonly envVar?: string;
  /** Sensitive data flag */
  readonly sensitive?: boolean;
}

/**
 * Deployment design result
 */
export interface DeploymentDesignResult {
  /** Deployment specification */
  readonly deploymentSpec: DeploymentSpec;
  /** Configuration specifications */
  readonly configurations: readonly ConfigurationSpec[];
  /** Infrastructure diagram in mermaid format */
  readonly infrastructureDiagram: string;
  /** Design warnings */
  readonly warnings: readonly string[];
}

/**
 * Deployment designer options
 */
export interface DeploymentDesignerOptions {
  /** Default deployment pattern */
  readonly defaultPattern?: DeploymentSpec['pattern'];
  /** Include development environment */
  readonly includeDevelopment?: boolean;
  /** Include staging environment */
  readonly includeStaging?: boolean;
  /** Default scaling type */
  readonly defaultScalingType?: ScalingSpec['type'];
  /** Default min instances */
  readonly defaultMinInstances?: number;
  /** Default max instances */
  readonly defaultMaxInstances?: number;
}

/**
 * Default designer options
 */
const DEFAULT_OPTIONS: Required<DeploymentDesignerOptions> = {
  defaultPattern: 'monolith',
  includeDevelopment: true,
  includeStaging: true,
  defaultScalingType: 'horizontal',
  defaultMinInstances: 1,
  defaultMaxInstances: 5,
};

/**
 * Designer for deployment architecture from components and NFRs
 */
export class DeploymentDesigner {
  private readonly options: Required<DeploymentDesignerOptions>;

  constructor(options: DeploymentDesignerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Design deployment architecture from components and NFRs
   * @param components - SDS components
   * @param nfrs - Non-functional requirements
   * @returns Deployment design result
   */
  public design(
    components: readonly SDSComponent[],
    nfrs: readonly ParsedNFR[]
  ): DeploymentDesignResult {
    const warnings: string[] = [];

    // Determine deployment pattern based on components and NFRs
    const pattern = this.determinePattern(components, nfrs);

    // Generate environment specifications
    const environments = this.generateEnvironments(nfrs);

    // Generate scaling strategy
    const scaling = this.generateScalingStrategy(nfrs);

    // Generate configuration specifications
    const configurations = this.generateConfigurations(components, nfrs);

    // Generate infrastructure diagram
    const infrastructureDiagram = this.generateInfrastructureDiagram(
      pattern,
      components,
      configurations
    );

    // Validate and collect warnings
    this.validateDesign(components, nfrs, warnings);

    const deploymentSpec: DeploymentSpec = {
      pattern,
      environments,
      scaling,
    };

    return {
      deploymentSpec,
      configurations,
      infrastructureDiagram,
      warnings,
    };
  }

  /**
   * Determine deployment pattern based on components and NFRs
   */
  private determinePattern(
    components: readonly SDSComponent[],
    nfrs: readonly ParsedNFR[]
  ): DeploymentSpec['pattern'] {
    const nfrText = nfrs.map((n) => n.description.toLowerCase()).join(' ');
    const componentCount = components.length;

    // Check for serverless indicators
    if (
      nfrText.includes('serverless') ||
      nfrText.includes('lambda') ||
      nfrText.includes('function as a service')
    ) {
      return 'serverless';
    }

    // Check for microservices indicators
    if (
      nfrText.includes('microservice') ||
      nfrText.includes('distributed') ||
      nfrText.includes('independent deployment') ||
      componentCount > 10
    ) {
      return 'microservices';
    }

    // Check for hybrid indicators
    if (nfrText.includes('hybrid') || nfrText.includes('mixed')) {
      return 'hybrid';
    }

    // Default based on component count
    if (componentCount <= 5) {
      return 'monolith';
    }

    return this.options.defaultPattern;
  }

  /**
   * Generate environment specifications
   */
  private generateEnvironments(nfrs: readonly ParsedNFR[]): EnvironmentSpec[] {
    const environments: EnvironmentSpec[] = [];
    const nfrText = nfrs.map((n) => n.description.toLowerCase()).join(' ');

    if (this.options.includeDevelopment) {
      environments.push({
        name: 'development',
        infrastructure: 'Local development environment with hot-reload support',
        configuration: 'Debug mode enabled, verbose logging',
      });
    }

    if (this.options.includeStaging) {
      environments.push({
        name: 'staging',
        infrastructure: 'Staging environment mirroring production configuration',
        configuration: 'Production-like settings with test data',
      });
    }

    // Production environment with details from NFRs
    const productionInfra = this.deriveProductionInfrastructure(nfrText);
    environments.push({
      name: 'production',
      infrastructure: productionInfra,
      configuration: 'Optimized settings, security hardened, monitoring enabled',
    });

    return environments;
  }

  /**
   * Derive production infrastructure details from NFRs
   */
  private deriveProductionInfrastructure(nfrText: string): string {
    const features: string[] = [];

    if (nfrText.includes('high availability') || nfrText.includes('99.9')) {
      features.push('Multi-AZ deployment for high availability');
    }

    if (nfrText.includes('cdn') || nfrText.includes('content delivery')) {
      features.push('CDN for static asset delivery');
    }

    if (nfrText.includes('load balancer') || nfrText.includes('traffic')) {
      features.push('Load balancer for traffic distribution');
    }

    if (nfrText.includes('database') || nfrText.includes('data')) {
      features.push('Managed database with automated backups');
    }

    if (nfrText.includes('cache') || nfrText.includes('performance')) {
      features.push('Distributed cache for performance optimization');
    }

    if (features.length === 0) {
      return 'Cloud-based production environment with monitoring and logging';
    }

    return features.join('. ');
  }

  /**
   * Generate scaling strategy from NFRs
   */
  private generateScalingStrategy(nfrs: readonly ParsedNFR[]): ScalingSpec {
    const nfrText = nfrs.map((n) => n.description.toLowerCase()).join(' ');
    const metrics: string[] = [];

    // Determine scaling type
    let scalingType = this.options.defaultScalingType;

    if (nfrText.includes('auto-scal') || nfrText.includes('auto scal')) {
      scalingType = 'auto';
    } else if (nfrText.includes('vertical') || nfrText.includes('scale up')) {
      scalingType = 'vertical';
    }

    // Extract scaling metrics
    if (nfrText.includes('cpu')) {
      metrics.push('CPU utilization > 70%');
    }
    if (nfrText.includes('memory')) {
      metrics.push('Memory utilization > 80%');
    }
    if (nfrText.includes('request') || nfrText.includes('throughput')) {
      metrics.push('Request rate threshold');
    }
    if (nfrText.includes('latency') || nfrText.includes('response time')) {
      metrics.push('Response latency > threshold');
    }

    // Default metrics if none specified
    if (metrics.length === 0) {
      metrics.push('CPU utilization > 70%', 'Memory utilization > 80%');
    }

    // Extract instance limits from NFRs
    const { minInstances, maxInstances } = this.extractInstanceLimits(nfrText);

    return {
      type: scalingType,
      metrics,
      minInstances,
      maxInstances,
    };
  }

  /**
   * Extract instance limits from NFR text
   */
  private extractInstanceLimits(nfrText: string): {
    minInstances: number;
    maxInstances: number;
  } {
    const minInstances = this.options.defaultMinInstances;
    let maxInstances = this.options.defaultMaxInstances;

    // Try to extract numbers from NFR text
    const concurrentMatch = nfrText.match(/(\d+)\s*concurrent/i);
    if (concurrentMatch !== null && concurrentMatch[1] !== undefined) {
      const concurrent = parseInt(concurrentMatch[1], 10);
      // Estimate instances based on concurrent users (rough: 100 users per instance)
      maxInstances = Math.max(Math.ceil(concurrent / 100), maxInstances);
    }

    const instanceMatch = nfrText.match(/max(?:imum)?\s*(\d+)\s*instance/i);
    if (instanceMatch !== null && instanceMatch[1] !== undefined) {
      maxInstances = parseInt(instanceMatch[1], 10);
    }

    return { minInstances, maxInstances };
  }

  /**
   * Generate configuration specifications from components and NFRs
   */
  private generateConfigurations(
    components: readonly SDSComponent[],
    nfrs: readonly ParsedNFR[]
  ): ConfigurationSpec[] {
    const configs: ConfigurationSpec[] = [];
    const seenKeys = new Set<string>();

    // Standard configurations
    const standardConfigs: ConfigurationSpec[] = [
      {
        key: 'LOG_LEVEL',
        description: 'Logging verbosity level',
        defaultValue: 'INFO',
        required: false,
        envVar: 'LOG_LEVEL',
      },
      {
        key: 'PORT',
        description: 'Application port',
        defaultValue: '3000',
        required: false,
        envVar: 'PORT',
      },
      {
        key: 'NODE_ENV',
        description: 'Runtime environment',
        defaultValue: 'development',
        required: true,
        envVar: 'NODE_ENV',
      },
    ];

    for (const config of standardConfigs) {
      if (!seenKeys.has(config.key)) {
        seenKeys.add(config.key);
        configs.push(config);
      }
    }

    // Extract configurations from NFRs
    const nfrConfigs = this.extractNFRConfigurations(nfrs);
    for (const config of nfrConfigs) {
      if (!seenKeys.has(config.key)) {
        seenKeys.add(config.key);
        configs.push(config);
      }
    }

    // Extract configurations from components
    const componentConfigs = this.extractComponentConfigurations(components);
    for (const config of componentConfigs) {
      if (!seenKeys.has(config.key)) {
        seenKeys.add(config.key);
        configs.push(config);
      }
    }

    return configs;
  }

  /**
   * Extract configurations from NFRs
   */
  private extractNFRConfigurations(nfrs: readonly ParsedNFR[]): ConfigurationSpec[] {
    const configs: ConfigurationSpec[] = [];

    for (const nfr of nfrs) {
      const descLower = nfr.description.toLowerCase();

      if (nfr.category === 'security' || descLower.includes('auth')) {
        configs.push({
          key: 'JWT_SECRET',
          description: 'Secret key for JWT token signing',
          required: true,
          envVar: 'JWT_SECRET',
          sensitive: true,
        });
        configs.push({
          key: 'JWT_EXPIRY',
          description: 'JWT token expiration time',
          defaultValue: '1h',
          required: false,
          envVar: 'JWT_EXPIRY',
        });
      }

      if (nfr.category === 'performance' || descLower.includes('cache')) {
        configs.push({
          key: 'CACHE_TTL',
          description: 'Cache time-to-live in seconds',
          defaultValue: '3600',
          required: false,
          envVar: 'CACHE_TTL',
        });
        configs.push({
          key: 'REDIS_URL',
          description: 'Redis connection URL for caching',
          required: false,
          envVar: 'REDIS_URL',
        });
      }

      if (descLower.includes('database') || descLower.includes('data')) {
        configs.push({
          key: 'DATABASE_URL',
          description: 'Database connection string',
          required: true,
          envVar: 'DATABASE_URL',
          sensitive: true,
        });
      }

      if (descLower.includes('rate limit')) {
        configs.push({
          key: 'RATE_LIMIT_MAX',
          description: 'Maximum requests per window',
          defaultValue: '100',
          required: false,
          envVar: 'RATE_LIMIT_MAX',
        });
        configs.push({
          key: 'RATE_LIMIT_WINDOW',
          description: 'Rate limit window in milliseconds',
          defaultValue: '60000',
          required: false,
          envVar: 'RATE_LIMIT_WINDOW',
        });
      }
    }

    return configs;
  }

  /**
   * Extract configurations from components
   */
  private extractComponentConfigurations(
    components: readonly SDSComponent[]
  ): ConfigurationSpec[] {
    const configs: ConfigurationSpec[] = [];

    for (const component of components) {
      const nameLower = component.name.toLowerCase();
      const descLower = (component.description + ' ' + component.responsibility).toLowerCase();

      if (nameLower.includes('github') || descLower.includes('github')) {
        configs.push({
          key: 'GITHUB_TOKEN',
          description: 'GitHub API access token',
          required: true,
          envVar: 'GITHUB_TOKEN',
          sensitive: true,
        });
      }

      if (nameLower.includes('api') || descLower.includes('external api')) {
        configs.push({
          key: 'API_BASE_URL',
          description: 'Base URL for external API',
          required: false,
          envVar: 'API_BASE_URL',
        });
        configs.push({
          key: 'API_TIMEOUT',
          description: 'API request timeout in milliseconds',
          defaultValue: '30000',
          required: false,
          envVar: 'API_TIMEOUT',
        });
      }

      if (nameLower.includes('email') || descLower.includes('email')) {
        configs.push({
          key: 'SMTP_HOST',
          description: 'SMTP server host',
          required: false,
          envVar: 'SMTP_HOST',
        });
        configs.push({
          key: 'SMTP_PORT',
          description: 'SMTP server port',
          defaultValue: '587',
          required: false,
          envVar: 'SMTP_PORT',
        });
      }

      if (nameLower.includes('storage') || descLower.includes('file') || descLower.includes('s3')) {
        configs.push({
          key: 'STORAGE_BUCKET',
          description: 'Cloud storage bucket name',
          required: false,
          envVar: 'STORAGE_BUCKET',
        });
        configs.push({
          key: 'STORAGE_REGION',
          description: 'Cloud storage region',
          defaultValue: 'us-east-1',
          required: false,
          envVar: 'STORAGE_REGION',
        });
      }
    }

    return configs;
  }

  /**
   * Generate infrastructure diagram in mermaid format
   */
  private generateInfrastructureDiagram(
    pattern: DeploymentSpec['pattern'],
    components: readonly SDSComponent[],
    configurations: readonly ConfigurationSpec[]
  ): string {
    const lines: string[] = [];
    lines.push('```mermaid');
    lines.push('flowchart LR');

    // User/Client
    lines.push('  subgraph Client["Client Layer"]');
    lines.push('    User[User/Browser]');
    lines.push('  end');

    // Infrastructure based on pattern
    if (pattern === 'serverless') {
      lines.push('  subgraph Cloud["Serverless Infrastructure"]');
      lines.push('    Gateway[API Gateway]');
      lines.push('    Functions[Lambda Functions]');
      lines.push('    Storage[(Object Storage)]');
      lines.push('  end');
      lines.push('  User --> Gateway');
      lines.push('  Gateway --> Functions');
      lines.push('  Functions --> Storage');
    } else if (pattern === 'microservices') {
      lines.push('  subgraph Infrastructure["Microservices Infrastructure"]');
      lines.push('    LB[Load Balancer]');
      lines.push('    subgraph Services["Services"]');
      // Group components into services
      const serviceGroups = this.groupComponentsIntoServices(components);
      for (const [idx, group] of serviceGroups.entries()) {
        lines.push(`      Service${String(idx)}[${group}]`);
      }
      lines.push('    end');
      lines.push('    DB[(Database)]');
      lines.push('    Cache[(Cache)]');
      lines.push('  end');
      lines.push('  User --> LB');
      lines.push('  LB --> Services');
      lines.push('  Services --> DB');
      lines.push('  Services --> Cache');
    } else {
      // Monolith or hybrid
      lines.push('  subgraph Infrastructure["Application Infrastructure"]');
      lines.push('    App[Application Server]');
      lines.push('    DB[(Database)]');
      lines.push('  end');
      lines.push('  User --> App');
      lines.push('  App --> DB');
    }

    // External services based on configurations
    const externalServices = this.detectExternalServices(configurations);
    if (externalServices.length > 0) {
      lines.push('  subgraph External["External Services"]');
      for (const service of externalServices) {
        lines.push(`    ${service.id}[${service.name}]`);
      }
      lines.push('  end');
      if (pattern === 'microservices') {
        lines.push('  Services --> External');
      } else {
        lines.push('  App --> External');
      }
    }

    lines.push('```');
    return lines.join('\n');
  }

  /**
   * Group components into logical services
   */
  private groupComponentsIntoServices(components: readonly SDSComponent[]): string[] {
    const services = new Set<string>();

    for (const component of components) {
      const name = component.name.toLowerCase();

      if (name.includes('auth') || name.includes('user') || name.includes('account')) {
        services.add('Auth Service');
      } else if (name.includes('api') || name.includes('gateway')) {
        services.add('API Gateway');
      } else if (name.includes('data') || name.includes('store') || name.includes('repository')) {
        services.add('Data Service');
      } else if (name.includes('notify') || name.includes('email') || name.includes('message')) {
        services.add('Notification Service');
      } else {
        services.add('Core Service');
      }
    }

    return [...services].slice(0, 5); // Limit to 5 services for diagram clarity
  }

  /**
   * Detect external services from configurations
   */
  private detectExternalServices(
    configurations: readonly ConfigurationSpec[]
  ): Array<{ id: string; name: string }> {
    const services: Array<{ id: string; name: string }> = [];
    const seenIds = new Set<string>();

    for (const config of configurations) {
      if (config.key.includes('GITHUB') && !seenIds.has('GitHub')) {
        seenIds.add('GitHub');
        services.push({ id: 'GitHub', name: 'GitHub API' });
      }
      if (config.key.includes('REDIS') && !seenIds.has('Redis')) {
        seenIds.add('Redis');
        services.push({ id: 'Redis', name: 'Redis Cache' });
      }
      if (config.key.includes('SMTP') && !seenIds.has('SMTP')) {
        seenIds.add('SMTP');
        services.push({ id: 'SMTP', name: 'Email Service' });
      }
      if (config.key.includes('STORAGE') && !seenIds.has('Storage')) {
        seenIds.add('Storage');
        services.push({ id: 'Storage', name: 'Cloud Storage' });
      }
    }

    return services;
  }

  /**
   * Validate design and collect warnings
   */
  private validateDesign(
    components: readonly SDSComponent[],
    nfrs: readonly ParsedNFR[],
    warnings: string[]
  ): void {
    // Check for missing high availability NFRs
    const hasHARequirement = nfrs.some(
      (n) =>
        n.description.toLowerCase().includes('availability') ||
        n.description.toLowerCase().includes('uptime')
    );
    if (!hasHARequirement && components.length > 5) {
      warnings.push('Consider adding high availability requirements for production deployment');
    }

    // Check for missing security NFRs
    const hasSecurityRequirement = nfrs.some((n) => n.category.toLowerCase() === 'security');
    if (!hasSecurityRequirement) {
      warnings.push('No security NFRs detected; consider adding authentication/authorization specs');
    }

    // Check for missing performance NFRs
    const hasPerformanceRequirement = nfrs.some((n) => n.category.toLowerCase() === 'performance');
    if (!hasPerformanceRequirement) {
      warnings.push('No performance NFRs detected; consider specifying response time requirements');
    }
  }

  /**
   * Generate deployment specification as markdown
   */
  public toMarkdown(result: DeploymentDesignResult): string {
    const lines: string[] = [];

    lines.push('## Deployment Architecture');
    lines.push('');

    // Pattern
    lines.push(`### Deployment Pattern: ${result.deploymentSpec.pattern}`);
    lines.push('');

    // Infrastructure diagram
    lines.push('### Infrastructure Diagram');
    lines.push('');
    lines.push(result.infrastructureDiagram);
    lines.push('');

    // Environments
    lines.push('### Environments');
    lines.push('');
    lines.push('| Environment | Infrastructure | Configuration |');
    lines.push('|-------------|----------------|---------------|');
    for (const env of result.deploymentSpec.environments) {
      const config = env.configuration ?? '-';
      lines.push(`| ${env.name} | ${env.infrastructure} | ${config} |`);
    }
    lines.push('');

    // Scaling
    if (result.deploymentSpec.scaling) {
      const scaling = result.deploymentSpec.scaling;
      lines.push('### Scaling Strategy');
      lines.push('');
      lines.push(`- **Type**: ${scaling.type}`);
      if (scaling.minInstances !== undefined) {
        lines.push(`- **Min Instances**: ${String(scaling.minInstances)}`);
      }
      if (scaling.maxInstances !== undefined) {
        lines.push(`- **Max Instances**: ${String(scaling.maxInstances)}`);
      }
      if (scaling.metrics && scaling.metrics.length > 0) {
        lines.push(`- **Scaling Metrics**:`);
        for (const metric of scaling.metrics) {
          lines.push(`  - ${metric}`);
        }
      }
      lines.push('');
    }

    // Configurations
    lines.push('### Configuration Specifications');
    lines.push('');
    lines.push('| Key | Description | Default | Required | Sensitive |');
    lines.push('|-----|-------------|---------|----------|-----------|');
    for (const config of result.configurations) {
      const defaultVal = config.defaultValue ?? '-';
      const required = config.required ? 'Yes' : 'No';
      const sensitive = config.sensitive === true ? 'Yes' : 'No';
      lines.push(`| ${config.key} | ${config.description} | ${defaultVal} | ${required} | ${sensitive} |`);
    }
    lines.push('');

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('### Design Warnings');
      lines.push('');
      for (const warning of result.warnings) {
        lines.push(`- ⚠️ ${warning}`);
      }
    }

    return lines.join('\n');
  }
}
