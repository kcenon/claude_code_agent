/**
 * Error Code Registry
 *
 * Standardized error codes for all modules in the AD-SDLC system.
 * Each code follows the pattern: MODULE-NNN
 *
 * @module errors/codes
 */

/**
 * Controller module error codes (CTL-xxx)
 */
export const ControllerErrorCodes = {
  // Graph errors (001-019)
  CTL_GRAPH_NOT_FOUND: 'CTL-001',
  CTL_GRAPH_PARSE_ERROR: 'CTL-002',
  CTL_GRAPH_VALIDATION_ERROR: 'CTL-003',
  CTL_CIRCULAR_DEPENDENCY: 'CTL-004',
  CTL_EMPTY_GRAPH: 'CTL-005',
  CTL_ISSUE_NOT_FOUND: 'CTL-006',
  CTL_PRIORITY_ANALYSIS_ERROR: 'CTL-007',

  // Worker pool errors (020-039)
  CTL_NO_AVAILABLE_WORKER: 'CTL-020',
  CTL_WORKER_NOT_FOUND: 'CTL-021',
  CTL_WORKER_NOT_AVAILABLE: 'CTL-022',
  CTL_WORK_ORDER_NOT_FOUND: 'CTL-023',
  CTL_WORK_ORDER_CREATION_ERROR: 'CTL-024',
  CTL_WORKER_ASSIGNMENT_ERROR: 'CTL-025',
  CTL_STATE_PERSISTENCE_ERROR: 'CTL-026',
  CTL_DEPENDENCIES_NOT_RESOLVED: 'CTL-027',

  // Progress monitor errors (040-049)
  CTL_PROGRESS_MONITOR_RUNNING: 'CTL-040',
  CTL_PROGRESS_MONITOR_NOT_RUNNING: 'CTL-041',
  CTL_PROGRESS_REPORT_ERROR: 'CTL-042',
  CTL_PROGRESS_PERSISTENCE_ERROR: 'CTL-043',

  // Health check errors (050-059)
  CTL_HEALTH_MONITOR_RUNNING: 'CTL-050',
  CTL_HEALTH_MONITOR_NOT_RUNNING: 'CTL-051',
  CTL_ZOMBIE_WORKER: 'CTL-052',
  CTL_WORKER_RESTART_ERROR: 'CTL-053',
  CTL_MAX_RESTARTS_EXCEEDED: 'CTL-054',
  CTL_TASK_REASSIGNMENT_ERROR: 'CTL-055',

  // Stuck worker errors (060-069)
  CTL_STUCK_WORKER_RECOVERY_ERROR: 'CTL-060',
  CTL_STUCK_WORKER_CRITICAL: 'CTL-061',
  CTL_MAX_RECOVERY_EXCEEDED: 'CTL-062',

  // Queue errors (070-079)
  CTL_QUEUE_FULL: 'CTL-070',
  CTL_QUEUE_MEMORY_LIMIT: 'CTL-071',
  CTL_QUEUE_BACKPRESSURE: 'CTL-072',
  CTL_TASK_PRIORITY_LOW: 'CTL-073',
} as const;

/**
 * Worker module error codes (WRK-xxx)
 */
export const WorkerErrorCodes = {
  // Parse/context errors (001-009)
  WRK_WORK_ORDER_PARSE_ERROR: 'WRK-001',
  WRK_CONTEXT_ANALYSIS_ERROR: 'WRK-002',

  // File errors (010-019)
  WRK_FILE_READ_ERROR: 'WRK-010',
  WRK_FILE_WRITE_ERROR: 'WRK-011',

  // Git errors (020-029)
  WRK_BRANCH_CREATION_ERROR: 'WRK-020',
  WRK_BRANCH_EXISTS: 'WRK-021',
  WRK_COMMIT_ERROR: 'WRK-022',
  WRK_GIT_OPERATION_ERROR: 'WRK-023',

  // Generation errors (030-039)
  WRK_CODE_GENERATION_ERROR: 'WRK-030',
  WRK_TEST_GENERATION_ERROR: 'WRK-031',

  // Verification errors (040-049)
  WRK_VERIFICATION_ERROR: 'WRK-040',
  WRK_TYPE_CHECK_ERROR: 'WRK-041',
  WRK_VERIFICATION_PIPELINE_ERROR: 'WRK-042',

  // Execution errors (050-059)
  WRK_MAX_RETRIES_EXCEEDED: 'WRK-050',
  WRK_IMPLEMENTATION_BLOCKED: 'WRK-051',
  WRK_RESULT_PERSISTENCE_ERROR: 'WRK-052',
  WRK_COMMAND_EXECUTION_ERROR: 'WRK-053',
  WRK_COMMAND_TIMEOUT: 'WRK-054',
  WRK_OPERATION_TIMEOUT: 'WRK-055',

  // Self-fix errors (060-069)
  WRK_SELF_FIX_ERROR: 'WRK-060',
  WRK_ESCALATION_REQUIRED: 'WRK-061',

  // Checkpoint errors (070-079)
  WRK_CHECKPOINT_SAVE_ERROR: 'WRK-070',
  WRK_CHECKPOINT_LOAD_ERROR: 'WRK-071',
  WRK_CHECKPOINT_INVALID: 'WRK-072',
  WRK_CHECKPOINT_EXPIRED: 'WRK-073',
} as const;

/**
 * State Manager error codes (STM-xxx)
 */
export const StateManagerErrorCodes = {
  // Transition errors (001-009)
  STM_INVALID_TRANSITION: 'STM-001',
  STM_INVALID_SKIP: 'STM-002',
  STM_REQUIRED_STAGE_SKIP: 'STM-003',

  // State errors (010-019)
  STM_STATE_NOT_FOUND: 'STM-010',
  STM_PROJECT_NOT_FOUND: 'STM-011',
  STM_PROJECT_EXISTS: 'STM-012',
  STM_VALIDATION_FAILED: 'STM-013',

  // Lock errors (020-029)
  STM_LOCK_FAILED: 'STM-020',

  // History errors (030-039)
  STM_HISTORY_ERROR: 'STM-030',
  STM_WATCH_ERROR: 'STM-031',

  // Checkpoint errors (040-049)
  STM_CHECKPOINT_NOT_FOUND: 'STM-040',
  STM_CHECKPOINT_VALIDATION_FAILED: 'STM-041',

  // Recovery errors (050-059)
  STM_ADMIN_AUTH_FAILED: 'STM-050',
  STM_RECOVERY_FAILED: 'STM-051',
} as const;

/**
 * PR Reviewer error codes (PRR-xxx)
 */
export const PRReviewerErrorCodes = {
  // Input errors (001-009)
  PRR_IMPLEMENTATION_NOT_FOUND: 'PRR-001',
  PRR_IMPLEMENTATION_PARSE_ERROR: 'PRR-002',

  // PR operation errors (010-019)
  PRR_CREATION_ERROR: 'PRR-010',
  PRR_ALREADY_EXISTS: 'PRR-011',
  PRR_NOT_FOUND: 'PRR-012',
  PRR_MERGE_ERROR: 'PRR-013',
  PRR_CLOSE_ERROR: 'PRR-014',

  // Review errors (020-029)
  PRR_SUBMISSION_ERROR: 'PRR-020',
  PRR_COMMENT_ERROR: 'PRR-021',

  // CI/CD errors (030-039)
  PRR_CI_TIMEOUT: 'PRR-030',
  PRR_CI_CHECK_FAILED: 'PRR-031',
  PRR_CIRCUIT_OPEN: 'PRR-032',
  PRR_CI_MAX_POLLS: 'PRR-033',
  PRR_CI_TERMINAL_FAILURE: 'PRR-034',

  // Quality gate errors (040-049)
  PRR_QUALITY_GATE_FAILED: 'PRR-040',
  PRR_COVERAGE_BELOW_THRESHOLD: 'PRR-041',
  PRR_SECURITY_VULNERABILITY: 'PRR-042',

  // Git errors (050-059)
  PRR_GIT_OPERATION_ERROR: 'PRR-050',
  PRR_BRANCH_NOT_FOUND: 'PRR-051',
  PRR_BRANCH_NAMING_ERROR: 'PRR-052',

  // Execution errors (060-069)
  PRR_COMMAND_EXECUTION_ERROR: 'PRR-060',
  PRR_RESULT_PERSISTENCE_ERROR: 'PRR-061',
} as const;

/**
 * Error Handler module error codes (ERH-xxx)
 */
export const ErrorHandlerErrorCodes = {
  ERH_MAX_RETRIES_EXCEEDED: 'ERH-001',
  ERH_OPERATION_TIMEOUT: 'ERH-002',
  ERH_OPERATION_ABORTED: 'ERH-003',
  ERH_NON_RETRYABLE: 'ERH-004',
  ERH_INVALID_RETRY_POLICY: 'ERH-005',
  ERH_RETRY_CONTEXT: 'ERH-006',
  ERH_CIRCUIT_OPEN: 'ERH-007',
  ERH_INVALID_CIRCUIT_BREAKER: 'ERH-008',
} as const;

/**
 * Scratchpad module error codes (SCR-xxx)
 */
export const ScratchpadErrorCodes = {
  SCR_LOCK_ERROR: 'SCR-001',
  SCR_LOCK_CONTENTION: 'SCR-002',
  SCR_LOCK_STOLEN: 'SCR-003',
  SCR_LOCK_TIMEOUT: 'SCR-004',
} as const;

/**
 * Config module error codes (CFG-xxx)
 */
export const ConfigErrorCodes = {
  CFG_NOT_FOUND: 'CFG-001',
  CFG_PARSE_ERROR: 'CFG-002',
  CFG_VALIDATION_ERROR: 'CFG-003',
} as const;

/**
 * Security module error codes (SEC-xxx)
 */
export const SecurityErrorCodes = {
  SEC_VALIDATION_ERROR: 'SEC-001',
  SEC_SANITIZATION_ERROR: 'SEC-002',
  SEC_AUTHENTICATION_ERROR: 'SEC-003',
  SEC_AUTHORIZATION_ERROR: 'SEC-004',
} as const;

/**
 * Monitoring module error codes (MON-xxx)
 */
export const MonitoringErrorCodes = {
  MON_METRIC_ERROR: 'MON-001',
  MON_ALERT_ERROR: 'MON-002',
  MON_HEALTH_CHECK_ERROR: 'MON-003',
} as const;

/**
 * Control-Plane module error codes (CPL-xxx)
 */
export const ControlPlaneErrorCodes = {
  // Pipeline errors (001-009)
  CPL_PIPELINE_START_ERROR: 'CPL-001',
  CPL_PIPELINE_RESUME_ERROR: 'CPL-002',
  CPL_PIPELINE_STATE_ERROR: 'CPL-003',

  // Agent lifecycle errors (010-019)
  CPL_AGENT_NOT_REGISTERED: 'CPL-010',
  CPL_AGENT_ALREADY_REGISTERED: 'CPL-011',
  CPL_AGENT_LIFECYCLE_ERROR: 'CPL-012',

  // Mode detection errors (020-029)
  CPL_MODE_DETECTION_ERROR: 'CPL-020',

  // Initialization errors (030-039)
  CPL_INIT_ERROR: 'CPL-030',
} as const;

/**
 * Generic error codes (GEN-xxx)
 */
export const GenericErrorCodes = {
  GEN_UNKNOWN: 'GEN-001',
  GEN_INTERNAL: 'GEN-002',
  GEN_INVALID_ARGUMENT: 'GEN-003',
  GEN_NOT_IMPLEMENTED: 'GEN-004',
  GEN_TIMEOUT: 'GEN-005',
  GEN_NETWORK_ERROR: 'GEN-006',
} as const;

/**
 * Document error codes (DOC-xxx)
 *
 * For PRD, SRS, SDS, and other document-related errors
 */
export const DocumentErrorCodes = {
  // Document access errors (001-009)
  DOC_NOT_FOUND: 'DOC-001',
  DOC_PARSE_ERROR: 'DOC-002',
  DOC_VALIDATION_ERROR: 'DOC-003',
  DOC_WRITE_ERROR: 'DOC-004',
  DOC_READ_ERROR: 'DOC-005',
  DOC_FORMAT_ERROR: 'DOC-006',

  // PRD-specific errors (010-019)
  DOC_PRD_INCOMPLETE: 'DOC-010',
  DOC_PRD_REQUIREMENT_CONFLICT: 'DOC-011',
  DOC_PRD_MISSING_SECTION: 'DOC-012',

  // SRS-specific errors (020-029)
  DOC_SRS_TRACEABILITY_ERROR: 'DOC-020',
  DOC_SRS_USE_CASE_INVALID: 'DOC-021',
  DOC_SRS_INTERFACE_ERROR: 'DOC-022',

  // SDS-specific errors (030-039)
  DOC_SDS_ARCHITECTURE_ERROR: 'DOC-030',
  DOC_SDS_COMPONENT_CONFLICT: 'DOC-031',
  DOC_SDS_API_SPEC_ERROR: 'DOC-032',
  DOC_SDS_SCHEMA_ERROR: 'DOC-033',
} as const;

/**
 * Agent error codes (AGT-xxx)
 *
 * For agent initialization, execution, and lifecycle errors
 */
export const AgentErrorCodes = {
  // Initialization errors (001-009)
  AGT_INIT_ERROR: 'AGT-001',
  AGT_CONFIG_ERROR: 'AGT-002',
  AGT_DEPENDENCY_ERROR: 'AGT-003',

  // Execution errors (010-019)
  AGT_EXECUTION_ERROR: 'AGT-010',
  AGT_TIMEOUT_ERROR: 'AGT-011',
  AGT_NOT_FOUND: 'AGT-012',
  AGT_STATE_ERROR: 'AGT-013',
  AGT_OUTPUT_ERROR: 'AGT-014',

  // Communication errors (020-029)
  AGT_HANDOFF_ERROR: 'AGT-020',
  AGT_CONTEXT_LOSS: 'AGT-021',
  AGT_PROTOCOL_ERROR: 'AGT-022',

  // Resource errors (030-039)
  AGT_RESOURCE_EXHAUSTED: 'AGT-030',
  AGT_QUOTA_EXCEEDED: 'AGT-031',
} as const;

/**
 * Infrastructure error codes (INF-xxx)
 *
 * For file system, locks, configuration, and system-level errors
 */
export const InfrastructureErrorCodes = {
  // File system errors (001-009)
  INF_FILE_ACCESS_ERROR: 'INF-001',
  INF_FILE_NOT_FOUND: 'INF-002',
  INF_DIRECTORY_ERROR: 'INF-003',
  INF_PERMISSION_ERROR: 'INF-004',

  // Lock errors (010-019)
  INF_LOCK_ACQUISITION_ERROR: 'INF-010',
  INF_LOCK_TIMEOUT_ERROR: 'INF-011',
  INF_LOCK_CONTENTION_ERROR: 'INF-012',
  INF_LOCK_STOLEN_ERROR: 'INF-013',

  // Configuration errors (020-029)
  INF_CONFIG_LOAD_ERROR: 'INF-020',
  INF_CONFIG_PARSE_ERROR: 'INF-021',
  INF_CONFIG_VALIDATION_ERROR: 'INF-022',
  INF_ENV_VAR_MISSING: 'INF-023',

  // Process errors (030-039)
  INF_PROCESS_SPAWN_ERROR: 'INF-030',
  INF_PROCESS_TIMEOUT: 'INF-031',
  INF_PROCESS_EXIT_ERROR: 'INF-032',
} as const;

/**
 * Extended Security error codes (SEC-xxx)
 *
 * Extends SecurityErrorCodes with more specific security errors
 */
export const ExtendedSecurityErrorCodes = {
  // Path security (010-019)
  SEC_PATH_TRAVERSAL_ERROR: 'SEC-010',
  SEC_SYMLINK_ATTACK: 'SEC-011',

  // Command security (020-029)
  SEC_COMMAND_INJECTION_ERROR: 'SEC-020',
  SEC_COMMAND_NOT_ALLOWED: 'SEC-021',
  SEC_ARGUMENT_INJECTION: 'SEC-022',

  // Access control (030-039)
  SEC_PERMISSION_DENIED: 'SEC-030',
  SEC_RATE_LIMIT_EXCEEDED: 'SEC-031',
  SEC_TOKEN_EXPIRED: 'SEC-032',
  SEC_TOKEN_INVALID: 'SEC-033',

  // Data security (040-049)
  SEC_SENSITIVE_DATA_EXPOSURE: 'SEC-040',
  SEC_INPUT_VALIDATION_ERROR: 'SEC-041',
} as const;

/**
 * External service error codes (EXT-xxx)
 *
 * For GitHub, CI/CD, and other external service interactions
 */
export const ExternalServiceErrorCodes = {
  // GitHub API errors (001-009)
  EXT_GITHUB_API_ERROR: 'EXT-001',
  EXT_GITHUB_RATE_LIMITED: 'EXT-002',
  EXT_GITHUB_AUTH_ERROR: 'EXT-003',
  EXT_GITHUB_NOT_FOUND: 'EXT-004',
  EXT_GITHUB_PERMISSION_ERROR: 'EXT-005',

  // CI/CD errors (010-019)
  EXT_CI_EXECUTION_ERROR: 'EXT-010',
  EXT_CI_TIMEOUT: 'EXT-011',
  EXT_CI_CONFIG_ERROR: 'EXT-012',
  EXT_CI_ARTIFACT_ERROR: 'EXT-013',

  // Network errors (020-029)
  EXT_NETWORK_ERROR: 'EXT-020',
  EXT_CONNECTION_REFUSED: 'EXT-021',
  EXT_DNS_ERROR: 'EXT-022',
  EXT_SSL_ERROR: 'EXT-023',

  // Third-party service errors (030-039)
  EXT_SERVICE_UNAVAILABLE: 'EXT-030',
  EXT_SERVICE_TIMEOUT: 'EXT-031',
  EXT_SERVICE_RESPONSE_ERROR: 'EXT-032',
} as const;

/**
 * All error codes combined
 */
export const ErrorCodes = {
  ...ControllerErrorCodes,
  ...WorkerErrorCodes,
  ...StateManagerErrorCodes,
  ...PRReviewerErrorCodes,
  ...ErrorHandlerErrorCodes,
  ...ScratchpadErrorCodes,
  ...ConfigErrorCodes,
  ...SecurityErrorCodes,
  ...MonitoringErrorCodes,
  ...ControlPlaneErrorCodes,
  ...GenericErrorCodes,
  ...DocumentErrorCodes,
  ...AgentErrorCodes,
  ...InfrastructureErrorCodes,
  ...ExtendedSecurityErrorCodes,
  ...ExternalServiceErrorCodes,
} as const;

/**
 * Error code type
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Error code descriptions for documentation and error messages
 */
export const ErrorCodeDescriptions: Record<ErrorCode, string> = {
  // Controller
  [ErrorCodes.CTL_GRAPH_NOT_FOUND]: 'Dependency graph file not found',
  [ErrorCodes.CTL_GRAPH_PARSE_ERROR]: 'Failed to parse dependency graph',
  [ErrorCodes.CTL_GRAPH_VALIDATION_ERROR]: 'Dependency graph validation failed',
  [ErrorCodes.CTL_CIRCULAR_DEPENDENCY]: 'Circular dependency detected',
  [ErrorCodes.CTL_EMPTY_GRAPH]: 'Dependency graph is empty',
  [ErrorCodes.CTL_ISSUE_NOT_FOUND]: 'Referenced issue not found',
  [ErrorCodes.CTL_PRIORITY_ANALYSIS_ERROR]: 'Priority analysis failed',
  [ErrorCodes.CTL_NO_AVAILABLE_WORKER]: 'No worker available in pool',
  [ErrorCodes.CTL_WORKER_NOT_FOUND]: 'Worker not found',
  [ErrorCodes.CTL_WORKER_NOT_AVAILABLE]: 'Worker not available',
  [ErrorCodes.CTL_WORK_ORDER_NOT_FOUND]: 'Work order not found',
  [ErrorCodes.CTL_WORK_ORDER_CREATION_ERROR]: 'Failed to create work order',
  [ErrorCodes.CTL_WORKER_ASSIGNMENT_ERROR]: 'Failed to assign worker',
  [ErrorCodes.CTL_STATE_PERSISTENCE_ERROR]: 'Failed to persist controller state',
  [ErrorCodes.CTL_DEPENDENCIES_NOT_RESOLVED]: 'Dependencies not resolved',
  [ErrorCodes.CTL_PROGRESS_MONITOR_RUNNING]: 'Progress monitor already running',
  [ErrorCodes.CTL_PROGRESS_MONITOR_NOT_RUNNING]: 'Progress monitor not running',
  [ErrorCodes.CTL_PROGRESS_REPORT_ERROR]: 'Failed to generate progress report',
  [ErrorCodes.CTL_PROGRESS_PERSISTENCE_ERROR]: 'Failed to persist progress report',
  [ErrorCodes.CTL_HEALTH_MONITOR_RUNNING]: 'Health monitor already running',
  [ErrorCodes.CTL_HEALTH_MONITOR_NOT_RUNNING]: 'Health monitor not running',
  [ErrorCodes.CTL_ZOMBIE_WORKER]: 'Zombie worker detected',
  [ErrorCodes.CTL_WORKER_RESTART_ERROR]: 'Failed to restart worker',
  [ErrorCodes.CTL_MAX_RESTARTS_EXCEEDED]: 'Maximum restarts exceeded',
  [ErrorCodes.CTL_TASK_REASSIGNMENT_ERROR]: 'Failed to reassign task',
  [ErrorCodes.CTL_STUCK_WORKER_RECOVERY_ERROR]: 'Failed to recover stuck worker',
  [ErrorCodes.CTL_STUCK_WORKER_CRITICAL]: 'Worker stuck in critical state',
  [ErrorCodes.CTL_MAX_RECOVERY_EXCEEDED]: 'Maximum recovery attempts exceeded',
  [ErrorCodes.CTL_QUEUE_FULL]: 'Task queue is full',
  [ErrorCodes.CTL_QUEUE_MEMORY_LIMIT]: 'Queue memory limit exceeded',
  [ErrorCodes.CTL_QUEUE_BACKPRESSURE]: 'Queue backpressure active',
  [ErrorCodes.CTL_TASK_PRIORITY_LOW]: 'Task priority too low',

  // Worker
  [ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR]: 'Failed to parse work order',
  [ErrorCodes.WRK_CONTEXT_ANALYSIS_ERROR]: 'Failed to analyze context',
  [ErrorCodes.WRK_FILE_READ_ERROR]: 'Failed to read file',
  [ErrorCodes.WRK_FILE_WRITE_ERROR]: 'Failed to write file',
  [ErrorCodes.WRK_BRANCH_CREATION_ERROR]: 'Failed to create branch',
  [ErrorCodes.WRK_BRANCH_EXISTS]: 'Branch already exists',
  [ErrorCodes.WRK_COMMIT_ERROR]: 'Failed to commit changes',
  [ErrorCodes.WRK_GIT_OPERATION_ERROR]: 'Git operation failed',
  [ErrorCodes.WRK_CODE_GENERATION_ERROR]: 'Failed to generate code',
  [ErrorCodes.WRK_TEST_GENERATION_ERROR]: 'Failed to generate tests',
  [ErrorCodes.WRK_VERIFICATION_ERROR]: 'Verification failed',
  [ErrorCodes.WRK_TYPE_CHECK_ERROR]: 'Type check failed',
  [ErrorCodes.WRK_VERIFICATION_PIPELINE_ERROR]: 'Verification pipeline failed',
  [ErrorCodes.WRK_MAX_RETRIES_EXCEEDED]: 'Maximum retries exceeded',
  [ErrorCodes.WRK_IMPLEMENTATION_BLOCKED]: 'Implementation blocked',
  [ErrorCodes.WRK_RESULT_PERSISTENCE_ERROR]: 'Failed to persist result',
  [ErrorCodes.WRK_COMMAND_EXECUTION_ERROR]: 'Command execution failed',
  [ErrorCodes.WRK_COMMAND_TIMEOUT]: 'Command timed out',
  [ErrorCodes.WRK_OPERATION_TIMEOUT]: 'Operation timed out',
  [ErrorCodes.WRK_SELF_FIX_ERROR]: 'Self-fix attempt failed',
  [ErrorCodes.WRK_ESCALATION_REQUIRED]: 'Escalation required',
  [ErrorCodes.WRK_CHECKPOINT_SAVE_ERROR]: 'Failed to save checkpoint',
  [ErrorCodes.WRK_CHECKPOINT_LOAD_ERROR]: 'Failed to load checkpoint',
  [ErrorCodes.WRK_CHECKPOINT_INVALID]: 'Invalid checkpoint',
  [ErrorCodes.WRK_CHECKPOINT_EXPIRED]: 'Checkpoint expired',

  // State Manager
  [ErrorCodes.STM_INVALID_TRANSITION]: 'Invalid state transition',
  [ErrorCodes.STM_INVALID_SKIP]: 'Invalid skip operation',
  [ErrorCodes.STM_REQUIRED_STAGE_SKIP]: 'Cannot skip required stage',
  [ErrorCodes.STM_STATE_NOT_FOUND]: 'State not found',
  [ErrorCodes.STM_PROJECT_NOT_FOUND]: 'Project not found',
  [ErrorCodes.STM_PROJECT_EXISTS]: 'Project already exists',
  [ErrorCodes.STM_VALIDATION_FAILED]: 'State validation failed',
  [ErrorCodes.STM_LOCK_FAILED]: 'Failed to acquire lock',
  [ErrorCodes.STM_HISTORY_ERROR]: 'History operation failed',
  [ErrorCodes.STM_WATCH_ERROR]: 'Watch operation failed',
  [ErrorCodes.STM_CHECKPOINT_NOT_FOUND]: 'Checkpoint not found',
  [ErrorCodes.STM_CHECKPOINT_VALIDATION_FAILED]: 'Checkpoint validation failed',
  [ErrorCodes.STM_ADMIN_AUTH_FAILED]: 'Admin authorization failed',
  [ErrorCodes.STM_RECOVERY_FAILED]: 'Recovery operation failed',

  // PR Reviewer
  [ErrorCodes.PRR_IMPLEMENTATION_NOT_FOUND]: 'Implementation result not found',
  [ErrorCodes.PRR_IMPLEMENTATION_PARSE_ERROR]: 'Failed to parse implementation result',
  [ErrorCodes.PRR_CREATION_ERROR]: 'Failed to create pull request',
  [ErrorCodes.PRR_ALREADY_EXISTS]: 'Pull request already exists',
  [ErrorCodes.PRR_NOT_FOUND]: 'Pull request not found',
  [ErrorCodes.PRR_MERGE_ERROR]: 'Failed to merge pull request',
  [ErrorCodes.PRR_CLOSE_ERROR]: 'Failed to close pull request',
  [ErrorCodes.PRR_SUBMISSION_ERROR]: 'Failed to submit review',
  [ErrorCodes.PRR_COMMENT_ERROR]: 'Failed to add review comment',
  [ErrorCodes.PRR_CI_TIMEOUT]: 'CI checks timed out',
  [ErrorCodes.PRR_CI_CHECK_FAILED]: 'CI checks failed',
  [ErrorCodes.PRR_CIRCUIT_OPEN]: 'CI circuit breaker is open',
  [ErrorCodes.PRR_CI_MAX_POLLS]: 'CI polling exceeded maximum attempts',
  [ErrorCodes.PRR_CI_TERMINAL_FAILURE]: 'Terminal CI failure detected',
  [ErrorCodes.PRR_QUALITY_GATE_FAILED]: 'Quality gates failed',
  [ErrorCodes.PRR_COVERAGE_BELOW_THRESHOLD]: 'Coverage below threshold',
  [ErrorCodes.PRR_SECURITY_VULNERABILITY]: 'Security vulnerability found',
  [ErrorCodes.PRR_GIT_OPERATION_ERROR]: 'Git operation failed',
  [ErrorCodes.PRR_BRANCH_NOT_FOUND]: 'Branch not found',
  [ErrorCodes.PRR_BRANCH_NAMING_ERROR]: 'Invalid branch naming',
  [ErrorCodes.PRR_COMMAND_EXECUTION_ERROR]: 'Command execution failed',
  [ErrorCodes.PRR_RESULT_PERSISTENCE_ERROR]: 'Failed to persist result',

  // Error Handler
  [ErrorCodes.ERH_MAX_RETRIES_EXCEEDED]: 'Maximum retries exceeded',
  [ErrorCodes.ERH_OPERATION_TIMEOUT]: 'Operation timed out',
  [ErrorCodes.ERH_OPERATION_ABORTED]: 'Operation aborted',
  [ErrorCodes.ERH_NON_RETRYABLE]: 'Non-retryable error encountered',
  [ErrorCodes.ERH_INVALID_RETRY_POLICY]: 'Invalid retry policy',
  [ErrorCodes.ERH_RETRY_CONTEXT]: 'Retry context error',
  [ErrorCodes.ERH_CIRCUIT_OPEN]: 'Circuit breaker is open',
  [ErrorCodes.ERH_INVALID_CIRCUIT_BREAKER]: 'Invalid circuit breaker config',

  // Scratchpad
  [ErrorCodes.SCR_LOCK_ERROR]: 'Lock operation error',
  [ErrorCodes.SCR_LOCK_CONTENTION]: 'Lock contention error',
  [ErrorCodes.SCR_LOCK_STOLEN]: 'Lock was stolen',
  [ErrorCodes.SCR_LOCK_TIMEOUT]: 'Lock operation timed out',

  // Config
  [ErrorCodes.CFG_NOT_FOUND]: 'Configuration not found',
  [ErrorCodes.CFG_PARSE_ERROR]: 'Configuration parse error',
  [ErrorCodes.CFG_VALIDATION_ERROR]: 'Configuration validation error',

  // Security
  [ErrorCodes.SEC_VALIDATION_ERROR]: 'Security validation error',
  [ErrorCodes.SEC_SANITIZATION_ERROR]: 'Input sanitization error',
  [ErrorCodes.SEC_AUTHENTICATION_ERROR]: 'Authentication error',
  [ErrorCodes.SEC_AUTHORIZATION_ERROR]: 'Authorization error',

  // Monitoring
  [ErrorCodes.MON_METRIC_ERROR]: 'Metric operation error',
  [ErrorCodes.MON_ALERT_ERROR]: 'Alert operation error',
  [ErrorCodes.MON_HEALTH_CHECK_ERROR]: 'Health check error',

  // Control-Plane
  [ErrorCodes.CPL_PIPELINE_START_ERROR]: 'Failed to start pipeline',
  [ErrorCodes.CPL_PIPELINE_RESUME_ERROR]: 'Failed to resume pipeline',
  [ErrorCodes.CPL_PIPELINE_STATE_ERROR]: 'Pipeline state error',
  [ErrorCodes.CPL_AGENT_NOT_REGISTERED]: 'Agent not registered',
  [ErrorCodes.CPL_AGENT_ALREADY_REGISTERED]: 'Agent already registered',
  [ErrorCodes.CPL_AGENT_LIFECYCLE_ERROR]: 'Agent lifecycle error',
  [ErrorCodes.CPL_MODE_DETECTION_ERROR]: 'Mode detection failed',
  [ErrorCodes.CPL_INIT_ERROR]: 'Control-plane initialization failed',

  // Generic
  [ErrorCodes.GEN_UNKNOWN]: 'Unknown error',
  [ErrorCodes.GEN_INTERNAL]: 'Internal error',
  [ErrorCodes.GEN_INVALID_ARGUMENT]: 'Invalid argument',
  [ErrorCodes.GEN_NOT_IMPLEMENTED]: 'Not implemented',
  [ErrorCodes.GEN_TIMEOUT]: 'Operation timed out',
  [ErrorCodes.GEN_NETWORK_ERROR]: 'Network error',

  // Document
  [ErrorCodes.DOC_NOT_FOUND]: 'Document not found',
  [ErrorCodes.DOC_PARSE_ERROR]: 'Document parse error',
  [ErrorCodes.DOC_VALIDATION_ERROR]: 'Document validation error',
  [ErrorCodes.DOC_WRITE_ERROR]: 'Document write error',
  [ErrorCodes.DOC_READ_ERROR]: 'Document read error',
  [ErrorCodes.DOC_FORMAT_ERROR]: 'Document format error',
  [ErrorCodes.DOC_PRD_INCOMPLETE]: 'PRD is incomplete',
  [ErrorCodes.DOC_PRD_REQUIREMENT_CONFLICT]: 'Conflicting requirements in PRD',
  [ErrorCodes.DOC_PRD_MISSING_SECTION]: 'Required section missing in PRD',
  [ErrorCodes.DOC_SRS_TRACEABILITY_ERROR]: 'SRS traceability matrix error',
  [ErrorCodes.DOC_SRS_USE_CASE_INVALID]: 'Invalid use case in SRS',
  [ErrorCodes.DOC_SRS_INTERFACE_ERROR]: 'SRS interface definition error',
  [ErrorCodes.DOC_SDS_ARCHITECTURE_ERROR]: 'SDS architecture design error',
  [ErrorCodes.DOC_SDS_COMPONENT_CONFLICT]: 'Component conflict in SDS',
  [ErrorCodes.DOC_SDS_API_SPEC_ERROR]: 'SDS API specification error',
  [ErrorCodes.DOC_SDS_SCHEMA_ERROR]: 'SDS database schema error',

  // Agent
  [ErrorCodes.AGT_INIT_ERROR]: 'Agent initialization error',
  [ErrorCodes.AGT_CONFIG_ERROR]: 'Agent configuration error',
  [ErrorCodes.AGT_DEPENDENCY_ERROR]: 'Agent dependency error',
  [ErrorCodes.AGT_EXECUTION_ERROR]: 'Agent execution error',
  [ErrorCodes.AGT_TIMEOUT_ERROR]: 'Agent operation timed out',
  [ErrorCodes.AGT_NOT_FOUND]: 'Agent not found',
  [ErrorCodes.AGT_STATE_ERROR]: 'Agent state error',
  [ErrorCodes.AGT_OUTPUT_ERROR]: 'Agent output error',
  [ErrorCodes.AGT_HANDOFF_ERROR]: 'Agent handoff error',
  [ErrorCodes.AGT_CONTEXT_LOSS]: 'Agent context lost',
  [ErrorCodes.AGT_PROTOCOL_ERROR]: 'Agent protocol error',
  [ErrorCodes.AGT_RESOURCE_EXHAUSTED]: 'Agent resources exhausted',
  [ErrorCodes.AGT_QUOTA_EXCEEDED]: 'Agent quota exceeded',

  // Infrastructure
  [ErrorCodes.INF_FILE_ACCESS_ERROR]: 'File access error',
  [ErrorCodes.INF_FILE_NOT_FOUND]: 'File not found',
  [ErrorCodes.INF_DIRECTORY_ERROR]: 'Directory operation error',
  [ErrorCodes.INF_PERMISSION_ERROR]: 'File permission error',
  [ErrorCodes.INF_LOCK_ACQUISITION_ERROR]: 'Lock acquisition failed',
  [ErrorCodes.INF_LOCK_TIMEOUT_ERROR]: 'Lock operation timed out',
  [ErrorCodes.INF_LOCK_CONTENTION_ERROR]: 'Lock contention detected',
  [ErrorCodes.INF_LOCK_STOLEN_ERROR]: 'Lock was stolen',
  [ErrorCodes.INF_CONFIG_LOAD_ERROR]: 'Configuration load error',
  [ErrorCodes.INF_CONFIG_PARSE_ERROR]: 'Configuration parse error',
  [ErrorCodes.INF_CONFIG_VALIDATION_ERROR]: 'Configuration validation error',
  [ErrorCodes.INF_ENV_VAR_MISSING]: 'Required environment variable missing',
  [ErrorCodes.INF_PROCESS_SPAWN_ERROR]: 'Process spawn error',
  [ErrorCodes.INF_PROCESS_TIMEOUT]: 'Process timed out',
  [ErrorCodes.INF_PROCESS_EXIT_ERROR]: 'Process exited with error',

  // Extended Security
  [ErrorCodes.SEC_PATH_TRAVERSAL_ERROR]: 'Path traversal attempt detected',
  [ErrorCodes.SEC_SYMLINK_ATTACK]: 'Symlink attack detected',
  [ErrorCodes.SEC_COMMAND_INJECTION_ERROR]: 'Command injection attempt detected',
  [ErrorCodes.SEC_COMMAND_NOT_ALLOWED]: 'Command not allowed',
  [ErrorCodes.SEC_ARGUMENT_INJECTION]: 'Argument injection detected',
  [ErrorCodes.SEC_PERMISSION_DENIED]: 'Permission denied',
  [ErrorCodes.SEC_RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCodes.SEC_TOKEN_EXPIRED]: 'Token expired',
  [ErrorCodes.SEC_TOKEN_INVALID]: 'Invalid token',
  [ErrorCodes.SEC_SENSITIVE_DATA_EXPOSURE]: 'Sensitive data exposure',
  [ErrorCodes.SEC_INPUT_VALIDATION_ERROR]: 'Input validation failed',

  // External Services
  [ErrorCodes.EXT_GITHUB_API_ERROR]: 'GitHub API error',
  [ErrorCodes.EXT_GITHUB_RATE_LIMITED]: 'GitHub rate limit exceeded',
  [ErrorCodes.EXT_GITHUB_AUTH_ERROR]: 'GitHub authentication error',
  [ErrorCodes.EXT_GITHUB_NOT_FOUND]: 'GitHub resource not found',
  [ErrorCodes.EXT_GITHUB_PERMISSION_ERROR]: 'GitHub permission denied',
  [ErrorCodes.EXT_CI_EXECUTION_ERROR]: 'CI execution error',
  [ErrorCodes.EXT_CI_TIMEOUT]: 'CI operation timed out',
  [ErrorCodes.EXT_CI_CONFIG_ERROR]: 'CI configuration error',
  [ErrorCodes.EXT_CI_ARTIFACT_ERROR]: 'CI artifact error',
  [ErrorCodes.EXT_NETWORK_ERROR]: 'Network error',
  [ErrorCodes.EXT_CONNECTION_REFUSED]: 'Connection refused',
  [ErrorCodes.EXT_DNS_ERROR]: 'DNS resolution error',
  [ErrorCodes.EXT_SSL_ERROR]: 'SSL/TLS error',
  [ErrorCodes.EXT_SERVICE_UNAVAILABLE]: 'External service unavailable',
  [ErrorCodes.EXT_SERVICE_TIMEOUT]: 'External service timed out',
  [ErrorCodes.EXT_SERVICE_RESPONSE_ERROR]: 'External service response error',
};
