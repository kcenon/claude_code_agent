/**
 * Data Designer module
 *
 * Designs data models from components and features, generating
 * entity definitions, relationships, and database schemas.
 */

import type {
  ParsedSRSFeature,
  SDSComponent,
  DataModel,
  DataProperty,
  DataRelationship,
  DataIndex,
  DataTypeCategory,
  DataModelDesignInput,
} from './types.js';

/**
 * Data designer options
 */
export interface DataDesignerOptions {
  /** Default category for data models */
  readonly defaultCategory?: DataTypeCategory;
  /** Generate indexes automatically */
  readonly generateIndexes?: boolean;
  /** Include timestamps (createdAt, updatedAt) */
  readonly includeTimestamps?: boolean;
  /** Include soft delete (deletedAt) */
  readonly includeSoftDelete?: boolean;
}

/**
 * Default designer options
 */
const DEFAULT_OPTIONS: Required<DataDesignerOptions> = {
  defaultCategory: 'entity',
  generateIndexes: true,
  includeTimestamps: true,
  includeSoftDelete: false,
};

/**
 * Data design result
 */
export interface DataDesignResult {
  /** Designed data models */
  readonly models: readonly DataModel[];
  /** Components that could not be processed */
  readonly failedComponents: readonly string[];
  /** Design warnings */
  readonly warnings: readonly string[];
}

/**
 * Designer for data models from components
 */
export class DataDesigner {
  private readonly options: Required<DataDesignerOptions>;

  constructor(options: DataDesignerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Design data models from components
   * @param components - SDS components
   * @param features - Related features
   * @returns Data design result
   */
  public design(
    components: readonly SDSComponent[],
    features: readonly ParsedSRSFeature[]
  ): DataDesignResult {
    const models: DataModel[] = [];
    const failedComponents: string[] = [];
    const warnings: string[] = [];

    // Create feature lookup
    const featureById = new Map<string, ParsedSRSFeature>();
    for (const feature of features) {
      featureById.set(feature.id, feature);
    }

    let modelIndex = 1;

    for (const component of components) {
      try {
        // Get related features
        const relatedFeatures = this.getRelatedFeatures(component, featureById);

        const input: DataModelDesignInput = {
          component,
          features: relatedFeatures,
          modelIndex,
        };

        const model = this.designModel(input);
        if (model) {
          models.push(model);
          modelIndex++;
        }
      } catch (error) {
        failedComponents.push(component.id);
        if (error instanceof Error) {
          warnings.push(`Component ${component.id}: ${error.message}`);
        }
      }
    }

    // Resolve relationships between models
    const modelsWithRelationships = this.resolveRelationships(models);

    return {
      models: modelsWithRelationships,
      failedComponents,
      warnings,
    };
  }

  /**
   * Design a single data model from a component
   * @param input
   */
  public designModel(input: DataModelDesignInput): DataModel | null {
    const { component, features, modelIndex } = input;

    // Check if component needs a data model
    if (!this.needsDataModel(component)) {
      return null;
    }

    // Generate model ID and name
    const modelId = `DM-${String(modelIndex).padStart(3, '0')}`;
    const modelName = this.extractModelName(component.name);

    // Determine category
    const category = this.determineCategory(component, features);

    // Extract properties from component and features
    const properties = this.extractProperties(component, features);

    // Add standard properties
    const allProperties = this.addStandardProperties(properties);

    // Generate indexes
    const indexes = this.options.generateIndexes
      ? this.generateIndexes(modelName, allProperties)
      : undefined;

    const baseModel = {
      id: modelId,
      name: modelName,
      category,
      description: this.generateDescription(component),
      sourceComponent: component.id,
      properties: allProperties,
      relationships: [], // Will be resolved later
    };

    if (indexes !== undefined && indexes.length > 0) {
      return { ...baseModel, indexes };
    }

    return baseModel;
  }

  /**
   * Get related features for a component
   * @param component
   * @param featureById
   */
  private getRelatedFeatures(
    component: SDSComponent,
    featureById: Map<string, ParsedSRSFeature>
  ): readonly ParsedSRSFeature[] {
    const features: ParsedSRSFeature[] = [];

    const sourceFeature = featureById.get(component.sourceFeature);
    if (sourceFeature) {
      features.push(sourceFeature);
    }

    return features;
  }

  /**
   * Check if a component needs a data model
   * @param component
   */
  private needsDataModel(component: SDSComponent): boolean {
    const nameLower = component.name.toLowerCase();
    const descLower = (component.description + ' ' + component.responsibility).toLowerCase();

    // Components that typically need data models
    const dataIndicators = [
      'repository',
      'store',
      'storage',
      'database',
      'data',
      'entity',
      'model',
      'record',
      'collection',
      'user',
      'account',
      'profile',
      'item',
      'product',
      'order',
      'payment',
      'transaction',
      'session',
      'token',
      'config',
      'setting',
    ];

    for (const indicator of dataIndicators) {
      if (nameLower.includes(indicator) || descLower.includes(indicator)) {
        return true;
      }
    }

    // Check interfaces for CRUD-like operations
    for (const iface of component.interfaces) {
      for (const method of iface.methods) {
        const methodLower = method.name.toLowerCase();
        if (
          methodLower.startsWith('create') ||
          methodLower.startsWith('save') ||
          methodLower.startsWith('get') ||
          methodLower.startsWith('find') ||
          methodLower.startsWith('update') ||
          methodLower.startsWith('delete')
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract model name from component name
   * @param componentName
   */
  private extractModelName(componentName: string): string {
    return componentName
      .replace(
        /(Manager|Service|Controller|Handler|Repository|Provider|Gateway|Adapter|Factory)$/,
        ''
      )
      .trim();
  }

  /**
   * Determine data model category
   * @param component
   * @param features
   */
  private determineCategory(
    component: SDSComponent,
    features: readonly ParsedSRSFeature[]
  ): DataTypeCategory {
    const fullText = [
      component.name,
      component.description,
      ...features.map((f) => f.name + ' ' + f.description),
    ]
      .join(' ')
      .toLowerCase();

    if (fullText.includes('aggregate') || fullText.includes('root')) {
      return 'aggregate';
    }
    if (fullText.includes('value object') || fullText.includes('immutable')) {
      return 'value_object';
    }
    if (
      fullText.includes('status') ||
      fullText.includes('type') ||
      fullText.includes('category') ||
      fullText.includes('enum')
    ) {
      return 'enum';
    }

    return this.options.defaultCategory;
  }

  /**
   * Extract properties from component and features
   * @param component
   * @param features
   */
  private extractProperties(
    component: SDSComponent,
    features: readonly ParsedSRSFeature[]
  ): DataProperty[] {
    const properties: DataProperty[] = [];
    const seenNames = new Set<string>();

    // Always add ID
    properties.push({
      name: 'id',
      type: 'string',
      required: true,
      description: 'Unique identifier',
      validation: ['uuid'],
    });
    seenNames.add('id');

    // Extract from interfaces
    for (const iface of component.interfaces) {
      for (const method of iface.methods) {
        if (method.parameters) {
          for (const param of method.parameters) {
            if (!seenNames.has(param.name) && !this.isSystemParam(param.name)) {
              seenNames.add(param.name);
              const baseProp = {
                name: param.name,
                type: this.mapToDataType(param.type),
                required: !param.optional,
              };
              if (param.description !== undefined) {
                properties.push({ ...baseProp, description: param.description });
              } else {
                properties.push(baseProp);
              }
            }
          }
        }
      }
    }

    // Extract from feature acceptance criteria
    for (const feature of features) {
      const extracted = this.extractPropertiesFromCriteria(feature.acceptanceCriteria);
      for (const prop of extracted) {
        if (!seenNames.has(prop.name)) {
          seenNames.add(prop.name);
          properties.push(prop);
        }
      }
    }

    // Extract from component description
    const descProps = this.extractPropertiesFromText(
      component.description + ' ' + component.responsibility
    );
    for (const prop of descProps) {
      if (!seenNames.has(prop.name)) {
        seenNames.add(prop.name);
        properties.push(prop);
      }
    }

    return properties;
  }

  /**
   * Check if parameter is a system parameter (not for data model)
   * @param name
   */
  private isSystemParam(name: string): boolean {
    const systemParams = [
      'options',
      'config',
      'context',
      'callback',
      'handler',
      'listener',
      'observer',
      'factory',
    ];
    return systemParams.includes(name.toLowerCase());
  }

  /**
   * Map TypeScript type to data model type
   * @param tsType
   */
  private mapToDataType(tsType: string): string {
    const typeLower = tsType.toLowerCase();

    if (typeLower.includes('string')) return 'string';
    if (typeLower.includes('number') || typeLower.includes('int')) return 'number';
    if (typeLower.includes('boolean') || typeLower.includes('bool')) return 'boolean';
    if (typeLower.includes('date')) return 'datetime';
    if (typeLower.includes('array') || typeLower.includes('[]')) return 'array';
    if (typeLower.includes('object') || typeLower.includes('record')) return 'json';

    return 'string';
  }

  /**
   * Extract properties from acceptance criteria
   * @param criteria
   */
  private extractPropertiesFromCriteria(criteria: readonly string[]): DataProperty[] {
    const fullText = criteria.join(' ');
    return this.extractPropertiesFromText(fullText);
  }

  /**
   * Extract properties from text
   * @param text
   */
  private extractPropertiesFromText(text: string): DataProperty[] {
    const properties: DataProperty[] = [];
    const textLower = text.toLowerCase();

    // Common property patterns
    const patterns: Array<{
      pattern: RegExp;
      name: string;
      type: string;
      description: string;
      validation?: string[];
    }> = [
      {
        pattern: /email/i,
        name: 'email',
        type: 'string',
        description: 'Email address',
        validation: ['email'],
      },
      {
        pattern: /password/i,
        name: 'passwordHash',
        type: 'string',
        description: 'Hashed password',
      },
      {
        pattern: /username/i,
        name: 'username',
        type: 'string',
        description: 'Username',
        validation: ['minLength:3', 'maxLength:50'],
      },
      { pattern: /name/i, name: 'name', type: 'string', description: 'Name' },
      { pattern: /title/i, name: 'title', type: 'string', description: 'Title' },
      { pattern: /description/i, name: 'description', type: 'text', description: 'Description' },
      { pattern: /status/i, name: 'status', type: 'string', description: 'Current status' },
      { pattern: /type/i, name: 'type', type: 'string', description: 'Type classification' },
      {
        pattern: /amount|price|cost/i,
        name: 'amount',
        type: 'decimal',
        description: 'Monetary amount',
      },
      { pattern: /quantity|count/i, name: 'quantity', type: 'integer', description: 'Quantity' },
      {
        pattern: /active|enabled/i,
        name: 'isActive',
        type: 'boolean',
        description: 'Active status',
      },
      {
        pattern: /url|link/i,
        name: 'url',
        type: 'string',
        description: 'URL',
        validation: ['url'],
      },
      { pattern: /phone/i, name: 'phone', type: 'string', description: 'Phone number' },
      { pattern: /address/i, name: 'address', type: 'text', description: 'Address' },
      {
        pattern: /image|photo|avatar/i,
        name: 'imageUrl',
        type: 'string',
        description: 'Image URL',
      },
      { pattern: /content|body|text/i, name: 'content', type: 'text', description: 'Content' },
      { pattern: /metadata/i, name: 'metadata', type: 'json', description: 'Additional metadata' },
    ];

    for (const { pattern, name, type, description, validation } of patterns) {
      if (pattern.test(textLower)) {
        const baseProp = {
          name,
          type,
          required: false as const,
          description,
        };
        if (validation !== undefined) {
          properties.push({ ...baseProp, validation });
        } else {
          properties.push(baseProp);
        }
      }
    }

    return properties;
  }

  /**
   * Add standard properties to model
   * @param properties
   */
  private addStandardProperties(properties: readonly DataProperty[]): DataProperty[] {
    const allProps = [...properties];

    if (this.options.includeTimestamps) {
      if (!allProps.find((p) => p.name === 'createdAt')) {
        allProps.push({
          name: 'createdAt',
          type: 'datetime',
          required: true,
          description: 'Creation timestamp',
        });
      }
      if (!allProps.find((p) => p.name === 'updatedAt')) {
        allProps.push({
          name: 'updatedAt',
          type: 'datetime',
          required: true,
          description: 'Last update timestamp',
        });
      }
    }

    if (this.options.includeSoftDelete) {
      if (!allProps.find((p) => p.name === 'deletedAt')) {
        allProps.push({
          name: 'deletedAt',
          type: 'datetime',
          required: false,
          description: 'Soft delete timestamp',
        });
      }
    }

    return allProps;
  }

  /**
   * Generate indexes for a model
   * @param modelName
   * @param properties
   */
  private generateIndexes(modelName: string, properties: readonly DataProperty[]): DataIndex[] {
    const indexes: DataIndex[] = [];

    // Primary key index
    indexes.push({
      name: `idx_${this.toSnakeCase(modelName)}_pk`,
      fields: ['id'],
      unique: true,
    });

    // Indexes for common lookup fields
    const indexableFields = ['email', 'username', 'status', 'type', 'createdAt'];

    for (const prop of properties) {
      if (indexableFields.includes(prop.name)) {
        indexes.push({
          name: `idx_${this.toSnakeCase(modelName)}_${this.toSnakeCase(prop.name)}`,
          fields: [prop.name],
          unique: prop.name === 'email' || prop.name === 'username',
        });
      }
    }

    // Composite index for timestamps if soft delete enabled
    if (this.options.includeSoftDelete) {
      indexes.push({
        name: `idx_${this.toSnakeCase(modelName)}_active`,
        fields: ['deletedAt', 'createdAt'],
        unique: false,
      });
    }

    return indexes;
  }

  /**
   * Convert to snake_case
   * @param str
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  /**
   * Generate description for model
   * @param component
   */
  private generateDescription(component: SDSComponent): string {
    return `Data model for ${component.name}. ${component.responsibility}`;
  }

  /**
   * Resolve relationships between models
   * @param models
   */
  private resolveRelationships(models: readonly DataModel[]): readonly DataModel[] {
    // Create model name lookup
    const modelByName = new Map<string, DataModel>();
    for (const model of models) {
      modelByName.set(model.name.toLowerCase(), model);
    }

    return models.map((model) => {
      const relationships: DataRelationship[] = [];

      // Check properties for potential relationships
      for (const prop of model.properties) {
        // Check for foreign key patterns
        if (prop.name.endsWith('Id') && prop.name !== 'id') {
          const relatedName = prop.name.replace(/Id$/, '');
          const relatedModel = modelByName.get(relatedName.toLowerCase());

          if (relatedModel) {
            relationships.push({
              target: relatedModel.name,
              type: 'many-to-many', // Could be refined based on context
              foreignKey: prop.name,
              description: `Reference to ${relatedModel.name}`,
            });
          }
        }
      }

      // Check component dependencies for relationships
      // This would require access to component dependency information

      return {
        ...model,
        relationships,
      };
    });
  }
}
