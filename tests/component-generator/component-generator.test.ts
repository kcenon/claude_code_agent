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
// Interface Type Detection Tests
// ============================================================

describe('Interface Type Detection', () => {
  let generator: InterfaceGenerator;

  beforeEach(() => {
    generator = new InterfaceGenerator();
  });

  // Note: Event, File, Message, and Callback interface types are detected but
  // not yet implemented (only API interfaces are generated). These tests verify
  // that the detection logic correctly identifies non-API types and skips them.

  it('should skip Event interface type for event operations (not implemented)', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Notify User Event',
      description: 'Triggers notification event when user action occurs',
      actor: 'System',
      preconditions: [],
      mainFlow: ['System triggers event'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    // Non-API interface types are detected but not generated
    expect(interfaces.length).toBe(0);
  });

  it('should skip File interface type for file operations (not implemented)', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Export Report to File',
      description: 'Exports report data to file',
      actor: 'User',
      preconditions: [],
      mainFlow: ['User exports file'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    expect(interfaces.length).toBe(0);
  });

  it('should skip Message interface type for messaging operations (not implemented)', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Send Message to Queue',
      description: 'Sends message to the queue system',
      actor: 'System',
      preconditions: [],
      mainFlow: ['System sends message'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    expect(interfaces.length).toBe(0);
  });

  it('should skip Callback interface type for webhook operations (not implemented)', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Handle Webhook Callback',
      description: 'Processes callback from external service',
      actor: 'External System',
      preconditions: [],
      mainFlow: ['Receive callback'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    expect(interfaces.length).toBe(0);
  });
});

// ============================================================
// HTTP Method Detection Additional Tests
// ============================================================

describe('HTTP Method Detection Additional', () => {
  let generator: InterfaceGenerator;

  beforeEach(() => {
    generator = new InterfaceGenerator();
  });

  it('should detect POST for add operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Add Item')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('POST');
  });

  it('should detect POST for register operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Register User')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('POST');
  });

  it('should detect POST for submit operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Submit Form')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('POST');
  });

  it('should detect POST for upload operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Upload Document')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('POST');
  });

  it('should detect GET for view operations', () => {
    const useCases = [createMockUseCase('UC-001', 'View Report')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('GET');
  });

  it('should detect GET for list operations', () => {
    const useCases = [createMockUseCase('UC-001', 'List Users')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('GET');
  });

  it('should detect GET for fetch operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Fetch Data')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('GET');
  });

  it('should detect GET for retrieve operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Retrieve Document')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('GET');
  });

  it('should detect GET for search operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Search Products')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('GET');
  });

  it('should detect PUT for edit operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Edit User Data')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('PUT');
  });

  it('should detect PATCH for modify operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Modify Settings')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('PATCH');
  });

  it('should detect PATCH for patch operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Patch Record')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('PATCH');
  });

  it('should detect DELETE for remove operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Remove Item')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('DELETE');
  });

  it('should detect DELETE for cancel operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Cancel Order')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('DELETE');
  });

  it('should default to GET for unknown operations', () => {
    const useCases = [createMockUseCase('UC-001', 'Process Something')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.method).toBe('GET');
  });
});

// ============================================================
// Resource Detection Additional Tests
// ============================================================

describe('Resource Detection Additional', () => {
  let generator: InterfaceGenerator;

  beforeEach(() => {
    generator = new InterfaceGenerator();
  });

  it('should detect account resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Create Account')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('accounts');
  });

  it('should detect document resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Create Document')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('documents');
  });

  // Note: 'file' resource cannot be tested as it triggers File interface type detection

  it('should detect order resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Create Order')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('orders');
  });

  it('should detect product resource', () => {
    const useCases = [createMockUseCase('UC-001', 'List Products')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('products');
  });

  it('should detect item resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Add Item')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('items');
  });

  it('should detect task resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Create Task')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('tasks');
  });

  it('should detect issue resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Report Issue')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('issues');
  });

  it('should detect report resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Generate Report')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('reports');
  });

  it('should detect setting resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Update Setting')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('settings');
  });

  it('should detect config resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Save Config')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('configurations');
  });

  // Note: 'message' resource cannot be tested as it triggers Message interface type detection

  it('should detect notification resource', () => {
    const useCases = [createMockUseCase('UC-001', 'List Notification Records')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('notifications');
  });

  it('should detect agent resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Deploy Agent')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('agents');
  });

  it('should detect workflow resource', () => {
    const useCases = [createMockUseCase('UC-001', 'Start Workflow')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('workflows');
  });

  it('should use fallback resource name for unknown resources', () => {
    const useCases = [createMockUseCase('UC-001', 'Do Something Special')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('/api/v1/');
  });

  it('should pluralize singular resource from use case name', () => {
    const useCases = [createMockUseCase('UC-001', 'Process Widget')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.endpoint).toContain('widgets');
  });
});

// ============================================================
// Authentication Detection Tests
// ============================================================

describe('Authentication Detection', () => {
  let generator: InterfaceGenerator;

  beforeEach(() => {
    generator = new InterfaceGenerator();
  });

  it('should not require auth for public endpoints', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'View Public Content',
      description: 'Shows public information',
      actor: 'Guest',
      preconditions: [],
      mainFlow: ['View content'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(false);
  });

  it('should not require auth for guest endpoints', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Browse as Guest',
      description: 'Guest access to browse',
      actor: 'Guest',
      preconditions: [],
      mainFlow: ['Browse items'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(false);
  });

  it('should not require auth for anonymous endpoints', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Anonymous Feedback',
      description: 'Submit anonymous feedback',
      actor: 'Anonymous',
      preconditions: [],
      mainFlow: ['Submit feedback'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(false);
  });

  it('should not require auth for login endpoint', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'User Login',
      description: 'User logs into system',
      actor: 'User',
      preconditions: [],
      mainFlow: ['Enter credentials'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(false);
  });

  it('should not require auth for register endpoint', () => {
    const useCases = [createMockUseCase('UC-001', 'Register New User')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(false);
  });

  it('should not require auth for signup endpoint', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'User Signup',
      description: 'New user signup',
      actor: 'User',
      preconditions: [],
      mainFlow: ['Enter details'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(false);
  });

  it('should require auth by default', () => {
    const useCases = [createMockUseCase('UC-001', 'Update User Data')];
    const interfaces = generator.generateInterfaces(useCases);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.authenticated).toBe(true);
  });
});

// ============================================================
// Field Extraction Tests
// ============================================================

describe('Field Extraction from Steps', () => {
  let generator: InterfaceGenerator;

  beforeEach(() => {
    generator = new InterfaceGenerator();
  });

  it('should extract name field from step', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Create Item',
      description: 'Creates a new item',
      actor: 'User',
      preconditions: [],
      mainFlow: ['User enters name'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.request.body?.fields.some((f) => f.name === 'name')).toBe(true);
  });

  it('should extract email field from step', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Create User',
      description: 'Creates a new user',
      actor: 'User',
      preconditions: [],
      mainFlow: ['User provides email address'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.request.body?.fields.some((f) => f.name === 'email')).toBe(true);
  });

  it('should extract password field from step', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Create Account',
      description: 'Creates account',
      actor: 'User',
      preconditions: [],
      mainFlow: ['User enters password'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.request.body?.fields.some((f) => f.name === 'password')).toBe(true);
  });

  it('should extract multiple field types from steps', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Create Item',
      description: 'Creates item with all details',
      actor: 'User',
      preconditions: [],
      mainFlow: [
        'User enters title and description',
        'User sets priority and status',
        'User specifies count and amount',
        'User toggles enabled flag',
        'User adds tags and items',
        'User sets date and timestamp',
        'User enters url and path',
        'User adds config and metadata',
      ],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;

    expect(spec.request.body?.fields.some((f) => f.name === 'title')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'description')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'priority')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'status')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'count')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'amount')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'enabled')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'tags')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'items')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'date')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'timestamp')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'url')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'path')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'config')).toBe(true);
    expect(spec.request.body?.fields.some((f) => f.name === 'metadata')).toBe(true);
  });

  it('should mark field as required when step contains required', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Create Item',
      description: 'Creates item',
      actor: 'User',
      preconditions: [],
      mainFlow: ['User must enter required name'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    const nameField = spec.request.body?.fields.find((f) => f.name === 'name');
    expect(nameField?.required).toBe(true);
  });

  it('should add default data field when no fields extracted', () => {
    const useCase: SRSUseCase = {
      id: 'UC-001',
      name: 'Create Widget',
      description: 'Creates widget',
      actor: 'User',
      preconditions: [],
      mainFlow: ['User submits form'],
      alternativeFlows: [],
      postconditions: [],
    };

    const interfaces = generator.generateInterfaces([useCase]);
    const spec = interfaces[0]?.specification as APIEndpoint;
    expect(spec.request.body?.fields.some((f) => f.name === 'data')).toBe(true);
  });
});

// ============================================================
// API Specification Generator Additional Tests
// ============================================================

describe('APISpecificationGenerator Additional', () => {
  let generator: APISpecificationGenerator;

  beforeEach(() => {
    generator = new APISpecificationGenerator();
  });

  it('should generate rate limit in table when present', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/users',
        method: 'POST',
        description: 'Create user',
        request: { headers: [], pathParams: [], queryParams: [] },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
        rateLimit: { requests: 100, window: 60 },
      },
    ];

    const table = generator.generateSpecificationTable(endpoints);
    expect(table).toContain('100/60s');
  });

  it('should handle endpoints with headers in documentation', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/users',
        method: 'POST',
        description: 'Create user',
        request: {
          headers: [{ name: 'Authorization', description: 'Bearer token', required: true }],
          pathParams: [],
          queryParams: [],
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const interfaceGen = new InterfaceGenerator();
    const ifaces = interfaceGen.generateInterfaces([createMockUseCase('UC-001', 'Create User')]);
    const docs = generator.generateDetailedDocumentation(endpoints, ifaces);

    expect(docs).toContain('**Headers**');
    expect(docs).toContain('Authorization');
  });

  it('should handle endpoints with path params in documentation', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/users/{id}',
        method: 'GET',
        description: 'Get user',
        request: {
          headers: [],
          pathParams: [{ name: 'id', type: 'string', description: 'User ID', required: true }],
          queryParams: [],
        },
        response: { success: { status: 200, description: 'OK' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('**Path Parameters**');
  });

  it('should handle endpoints with query params in documentation', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/users',
        method: 'GET',
        description: 'List users',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [
            { name: 'page', type: 'number', description: 'Page number', required: false, default: '1' },
          ],
        },
        response: { success: { status: 200, description: 'OK' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('**Query Parameters**');
    expect(docs).toContain('Default');
  });

  it('should handle endpoints with request body in documentation', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/users',
        method: 'POST',
        description: 'Create user',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'name', type: 'string', description: 'Name', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('**Request Body**');
  });

  it('should handle endpoints with response body in documentation', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/users',
        method: 'GET',
        description: 'Get user',
        request: { headers: [], pathParams: [], queryParams: [] },
        response: {
          success: {
            status: 200,
            description: 'OK',
            body: {
              contentType: 'application/json',
              fields: [{ name: 'id', type: 'string', description: 'ID', required: true }],
            },
          },
          errors: [],
        },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('**Success Response**');
  });

  it('should generate example for number fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'count', type: 'number', description: 'Count', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"count": 0');
  });

  it('should generate example for boolean fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'enabled', type: 'boolean', description: 'Enabled', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"enabled": true');
  });

  it('should generate example for array fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'tags', type: 'array', description: 'Tags', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"tags": []');
  });

  it('should generate example for object fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'metadata', type: 'object', description: 'Metadata', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"metadata": {}');
  });

  it('should generate example for null fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'optional', type: 'null', description: 'Optional', required: false }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"optional": null');
  });

  it('should generate example for file fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/files',
        method: 'POST',
        description: 'Upload file',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'multipart/form-data',
            fields: [{ name: 'file', type: 'file', description: 'File', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"file": "binary"');
  });

  it('should generate example for date fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/events',
        method: 'POST',
        description: 'Create event',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [{ name: 'startDate', type: 'date', description: 'Start date', required: true }],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    // Date example should be an ISO string
    expect(docs).toContain('startDate');
  });

  it('should use example from body if provided', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [],
            example: { custom: 'example' },
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('"custom": "example"');
  });

  it('should generate object with nested fields example', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [
              {
                name: 'nested',
                type: 'object',
                description: 'Nested',
                required: true,
                fields: [{ name: 'inner', type: 'string', description: 'Inner', required: true }],
              },
            ],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const docs = generator.generateDetailedDocumentation(endpoints, []);
    expect(docs).toContain('nested');
    expect(docs).toContain('inner');
  });

  it('should generate TypeScript types for various field types', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [
              { name: 'str', type: 'string', description: 'String', required: true },
              { name: 'num', type: 'number', description: 'Number', required: true },
              { name: 'bool', type: 'boolean', description: 'Boolean', required: true },
              { name: 'date', type: 'date', description: 'Date', required: true },
              { name: 'arr', type: 'array', description: 'Array', required: true },
              { name: 'obj', type: 'object', description: 'Object', required: true },
              { name: 'nil', type: 'null', description: 'Null', required: false },
              { name: 'file', type: 'file', description: 'File', required: true },
            ],
          },
        },
        response: {
          success: {
            status: 201,
            description: 'Created',
            body: {
              contentType: 'application/json',
              fields: [{ name: 'id', type: 'string', description: 'ID', required: true }],
            },
          },
          errors: [],
        },
        authenticated: true,
      },
    ];

    const ts = generator.generateTypeScriptInterfaces(endpoints);
    expect(ts).toContain('str: string');
    expect(ts).toContain('num: number');
    expect(ts).toContain('bool: boolean');
    expect(ts).toContain('arr: unknown[]');
  });

  it('should generate TypeScript for array with item type', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [
              { name: 'tags', type: 'array', description: 'Tags', required: true, items: 'string' },
            ],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const ts = generator.generateTypeScriptInterfaces(endpoints);
    expect(ts).toContain('tags: string[]');
  });

  it('should generate TypeScript for object with nested fields', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [
              {
                name: 'nested',
                type: 'object',
                description: 'Nested',
                required: true,
                fields: [{ name: 'inner', type: 'string', description: 'Inner', required: true }],
              },
            ],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const ts = generator.generateTypeScriptInterfaces(endpoints);
    expect(ts).toContain('nested: { inner: string }');
  });

  it('should handle optional fields in TypeScript', () => {
    const endpoints: APIEndpoint[] = [
      {
        endpoint: '/api/v1/items',
        method: 'POST',
        description: 'Create item',
        request: {
          headers: [],
          pathParams: [],
          queryParams: [],
          body: {
            contentType: 'application/json',
            fields: [
              { name: 'required', type: 'string', description: 'Required', required: true },
              { name: 'optional', type: 'string', description: 'Optional', required: false },
            ],
          },
        },
        response: { success: { status: 201, description: 'Created' }, errors: [] },
        authenticated: true,
      },
    ];

    const ts = generator.generateTypeScriptInterfaces(endpoints);
    expect(ts).toContain('required: string');
    expect(ts).toContain('optional?: string');
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
