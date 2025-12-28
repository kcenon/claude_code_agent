/**
 * Component Designer module
 *
 * Designs software components from SRS features, generating
 * component specifications with interfaces, dependencies, and responsibilities.
 */

import type {
  ParsedSRSFeature,
  ParsedUseCase,
  ParsedNFR,
  ParsedConstraint,
  SDSComponent,
  SDSInterface,
  SDSMethod,
  MethodParameter,
  ComponentDesignInput,
} from './types.js';

/**
 * Component designer options
 */
export interface ComponentDesignerOptions {
  /** Naming convention for components */
  readonly namingConvention?: 'PascalCase' | 'camelCase' | 'kebab-case';
  /** Generate TypeScript interfaces */
  readonly generateInterfaces?: boolean;
  /** Maximum methods per interface */
  readonly maxMethodsPerInterface?: number;
  /** Include implementation notes */
  readonly includeImplementationNotes?: boolean;
}

/**
 * Default designer options
 */
const DEFAULT_OPTIONS: Required<ComponentDesignerOptions> = {
  namingConvention: 'PascalCase',
  generateInterfaces: true,
  maxMethodsPerInterface: 10,
  includeImplementationNotes: true,
};

/**
 * Component design result
 */
export interface ComponentDesignResult {
  /** Designed components */
  readonly components: readonly SDSComponent[];
  /** Components that could not be designed */
  readonly failedFeatures: readonly string[];
  /** Design warnings */
  readonly warnings: readonly string[];
}

/**
 * Designer for SDS components from SRS features
 */
export class ComponentDesigner {
  private readonly options: Required<ComponentDesignerOptions>;

  constructor(options: ComponentDesignerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Design components from SRS features
   * @param features - SRS features to design components for
   * @param useCases - Related use cases
   * @param nfrs - Non-functional requirements
   * @param constraints - Constraints to consider
   * @returns Component design result
   */
  public design(
    features: readonly ParsedSRSFeature[],
    useCases: readonly ParsedUseCase[],
    nfrs: readonly ParsedNFR[],
    constraints: readonly ParsedConstraint[]
  ): ComponentDesignResult {
    const components: SDSComponent[] = [];
    const failedFeatures: string[] = [];
    const warnings: string[] = [];

    // Create use case lookup by feature ID
    const useCasesByFeature = this.groupUseCasesByFeature(useCases);

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (!feature) continue;

      try {
        const input: ComponentDesignInput = {
          feature,
          useCases: useCasesByFeature.get(feature.id) ?? [],
          nfrs,
          constraints,
          componentIndex: i + 1,
        };

        const component = this.designComponent(input);
        components.push(component);
      } catch (error) {
        failedFeatures.push(feature.id);
        if (error instanceof Error) {
          warnings.push(`Feature ${feature.id}: ${error.message}`);
        }
      }
    }

    // Detect and resolve dependencies
    const componentsWithDeps = this.resolveDependencies(components, features);

    return {
      components: componentsWithDeps,
      failedFeatures,
      warnings,
    };
  }

  /**
   * Design a single component from a feature
   */
  public designComponent(input: ComponentDesignInput): SDSComponent {
    const { feature, useCases, nfrs, constraints, componentIndex } = input;

    // Generate component ID
    const componentId = `CMP-${String(componentIndex).padStart(3, '0')}`;

    // Generate component name
    const componentName = this.generateComponentName(feature.name);

    // Generate responsibility from feature description
    const responsibility = this.generateResponsibility(feature);

    // Generate interfaces from use cases
    const interfaces = this.options.generateInterfaces
      ? this.generateInterfaces(componentName, feature, useCases)
      : [];

    // Generate implementation notes from NFRs and constraints
    const implementationNotes = this.options.includeImplementationNotes
      ? this.generateImplementationNotes(feature, nfrs, constraints)
      : '';

    // Determine technology suggestion based on feature and NFRs
    const technology = this.suggestTechnology(feature, nfrs);

    const baseComponent = {
      id: componentId,
      name: componentName,
      responsibility,
      sourceFeature: feature.id,
      priority: feature.priority,
      description: feature.description || this.generateDescription(feature),
      interfaces,
      dependencies: [], // Will be resolved later
      implementationNotes,
    };

    if (technology !== undefined) {
      return { ...baseComponent, technology };
    }

    return baseComponent;
  }

  /**
   * Group use cases by their source feature ID
   */
  private groupUseCasesByFeature(
    useCases: readonly ParsedUseCase[]
  ): Map<string, ParsedUseCase[]> {
    const map = new Map<string, ParsedUseCase[]>();

    for (const useCase of useCases) {
      const featureId = useCase.sourceFeatureId;
      if (featureId) {
        const existing = map.get(featureId) ?? [];
        existing.push(useCase);
        map.set(featureId, existing);
      }
    }

    return map;
  }

  /**
   * Generate component name from feature name
   */
  private generateComponentName(featureName: string): string {
    // Remove common prefixes and clean up
    let name = featureName
      .replace(/^(Feature|Module|Component|System|Service)\s*:?\s*/i, '')
      .replace(/\s+Management$/i, 'Manager')
      .replace(/\s+Processing$/i, 'Processor')
      .replace(/\s+Handling$/i, 'Handler')
      .trim();

    // Convert to PascalCase
    name = name
      .split(/[\s-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    // Ensure it ends with a component suffix if not already
    if (
      !name.match(
        /(Manager|Processor|Handler|Service|Controller|Provider|Factory|Repository|Gateway|Adapter|Client|Server)$/
      )
    ) {
      // Add appropriate suffix based on context
      if (name.toLowerCase().includes('auth')) {
        name += 'Service';
      } else if (name.toLowerCase().includes('data') || name.toLowerCase().includes('store')) {
        name += 'Repository';
      } else if (name.toLowerCase().includes('api') || name.toLowerCase().includes('external')) {
        name += 'Gateway';
      } else {
        name += 'Manager';
      }
    }

    return name;
  }

  /**
   * Generate responsibility statement from feature
   */
  private generateResponsibility(feature: ParsedSRSFeature): string {
    if (feature.description) {
      // Extract first sentence or up to 200 chars
      const firstSentence = feature.description.split(/\.\s/)[0] ?? '';
      if (firstSentence.length <= 200) {
        return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
      }
      return `${firstSentence.slice(0, 197)}...`;
    }

    return `Manages ${feature.name.toLowerCase()} functionality.`;
  }

  /**
   * Generate description from feature
   */
  private generateDescription(feature: ParsedSRSFeature): string {
    const parts: string[] = [];

    parts.push(`This component implements the ${feature.name} feature.`);

    if (feature.acceptanceCriteria.length > 0) {
      parts.push('\n\nKey capabilities:');
      for (const criterion of feature.acceptanceCriteria.slice(0, 5)) {
        parts.push(`- ${criterion}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate interfaces for a component
   */
  private generateInterfaces(
    componentName: string,
    feature: ParsedSRSFeature,
    useCases: readonly ParsedUseCase[]
  ): readonly SDSInterface[] {
    const interfaces: SDSInterface[] = [];

    // Generate main interface from feature
    const mainInterface = this.generateMainInterface(componentName, feature);
    if (mainInterface) {
      interfaces.push(mainInterface);
    }

    // Generate additional interfaces from use cases
    for (const useCase of useCases.slice(0, 3)) {
      // Limit to 3 use cases
      const ucInterface = this.generateUseCaseInterface(componentName, useCase);
      if (ucInterface) {
        interfaces.push(ucInterface);
      }
    }

    return interfaces;
  }

  /**
   * Generate main interface for a component
   */
  private generateMainInterface(
    componentName: string,
    feature: ParsedSRSFeature
  ): SDSInterface | null {
    const interfaceName = `I${componentName}`;
    const methods: SDSMethod[] = [];

    // Generate methods from acceptance criteria
    for (const criterion of feature.acceptanceCriteria.slice(
      0,
      this.options.maxMethodsPerInterface
    )) {
      const method = this.generateMethodFromCriterion(criterion);
      if (method) {
        methods.push(method);
      }
    }

    // Add default CRUD-like methods if no methods generated
    if (methods.length === 0) {
      methods.push(...this.generateDefaultMethods(feature.name));
    }

    // Generate raw TypeScript code
    const rawCode = this.generateInterfaceCode(interfaceName, methods);

    return {
      name: interfaceName,
      methods,
      rawCode,
    };
  }

  /**
   * Generate interface from a use case
   */
  private generateUseCaseInterface(
    componentName: string,
    useCase: ParsedUseCase
  ): SDSInterface | null {
    const interfaceName = `I${componentName}${this.sanitizeUseCaseName(useCase.name)}`;
    const methods: SDSMethod[] = [];

    // Generate method from main scenario
    if (useCase.mainScenario.length > 0) {
      const mainMethod = this.generateMethodFromScenario(useCase.name, useCase.mainScenario);
      if (mainMethod) {
        methods.push(mainMethod);
      }
    }

    // Generate methods from alternative scenarios
    for (const alt of useCase.alternativeScenarios.slice(0, 2)) {
      const altMethod = this.generateMethodFromScenario(alt.name, alt.steps);
      if (altMethod) {
        methods.push(altMethod);
      }
    }

    if (methods.length === 0) {
      return null;
    }

    const rawCode = this.generateInterfaceCode(interfaceName, methods);

    return {
      name: interfaceName,
      methods,
      rawCode,
    };
  }

  /**
   * Sanitize use case name for interface naming
   */
  private sanitizeUseCaseName(name: string): string {
    return name
      .split(/[\s-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Generate method from acceptance criterion
   */
  private generateMethodFromCriterion(criterion: string): SDSMethod | null {
    // Parse criterion for action verbs
    const actionMatch = criterion.match(
      /^(User can|System should|Must be able to|Should|Can|Must)\s+(.+)/i
    );

    if (!actionMatch) {
      return null;
    }

    const action = actionMatch[2] ?? criterion;
    const methodName = this.generateMethodName(action);
    const parameters = this.extractParameters(action);
    const returnType = this.inferReturnType(action);

    const paramString =
      parameters.length > 0
        ? parameters.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')
        : '';

    return {
      name: methodName,
      signature: `${methodName}(${paramString}): ${returnType}`,
      returnType,
      parameters,
      description: criterion,
    };
  }

  /**
   * Generate method from use case scenario
   */
  private generateMethodFromScenario(
    scenarioName: string,
    steps: readonly string[]
  ): SDSMethod | null {
    const methodName = this.generateMethodName(scenarioName);
    const returnType = 'Promise<void>';

    // Extract potential parameters from steps
    const parameters: MethodParameter[] = [];
    for (const step of steps.slice(0, 3)) {
      const params = this.extractParameters(step);
      for (const param of params) {
        if (!parameters.find((p) => p.name === param.name)) {
          parameters.push(param);
        }
      }
    }

    const paramString =
      parameters.length > 0
        ? parameters.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')
        : '';

    return {
      name: methodName,
      signature: `${methodName}(${paramString}): ${returnType}`,
      returnType,
      parameters,
      description: `Executes: ${scenarioName}`,
    };
  }

  /**
   * Generate method name from action description
   */
  private generateMethodName(action: string): string {
    // Extract key verbs and nouns
    const words = action
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) {
      return 'execute';
    }

    // Common verb mappings
    const verbMappings: Record<string, string> = {
      create: 'create',
      add: 'add',
      insert: 'insert',
      read: 'get',
      retrieve: 'get',
      fetch: 'fetch',
      get: 'get',
      find: 'find',
      search: 'search',
      update: 'update',
      modify: 'update',
      change: 'update',
      edit: 'edit',
      delete: 'delete',
      remove: 'remove',
      view: 'view',
      display: 'display',
      show: 'show',
      list: 'list',
      validate: 'validate',
      verify: 'verify',
      check: 'check',
      authenticate: 'authenticate',
      authorize: 'authorize',
      login: 'login',
      logout: 'logout',
      register: 'register',
      submit: 'submit',
      process: 'process',
      handle: 'handle',
      manage: 'manage',
      configure: 'configure',
      set: 'set',
      enable: 'enable',
      disable: 'disable',
      upload: 'upload',
      download: 'download',
      export: 'export',
      import: 'import',
    };

    let verb = 'execute';
    let noun = '';

    for (const word of words) {
      if (verbMappings[word]) {
        verb = verbMappings[word];
      } else if (word.length > 3 && !noun) {
        noun = word.charAt(0).toUpperCase() + word.slice(1);
      }
    }

    return verb + noun;
  }

  /**
   * Extract parameters from action description
   */
  private extractParameters(action: string): MethodParameter[] {
    const parameters: MethodParameter[] = [];
    const lowerAction = action.toLowerCase();

    // Common parameter patterns
    const patterns: Array<{ pattern: RegExp; name: string; type: string }> = [
      { pattern: /user\s*id|userid/i, name: 'userId', type: 'string' },
      { pattern: /email/i, name: 'email', type: 'string' },
      { pattern: /password/i, name: 'password', type: 'string' },
      { pattern: /username/i, name: 'username', type: 'string' },
      { pattern: /name/i, name: 'name', type: 'string' },
      { pattern: /id\b/i, name: 'id', type: 'string' },
      { pattern: /data|payload|body/i, name: 'data', type: 'Record<string, unknown>' },
      { pattern: /options?|config/i, name: 'options', type: 'object' },
      { pattern: /file/i, name: 'file', type: 'File' },
      { pattern: /query|filter|search/i, name: 'query', type: 'string' },
      { pattern: /limit|count|size/i, name: 'limit', type: 'number' },
      { pattern: /offset|page|skip/i, name: 'offset', type: 'number' },
    ];

    for (const { pattern, name, type } of patterns) {
      if (pattern.test(lowerAction)) {
        parameters.push({
          name,
          type,
          optional: !lowerAction.includes('required'),
          description: `The ${name} parameter`,
        });
      }
    }

    return parameters;
  }

  /**
   * Infer return type from action description
   */
  private inferReturnType(action: string): string {
    const lowerAction = action.toLowerCase();

    if (lowerAction.includes('list') || lowerAction.includes('all') || lowerAction.includes('multiple')) {
      return 'Promise<Array<unknown>>';
    }
    if (lowerAction.includes('get') || lowerAction.includes('find') || lowerAction.includes('retrieve')) {
      return 'Promise<unknown | null>';
    }
    if (lowerAction.includes('create') || lowerAction.includes('add')) {
      return 'Promise<unknown>';
    }
    if (lowerAction.includes('update') || lowerAction.includes('modify')) {
      return 'Promise<unknown>';
    }
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
      return 'Promise<boolean>';
    }
    if (lowerAction.includes('validate') || lowerAction.includes('check') || lowerAction.includes('verify')) {
      return 'Promise<boolean>';
    }
    if (lowerAction.includes('count') || lowerAction.includes('total')) {
      return 'Promise<number>';
    }

    return 'Promise<void>';
  }

  /**
   * Generate default CRUD methods for a feature
   */
  private generateDefaultMethods(featureName: string): SDSMethod[] {
    const entityName = featureName
      .replace(/\s+/g, '')
      .replace(/^(.)/, (c) => c.toUpperCase());

    return [
      {
        name: `create${entityName}`,
        signature: `create${entityName}(data: Create${entityName}Input): Promise<${entityName}>`,
        returnType: `Promise<${entityName}>`,
        parameters: [
          { name: 'data', type: `Create${entityName}Input`, optional: false },
        ],
      },
      {
        name: `get${entityName}ById`,
        signature: `get${entityName}ById(id: string): Promise<${entityName} | null>`,
        returnType: `Promise<${entityName} | null>`,
        parameters: [{ name: 'id', type: 'string', optional: false }],
      },
      {
        name: `update${entityName}`,
        signature: `update${entityName}(id: string, data: Update${entityName}Input): Promise<${entityName}>`,
        returnType: `Promise<${entityName}>`,
        parameters: [
          { name: 'id', type: 'string', optional: false },
          { name: 'data', type: `Update${entityName}Input`, optional: false },
        ],
      },
      {
        name: `delete${entityName}`,
        signature: `delete${entityName}(id: string): Promise<boolean>`,
        returnType: 'Promise<boolean>',
        parameters: [{ name: 'id', type: 'string', optional: false }],
      },
      {
        name: `list${entityName}s`,
        signature: `list${entityName}s(options?: ListOptions): Promise<Array<${entityName}>>`,
        returnType: `Promise<Array<${entityName}>>`,
        parameters: [{ name: 'options', type: 'ListOptions', optional: true }],
      },
    ];
  }

  /**
   * Generate TypeScript interface code
   */
  private generateInterfaceCode(name: string, methods: readonly SDSMethod[]): string {
    const methodLines = methods
      .map((m) => `  ${m.signature};`)
      .join('\n');

    return `interface ${name} {\n${methodLines}\n}`;
  }

  /**
   * Generate implementation notes from NFRs and constraints
   */
  private generateImplementationNotes(
    feature: ParsedSRSFeature,
    nfrs: readonly ParsedNFR[],
    constraints: readonly ParsedConstraint[]
  ): string {
    const notes: string[] = [];

    // Add priority-based notes
    if (feature.priority === 'P0') {
      notes.push('Critical component - requires thorough testing and error handling.');
    }

    // Add NFR-based notes
    const relevantNfrs = nfrs.filter(
      (nfr) =>
        nfr.category === 'Performance' ||
        nfr.category === 'Security' ||
        nfr.category === 'Scalability'
    );

    for (const nfr of relevantNfrs.slice(0, 3)) {
      if (nfr.metric) {
        notes.push(`${nfr.category}: ${nfr.metric}`);
      } else {
        notes.push(`${nfr.category}: ${nfr.description.slice(0, 100)}`);
      }
    }

    // Add constraint-based notes
    for (const constraint of constraints.slice(0, 2)) {
      notes.push(`Constraint (${constraint.type}): ${constraint.description.slice(0, 100)}`);
    }

    return notes.join('\n');
  }

  /**
   * Suggest technology based on feature and NFRs
   */
  private suggestTechnology(
    feature: ParsedSRSFeature,
    nfrs: readonly ParsedNFR[]
  ): string | undefined {
    const featureLower = (feature.name + ' ' + feature.description).toLowerCase();

    // Check for specific technology hints
    if (featureLower.includes('api') || featureLower.includes('rest')) {
      return 'Express.js / Fastify';
    }
    if (featureLower.includes('database') || featureLower.includes('storage')) {
      return 'PostgreSQL / MongoDB';
    }
    if (featureLower.includes('cache') || featureLower.includes('redis')) {
      return 'Redis';
    }
    if (featureLower.includes('queue') || featureLower.includes('message')) {
      return 'RabbitMQ / Redis Queue';
    }
    if (featureLower.includes('search') || featureLower.includes('elastic')) {
      return 'Elasticsearch';
    }
    if (featureLower.includes('auth')) {
      return 'JWT / OAuth2';
    }

    // Check NFRs for technology hints
    for (const nfr of nfrs) {
      if (nfr.category === 'Performance' && nfr.description.toLowerCase().includes('real-time')) {
        return 'WebSocket / Socket.io';
      }
    }

    return undefined;
  }

  /**
   * Resolve dependencies between components
   */
  private resolveDependencies(
    components: readonly SDSComponent[],
    features: readonly ParsedSRSFeature[]
  ): readonly SDSComponent[] {
    // Create feature-to-component mapping
    const featureToComponent = new Map<string, string>();
    for (const component of components) {
      featureToComponent.set(component.sourceFeature, component.id);
    }

    // Create feature dependency map
    const featureDeps = new Map<string, string[]>();
    for (const feature of features) {
      const deps: string[] = [];
      // Check if feature references other features in description
      for (const otherFeature of features) {
        if (
          feature.id !== otherFeature.id &&
          (feature.description.includes(otherFeature.id) ||
            feature.description.toLowerCase().includes(otherFeature.name.toLowerCase()))
        ) {
          deps.push(otherFeature.id);
        }
      }
      featureDeps.set(feature.id, deps);
    }

    // Resolve component dependencies
    return components.map((component) => {
      const featureDependencies = featureDeps.get(component.sourceFeature) ?? [];
      const componentDependencies = featureDependencies
        .map((fid) => featureToComponent.get(fid))
        .filter((cid): cid is string => cid !== undefined && cid !== component.id);

      return {
        ...component,
        dependencies: componentDependencies,
      };
    });
  }
}
