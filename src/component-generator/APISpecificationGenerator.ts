/**
 * API Specification Generator
 *
 * Generates API specification tables and documentation from
 * component interfaces and endpoint definitions.
 *
 * @module component-generator/APISpecificationGenerator
 */

import { APISpecificationError } from './errors.js';
import type {
  ComponentDefinition,
  InterfaceSpec,
  APIEndpoint,
  BodySchema,
  FieldSpec,
  DataType,
} from './types.js';

// ============================================================
// API Specification Generator Class
// ============================================================

/**
 * Generates API specifications and documentation
 */
export class APISpecificationGenerator {
  /**
   * Extract all API endpoints from components
   */
  public extractAPIEndpoints(components: readonly ComponentDefinition[]): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];

    for (const component of components) {
      for (const iface of component.interfaces) {
        if (iface.type === 'API') {
          const endpoint = iface.specification as APIEndpoint;
          endpoints.push(endpoint);
        }
      }
    }

    return endpoints;
  }

  /**
   * Generate API specification table in markdown format
   */
  public generateSpecificationTable(endpoints: readonly APIEndpoint[]): string {
    const lines: string[] = [];

    lines.push('## API Specification');
    lines.push('');
    lines.push('| Endpoint | Method | Description | Auth | Rate Limit |');
    lines.push('|----------|--------|-------------|------|------------|');

    for (const endpoint of endpoints) {
      const auth = endpoint.authenticated ? 'Yes' : 'No';
      const rateLimit = endpoint.rateLimit
        ? `${String(endpoint.rateLimit.requests)}/${String(endpoint.rateLimit.window)}s`
        : '-';
      lines.push(
        `| \`${endpoint.endpoint}\` | ${endpoint.method} | ${endpoint.description} | ${auth} | ${rateLimit} |`
      );
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Generate detailed API documentation in markdown format
   */
  public generateDetailedDocumentation(
    endpoints: readonly APIEndpoint[],
    interfaces: readonly InterfaceSpec[]
  ): string {
    const lines: string[] = [];

    lines.push('## API Documentation');
    lines.push('');

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      if (endpoint === undefined) continue;

      const iface = interfaces.find((inf) => {
        if (inf.type !== 'API') return false;
        const spec = inf.specification as APIEndpoint;
        return spec.endpoint === endpoint.endpoint && spec.method === endpoint.method;
      });

      lines.push(`### ${endpoint.method} ${endpoint.endpoint}`);
      lines.push('');
      lines.push(endpoint.description);
      lines.push('');

      if (iface) {
        lines.push(`**Interface ID**: ${iface.interfaceId}`);
        lines.push(`**Source Use Case**: ${iface.sourceUseCase}`);
        lines.push('');
      }

      // Request section
      lines.push('#### Request');
      lines.push('');
      lines.push(...this.formatRequestSection(endpoint));
      lines.push('');

      // Response section
      lines.push('#### Response');
      lines.push('');
      lines.push(...this.formatResponseSection(endpoint));
      lines.push('');

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate OpenAPI specification (YAML format)
   */
  public generateOpenAPISpec(
    endpoints: readonly APIEndpoint[],
    title: string,
    version: string
  ): string {
    const lines: string[] = [];

    lines.push('openapi: 3.0.3');
    lines.push('info:');
    lines.push(`  title: ${title}`);
    lines.push(`  version: ${version}`);
    lines.push('paths:');

    // Group endpoints by path
    const pathGroups = this.groupEndpointsByPath(endpoints);

    for (const [path, pathEndpoints] of pathGroups) {
      lines.push(`  ${path}:`);
      for (const endpoint of pathEndpoints) {
        lines.push(...this.formatOpenAPIOperation(endpoint));
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate TypeScript interface definitions from API endpoints
   */
  public generateTypeScriptInterfaces(endpoints: readonly APIEndpoint[]): string {
    const lines: string[] = [];
    const generatedInterfaces = new Set<string>();

    lines.push('/**');
    lines.push(' * Auto-generated TypeScript interfaces for API endpoints');
    lines.push(' */');
    lines.push('');

    for (const endpoint of endpoints) {
      try {
        // Generate request interface
        if (endpoint.request.body) {
          const reqInterfaceName = this.deriveInterfaceName(endpoint, 'Request');
          if (!generatedInterfaces.has(reqInterfaceName)) {
            generatedInterfaces.add(reqInterfaceName);
            lines.push(
              this.generateTypeScriptInterface(reqInterfaceName, endpoint.request.body.fields)
            );
            lines.push('');
          }
        }

        // Generate response interface
        if (endpoint.response.success.body) {
          const resInterfaceName = this.deriveInterfaceName(endpoint, 'Response');
          if (!generatedInterfaces.has(resInterfaceName)) {
            generatedInterfaces.add(resInterfaceName);
            lines.push(
              this.generateTypeScriptInterface(
                resInterfaceName,
                endpoint.response.success.body.fields
              )
            );
            lines.push('');
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new APISpecificationError(
          endpoint.endpoint,
          endpoint.method,
          `Failed to generate TypeScript interface: ${message}`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Format request section for documentation
   */
  private formatRequestSection(endpoint: APIEndpoint): string[] {
    const lines: string[] = [];

    // Headers
    if (endpoint.request.headers.length > 0) {
      lines.push('**Headers**:');
      lines.push('');
      lines.push('| Name | Description | Required |');
      lines.push('|------|-------------|----------|');
      for (const header of endpoint.request.headers) {
        const required = header.required ? 'Yes' : 'No';
        lines.push(`| \`${header.name}\` | ${header.description} | ${required} |`);
      }
      lines.push('');
    }

    // Path Parameters
    if (endpoint.request.pathParams.length > 0) {
      lines.push('**Path Parameters**:');
      lines.push('');
      lines.push('| Name | Type | Description | Required |');
      lines.push('|------|------|-------------|----------|');
      for (const param of endpoint.request.pathParams) {
        const required = param.required ? 'Yes' : 'No';
        lines.push(`| \`${param.name}\` | ${param.type} | ${param.description} | ${required} |`);
      }
      lines.push('');
    }

    // Query Parameters
    if (endpoint.request.queryParams.length > 0) {
      lines.push('**Query Parameters**:');
      lines.push('');
      lines.push('| Name | Type | Description | Required | Default |');
      lines.push('|------|------|-------------|----------|---------|');
      for (const param of endpoint.request.queryParams) {
        const required = param.required ? 'Yes' : 'No';
        const defaultVal = param.default ?? '-';
        lines.push(
          `| \`${param.name}\` | ${param.type} | ${param.description} | ${required} | ${defaultVal} |`
        );
      }
      lines.push('');
    }

    // Request Body
    if (endpoint.request.body) {
      lines.push('**Request Body**:');
      lines.push('');
      lines.push('```json');
      lines.push(this.formatBodyExample(endpoint.request.body));
      lines.push('```');
    }

    return lines;
  }

  /**
   * Format response section for documentation
   */
  private formatResponseSection(endpoint: APIEndpoint): string[] {
    const lines: string[] = [];

    // Success Response
    lines.push(
      `**Success Response** (${String(endpoint.response.success.status)}): ${endpoint.response.success.description}`
    );
    lines.push('');

    if (endpoint.response.success.body) {
      lines.push('```json');
      lines.push(this.formatBodyExample(endpoint.response.success.body));
      lines.push('```');
      lines.push('');
    }

    // Error Responses
    if (endpoint.response.errors.length > 0) {
      lines.push('**Error Responses**:');
      lines.push('');
      lines.push('| Status | Message | Code |');
      lines.push('|--------|---------|------|');
      for (const error of endpoint.response.errors) {
        const code = error.code ?? '-';
        lines.push(`| ${String(error.status)} | ${error.message} | ${code} |`);
      }
    }

    return lines;
  }

  /**
   * Format body schema as JSON example
   */
  private formatBodyExample(body: BodySchema): string {
    const example = body.example ?? this.generateExampleFromFields(body.fields);
    return JSON.stringify(example, null, 2);
  }

  /**
   * Generate example object from field specifications
   */
  private generateExampleFromFields(fields: readonly FieldSpec[]): Record<string, unknown> {
    const example: Record<string, unknown> = {};

    for (const field of fields) {
      example[field.name] = this.generateFieldExample(field);
    }

    return example;
  }

  /**
   * Generate example value for a field
   */
  private generateFieldExample(field: FieldSpec): unknown {
    switch (field.type) {
      case 'string':
        return this.getStringExample(field.name);
      case 'number':
        return 0;
      case 'boolean':
        return true;
      case 'date':
        return new Date().toISOString();
      case 'array':
        return [];
      case 'object':
        if (field.fields) {
          return this.generateExampleFromFields(field.fields);
        }
        return {};
      case 'null':
        return null;
      case 'file':
        return 'binary';
      default:
        return null;
    }
  }

  /**
   * Get example string value based on field name
   */
  private getStringExample(name: string): string {
    const examples: Record<string, string> = {
      id: 'uuid-v4-example',
      name: 'Example Name',
      email: 'user@example.com',
      password: '********',
      username: 'example_user',
      title: 'Example Title',
      description: 'Example description text',
      status: 'active',
      type: 'default',
      priority: 'medium',
      content: 'Example content',
      url: 'https://example.com',
      path: '/path/to/resource',
    };

    return examples[name] ?? 'string';
  }

  /**
   * Group endpoints by path
   */
  private groupEndpointsByPath(endpoints: readonly APIEndpoint[]): Map<string, APIEndpoint[]> {
    const groups = new Map<string, APIEndpoint[]>();

    for (const endpoint of endpoints) {
      const existing = groups.get(endpoint.endpoint) ?? [];
      existing.push(endpoint);
      groups.set(endpoint.endpoint, existing);
    }

    return groups;
  }

  /**
   * Format OpenAPI operation
   */
  private formatOpenAPIOperation(endpoint: APIEndpoint): string[] {
    const lines: string[] = [];
    const method = endpoint.method.toLowerCase();

    lines.push(`    ${method}:`);
    lines.push(`      summary: ${endpoint.description}`);
    lines.push('      responses:');
    lines.push(`        '${String(endpoint.response.success.status)}':`);
    lines.push(`          description: ${endpoint.response.success.description}`);

    for (const error of endpoint.response.errors) {
      lines.push(`        '${String(error.status)}':`);
      lines.push(`          description: ${error.message}`);
    }

    return lines;
  }

  /**
   * Derive interface name from endpoint
   */
  private deriveInterfaceName(endpoint: APIEndpoint, suffix: string): string {
    const parts = endpoint.endpoint.split('/').filter((p) => p !== '' && !p.startsWith('{'));
    const resourcePart = parts[parts.length - 1] ?? 'Resource';
    const resource = resourcePart.charAt(0).toUpperCase() + resourcePart.slice(1).replace(/s$/, '');
    const method = endpoint.method.charAt(0) + endpoint.method.slice(1).toLowerCase();

    return `${method}${resource}${suffix}`;
  }

  /**
   * Generate TypeScript interface from field specifications
   */
  private generateTypeScriptInterface(
    name: string,
    fields: readonly FieldSpec[],
    indent: number = 0
  ): string {
    const lines: string[] = [];
    const padding = '  '.repeat(indent);

    lines.push(`${padding}export interface ${name} {`);

    for (const field of fields) {
      const optional = field.required ? '' : '?';
      const tsType = this.fieldToTypeScriptType(field);
      lines.push(`${padding}  readonly ${field.name}${optional}: ${tsType};`);
    }

    lines.push(`${padding}}`);

    return lines.join('\n');
  }

  /**
   * Convert field spec to TypeScript type
   */
  private fieldToTypeScriptType(field: FieldSpec): string {
    return this.dataTypeToTypeScript(field.type, field.fields, field.items);
  }

  /**
   * Convert data type to TypeScript type
   */
  private dataTypeToTypeScript(
    type: DataType,
    nestedFields?: readonly FieldSpec[],
    arrayItems?: DataType | readonly FieldSpec[]
  ): string {
    switch (type) {
      case 'string':
      case 'file':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'string'; // ISO date string
      case 'null':
        return 'null';
      case 'array':
        if (arrayItems !== undefined) {
          if (typeof arrayItems === 'string') {
            return `${this.dataTypeToTypeScript(arrayItems)}[]`;
          }
          return 'unknown[]';
        }
        return 'unknown[]';
      case 'object':
        if (nestedFields && nestedFields.length > 0) {
          const props = nestedFields
            .map((f) => `${f.name}${f.required ? '' : '?'}: ${this.fieldToTypeScriptType(f)}`)
            .join('; ');
          return `{ ${props} }`;
        }
        return 'Record<string, unknown>';
      default:
        return 'unknown';
    }
  }
}
