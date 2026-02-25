/**
 * Test Fixtures for E2E Tests
 *
 * Provides predefined test inputs for various pipeline scenarios.
 */

/**
 * Simple feature input - single requirement
 */
export const SIMPLE_FEATURE_INPUT = `
Build a user login feature for a web application.

Requirements:
- Users should be able to log in with email and password
- The system should validate email format
- Failed login attempts should show an error message
- Successful login should redirect to the dashboard

Non-functional requirements:
- Login should complete within 2 seconds
- Password must be at least 8 characters
`;

/**
 * Medium feature input - multiple requirements with dependencies
 */
export const MEDIUM_FEATURE_INPUT = `
Build a user dashboard with widgets for a project management application.

Functional Requirements:
1. FR-001: Display user profile information including name, email, and avatar
2. FR-002: Show a list of recent projects with status indicators
3. FR-003: Display task summary widget showing pending, in-progress, and completed tasks
4. FR-004: Provide quick action buttons for creating new projects and tasks
5. FR-005: Show notification center with unread count badge

Dependencies:
- FR-002 depends on FR-001 (user context required)
- FR-003 depends on FR-002 (project context required)
- FR-005 depends on FR-001 (user preferences for notifications)

Non-functional Requirements:
- NFR-001 Performance: Dashboard should load within 3 seconds
- NFR-002 Responsiveness: Must work on mobile and desktop
- NFR-003 Security: All API calls must be authenticated

Constraints:
- Must use existing authentication system
- Must integrate with existing REST API
`;

/**
 * Complex feature input - many requirements with parallel work possible
 */
export const COMPLEX_FEATURE_INPUT = `
Build a complete e-commerce checkout system.

# Product Overview
A multi-step checkout flow that handles cart management, shipping, payment, and order confirmation.

# Functional Requirements

## Cart Management
- FR-001: Display cart items with quantities and prices
- FR-002: Allow quantity updates for cart items
- FR-003: Support removing items from cart
- FR-004: Calculate subtotal, tax, and total
- FR-005: Apply discount codes and promotions

## Shipping
- FR-006: Collect shipping address with validation
- FR-007: Offer multiple shipping options with costs
- FR-008: Calculate shipping based on location and weight
- FR-009: Support address book for saved addresses
- FR-010: Validate addresses with external service

## Payment
- FR-011: Support credit card payments
- FR-012: Support PayPal integration
- FR-013: Support Apple Pay and Google Pay
- FR-014: Handle payment validation and errors
- FR-015: Store payment methods securely

## Order Processing
- FR-016: Create order from cart contents
- FR-017: Generate unique order numbers
- FR-018: Send order confirmation email
- FR-019: Update inventory after purchase
- FR-020: Create shipping labels

# Non-Functional Requirements
- NFR-001: Checkout must complete in under 30 seconds
- NFR-002: Support 1000 concurrent checkout sessions
- NFR-003: 99.9% uptime for payment processing
- NFR-004: PCI DSS compliance for payment data
- NFR-005: GDPR compliance for customer data

# Constraints
- Must use Stripe for credit card processing
- Must integrate with existing inventory system
- Maximum 5 steps in checkout flow

# Assumptions
- Users have already authenticated
- Products are already in the database
- Shipping carriers API is available
`;

/**
 * Minimal input for error recovery testing
 */
export const MINIMAL_INPUT = `
Create a hello world application.
- Display "Hello, World!" on the screen
`;

/**
 * Input with missing information for clarification testing
 */
export const INCOMPLETE_INPUT = `
Build a notification system.
`;

/**
 * Input with conflicting requirements for consistency testing
 */
export const CONFLICTING_INPUT = `
Build a user management system.

Requirements:
- FR-001: Users can only access their own data (strict isolation)
- FR-002: Admins can view all user data
- FR-003: All user data is public by default
- FR-004: Users must authenticate to access any feature
- FR-005: Guest users can access basic features without login

Performance:
- System must handle 10,000 concurrent users
- Each request must complete in under 10ms
- Full database sync on every request
`;

/**
 * Technical specification input
 */
export const TECHNICAL_SPEC_INPUT = `
# API Gateway Service

## Overview
Build a high-performance API gateway that handles routing, authentication, and rate limiting.

## Functional Requirements
- FR-001: Route requests to appropriate backend services based on URL patterns
- FR-002: Authenticate requests using JWT tokens
- FR-003: Implement rate limiting per API key
- FR-004: Cache responses for GET requests
- FR-005: Transform request/response formats
- FR-006: Log all requests with timing information
- FR-007: Health check endpoints for monitoring
- FR-008: Circuit breaker for failing backends

## Technical Specifications
- Language: TypeScript
- Runtime: Node.js 20+
- Framework: Express.js
- Cache: Redis
- Database: PostgreSQL for configuration

## Non-Functional Requirements
- NFR-001: Handle 10,000 requests per second
- NFR-002: P99 latency under 50ms
- NFR-003: 99.99% availability
- NFR-004: Horizontal scalability
- NFR-005: Zero-downtime deployments

## Security Requirements
- All traffic must be HTTPS
- JWT validation with key rotation
- IP-based blocking capability
- Rate limiting per IP and API key
`;

/**
 * Get fixture by name
 */
export function getFixture(
  name:
    | 'simple'
    | 'medium'
    | 'complex'
    | 'minimal'
    | 'incomplete'
    | 'conflicting'
    | 'technical'
): string {
  switch (name) {
    case 'simple':
      return SIMPLE_FEATURE_INPUT;
    case 'medium':
      return MEDIUM_FEATURE_INPUT;
    case 'complex':
      return COMPLEX_FEATURE_INPUT;
    case 'minimal':
      return MINIMAL_INPUT;
    case 'incomplete':
      return INCOMPLETE_INPUT;
    case 'conflicting':
      return CONFLICTING_INPUT;
    case 'technical':
      return TECHNICAL_SPEC_INPUT;
    default:
      throw new Error(`Unknown fixture: ${String(name)}`);
  }
}

/**
 * Expected characteristics for each fixture
 */
export const FIXTURE_EXPECTATIONS = {
  simple: {
    minRequirements: 3,
    maxRequirements: 6,
    expectedIssues: { min: 1, max: 5 },
    maxTimeMs: 30000,
  },
  medium: {
    minRequirements: 5,
    maxRequirements: 10,
    expectedIssues: { min: 3, max: 10 },
    maxTimeMs: 45000,
  },
  complex: {
    minRequirements: 15,
    maxRequirements: 30,
    // SRS Writer consolidates related FRs into fewer features, producing
    // fewer components and issues than the raw FR count suggests.
    expectedIssues: { min: 3, max: 30 },
    maxTimeMs: 90000,
  },
  minimal: {
    minRequirements: 1,
    maxRequirements: 3,
    expectedIssues: { min: 1, max: 3 },
    maxTimeMs: 20000,
  },
  technical: {
    minRequirements: 8,
    maxRequirements: 15,
    expectedIssues: { min: 5, max: 15 },
    maxTimeMs: 60000,
  },
};
