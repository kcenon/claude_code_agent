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
 * Output from the sdp-writer agent.
 * Generates a Software Development Plan document from PRD and SRS.
 */
export const sdpOutput = [
  '# Software Development Plan',
  '',
  '## 1. Project Overview',
  '- Project: smoke-test-project',
  '- Stakeholders: Product, Engineering, QA',
  '',
  '## 2. Development Lifecycle Model',
  '- Model: Iterative',
  '- Sprint length: 2 weeks',
  '',
  '## 3. Development Environment',
  '- Language: TypeScript',
  '- VCS: Git / GitHub',
  '- CI: GitHub Actions',
  '',
  '## 4. Artifact Definitions',
  '- PRD, SRS, SDS, Source Code, Test Suite',
  '',
  '## 5. Quality Assurance Strategy',
  '- Code review on every PR',
  '- Coverage threshold: 80%',
  '',
  '## 6. Verification & Validation Strategy',
  '- Derived from 2 SRS features',
  '- Unit, integration, and E2E test levels',
  '',
  '## 7. Risk Management',
  '- Schedule risk: medium',
  '',
  '## 8. Schedule & Milestones',
  '- M1: PRD approved',
  '- M2: SRS approved',
  '- M3: Implementation complete',
  '',
  '## 9. Configuration Management',
  '- Branch strategy: feature branches from main',
  '- Release tagging: semver',
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
 * Output from the threat-model-writer agent.
 * Generates a Threat Model document using STRIDE categorization and
 * DREAD risk scoring, derived from the SDS components.
 */
export const threatModelOutput = [
  '# Threat Model: smoke-test-project',
  '',
  '## 1. System Overview',
  '- Product: smoke-test-project',
  '- Source SDS: SDS-smoke-test-project',
  '- Components analysed: 3',
  '- API surface detected: Yes',
  '- Data layer detected: No',
  '',
  '### 1.1 Data Flow Diagram',
  '',
  '```mermaid',
  'flowchart LR',
  '    User([External User])',
  '    API[API Gateway]',
  '    User -->|HTTPS| API',
  '    CMP_001[AuthController]',
  '    API --> CMP_001',
  '```',
  '',
  '## 2. Threat Identification (STRIDE)',
  '',
  '| ID | STRIDE Category | Target | Threat |',
  '|----|-----------------|--------|--------|',
  '| T1 | Spoofing | AuthController | Authentication bypass via forged credentials |',
  '| T2 | Tampering | AuthService | Unauthorized modification of persisted data |',
  '| T3 | Repudiation | AuthController | Insufficient audit trail for privileged actions |',
  '| T4 | Information Disclosure | AuthController | Sensitive data exposure in responses or logs |',
  '| T5 | Denial of Service | Public API | Resource exhaustion via uncontrolled request load |',
  '| T6 | Elevation of Privilege | AuthController | Privilege escalation through missing authorization checks |',
  '',
  '## 3. Risk Assessment (DREAD)',
  '',
  '| ID | Damage | Reproducibility | Exploitability | Affected Users | Discoverability | Overall |',
  '|----|--------|-----------------|----------------|----------------|-----------------|---------|',
  '| T1 | 8 | 6 | 5 | 8 | 6 | 6.6 |',
  '| T2 | 7 | 5 | 4 | 7 | 5 | 5.6 |',
  '| T3 | 5 | 6 | 4 | 6 | 5 | 5.2 |',
  '| T4 | 8 | 7 | 6 | 8 | 7 | 7.2 |',
  '| T5 | 6 | 8 | 7 | 9 | 8 | 7.6 |',
  '| T6 | 9 | 5 | 4 | 7 | 5 | 6.0 |',
  '',
  '## 4. Mitigation Strategies',
  '- Strong authentication with MFA and token rotation',
  '- Parameterized queries and input validation',
  '- Append-only audit logging with tamper protection',
  '- Data classification, masking, encryption at rest and in transit',
  '- Rate limiting and circuit breakers',
  '- Role-based access control with deny-by-default',
  '',
  '## 5. Residual Risk Summary',
  '- High: 0',
  '- Medium: 3',
  '- Low: 3',
].join('\n');

/**
 * Output from the svp-writer agent.
 * Generates a Software Verification Plan with derived test cases from the SRS.
 */
export const svpOutput = [
  '# Software Verification Plan: smoke-test-project',
  '',
  '| **Document ID** | **Source SRS** | **Source SDS** | **Version** | **Status** |',
  '|-----------------|----------------|----------------|-------------|------------|',
  '| SVP-smoke-test-project | SRS-smoke-test-project | SDS-smoke-test-project | 1.0.0 | Draft |',
  '',
  '## 1. Verification Strategy',
  '',
  'Standard testing pyramid: unit, integration, system.',
  '',
  '## 2. Test Environment',
  '',
  '- Source SRS: SRS-smoke-test-project',
  '- Source SDS: SDS-smoke-test-project',
  '- Use cases analysed: 2',
  '- NFRs analysed: 1',
  '',
  '## 3. Unit Verification',
  '',
  '| ID | Source | Title | Priority | Expected |',
  '|----|--------|-------|----------|----------|',
  '| TC-003 | UC-001 | Login — precondition #1 violated | P1 | System rejects the request |',
  '',
  '## 4. Integration Verification',
  '',
  '| ID | Source | Title | Priority | Expected |',
  '|----|--------|-------|----------|----------|',
  '| TC-002 | UC-001 | Login — alt #1 | P1 | System handles failure gracefully |',
  '| TC-005 | NFR-001 | Performance verification | P1 | Latency target satisfied |',
  '',
  '## 5. System Verification',
  '',
  '| ID | Source | Title | Priority | Expected |',
  '|----|--------|-------|----------|----------|',
  '| TC-001 | UC-001 | Login — happy path | P1 | Session is established |',
  '| TC-004 | UC-002 | Logout — happy path | P1 | Session no longer exists |',
  '',
  '## 6. Traceability Matrix',
  '',
  '| Source ID | Kind | Test Cases |',
  '|-----------|------|------------|',
  '| UC-001 | Use Case | TC-001, TC-002, TC-003 |',
  '| UC-002 | Use Case | TC-004 |',
  '| NFR-001 | NFR | TC-005 |',
  '',
  '## 7. Coverage Summary',
  '',
  '| Metric | Count |',
  '|--------|-------|',
  '| Total test cases | 5 |',
  '| Unit tests | 1 |',
  '| Integration tests | 2 |',
  '| System tests | 2 |',
  '| Use cases covered | 2 |',
  '| NFRs covered | 1 |',
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
 * Output from the validation agent.
 * Validates implementation against requirements and acceptance criteria.
 */
export const validationOutput = JSON.stringify({
  status: 'completed',
  overallResult: 'pass',
  requirementsCoverage: 1.0,
  acceptanceCriteriaPassed: 6,
  acceptanceCriteriaFailed: 0,
});

/**
 * Output from the tech-decision-writer agent.
 * Generates Technology Decision comparison documents from the SDS tech stack.
 */
export const techDecisionOutput = [
  '# Tech Decision 001: Runtime Selection',
  '',
  '| **Document ID** | **Source SDS** | **Version** | **Status** |',
  '|-----------------|----------------|-------------|------------|',
  '| TD-001-runtime-selection | SDS-smoke-test-project | 1.0.0 | Draft |',
  '',
  '## 1. Context',
  'The Runtime layer for smoke-test-project needs a technology that satisfies the project constraints described in SDS-smoke-test-project.',
  '',
  '## 2. Candidates',
  '',
  '| Name | Category | License | Maturity | Description |',
  '|------|----------|---------|----------|-------------|',
  '| Node.js | Runtime | MIT | Mature | Event-driven JavaScript runtime |',
  '| Deno | Runtime | MIT | Stable | Secure TypeScript-first runtime |',
  '| Bun | Runtime | MIT | Emerging | Fast JavaScript runtime with built-in tooling |',
  '',
  '## 3. Evaluation Criteria',
  '',
  '| Criterion | Weight | Description |',
  '|-----------|--------|-------------|',
  '| Performance | 25% | Throughput, latency, and resource efficiency |',
  '| Ecosystem | 20% | Maturity of libraries and tooling |',
  '| Learning | 15% | Learning curve and documentation |',
  '| Maintenance | 15% | Operational burden and upgrade cadence |',
  '| Cost | 15% | License and hosting cost |',
  '| Security | 10% | Vulnerability track record |',
  '',
  '## 4. Evaluation Matrix',
  '',
  '| Candidate | Performance | Ecosystem | Learning | Maintenance | Cost | Security | Weighted Total |',
  '|-----------|-------------|-----------|----------|-------------|------|----------|----------------|',
  '| Node.js | 8 | 8 | 8 | 8 | 8 | 8 | 8.0 |',
  '| Deno | 6 | 6 | 6 | 6 | 6 | 6 | 6.0 |',
  '| Bun | 6 | 6 | 6 | 6 | 6 | 6 | 6.0 |',
  '',
  '## 5. Decision',
  '',
  '**Selected:** Node.js',
  '',
  '**Decided on:** 2026-04-12',
  '',
  '**Rationale:** Node.js is the technology declared in the SDS for the Runtime layer.',
  '',
  '## 6. Consequences',
  '',
  '### Positive',
  '- Leverages the Runtime strengths of Node.js 20.x',
  '- Aligns with the declared SDS technology stack',
  '',
  '### Negative',
  '- The team accepts the Node.js learning curve and operational burden',
  '',
  '### Risks',
  '- Node.js upstream changes may require follow-up upgrades',
  '',
  '## 7. References',
  '- SDS: SDS-smoke-test-project',
].join('\n');

/**
 * Complete response map for all Greenfield pipeline agent types.
 * Keys match the agentType field in GREENFIELD_STAGES.
 */
/**
 * Output from the doc-index-generator agent.
 * Generates documentation index YAML files.
 */
export const docIndexGeneratorOutput = JSON.stringify({
  status: 'completed',
  artifacts: [
    'docs/.index/manifest.yaml',
    'docs/.index/bundles.yaml',
    'docs/.index/graph.yaml',
    'docs/.index/router.yaml',
  ],
  stats: {
    documentsIndexed: 3,
    bundlesCreated: 1,
    crossReferences: 2,
    processingTimeMs: 150,
  },
});

export const GREENFIELD_RESPONSES: Record<string, string> = {
  'project-initializer': initializerOutput,
  'mode-detector': modeDetectorOutput,
  collector: collectorOutput,
  'prd-writer': prdOutput,
  'srs-writer': srsOutput,
  'sdp-writer': sdpOutput,
  'repo-detector': repoDetectorOutput,
  'github-repo-setup': githubRepoSetupOutput,
  'sds-writer': sdsOutput,
  'threat-model-writer': threatModelOutput,
  'tech-decision-writer': techDecisionOutput,
  'issue-generator': issueGeneratorOutput,
  'svp-writer': svpOutput,
  controller: controllerOutput,
  worker: workerOutput,
  validation: validationOutput,
  'pr-reviewer': prReviewerOutput,
  'doc-index-generator': docIndexGeneratorOutput,
};
