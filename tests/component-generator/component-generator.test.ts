/**
 * Component Generator module tests
 *
 * Tests for component generation, interface specification,
 * API endpoint design, and traceability mapping.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ComponentGenerator,
  InterfaceGenerator,
  APISpecificationGenerator,
  ComponentGeneratorError,
  ComponentGenerationError,
  InterfaceGenerationError,
  APISpecificationError,
  InvalidSRSError,
  getComponentGenerator,
  resetComponentGenerator,
  COMPONENT_SCHEMA_VERSION,
  VALID_HTTP_METHODS,
  VALID_INTERFACE_TYPES,
  VALID_COMPONENT_LAYERS,
} from '../../src/component-generator/index.js';
import type {
  ComponentDesign,
  ComponentDefinition,
  InterfaceSpec,
  APIEndpoint,
} from '../../src/component-generator/index.js';
import type { ParsedSRS, SRSFeature, SRSUseCase } from '../../src/architecture-generator/index.js';

// ============================================================
// Test Data
// ============================================================

const createMockUseCase = (id: string, name: string): SRSUseCase => ({
  id,
  name,
  description: `Description for ${name}`,
  actor: 'User',
  preconditions: ['User is authenticated'],
  mainFlow: [
    'User enters name and email',
    'System validates input',
    'System creates resource',
  ],
  alternativeFlows: [],
  postconditions: ['Resource is created'],
});

const createMockFeature = (
  id: string,
  name: string,
  useCases: SRSUseCase[] = []
): SRSFeature => ({
  id,
  name,
  description: `Description for ${name}`,
  priority: 'P0',
  useCases,
  nfrs: [],
});

const createMockSRS = (): ParsedSRS => ({
  metadata: {
    documentId: 'SRS-TEST',
    sourcePRD: 'PRD-TEST',
    version: '1.0.0',
    status: 'Draft',
    productName: 'Test Product',
  },
  features: [
    createMockFeature('SF-001', 'User Management', [
      createMockUseCase('UC-001', 'Create User'),
      createMockUseCase('UC-002', 'Update User'),
    ]),
    createMockFeature('SF-002', 'Project Management', [
      createMockUseCase('UC-003', 'Create Project'),
    ]),
  ],
  nfrs: [],
  constraints: [],
  assumptions: [],
});

// ============================================================
// ComponentGenerator Tests
// ============================================================

describe('ComponentGenerator', () => {
  let generator: ComponentGenerator;
  let mockSRS: ParsedSRS;

  beforeEach(() => {
    resetComponentGenerator();
    generator = new ComponentGenerator();
    mockSRS = createMockSRS();
  });

  afterEach(() => {
    resetComponentGenerator();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const gen = new ComponentGenerator();
      expect(gen).toBeInstanceOf(ComponentGenerator);
    });

    it('should create with custom config', () => {
      const gen = new ComponentGenerator({
        outputDir: 'custom/output',
        defaultOptions: {
          verbose: true,
        },
      });
      expect(gen).toBeInstanceOf(ComponentGenerator);
    });
  });

  describe('generate', () => {
    it('should generate component design from SRS', () => {
      const design = generator.generate(mockSRS);

      expect(design).toBeDefined();
      expect(design.components).toHaveLength(2);
      expect(design.metadata.sourceSRS).toBe('SRS-TEST');
      expect(design.metadata.version).toBe(COMPONENT_SCHEMA_VERSION);
    });

    it('should generate components with correct IDs', () => {
      const design = generator.generate(mockSRS);

      expect(design.components[0]?.id).toBe('CMP-001');
      expect(design.components[1]?.id).toBe('CMP-002');
    });

    it('should map features to components', () => {
      const design = generator.generate(mockSRS);

      expect(design.components[0]?.sourceFeature).toBe('SF-001');
      expect(design.components[1]?.sourceFeature).toBe('SF-002');
    });

    it('should generate interfaces from use cases', () => {
      const design = generator.generate(mockSRS);

      const firstComponent = design.components[0];
      expect(firstComponent?.interfaces.length).toBeGreaterThan(0);
    });

    it('should generate traceability matrix', () => {
      const design = generator.generate(mockSRS);

      expect(design.traceabilityMatrix).toHaveLength(2);
      expect(design.traceabilityMatrix[0]?.featureId).toBe('SF-001');
      expect(design.traceabilityMatrix[0]?.componentId).toBe('CMP-001');
    });

    it('should generate API specifications when enabled', () => {
      const design = generator.generate(mockSRS, { generateAPISpecs: true });

      expect(design.apiSpecification.length).toBeGreaterThan(0);
    });

    it('should skip API specifications when disabled', () => {
      const design = generator.generate(mockSRS, { generateAPISpecs: false });

      expect(design.apiSpecification).toHaveLength(0);
    });

    it('should throw InvalidSRSError for empty features', () => {
      const emptySRS: ParsedSRS = {
        ...mockSRS,
        features: [],
      };

      expect(() => generator.generate(emptySRS)).toThrow(InvalidSRSError);
    });

    it('should throw InvalidSRSError for empty document ID', () => {
      const invalidSRS: ParsedSRS = {
        metadata: {
          documentId: '',
          sourcePRD: 'PRD-TEST',
          version: '1.0.0',
          status: 'Draft',
          productName: 'Test Product',
        },
        features: mockSRS.features,
        nfrs: [],
        constraints: [],
        assumptions: [],
      };

      expect(() => generator.generate(invalidSRS)).toThrow(InvalidSRSError);
    });
  });

  describe('designToMarkdown', () => {
    it('should convert design to markdown format', () => {
      const design = generator.generate(mockSRS);
      const markdown = generator.designToMarkdown(design);

      expect(markdown).toContain('# Component Design');
      expect(markdown).toContain('## 1. Component Overview');
      expect(markdown).toContain('## 2. Component Definitions');
      expect(markdown).toContain('## 4. Traceability Matrix');
      expect(markdown).toContain('CMP-001');
      expect(markdown).toContain('SF-001');
    });

    it('should include API specification section when APIs exist', () => {
      const design = generator.generate(mockSRS, { generateAPISpecs: true });
      const markdown = generator.designToMarkdown(design);

      expect(markdown).toContain('## 3. API Specification');
    });
  });

  describe('generateTypeScriptInterfaces', () => {
    it('should generate TypeScript interfaces from design', () => {
      const design = generator.generate(mockSRS, { generateAPISpecs: true });
      const typescript = generator.generateTypeScriptInterfaces(design);

      expect(typescript).toContain('export interface');
      expect(typescript).toContain('readonly');
    });
  });
});

// ============================================================
// InterfaceGenerator Tests
// ============================================================

describe('InterfaceGenerator', () => {
  let generator: InterfaceGenerator;

  beforeEach(() => {
    generator = new InterfaceGenerator();
  });

  describe('generateInterfaces', () => {
    it('should generate interfaces from use cases', () => {
      const useCases = [
        createMockUseCase('UC-001', 'Create User'),
        createMockUseCase('UC-002', 'Get User'),
      ];

      const interfaces = generator.generateInterfaces(useCases);

      expect(interfaces).toHaveLength(2);
      expect(interfaces[0]?.type).toBe('API');
    });

    it('should generate unique interface IDs', () => {
      const useCases = [
        createMockUseCase('UC-001', 'Create User'),
        createMockUseCase('UC-002', 'Get User'),
        createMockUseCase('UC-003', 'Delete User'),
      ];

      const interfaces = generator.generateInterfaces(useCases);

      expect(interfaces[0]?.interfaceId).toBe('API-001');
      expect(interfaces[1]?.interfaceId).toBe('API-002');
      expect(interfaces[2]?.interfaceId).toBe('API-003');
    });

    it('should link interfaces to source use cases', () => {
      const useCases = [createMockUseCase('UC-001', 'Create User')];

      const interfaces = generator.generateInterfaces(useCases);

      expect(interfaces[0]?.sourceUseCase).toBe('UC-001');
    });
  });

  describe('HTTP method detection', () => {
    it('should detect POST for create operations', () => {
      const useCases = [createMockUseCase('UC-001', 'Create User')];
      const interfaces = generator.generateInterfaces(useCases);
      const spec = interfaces[0]?.specification as APIEndpoint;

      expect(spec.method).toBe('POST');
    });

    it('should detect GET for read operations', () => {
      const useCases = [createMockUseCase('UC-001', 'Get User')];
      const interfaces = generator.generateInterfaces(useCases);
      const spec = interfaces[0]?.specification as APIEndpoint;

      expect(spec.method).toBe('GET');
    });

    it('should detect PUT for update operations', () => {
      const useCases = [createMockUseCase('UC-001', 'Update User')];
      const interfaces = generator.generateInterfaces(useCases);
      const spec = interfaces[0]?.specification as APIEndpoint;

      expect(spec.method).toBe('PUT');
    });

    it('should detect DELETE for delete operations', () => {
      const useCases = [createMockUseCase('UC-001', 'Delete User')];
      const interfaces = generator.generateInterfaces(useCases);
      const spec = interfaces[0]?.specification as APIEndpoint;

      expect(spec.method).toBe('DELETE');
    });
  });

  describe('resource detection', () => {
    it('should detect user resource', () => {
      const useCases = [createMockUseCase('UC-001', 'Create User')];
      const interfaces = generator.generateInterfaces(useCases);
      const spec = interfaces[0]?.specification as APIEndpoint;

      expect(spec.endpoint).toContain('users');
    });

    it('should detect project resource', () => {
      const useCases = [createMockUseCase('UC-001', 'Create Project')];
      const interfaces = generator.generateInterfaces(useCases);
      const spec = interfaces[0]?.specification as APIEndpoint;

      expect(spec.endpoint).toContain('projects');
    });
  });

  describe('reset', () => {
    it('should reset interface counters', () => {
      const useCases = [createMockUseCase('UC-001', 'Create User')];

      generator.generateInterfaces(useCases);
      generator.reset();
      const interfaces = generator.generateInterfaces(useCases);

      expect(interfaces[0]?.interfaceId).toBe('API-001');
    });
  });
});

// ============================================================
// APISpecificationGenerator Tests
// ============================================================

describe('APISpecificationGenerator', () => {
  let generator: APISpecificationGenerator;
  let interfaceGenerator: InterfaceGenerator;

  beforeEach(() => {
    generator = new APISpecificationGenerator();
    interfaceGenerator = new InterfaceGenerator();
  });

  describe('extractAPIEndpoints', () => {
    it('should extract endpoints from components', () => {
      const mockSRS = createMockSRS();
      const componentGenerator = new ComponentGenerator();
      const design = componentGenerator.generate(mockSRS);

      const endpoints = generator.extractAPIEndpoints(design.components);

      expect(endpoints.length).toBeGreaterThan(0);
    });
  });

  describe('generateSpecificationTable', () => {
    it('should generate markdown table from endpoints', () => {
      const endpoints: APIEndpoint[] = [
        {
          endpoint: '/api/v1/users',
          method: 'POST',
          description: 'Create a new user',
          request: {
            headers: [],
            pathParams: [],
            queryParams: [],
          },
          response: {
            success: { status: 201, description: 'Created' },
            errors: [],
          },
          authenticated: true,
        },
      ];

      const table = generator.generateSpecificationTable(endpoints);

      expect(table).toContain('## API Specification');
      expect(table).toContain('| Endpoint | Method |');
      expect(table).toContain('/api/v1/users');
      expect(table).toContain('POST');
    });
  });

  describe('generateDetailedDocumentation', () => {
    it('should generate detailed API docs', () => {
      const useCases = [createMockUseCase('UC-001', 'Create User')];
      const interfaces = interfaceGenerator.generateInterfaces(useCases);
      const endpoints = interfaces
        .filter((i) => i.type === 'API')
        .map((i) => i.specification as APIEndpoint);

      const docs = generator.generateDetailedDocumentation(endpoints, interfaces);

      expect(docs).toContain('## API Documentation');
      expect(docs).toContain('#### Request');
      expect(docs).toContain('#### Response');
    });
  });

  describe('generateTypeScriptInterfaces', () => {
    it('should generate TypeScript interfaces from endpoints', () => {
      const useCases = [createMockUseCase('UC-001', 'Create User')];
      const interfaces = interfaceGenerator.generateInterfaces(useCases);
      const endpoints = interfaces
        .filter((i) => i.type === 'API')
        .map((i) => i.specification as APIEndpoint);

      const typescript = generator.generateTypeScriptInterfaces(endpoints);

      expect(typescript).toContain('export interface');
    });
  });

  describe('generateOpenAPISpec', () => {
    it('should generate OpenAPI specification', () => {
      const endpoints: APIEndpoint[] = [
        {
          endpoint: '/api/v1/users',
          method: 'POST',
          description: 'Create a new user',
          request: {
            headers: [],
            pathParams: [],
            queryParams: [],
          },
          response: {
            success: { status: 201, description: 'Created' },
            errors: [{ status: 400, message: 'Bad request' }],
          },
          authenticated: true,
        },
      ];

      const spec = generator.generateOpenAPISpec(endpoints, 'Test API', '1.0.0');

      expect(spec).toContain('openapi: 3.0.3');
      expect(spec).toContain('title: Test API');
      expect(spec).toContain('version: 1.0.0');
      expect(spec).toContain('/api/v1/users:');
    });
  });
});

// ============================================================
// Singleton Tests
// ============================================================

describe('Singleton Pattern', () => {
  beforeEach(() => {
    resetComponentGenerator();
  });

  afterEach(() => {
    resetComponentGenerator();
  });

  it('should return same instance', () => {
    const instance1 = getComponentGenerator();
    const instance2 = getComponentGenerator();

    expect(instance1).toBe(instance2);
  });

  it('should return new instance after reset', () => {
    const instance1 = getComponentGenerator();
    resetComponentGenerator();
    const instance2 = getComponentGenerator();

    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================
// Error Tests
// ============================================================

describe('Error Classes', () => {
  describe('ComponentGeneratorError', () => {
    it('should have correct name and message', () => {
      const error = new ComponentGeneratorError('test error');

      expect(error.name).toBe('ComponentGeneratorError');
      expect(error.message).toBe('test error');
    });
  });

  describe('ComponentGenerationError', () => {
    it('should include component ID and phase', () => {
      const error = new ComponentGenerationError('CMP-001', 'validation', 'invalid input');

      expect(error.name).toBe('ComponentGenerationError');
      expect(error.componentId).toBe('CMP-001');
      expect(error.phase).toBe('validation');
      expect(error.message).toContain('CMP-001');
      expect(error.message).toContain('validation');
    });
  });

  describe('InterfaceGenerationError', () => {
    it('should include interface ID and type', () => {
      const error = new InterfaceGenerationError('API-001', 'API', 'invalid spec');

      expect(error.name).toBe('InterfaceGenerationError');
      expect(error.interfaceId).toBe('API-001');
      expect(error.interfaceType).toBe('API');
    });
  });

  describe('InvalidSRSError', () => {
    it('should include validation errors', () => {
      const error = new InvalidSRSError(['error1', 'error2']);

      expect(error.name).toBe('InvalidSRSError');
      expect(error.errors).toHaveLength(2);
      expect(error.message).toContain('error1');
      expect(error.message).toContain('error2');
    });
  });
});

// ============================================================
// Schema Constants Tests
// ============================================================

describe('Schema Constants', () => {
  it('should export schema version', () => {
    expect(COMPONENT_SCHEMA_VERSION).toBeDefined();
    expect(typeof COMPONENT_SCHEMA_VERSION).toBe('string');
  });

  it('should export valid HTTP methods', () => {
    expect(VALID_HTTP_METHODS).toContain('GET');
    expect(VALID_HTTP_METHODS).toContain('POST');
    expect(VALID_HTTP_METHODS).toContain('PUT');
    expect(VALID_HTTP_METHODS).toContain('PATCH');
    expect(VALID_HTTP_METHODS).toContain('DELETE');
  });

  it('should export valid interface types', () => {
    expect(VALID_INTERFACE_TYPES).toContain('API');
    expect(VALID_INTERFACE_TYPES).toContain('Event');
    expect(VALID_INTERFACE_TYPES).toContain('File');
  });

  it('should export valid component layers', () => {
    expect(VALID_COMPONENT_LAYERS).toContain('presentation');
    expect(VALID_COMPONENT_LAYERS).toContain('application');
    expect(VALID_COMPONENT_LAYERS).toContain('domain');
    expect(VALID_COMPONENT_LAYERS).toContain('infrastructure');
    expect(VALID_COMPONENT_LAYERS).toContain('integration');
  });
});

// ============================================================
// Component Layer Detection Tests
// ============================================================

describe('Component Layer Detection', () => {
  let generator: ComponentGenerator;

  beforeEach(() => {
    resetComponentGenerator();
    generator = new ComponentGenerator();
  });

  afterEach(() => {
    resetComponentGenerator();
  });

  it('should detect presentation layer for UI features', () => {
    const srs: ParsedSRS = {
      ...createMockSRS(),
      features: [createMockFeature('SF-001', 'User Interface Dashboard')],
    };

    const design = generator.generate(srs);

    expect(design.components[0]?.layer).toBe('presentation');
  });

  it('should detect infrastructure layer for database features', () => {
    const srs: ParsedSRS = {
      ...createMockSRS(),
      features: [createMockFeature('SF-001', 'Database Storage Handler')],
    };

    const design = generator.generate(srs);

    expect(design.components[0]?.layer).toBe('infrastructure');
  });

  it('should detect integration layer for external API features', () => {
    const srs: ParsedSRS = {
      ...createMockSRS(),
      features: [createMockFeature('SF-001', 'External API Integration')],
    };

    const design = generator.generate(srs);

    expect(design.components[0]?.layer).toBe('integration');
  });
});

// ============================================================
// Component Name Generation Tests
// ============================================================

describe('Component Name Generation', () => {
  let generator: ComponentGenerator;

  beforeEach(() => {
    resetComponentGenerator();
    generator = new ComponentGenerator();
  });

  afterEach(() => {
    resetComponentGenerator();
  });

  it('should generate Service suffix for process features', () => {
    const srs: ParsedSRS = {
      ...createMockSRS(),
      features: [createMockFeature('SF-001', 'Data Processing')],
    };

    const design = generator.generate(srs);

    expect(design.components[0]?.name).toContain('Service');
  });

  it('should generate Manager suffix for management features', () => {
    const srs: ParsedSRS = {
      ...createMockSRS(),
      features: [createMockFeature('SF-001', 'Task Manager')],
    };

    const design = generator.generate(srs);

    expect(design.components[0]?.name).toContain('Manager');
  });

  it('should convert feature name to PascalCase', () => {
    const srs: ParsedSRS = {
      ...createMockSRS(),
      features: [createMockFeature('SF-001', 'user-data-handler')],
    };

    const design = generator.generate(srs);

    expect(design.components[0]?.name).toMatch(/^[A-Z]/);
    expect(design.components[0]?.name).not.toContain('-');
  });
});
