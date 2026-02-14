/**
 * Interface Generator
 *
 * Generates interface specifications from use cases including
 * API endpoints, events, and file interfaces.
 *
 * @module component-generator/InterfaceGenerator
 */

import { InterfaceGenerationError } from './errors.js';
import {
  INTERFACE_TYPE_PREFIXES,
  COMMON_HEADERS,
  DEFAULT_ERROR_RESPONSES,
  HTTP_STATUS_CODES,
} from './schemas.js';
import type {
  SRSUseCase,
  InterfaceSpec,
  InterfaceType,
  APIEndpoint,
  HttpMethod,
  RequestSpec,
  ResponseSpec,
  SuccessResponse,
  HeaderSpec,
  ParamSpec,
  BodySchema,
  FieldSpec,
  ErrorResponse,
  DataType,
} from './types.js';

// ============================================================
// Constants
// ============================================================

const CRUD_KEYWORDS: Record<string, { method: HttpMethod; action: string }> = {
  create: { method: 'POST', action: 'create' },
  add: { method: 'POST', action: 'create' },
  register: { method: 'POST', action: 'create' },
  submit: { method: 'POST', action: 'create' },
  upload: { method: 'POST', action: 'create' },
  read: { method: 'GET', action: 'read' },
  get: { method: 'GET', action: 'read' },
  view: { method: 'GET', action: 'read' },
  list: { method: 'GET', action: 'read' },
  fetch: { method: 'GET', action: 'read' },
  retrieve: { method: 'GET', action: 'read' },
  search: { method: 'GET', action: 'read' },
  update: { method: 'PUT', action: 'update' },
  edit: { method: 'PUT', action: 'update' },
  modify: { method: 'PATCH', action: 'update' },
  patch: { method: 'PATCH', action: 'update' },
  delete: { method: 'DELETE', action: 'delete' },
  remove: { method: 'DELETE', action: 'delete' },
  cancel: { method: 'DELETE', action: 'delete' },
};

const RESOURCE_PATTERNS: Record<string, string> = {
  user: 'users',
  account: 'accounts',
  project: 'projects',
  document: 'documents',
  file: 'files',
  order: 'orders',
  product: 'products',
  item: 'items',
  task: 'tasks',
  issue: 'issues',
  report: 'reports',
  setting: 'settings',
  config: 'configurations',
  message: 'messages',
  notification: 'notifications',
  agent: 'agents',
  workflow: 'workflows',
};

// ============================================================
// Interface Generator Class
// ============================================================

/**
 * Generates interface specifications from use cases
 */
export class InterfaceGenerator {
  private readonly interfaceCounters: Map<string, number>;

  constructor() {
    this.interfaceCounters = new Map();
  }

  /**
   * Reset interface counters
   */
  public reset(): void {
    this.interfaceCounters.clear();
  }

  /**
   * Generate interfaces from use cases
   * @param useCases - Array of SRS use cases to generate interfaces from
   * @returns Array of generated interface specifications
   */
  public generateInterfaces(useCases: readonly SRSUseCase[]): InterfaceSpec[] {
    const interfaces: InterfaceSpec[] = [];

    for (const useCase of useCases) {
      try {
        const interfaceSpecs = this.generateFromUseCase(useCase);
        interfaces.push(...interfaceSpecs);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new InterfaceGenerationError(useCase.id, 'API', message);
      }
    }

    return interfaces;
  }

  /**
   * Generate interfaces from a single use case
   * @param useCase - SRS use case to generate interfaces from
   * @returns Array of interface specifications for this use case
   */
  private generateFromUseCase(useCase: SRSUseCase): InterfaceSpec[] {
    const interfaces: InterfaceSpec[] = [];

    // Analyze use case to determine interface type
    const interfaceType = this.determineInterfaceType(useCase);

    if (interfaceType === 'API') {
      const apiEndpoint = this.generateAPIEndpoint(useCase);
      interfaces.push({
        interfaceId: this.generateInterfaceId('API'),
        type: 'API',
        specification: apiEndpoint,
        sourceUseCase: useCase.id,
      });
    }

    return interfaces;
  }

  /**
   * Determine interface type from use case
   * @param useCase - SRS use case to analyze for interface type
   * @returns Determined interface type (API, Event, File, Message, or Callback)
   */
  private determineInterfaceType(useCase: SRSUseCase): InterfaceType {
    const text = `${useCase.name} ${useCase.description}`.toLowerCase();

    if (text.includes('event') || text.includes('notify') || text.includes('trigger')) {
      return 'Event';
    }
    if (text.includes('file') || text.includes('export') || text.includes('import')) {
      return 'File';
    }
    if (text.includes('message') || text.includes('queue')) {
      return 'Message';
    }
    if (text.includes('callback') || text.includes('webhook')) {
      return 'Callback';
    }

    return 'API';
  }

  /**
   * Generate API endpoint from use case
   * @param useCase - SRS use case to generate API endpoint from
   * @returns Complete API endpoint specification
   */
  private generateAPIEndpoint(useCase: SRSUseCase): APIEndpoint {
    const { method, action } = this.determineHttpMethod(useCase);
    const resource = this.determineResource(useCase);
    const endpoint = this.buildEndpoint(resource, action, method);
    const request = this.generateRequestSpec(useCase, method);
    const response = this.generateResponseSpec(useCase, method);
    const authenticated = this.requiresAuthentication(useCase);

    return {
      endpoint,
      method,
      description: useCase.description,
      request,
      response,
      authenticated,
    };
  }

  /**
   * Determine HTTP method from use case
   * @param useCase - SRS use case to analyze for HTTP method
   * @returns Object containing the HTTP method and corresponding CRUD action
   */
  private determineHttpMethod(useCase: SRSUseCase): { method: HttpMethod; action: string } {
    const text = `${useCase.name} ${useCase.description}`.toLowerCase();

    for (const [keyword, info] of Object.entries(CRUD_KEYWORDS)) {
      if (text.includes(keyword)) {
        return info;
      }
    }

    // Default to GET for read-like operations
    return { method: 'GET', action: 'read' };
  }

  /**
   * Determine resource name from use case
   * @param useCase - SRS use case to extract resource name from
   * @returns Plural resource name for the API endpoint
   */
  private determineResource(useCase: SRSUseCase): string {
    const text = `${useCase.name} ${useCase.description}`.toLowerCase();

    for (const [singular, plural] of Object.entries(RESOURCE_PATTERNS)) {
      if (text.includes(singular)) {
        return plural;
      }
    }

    // Extract resource from use case name
    const words = useCase.name.toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord !== undefined && lastWord !== '' && lastWord.length > 2) {
      return lastWord.endsWith('s') ? lastWord : `${lastWord}s`;
    }

    return 'resources';
  }

  /**
   * Build endpoint path
   * @param resource - Resource name to include in the path
   * @param action - CRUD action being performed
   * @param method - HTTP method for the endpoint
   * @returns Complete API endpoint path
   */
  private buildEndpoint(resource: string, action: string, method: HttpMethod): string {
    const base = `/api/v1/${resource}`;

    if (method === 'GET' && action === 'read') {
      // Could be list or single item
      return base;
    }
    if (method === 'POST') {
      return base;
    }
    if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      return `${base}/{id}`;
    }

    return base;
  }

  /**
   * Generate request specification
   * @param useCase - SRS use case to generate request spec from
   * @param method - HTTP method to determine request structure
   * @returns Complete request specification with headers, params, and body
   */
  private generateRequestSpec(useCase: SRSUseCase, method: HttpMethod): RequestSpec {
    const headers: HeaderSpec[] = [];
    const pathParams: ParamSpec[] = [];
    const queryParams: ParamSpec[] = [];
    let body: BodySchema | undefined;

    // Add authorization header if authenticated
    if (this.requiresAuthentication(useCase)) {
      headers.push(COMMON_HEADERS.AUTHORIZATION);
    }

    // Add path parameters for item-specific operations
    if (method === 'PUT' || method === 'PATCH' || method === 'DELETE' || method === 'GET') {
      const resource = this.determineResource(useCase);
      if (resource !== 'resources') {
        pathParams.push({
          name: 'id',
          type: 'string',
          description: `${resource.slice(0, -1)} identifier`,
          required: true,
        });
      }
    }

    // Add query parameters for GET requests
    if (method === 'GET') {
      queryParams.push(
        {
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          required: false,
          default: '1',
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of items per page',
          required: false,
          default: '20',
        }
      );
    }

    // Add content type header and body for POST/PUT/PATCH
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      headers.push(COMMON_HEADERS.CONTENT_TYPE);
      body = this.generateRequestBody(useCase);
    }

    const result: RequestSpec = {
      headers,
      pathParams,
      queryParams,
    };

    if (body !== undefined) {
      return { ...result, body };
    }

    return result;
  }

  /**
   * Generate request body schema from use case
   * @param useCase - SRS use case to extract request body fields from
   * @returns Body schema with content type and field specifications
   */
  private generateRequestBody(useCase: SRSUseCase): BodySchema {
    const fields = this.extractFieldsFromUseCase(useCase);

    return {
      contentType: 'application/json',
      fields,
    };
  }

  /**
   * Extract fields from use case main flow
   * @param useCase - SRS use case containing main flow steps to analyze
   * @returns Array of field specifications extracted from the use case
   */
  private extractFieldsFromUseCase(useCase: SRSUseCase): FieldSpec[] {
    const fields: FieldSpec[] = [];
    const fieldNames = new Set<string>();

    // Analyze main flow for potential fields
    for (const step of useCase.mainFlow) {
      const extractedFields = this.extractFieldsFromStep(step);
      for (const field of extractedFields) {
        if (!fieldNames.has(field.name)) {
          fieldNames.add(field.name);
          fields.push(field);
        }
      }
    }

    // If no fields found, add generic data field
    if (fields.length === 0) {
      fields.push({
        name: 'data',
        type: 'object',
        description: 'Request data',
        required: true,
      });
    }

    return fields;
  }

  /**
   * Extract field information from a step description
   * @param step - Use case step description to parse for field patterns
   * @returns Array of field specifications found in the step
   */
  private extractFieldsFromStep(step: string): FieldSpec[] {
    const fields: FieldSpec[] = [];
    const lowerStep = step.toLowerCase();

    // Common field patterns
    const fieldPatterns: Array<{ pattern: RegExp; name: string; type: DataType }> = [
      { pattern: /\bname\b/i, name: 'name', type: 'string' },
      { pattern: /\bemail\b/i, name: 'email', type: 'string' },
      { pattern: /\bpassword\b/i, name: 'password', type: 'string' },
      { pattern: /\busername\b/i, name: 'username', type: 'string' },
      { pattern: /\btitle\b/i, name: 'title', type: 'string' },
      { pattern: /\bdescription\b/i, name: 'description', type: 'string' },
      { pattern: /\bstatus\b/i, name: 'status', type: 'string' },
      { pattern: /\btype\b/i, name: 'type', type: 'string' },
      { pattern: /\bpriority\b/i, name: 'priority', type: 'string' },
      { pattern: /\bcontent\b/i, name: 'content', type: 'string' },
      { pattern: /\burl\b/i, name: 'url', type: 'string' },
      { pattern: /\bpath\b/i, name: 'path', type: 'string' },
      { pattern: /\bconfig\b/i, name: 'config', type: 'object' },
      { pattern: /\bmetadata\b/i, name: 'metadata', type: 'object' },
      { pattern: /\bcount\b/i, name: 'count', type: 'number' },
      { pattern: /\bamount\b/i, name: 'amount', type: 'number' },
      { pattern: /\bprice\b/i, name: 'price', type: 'number' },
      { pattern: /\benabled\b/i, name: 'enabled', type: 'boolean' },
      { pattern: /\bactive\b/i, name: 'active', type: 'boolean' },
      { pattern: /\bitems\b/i, name: 'items', type: 'array' },
      { pattern: /\btags\b/i, name: 'tags', type: 'array' },
      { pattern: /\bdate\b/i, name: 'date', type: 'date' },
      { pattern: /\btimestamp\b/i, name: 'timestamp', type: 'date' },
    ];

    for (const { pattern, name, type } of fieldPatterns) {
      if (pattern.test(lowerStep)) {
        fields.push({
          name,
          type,
          description: `${name.charAt(0).toUpperCase()}${name.slice(1)} field`,
          required: lowerStep.includes('required') || lowerStep.includes('must'),
        });
      }
    }

    return fields;
  }

  /**
   * Generate response specification
   * @param useCase - SRS use case to generate response from
   * @param method - HTTP method to determine response structure
   * @returns Complete response specification with success and error responses
   */
  private generateResponseSpec(useCase: SRSUseCase, method: HttpMethod): ResponseSpec {
    const successStatus = this.getSuccessStatus(method);
    const successBody = this.generateSuccessBody(useCase, method);
    const errors = this.generateErrorResponses(method);

    const success: SuccessResponse = {
      status: successStatus,
      description: this.getSuccessDescription(method),
    };

    if (successBody !== undefined) {
      return {
        success: { ...success, body: successBody },
        errors,
      };
    }

    return { success, errors };
  }

  /**
   * Get success status code based on method
   * @param method - HTTP method to determine appropriate status code
   * @returns HTTP status code for successful response
   */
  private getSuccessStatus(method: HttpMethod): number {
    switch (method) {
      case 'POST':
        return HTTP_STATUS_CODES.CREATED;
      case 'DELETE':
        return HTTP_STATUS_CODES.NO_CONTENT;
      default:
        return HTTP_STATUS_CODES.OK;
    }
  }

  /**
   * Get success description based on method
   * @param method - HTTP method to generate description for
   * @returns Human-readable success message for the HTTP method
   */
  private getSuccessDescription(method: HttpMethod): string {
    switch (method) {
      case 'POST':
        return 'Resource created successfully';
      case 'PUT':
      case 'PATCH':
        return 'Resource updated successfully';
      case 'DELETE':
        return 'Resource deleted successfully';
      default:
        return 'Request successful';
    }
  }

  /**
   * Generate success response body
   * @param useCase - SRS use case to extract response fields from
   * @param method - HTTP method to determine if body is needed
   * @returns Body schema for success response, or undefined for DELETE
   */
  private generateSuccessBody(useCase: SRSUseCase, method: HttpMethod): BodySchema | undefined {
    if (method === 'DELETE') {
      return undefined;
    }

    const resource = this.determineResource(useCase);
    const singularResource = resource.slice(0, -1);

    const fields: FieldSpec[] = [
      {
        name: 'id',
        type: 'string',
        description: `${singularResource} identifier`,
        required: true,
      },
    ];

    // Add fields based on use case
    const extractedFields = this.extractFieldsFromUseCase(useCase);
    fields.push(...extractedFields.filter((f) => f.name !== 'id' && f.name !== 'data'));

    // Add timestamp fields
    fields.push(
      {
        name: 'createdAt',
        type: 'date',
        description: 'Creation timestamp',
        required: true,
      },
      {
        name: 'updatedAt',
        type: 'date',
        description: 'Last update timestamp',
        required: true,
      }
    );

    return {
      contentType: 'application/json',
      fields,
    };
  }

  /**
   * Generate common error responses
   * @param method - HTTP method to determine applicable error responses
   * @returns Array of error response specifications
   */
  private generateErrorResponses(method: HttpMethod): ErrorResponse[] {
    const errors: ErrorResponse[] = [DEFAULT_ERROR_RESPONSES[400], DEFAULT_ERROR_RESPONSES[401]];

    if (method === 'GET' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      errors.push(DEFAULT_ERROR_RESPONSES[404]);
    }

    if (method === 'POST' || method === 'PUT') {
      errors.push(DEFAULT_ERROR_RESPONSES[409]);
    }

    errors.push(DEFAULT_ERROR_RESPONSES[500]);

    return errors;
  }

  /**
   * Check if use case requires authentication
   * @param useCase - SRS use case to analyze for authentication requirements
   * @returns True if authentication is required, false for public endpoints
   */
  private requiresAuthentication(useCase: SRSUseCase): boolean {
    const text =
      `${useCase.name} ${useCase.description} ${useCase.preconditions.join(' ')}`.toLowerCase();

    // Public endpoints
    if (text.includes('public') || text.includes('guest') || text.includes('anonymous')) {
      return false;
    }

    // Authentication endpoints
    if (text.includes('login') || text.includes('register') || text.includes('signup')) {
      return false;
    }

    // Default to requiring authentication
    return true;
  }

  /**
   * Generate unique interface ID
   * @param type - Interface type to generate ID for
   * @returns Unique interface ID with type prefix and sequence number
   */
  private generateInterfaceId(type: InterfaceType): string {
    const prefix = INTERFACE_TYPE_PREFIXES[type] ?? 'INT';
    const count = (this.interfaceCounters.get(prefix) ?? 0) + 1;
    this.interfaceCounters.set(prefix, count);
    return `${prefix}-${String(count).padStart(3, '0')}`;
  }
}
