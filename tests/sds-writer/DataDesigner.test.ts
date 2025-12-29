import { describe, it, expect } from 'vitest';
import { DataDesigner } from '../../src/sds-writer/DataDesigner.js';
import type {
  SDSComponent,
  ParsedSRSFeature,
} from '../../src/sds-writer/types.js';

describe('DataDesigner', () => {
  const createComponent = (
    id: string,
    name: string,
    options: {
      description?: string;
      responsibility?: string;
      interfaces?: SDSComponent['interfaces'];
    } = {}
  ): SDSComponent => ({
    id,
    name,
    description: options.description ?? `Description for ${name}`,
    responsibility: options.responsibility ?? `Responsibility for ${name}`,
    sourceFeature: 'SF-001',
    priority: 'P1',
    interfaces: options.interfaces ?? [],
    dependencies: [],
    implementationNotes: 'Notes',
  });

  const createFeature = (
    id: string,
    name: string,
    options: {
      acceptanceCriteria?: string[];
    } = {}
  ): ParsedSRSFeature => ({
    id,
    name,
    description: `Description for ${name}`,
    priority: 'P1',
    sourceRequirements: ['FR-001'],
    useCaseIds: ['UC-001'],
    acceptanceCriteria: options.acceptanceCriteria ?? [],
  });

  describe('constructor', () => {
    it('should create designer with default options', () => {
      const designer = new DataDesigner();
      expect(designer).toBeInstanceOf(DataDesigner);
    });

    it('should accept custom options', () => {
      const designer = new DataDesigner({
        generateIndexes: false,
        includeTimestamps: false,
        includeSoftDelete: true,
      });
      expect(designer).toBeInstanceOf(DataDesigner);
    });
  });

  describe('design', () => {
    it('should design data models from components', () => {
      const designer = new DataDesigner();
      const components = [
        createComponent('CMP-001', 'UserRepository', {
          description: 'Manages user data storage',
        }),
      ];
      const features = [createFeature('SF-001', 'User Management')];

      const result = designer.design(components, features);

      expect(result.models.length).toBeGreaterThan(0);
      expect(result.failedComponents.length).toBe(0);
    });

    it('should not create model for non-data components', () => {
      const designer = new DataDesigner();
      const components = [
        createComponent('CMP-001', 'LogFormatter', {
          description: 'Utility for formatting logs',
          responsibility: 'Formats log messages',
        }),
      ];
      const features: ParsedSRSFeature[] = [];

      const result = designer.design(components, features);

      // LogFormatter doesn't match data indicators
      expect(result.models.length).toBe(0);
    });

    it('should create model for repository components', () => {
      const designer = new DataDesigner();
      const components = [
        createComponent('CMP-001', 'OrderRepository', {
          description: 'Stores order records',
        }),
      ];
      const features: ParsedSRSFeature[] = [];

      const result = designer.design(components, features);

      expect(result.models.length).toBe(1);
      expect(result.models[0].name).toBe('Order');
    });

    it('should include timestamps when enabled', () => {
      const designer = new DataDesigner({ includeTimestamps: true });
      const components = [
        createComponent('CMP-001', 'UserStore', {
          description: 'User data storage',
        }),
      ];

      const result = designer.design(components, []);

      const model = result.models[0];
      expect(model.properties.some((p) => p.name === 'createdAt')).toBe(true);
      expect(model.properties.some((p) => p.name === 'updatedAt')).toBe(true);
    });

    it('should include soft delete when enabled', () => {
      const designer = new DataDesigner({ includeSoftDelete: true });
      const components = [
        createComponent('CMP-001', 'UserStore', {
          description: 'User data storage',
        }),
      ];

      const result = designer.design(components, []);

      const model = result.models[0];
      expect(model.properties.some((p) => p.name === 'deletedAt')).toBe(true);
    });
  });

  describe('designModel', () => {
    it('should generate model ID with proper format', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'ProductRepository');

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 5,
      });

      expect(model?.id).toBe('DM-005');
    });

    it('should extract model name from component name', () => {
      const designer = new DataDesigner();

      const testCases = [
        { input: 'UserRepository', expected: 'User' },
        { input: 'ProductService', expected: 'Product' },
        { input: 'OrderManager', expected: 'Order' },
        { input: 'PaymentHandler', expected: 'Payment' },
      ];

      for (const { input, expected } of testCases) {
        const component = createComponent('CMP-001', input);
        const model = designer.designModel({
          component,
          features: [],
          modelIndex: 1,
        });

        expect(model?.name).toBe(expected);
      }
    });

    it('should always include id property', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'UserStore');

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      const idProp = model?.properties.find((p) => p.name === 'id');
      expect(idProp).toBeDefined();
      expect(idProp?.required).toBe(true);
      expect(idProp?.validation).toContain('uuid');
    });
  });

  describe('property extraction', () => {
    it('should extract properties from interface methods', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'UserRepository', {
        interfaces: [
          {
            name: 'IUserRepository',
            methods: [
              {
                name: 'createUser',
                signature: 'createUser(email: string): User',
                returnType: 'User',
                parameters: [
                  { name: 'email', type: 'string', optional: false },
                  { name: 'name', type: 'string', optional: true },
                ],
              },
            ],
            rawCode: '',
          },
        ],
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.properties.some((p) => p.name === 'email')).toBe(true);
      expect(model?.properties.some((p) => p.name === 'name')).toBe(true);
    });

    it('should extract properties from feature acceptance criteria', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'UserStore');
      const features = [
        createFeature('SF-001', 'User Registration', {
          acceptanceCriteria: ['User must provide email address', 'User must set username'],
        }),
      ];

      const model = designer.designModel({
        component,
        features,
        modelIndex: 1,
      });

      expect(model?.properties.some((p) => p.name === 'email')).toBe(true);
      expect(model?.properties.some((p) => p.name === 'username')).toBe(true);
    });

    it('should extract properties from component description', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'ProductStore', {
        description: 'Stores product name, title, and description',
        responsibility: 'Manages product data with price information',
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.properties.some((p) => p.name === 'name')).toBe(true);
      expect(model?.properties.some((p) => p.name === 'title')).toBe(true);
      expect(model?.properties.some((p) => p.name === 'description')).toBe(true);
    });
  });

  describe('index generation', () => {
    it('should generate indexes when enabled', () => {
      const designer = new DataDesigner({ generateIndexes: true });
      const component = createComponent('CMP-001', 'UserStore', {
        description: 'User storage with email and username',
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.indexes).toBeDefined();
      expect(model?.indexes?.length).toBeGreaterThan(0);
    });

    it('should not generate indexes when disabled', () => {
      const designer = new DataDesigner({ generateIndexes: false });
      const component = createComponent('CMP-001', 'UserStore');

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.indexes).toBeUndefined();
    });

    it('should generate unique index for email', () => {
      const designer = new DataDesigner({ generateIndexes: true });
      const component = createComponent('CMP-001', 'UserStore', {
        description: 'Stores user email addresses',
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      const emailIndex = model?.indexes?.find((i) => i.fields.includes('email'));
      expect(emailIndex?.unique).toBe(true);
    });

    it('should generate primary key index', () => {
      const designer = new DataDesigner({ generateIndexes: true });
      const component = createComponent('CMP-001', 'UserStore');

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      const pkIndex = model?.indexes?.find((i) => i.fields.includes('id'));
      expect(pkIndex).toBeDefined();
      expect(pkIndex?.unique).toBe(true);
    });
  });

  describe('category determination', () => {
    it('should detect aggregate category', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'OrderAggregateStore', {
        description: 'Aggregate root for orders',
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.category).toBe('aggregate');
    });

    it('should detect value_object category', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'AddressStore', {
        description: 'Immutable value object for addresses',
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.category).toBe('value_object');
    });

    it('should detect enum category', () => {
      const designer = new DataDesigner();
      const component = createComponent('CMP-001', 'OrderStatusStore', {
        description: 'Manages order status enum values',
      });

      const model = designer.designModel({
        component,
        features: [],
        modelIndex: 1,
      });

      expect(model?.category).toBe('enum');
    });
  });

  describe('relationship resolution', () => {
    it('should detect relationships from foreign key properties', () => {
      const designer = new DataDesigner();
      const components = [
        createComponent('CMP-001', 'OrderRepository', {
          interfaces: [
            {
              name: 'IOrderRepository',
              methods: [
                {
                  name: 'create',
                  signature: 'create(userId: string): Order',
                  returnType: 'Order',
                  parameters: [{ name: 'userId', type: 'string', optional: false }],
                },
              ],
              rawCode: '',
            },
          ],
        }),
        createComponent('CMP-002', 'UserRepository'),
      ];

      const result = designer.design(components, []);

      const orderModel = result.models.find((m) => m.name === 'Order');
      expect(orderModel?.relationships.length).toBeGreaterThan(0);
      expect(orderModel?.relationships[0].target).toBe('User');
    });
  });

  describe('error handling', () => {
    it('should track failed components', () => {
      const designer = new DataDesigner();
      // This won't fail normally, but demonstrates the structure
      const components = [createComponent('CMP-001', 'UserRepository')];

      const result = designer.design(components, []);

      expect(result.failedComponents).toBeDefined();
      expect(Array.isArray(result.failedComponents)).toBe(true);
    });

    it('should collect warnings', () => {
      const designer = new DataDesigner();
      const components = [createComponent('CMP-001', 'UserRepository')];

      const result = designer.design(components, []);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
