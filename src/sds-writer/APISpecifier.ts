/**
 * API Specifier module
 *
 * Generates API endpoint specifications from use cases and components,
 * including request/response schemas, authentication, and error handling.
 */

import type {
  ParsedUseCase,
  ParsedNFR,
  SDSComponent,
  APIEndpoint,
  APIParameter,
  DataSchema,
  DataProperty,
  ErrorResponse,
  HttpMethod,
  SecurityLevel,
  APIDesignInput,
} from './types.js';

/**
 * API specifier options
 */
export interface APISpecifierOptions {
  /** Base path for APIs (e.g., /api/v1) */
  readonly basePath?: string;
  /** API version */
  readonly apiVersion?: string;
  /** Default security level */
  readonly defaultSecurityLevel?: SecurityLevel;
  /** Include standard error responses */
  readonly includeStandardErrors?: boolean;
}

/**
 * Default specifier options
 */
const DEFAULT_OPTIONS: Required<APISpecifierOptions> = {
  basePath: '/api/v1',
  apiVersion: 'v1',
  defaultSecurityLevel: 'authenticated',
  includeStandardErrors: true,
};

/**
 * API specification result
 */
export interface APISpecificationResult {
  /** Generated API endpoints */
  readonly endpoints: readonly APIEndpoint[];
  /** Use cases that could not be converted */
  readonly failedUseCases: readonly string[];
  /** Specification warnings */
  readonly warnings: readonly string[];
}

/**
 * Standard error responses
 */
const STANDARD_ERRORS: readonly ErrorResponse[] = [
  { statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid request parameters' },
  { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' },
  { statusCode: 403, code: 'FORBIDDEN', message: 'Insufficient permissions' },
  { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' },
  { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' },
];

/**
 * Specifier for API endpoints from use cases
 */
export class APISpecifier {
  private readonly options: Required<APISpecifierOptions>;

  constructor(options: APISpecifierOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate API specifications from components and use cases
   * @param components - SDS components
   * @param useCases - Related use cases
   * @param nfrs - Non-functional requirements
   * @returns API specification result
   */
  public specify(
    components: readonly SDSComponent[],
    useCases: readonly ParsedUseCase[],
    nfrs: readonly ParsedNFR[]
  ): APISpecificationResult {
    const endpoints: APIEndpoint[] = [];
    const failedUseCases: string[] = [];
    const warnings: string[] = [];

    // Create component lookup by source feature
    const componentByFeature = new Map<string, SDSComponent>();
    for (const component of components) {
      componentByFeature.set(component.sourceFeature, component);
    }

    let apiIndex = 1;

    for (const useCase of useCases) {
      try {
        // Find the component for this use case
        const component = componentByFeature.get(useCase.sourceFeatureId);
        if (!component) {
          warnings.push(
            `Use case ${useCase.id} has no matching component for feature ${useCase.sourceFeatureId}`
          );
          continue;
        }

        const input: APIDesignInput = {
          component,
          useCase,
          nfrs,
          apiIndex,
        };

        const endpoint = this.specifyEndpoint(input);
        if (endpoint) {
          endpoints.push(endpoint);
          apiIndex++;
        }
      } catch (error) {
        failedUseCases.push(useCase.id);
        if (error instanceof Error) {
          warnings.push(`Use case ${useCase.id}: ${error.message}`);
        }
      }
    }

    return {
      endpoints,
      failedUseCases,
      warnings,
    };
  }

  /**
   * Generate a single API endpoint from a use case
   */
  public specifyEndpoint(input: APIDesignInput): APIEndpoint | null {
    const { component, useCase, nfrs } = input;

    // Determine HTTP method and path from use case
    const { method, path, resourceName } = this.analyzeUseCase(useCase, component);

    // Generate request/response schemas
    const { requestBody, responseBody } = this.generateSchemas(useCase, resourceName);

    // Determine path parameters
    const pathParameters = this.extractPathParameters(path);

    // Determine query parameters
    const queryParameters = this.extractQueryParameters(useCase, method);

    // Determine security level
    const security = this.determineSecurityLevel(useCase, nfrs);

    // Generate error responses
    const errorResponses = this.generateErrorResponses(useCase, method);

    const baseEndpoint = {
      path,
      method,
      name: useCase.name,
      description: this.generateDescription(useCase),
      sourceUseCase: useCase.id,
      sourceComponent: component.id,
      responseBody,
      security,
      errorResponses,
    };

    return {
      ...baseEndpoint,
      ...(method !== 'GET' && method !== 'DELETE' && { requestBody }),
      ...(pathParameters.length > 0 && { pathParameters }),
      ...(queryParameters.length > 0 && { queryParameters }),
    };
  }

  /**
   * Analyze use case to determine HTTP method and path
   */
  private analyzeUseCase(
    useCase: ParsedUseCase,
    component: SDSComponent
  ): { method: HttpMethod; path: string; resourceName: string } {
    const nameLower = useCase.name.toLowerCase();
    const scenarioText = useCase.mainScenario.join(' ').toLowerCase();
    const fullText = `${nameLower} ${scenarioText}`;

    // Extract resource name from component
    const resourceName = this.extractResourceName(component.name);
    const resourcePath = this.toKebabCase(resourceName);

    // Determine HTTP method
    let method: HttpMethod = 'GET';
    let path = `${this.options.basePath}/${resourcePath}`;

    if (
      fullText.includes('create') ||
      fullText.includes('add') ||
      fullText.includes('register') ||
      fullText.includes('submit')
    ) {
      method = 'POST';
    } else if (
      fullText.includes('update') ||
      fullText.includes('modify') ||
      fullText.includes('edit') ||
      fullText.includes('change')
    ) {
      method = 'PUT';
      path = `${path}/{id}`;
    } else if (
      fullText.includes('delete') ||
      fullText.includes('remove') ||
      fullText.includes('cancel')
    ) {
      method = 'DELETE';
      path = `${path}/{id}`;
    } else if (
      fullText.includes('partial') ||
      fullText.includes('patch') ||
      fullText.includes('toggle')
    ) {
      method = 'PATCH';
      path = `${path}/{id}`;
    } else if (
      fullText.includes('list') ||
      fullText.includes('all') ||
      fullText.includes('search') ||
      fullText.includes('filter')
    ) {
      method = 'GET';
      // Keep base path for list operations
    } else if (
      fullText.includes('get') ||
      fullText.includes('view') ||
      fullText.includes('show') ||
      fullText.includes('retrieve')
    ) {
      method = 'GET';
      path = `${path}/{id}`;
    }

    // Check for nested resources
    if (fullText.includes('user') && !resourcePath.includes('user')) {
      path = `${this.options.basePath}/users/{userId}/${resourcePath}`;
    }

    return { method, path, resourceName };
  }

  /**
   * Extract resource name from component name
   */
  private extractResourceName(componentName: string): string {
    return componentName
      .replace(
        /(Manager|Service|Controller|Handler|Repository|Provider|Gateway|Adapter|Factory)$/,
        ''
      )
      .trim();
  }

  /**
   * Convert string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Generate request and response schemas
   */
  private generateSchemas(
    useCase: ParsedUseCase,
    resourceName: string
  ): { requestBody: DataSchema; responseBody: DataSchema } {
    const properties = this.extractPropertiesFromScenario(useCase);

    const requestBody: DataSchema = {
      name: `${resourceName}Request`,
      type: 'object',
      properties: properties.filter((p) => !p.name.includes('id') || p.name === 'id'),
    };

    const responseBody: DataSchema = {
      name: `${resourceName}Response`,
      type: 'object',
      properties: [
        { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
        ...properties,
        { name: 'createdAt', type: 'string', required: true, description: 'Creation timestamp' },
        { name: 'updatedAt', type: 'string', required: true, description: 'Last update timestamp' },
      ],
    };

    return { requestBody, responseBody };
  }

  /**
   * Extract properties from use case scenario
   */
  private extractPropertiesFromScenario(useCase: ParsedUseCase): DataProperty[] {
    const properties: DataProperty[] = [];
    const seenNames = new Set<string>();

    const fullText = [
      useCase.name,
      ...useCase.preconditions,
      ...useCase.mainScenario,
      ...useCase.postconditions,
    ].join(' ');

    // Common property patterns
    const patterns: Array<{ pattern: RegExp; name: string; type: string; description: string }> = [
      { pattern: /email/i, name: 'email', type: 'string', description: 'Email address' },
      { pattern: /password/i, name: 'password', type: 'string', description: 'Password' },
      { pattern: /username/i, name: 'username', type: 'string', description: 'Username' },
      { pattern: /name/i, name: 'name', type: 'string', description: 'Name' },
      { pattern: /title/i, name: 'title', type: 'string', description: 'Title' },
      { pattern: /description/i, name: 'description', type: 'string', description: 'Description' },
      { pattern: /status/i, name: 'status', type: 'string', description: 'Current status' },
      { pattern: /type/i, name: 'type', type: 'string', description: 'Type classification' },
      { pattern: /date/i, name: 'date', type: 'string', description: 'Date value' },
      {
        pattern: /amount|price|cost/i,
        name: 'amount',
        type: 'number',
        description: 'Monetary amount',
      },
      { pattern: /quantity|count/i, name: 'quantity', type: 'number', description: 'Quantity' },
      {
        pattern: /active|enabled|visible/i,
        name: 'isActive',
        type: 'boolean',
        description: 'Active status',
      },
      {
        pattern: /file|document|attachment/i,
        name: 'fileUrl',
        type: 'string',
        description: 'File URL',
      },
      {
        pattern: /image|photo|avatar/i,
        name: 'imageUrl',
        type: 'string',
        description: 'Image URL',
      },
      { pattern: /address/i, name: 'address', type: 'string', description: 'Address' },
      { pattern: /phone/i, name: 'phone', type: 'string', description: 'Phone number' },
      { pattern: /url|link/i, name: 'url', type: 'string', description: 'URL' },
      {
        pattern: /tag|label|category/i,
        name: 'tags',
        type: 'array',
        description: 'Tags or labels',
      },
      {
        pattern: /comment|note|message/i,
        name: 'message',
        type: 'string',
        description: 'Message content',
      },
    ];

    for (const { pattern, name, type, description } of patterns) {
      if (pattern.test(fullText) && !seenNames.has(name)) {
        seenNames.add(name);
        properties.push({
          name,
          type,
          required: name === 'email' || name === 'name',
          description,
        });
      }
    }

    // If no properties found, add generic ones
    if (properties.length === 0) {
      properties.push({
        name: 'data',
        type: 'object',
        required: true,
        description: 'Request data',
      });
    }

    return properties;
  }

  /**
   * Extract path parameters from path template
   */
  private extractPathParameters(path: string): APIParameter[] {
    const parameters: APIParameter[] = [];
    const paramPattern = /\{(\w+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = paramPattern.exec(path)) !== null) {
      const paramName = match[1];
      if (paramName !== undefined && paramName !== '') {
        parameters.push({
          name: paramName,
          type: 'string',
          required: true,
          description: `The ${this.toReadable(paramName)}`,
        });
      }
    }

    return parameters;
  }

  /**
   * Convert camelCase to readable string
   */
  private toReadable(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/Id$/, ' ID')
      .toLowerCase();
  }

  /**
   * Extract query parameters from use case
   */
  private extractQueryParameters(useCase: ParsedUseCase, method: HttpMethod): APIParameter[] {
    if (method !== 'GET') {
      return [];
    }

    const parameters: APIParameter[] = [];
    const fullText = [useCase.name, ...useCase.mainScenario].join(' ').toLowerCase();

    // Check for list/search operations
    if (fullText.includes('list') || fullText.includes('search') || fullText.includes('filter')) {
      parameters.push(
        {
          name: 'page',
          type: 'integer',
          required: false,
          description: 'Page number for pagination',
        },
        {
          name: 'limit',
          type: 'integer',
          required: false,
          description: 'Number of items per page',
        },
        { name: 'sort', type: 'string', required: false, description: 'Sort field and direction' }
      );

      if (fullText.includes('search') || fullText.includes('filter')) {
        parameters.push({
          name: 'q',
          type: 'string',
          required: false,
          description: 'Search query string',
        });
      }
    }

    return parameters;
  }

  /**
   * Determine security level from use case and NFRs
   */
  private determineSecurityLevel(
    useCase: ParsedUseCase,
    nfrs: readonly ParsedNFR[]
  ): SecurityLevel {
    const fullText = [
      useCase.name,
      useCase.primaryActor,
      ...useCase.preconditions,
      ...useCase.mainScenario,
    ]
      .join(' ')
      .toLowerCase();

    // Check for admin operations
    if (
      fullText.includes('admin') ||
      fullText.includes('manage') ||
      fullText.includes('configure')
    ) {
      return 'admin';
    }

    // Check for public operations
    if (
      fullText.includes('public') ||
      fullText.includes('guest') ||
      fullText.includes('anonymous') ||
      (fullText.includes('view') && (fullText.includes('public') || !fullText.includes('user')))
    ) {
      return 'public';
    }

    // Check for authorized operations (specific permissions)
    if (
      fullText.includes('permission') ||
      fullText.includes('role') ||
      fullText.includes('authorized')
    ) {
      return 'authorized';
    }

    // Check security NFRs
    for (const nfr of nfrs) {
      if (nfr.category === 'Security') {
        const nfrText = nfr.description.toLowerCase();
        if (nfrText.includes('all endpoints') && nfrText.includes('authenticated')) {
          return 'authenticated';
        }
      }
    }

    return this.options.defaultSecurityLevel;
  }

  /**
   * Generate error responses for an endpoint
   */
  private generateErrorResponses(useCase: ParsedUseCase, method: HttpMethod): ErrorResponse[] {
    const errors: ErrorResponse[] = [];

    // Always include standard errors if enabled
    if (this.options.includeStandardErrors) {
      errors.push(...STANDARD_ERRORS);
    }

    // Add method-specific errors
    const fullText = [useCase.name, ...useCase.mainScenario].join(' ').toLowerCase();

    if (method === 'POST' || method === 'PUT') {
      if (fullText.includes('valid') || fullText.includes('require')) {
        errors.push({
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed for the request data',
        });
      }
      if (
        fullText.includes('duplicate') ||
        fullText.includes('exists') ||
        fullText.includes('unique')
      ) {
        errors.push({
          statusCode: 409,
          code: 'CONFLICT',
          message: 'Resource already exists',
        });
      }
    }

    if (method === 'DELETE') {
      errors.push({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Cannot delete resource due to dependencies',
      });
    }

    // Check alternative scenarios for error cases
    for (const alt of useCase.alternativeScenarios) {
      const altText = [alt.name, ...alt.steps].join(' ').toLowerCase();
      if (altText.includes('fail') || altText.includes('error') || altText.includes('invalid')) {
        if (altText.includes('timeout')) {
          errors.push({
            statusCode: 504,
            code: 'GATEWAY_TIMEOUT',
            message: 'Request timeout',
          });
        }
        if (altText.includes('service') && altText.includes('unavailable')) {
          errors.push({
            statusCode: 503,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily unavailable',
          });
        }
      }
    }

    // Deduplicate by status code
    const seen = new Set<number>();
    return errors.filter((e) => {
      if (seen.has(e.statusCode)) {
        return false;
      }
      seen.add(e.statusCode);
      return true;
    });
  }

  /**
   * Generate description for endpoint
   */
  private generateDescription(useCase: ParsedUseCase): string {
    const parts: string[] = [];

    // Add use case name as main description
    parts.push(useCase.name);

    // Add preconditions as requirements
    if (useCase.preconditions.length > 0) {
      parts.push(`\n\nRequirements:\n${useCase.preconditions.map((p) => `- ${p}`).join('\n')}`);
    }

    // Add main scenario summary
    if (useCase.mainScenario.length > 0) {
      parts.push(
        `\n\nSteps:\n${useCase.mainScenario
          .slice(0, 3)
          .map((s, i) => `${String(i + 1)}. ${s}`)
          .join('\n')}`
      );
      if (useCase.mainScenario.length > 3) {
        parts.push(`... and ${String(useCase.mainScenario.length - 3)} more steps`);
      }
    }

    return parts.join('');
  }
}
