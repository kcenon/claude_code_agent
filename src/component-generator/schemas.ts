/**
 * Component Generator module schema definitions
 *
 * Defines schema version and validation patterns for component generation.
 */

/**
 * Current schema version for component definitions
 */
export const COMPONENT_SCHEMA_VERSION = '1.0.0';

/**
 * Component ID pattern (CMP-XXX)
 */
export const COMPONENT_ID_PATTERN = /^CMP-\d{3}$/;

/**
 * Interface ID pattern (API-XXX, EVT-XXX, FILE-XXX)
 */
export const INTERFACE_ID_PATTERN = /^(API|EVT|FILE|MSG|CB)-\d{3}$/;

/**
 * Feature ID pattern (SF-XXX)
 */
export const FEATURE_ID_PATTERN = /^SF-\d{3}$/;

/**
 * Use case ID pattern (UC-XXX)
 */
export const USE_CASE_ID_PATTERN = /^UC-\d{3}$/;

/**
 * Valid HTTP methods
 */
export const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Valid interface types
 */
export const VALID_INTERFACE_TYPES = ['API', 'Event', 'File', 'Message', 'Callback'] as const;

/**
 * Valid component layers
 */
export const VALID_COMPONENT_LAYERS = [
  'presentation',
  'application',
  'domain',
  'infrastructure',
  'integration',
] as const;

/**
 * Valid data types for API specifications
 */
export const VALID_DATA_TYPES = [
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'date',
  'file',
] as const;

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS_CODES = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Default error responses for common status codes
 */
export const DEFAULT_ERROR_RESPONSES = {
  400: { status: 400, message: 'Invalid input', code: 'INVALID_INPUT' },
  401: { status: 401, message: 'Authentication required', code: 'UNAUTHORIZED' },
  403: { status: 403, message: 'Access forbidden', code: 'FORBIDDEN' },
  404: { status: 404, message: 'Resource not found', code: 'NOT_FOUND' },
  409: { status: 409, message: 'Resource conflict', code: 'CONFLICT' },
  422: { status: 422, message: 'Validation error', code: 'VALIDATION_ERROR' },
  429: { status: 429, message: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
  500: { status: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' },
} as const;

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT = {
  requests: 100,
  window: 60,
} as const;

/**
 * Common request headers
 */
export const COMMON_HEADERS = {
  AUTHORIZATION: {
    name: 'Authorization',
    description: 'Bearer token for authentication',
    required: true,
    example: 'Bearer {token}',
  },
  CONTENT_TYPE: {
    name: 'Content-Type',
    description: 'Request body content type',
    required: true,
    example: 'application/json',
  },
  ACCEPT: {
    name: 'Accept',
    description: 'Expected response content type',
    required: false,
    example: 'application/json',
  },
  CORRELATION_ID: {
    name: 'X-Correlation-ID',
    description: 'Request correlation identifier for tracing',
    required: false,
    example: 'uuid-v4',
  },
} as const;

/**
 * Component layer descriptions
 */
export const LAYER_DESCRIPTIONS: Record<string, string> = {
  presentation: 'Handles user interface and external API endpoints',
  application: 'Orchestrates business workflows and use case execution',
  domain: 'Contains core business logic and domain models',
  infrastructure: 'Manages technical concerns like persistence and messaging',
  integration: 'Handles communication with external systems and services',
};

/**
 * Interface type prefixes for ID generation
 */
export const INTERFACE_TYPE_PREFIXES: Record<string, string> = {
  API: 'API',
  Event: 'EVT',
  File: 'FILE',
  Message: 'MSG',
  Callback: 'CB',
};
