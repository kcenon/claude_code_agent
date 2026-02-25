/**
 * Pipeline Stage Fixture Data
 *
 * Realistic but minimal output strings for each Greenfield pipeline stage.
 * Used by MockBridge to simulate agent responses during E2E smoke tests.
 *
 * Formats are derived from the AD-SDLC agent specifications and existing
 * test fixtures in the codebase.
 */

/**
 * Output from the project-initializer agent.
 * Creates the .ad-sdlc directory structure.
 */
export const initializerOutput = JSON.stringify({
  status: 'completed',
  directories: [
    '.ad-sdlc/scratchpad',
    '.ad-sdlc/scratchpad/info',
    '.ad-sdlc/scratchpad/documents',
    '.ad-sdlc/scratchpad/issues',
  ],
});

/**
 * Output from the mode-detector agent.
 * Detects project mode based on directory contents.
 */
export const modeDetectorOutput = JSON.stringify({
  detectedMode: 'greenfield',
  confidence: 0.95,
  reason: 'No existing codebase or documents found',
});

/**
 * Output from the collector agent.
 * Structures user requirements into collected_info YAML format.
 */
export const collectorOutput = [
  'collected_info:',
  '  project_name: smoke-test-project',
  '  project_description: A simple web application for E2E testing',
  '  functional_requirements:',
  '    - id: FR-001',
  '      title: User authentication',
  '      description: Users can log in with email and password',
  '      priority: high',
  '    - id: FR-002',
  '      title: Dashboard display',
  '      description: Show summary information after login',
  '      priority: medium',
  '  non_functional_requirements:',
  '    - id: NFR-001',
  '      title: Response time',
  '      description: Pages load within 2 seconds',
  '  constraints:',
  '    - TypeScript with Node.js runtime',
  '  assumptions:',
  '    - Users have modern web browsers',
  '  confidence: 0.85',
].join('\n');

/**
 * Output from the prd-writer agent.
 * Generates a PRD document from collected information.
 */
export const prdOutput = [
  '# Product Requirements Document',
  '',
  '## 1. Overview',
  'A simple web application providing user authentication and dashboard.',
  '',
  '## 2. Functional Requirements',
  '### FR-001: User Authentication',
  '- Users log in with email and password',
  '- Failed attempts show error messages',
  '',
  '### FR-002: Dashboard Display',
  '- Authenticated users see a summary dashboard',
  '',
  '## 3. Non-Functional Requirements',
  '### NFR-001: Performance',
  '- Pages load within 2 seconds',
  '',
  '## 4. Constraints',
  '- TypeScript with Node.js',
].join('\n');

/**
 * Output from the srs-writer agent.
 * Generates an SRS document from the PRD.
 */
export const srsOutput = [
  '# Software Requirements Specification',
  '',
  '## 1. System Features',
  '### SF-001: Authentication Module',
  '- Derived from: FR-001',
  '- Email/password login with bcrypt hashing',
  '- JWT token generation and validation',
  '',
  '### SF-002: Dashboard Module',
  '- Derived from: FR-002',
  '- Aggregates user-specific data for display',
  '',
  '## 2. Use Cases',
  '### UC-001: User Login',
  '- Actor: End User',
  '- Precondition: User has registered account',
  '- Main flow: Enter credentials, validate, issue JWT',
  '',
  '## 3. Data Model',
  '- User: { id, email, passwordHash, createdAt }',
  '- Session: { token, userId, expiresAt }',
].join('\n');

/**
 * Output from the repo-detector agent.
 * Checks for existing repository presence.
 */
export const repoDetectorOutput = JSON.stringify({
  repositoryExists: false,
  suggestedName: 'smoke-test-project',
});

/**
 * Output from the github-repo-setup agent.
 * Creates and initializes a GitHub repository.
 */
export const githubRepoSetupOutput = JSON.stringify({
  status: 'completed',
  repository: 'mock-org/smoke-test-project',
  url: 'https://github.com/mock-org/smoke-test-project',
});

/**
 * Output from the sds-writer agent.
 * Generates an SDS document from the SRS.
 */
export const sdsOutput = [
  '# Software Design Specification',
  '',
  '## 1. Architecture Overview',
  'Three-layer architecture: API, Service, Data.',
  '',
  '## 2. Components',
  '### CMP-001: AuthController',
  '- Handles login/logout HTTP endpoints',
  '- Depends on: AuthService',
  '',
  '### CMP-002: AuthService',
  '- Business logic for credential validation',
  '- Depends on: UserRepository',
  '',
  '### CMP-003: DashboardController',
  '- Serves dashboard data',
  '- Depends on: DashboardService',
  '',
  '## 3. Interfaces',
  '- POST /api/auth/login',
  '- GET /api/dashboard',
].join('\n');

/**
 * Output from the issue-generator agent.
 * Generates GitHub issues from the SDS components.
 */
export const issueGeneratorOutput = JSON.stringify({
  issues: [
    {
      title: 'Implement AuthController (CMP-001)',
      labels: ['component', 'auth'],
      priority: 'high',
    },
    {
      title: 'Implement AuthService (CMP-002)',
      labels: ['component', 'auth'],
      priority: 'high',
    },
    {
      title: 'Implement DashboardController (CMP-003)',
      labels: ['component', 'dashboard'],
      priority: 'medium',
    },
  ],
  totalCount: 3,
});

/**
 * Output from the controller (orchestration) agent.
 * Distributes work orders to worker agents.
 */
export const controllerOutput = JSON.stringify({
  workOrders: [
    { issueNumber: 1, assignedTo: 'worker-1', priority: 'high' },
    { issueNumber: 2, assignedTo: 'worker-1', priority: 'high' },
    { issueNumber: 3, assignedTo: 'worker-2', priority: 'medium' },
  ],
  strategy: 'sequential',
});

/**
 * Output from the worker agent.
 * Implements assigned issues.
 */
export const workerOutput = JSON.stringify({
  status: 'completed',
  implemented: 3,
  filesCreated: ['src/auth/controller.ts', 'src/auth/service.ts', 'src/dashboard/controller.ts'],
});

/**
 * Output from the pr-reviewer agent.
 * Creates and reviews pull requests.
 */
export const prReviewerOutput = JSON.stringify({
  status: 'approved',
  pullRequests: [
    { number: 1, title: 'feat(auth): implement authentication', state: 'merged' },
    { number: 2, title: 'feat(dashboard): implement dashboard', state: 'merged' },
  ],
});

/**
 * Complete response map for all Greenfield pipeline agent types.
 * Keys match the agentType field in GREENFIELD_STAGES.
 */
export const GREENFIELD_RESPONSES: Record<string, string> = {
  'project-initializer': initializerOutput,
  'mode-detector': modeDetectorOutput,
  'collector': collectorOutput,
  'prd-writer': prdOutput,
  'srs-writer': srsOutput,
  'repo-detector': repoDetectorOutput,
  'github-repo-setup': githubRepoSetupOutput,
  'sds-writer': sdsOutput,
  'issue-generator': issueGeneratorOutput,
  'controller': controllerOutput,
  'worker': workerOutput,
  'pr-reviewer': prReviewerOutput,
};
