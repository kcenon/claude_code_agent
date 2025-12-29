import { describe, it, expect } from 'vitest';
import { DeploymentDesigner } from '../../src/sds-writer/DeploymentDesigner.js';
import type { SDSComponent, ParsedNFR } from '../../src/sds-writer/types.js';

describe('DeploymentDesigner', () => {
  const createComponent = (
    id: string,
    name: string,
    options: {
      description?: string;
      responsibility?: string;
    } = {}
  ): SDSComponent => ({
    id,
    name,
    description: options.description ?? `Description for ${name}`,
    responsibility: options.responsibility ?? `Responsibility for ${name}`,
    sourceFeature: 'SF-001',
    priority: 'P1',
    interfaces: [],
    dependencies: [],
    implementationNotes: 'Notes',
  });

  const createNFR = (
    id: string,
    category: string,
    description: string,
    options: { metric?: string } = {}
  ): ParsedNFR => ({
    id,
    category,
    description,
    metric: options.metric,
    priority: 'P1',
  });

  describe('constructor', () => {
    it('should create designer with default options', () => {
      const designer = new DeploymentDesigner();
      expect(designer).toBeInstanceOf(DeploymentDesigner);
    });

    it('should accept custom options', () => {
      const designer = new DeploymentDesigner({
        defaultPattern: 'microservices',
        includeDevelopment: false,
        includeStaging: false,
        defaultScalingType: 'auto',
        defaultMinInstances: 2,
        defaultMaxInstances: 10,
      });
      expect(designer).toBeInstanceOf(DeploymentDesigner);
    });
  });

  describe('design', () => {
    it('should design deployment from components and NFRs', () => {
      const designer = new DeploymentDesigner();
      const components = [createComponent('CMP-001', 'UserService')];
      const nfrs = [createNFR('NFR-001', 'performance', 'Response time < 200ms')];

      const result = designer.design(components, nfrs);

      expect(result.deploymentSpec).toBeDefined();
      expect(result.configurations).toBeDefined();
      expect(result.infrastructureDiagram).toBeDefined();
    });

    it('should include all environment types when enabled', () => {
      const designer = new DeploymentDesigner({
        includeDevelopment: true,
        includeStaging: true,
      });
      const result = designer.design([], []);

      const envNames = result.deploymentSpec.environments.map((e) => e.name);
      expect(envNames).toContain('development');
      expect(envNames).toContain('staging');
      expect(envNames).toContain('production');
    });

    it('should exclude development when disabled', () => {
      const designer = new DeploymentDesigner({
        includeDevelopment: false,
      });
      const result = designer.design([], []);

      const envNames = result.deploymentSpec.environments.map((e) => e.name);
      expect(envNames).not.toContain('development');
    });
  });

  describe('pattern detection', () => {
    it('should detect serverless pattern from NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'architecture', 'Deploy using serverless Lambda functions')];

      const result = designer.design([], nfrs);

      expect(result.deploymentSpec.pattern).toBe('serverless');
    });

    it('should detect microservices pattern from NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [
        createNFR('NFR-001', 'architecture', 'Use microservices architecture for scalability'),
      ];

      const result = designer.design([], nfrs);

      expect(result.deploymentSpec.pattern).toBe('microservices');
    });

    it('should detect microservices pattern from many components', () => {
      const designer = new DeploymentDesigner();
      const components = Array.from({ length: 15 }, (_, i) =>
        createComponent(`CMP-${String(i + 1).padStart(3, '0')}`, `Service${i + 1}`)
      );

      const result = designer.design(components, []);

      expect(result.deploymentSpec.pattern).toBe('microservices');
    });

    it('should default to monolith for few components', () => {
      const designer = new DeploymentDesigner();
      const components = [
        createComponent('CMP-001', 'Service1'),
        createComponent('CMP-002', 'Service2'),
      ];

      const result = designer.design(components, []);

      expect(result.deploymentSpec.pattern).toBe('monolith');
    });
  });

  describe('scaling strategy', () => {
    it('should generate scaling specification', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      expect(result.deploymentSpec.scaling).toBeDefined();
      expect(result.deploymentSpec.scaling?.type).toBeDefined();
    });

    it('should detect auto-scaling from NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'scalability', 'Auto-scaling based on load')];

      const result = designer.design([], nfrs);

      expect(result.deploymentSpec.scaling?.type).toBe('auto');
    });

    it('should include CPU metric when mentioned in NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'performance', 'CPU utilization should not exceed 70%')];

      const result = designer.design([], nfrs);

      expect(result.deploymentSpec.scaling?.metrics).toContain('CPU utilization > 70%');
    });

    it('should include response latency metric when mentioned', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'performance', 'Response latency must be low')];

      const result = designer.design([], nfrs);

      expect(result.deploymentSpec.scaling?.metrics?.some((m) => m.includes('latency'))).toBe(true);
    });

    it('should set min and max instances', () => {
      const designer = new DeploymentDesigner({
        defaultMinInstances: 2,
        defaultMaxInstances: 8,
      });

      const result = designer.design([], []);

      expect(result.deploymentSpec.scaling?.minInstances).toBe(2);
      expect(result.deploymentSpec.scaling?.maxInstances).toBe(8);
    });
  });

  describe('configuration generation', () => {
    it('should include standard configurations', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      const configKeys = result.configurations.map((c) => c.key);
      expect(configKeys).toContain('LOG_LEVEL');
      expect(configKeys).toContain('PORT');
      expect(configKeys).toContain('NODE_ENV');
    });

    it('should add JWT configs for security NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'security', 'Authentication required')];

      const result = designer.design([], nfrs);

      const configKeys = result.configurations.map((c) => c.key);
      expect(configKeys).toContain('JWT_SECRET');
      expect(configKeys).toContain('JWT_EXPIRY');
    });

    it('should mark sensitive configs correctly', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'security', 'JWT authentication')];

      const result = designer.design([], nfrs);

      const jwtSecret = result.configurations.find((c) => c.key === 'JWT_SECRET');
      expect(jwtSecret?.sensitive).toBe(true);
    });

    it('should add cache configs for performance NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'performance', 'Use caching for performance')];

      const result = designer.design([], nfrs);

      const configKeys = result.configurations.map((c) => c.key);
      expect(configKeys).toContain('CACHE_TTL');
      expect(configKeys).toContain('REDIS_URL');
    });

    it('should add database config when data NFR present', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'data', 'Database persistence required')];

      const result = designer.design([], nfrs);

      const configKeys = result.configurations.map((c) => c.key);
      expect(configKeys).toContain('DATABASE_URL');
    });

    it('should add GitHub config for GitHub components', () => {
      const designer = new DeploymentDesigner();
      const components = [
        createComponent('CMP-001', 'GitHubService', {
          description: 'Integrates with GitHub API',
        }),
      ];

      const result = designer.design(components, []);

      const configKeys = result.configurations.map((c) => c.key);
      expect(configKeys).toContain('GITHUB_TOKEN');
    });

    it('should add storage config for storage components', () => {
      const designer = new DeploymentDesigner();
      const components = [
        createComponent('CMP-001', 'FileStorage', {
          description: 'Manages file uploads to S3',
        }),
      ];

      const result = designer.design(components, []);

      const configKeys = result.configurations.map((c) => c.key);
      expect(configKeys).toContain('STORAGE_BUCKET');
      expect(configKeys).toContain('STORAGE_REGION');
    });
  });

  describe('infrastructure diagram', () => {
    it('should generate mermaid diagram', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      expect(result.infrastructureDiagram).toContain('```mermaid');
      expect(result.infrastructureDiagram).toContain('flowchart');
      expect(result.infrastructureDiagram).toContain('```');
    });

    it('should include client layer', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      expect(result.infrastructureDiagram).toContain('Client');
      expect(result.infrastructureDiagram).toContain('User');
    });

    it('should show serverless components for serverless pattern', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'architecture', 'Use serverless')];

      const result = designer.design([], nfrs);

      expect(result.infrastructureDiagram).toContain('Gateway');
      expect(result.infrastructureDiagram).toContain('Functions');
    });

    it('should show load balancer for microservices', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'architecture', 'Microservices architecture')];

      const result = designer.design([], nfrs);

      expect(result.infrastructureDiagram).toContain('Load Balancer');
    });

    it('should include external services', () => {
      const designer = new DeploymentDesigner();
      const components = [
        createComponent('CMP-001', 'GitHubIntegration', {
          description: 'GitHub API integration',
        }),
      ];

      const result = designer.design(components, []);

      expect(result.infrastructureDiagram).toContain('External');
      expect(result.infrastructureDiagram).toContain('GitHub');
    });
  });

  describe('validation and warnings', () => {
    it('should warn about missing HA requirements for many components', () => {
      const designer = new DeploymentDesigner();
      const components = Array.from({ length: 10 }, (_, i) =>
        createComponent(`CMP-${String(i + 1).padStart(3, '0')}`, `Service${i + 1}`)
      );

      const result = designer.design(components, []);

      expect(result.warnings.some((w) => w.includes('availability'))).toBe(true);
    });

    it('should warn about missing security NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'performance', 'Fast response')];

      const result = designer.design([], nfrs);

      expect(result.warnings.some((w) => w.includes('security'))).toBe(true);
    });

    it('should warn about missing performance NFRs', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [createNFR('NFR-001', 'security', 'Secure access')];

      const result = designer.design([], nfrs);

      expect(result.warnings.some((w) => w.includes('performance'))).toBe(true);
    });

    it('should not warn when all NFR categories present', () => {
      const designer = new DeploymentDesigner();
      const nfrs = [
        createNFR('NFR-001', 'security', 'Secure access'),
        createNFR('NFR-002', 'performance', 'Fast response'),
        createNFR('NFR-003', 'availability', '99.9% uptime'),
      ];

      const result = designer.design([], nfrs);

      expect(result.warnings.filter((w) => w.includes('security')).length).toBe(0);
      expect(result.warnings.filter((w) => w.includes('performance')).length).toBe(0);
    });
  });

  describe('toMarkdown', () => {
    it('should generate markdown output', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      const markdown = designer.toMarkdown(result);

      expect(markdown).toContain('## Deployment Architecture');
      expect(markdown).toContain('### Deployment Pattern');
      expect(markdown).toContain('### Environments');
      expect(markdown).toContain('### Scaling Strategy');
      expect(markdown).toContain('### Configuration Specifications');
    });

    it('should include infrastructure diagram', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      const markdown = designer.toMarkdown(result);

      expect(markdown).toContain('```mermaid');
    });

    it('should include environment table', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      const markdown = designer.toMarkdown(result);

      expect(markdown).toContain('| Environment |');
      expect(markdown).toContain('| development |');
      expect(markdown).toContain('| staging |');
      expect(markdown).toContain('| production |');
    });

    it('should include configuration table', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      const markdown = designer.toMarkdown(result);

      expect(markdown).toContain('| Key |');
      expect(markdown).toContain('| LOG_LEVEL |');
      expect(markdown).toContain('| PORT |');
    });

    it('should include warnings section when present', () => {
      const designer = new DeploymentDesigner();
      const result = designer.design([], []);

      const markdown = designer.toMarkdown(result);

      if (result.warnings.length > 0) {
        expect(markdown).toContain('### Design Warnings');
        expect(markdown).toContain('⚠️');
      }
    });
  });
});
