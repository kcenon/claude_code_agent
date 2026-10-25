/**
 * Approval gate evaluation for the AD-SDLC orchestrator.
 *
 * Builds the decision request for a stage (concrete inputs, completed
 * upstream artifacts, failed verification checks, and the proposed next
 * action), applies the mode semantics from `approvalPolicy.ts`, reuses a
 * matching decision on resume, and asks a person or the custom strategy when
 * the mode requests a decision. Extracted from `AdsdlcOrchestratorAgent` in
 * issue #799; decision records were added in #953.
 */

import { inspectArtifact } from '../execution/artifacts/paths.js';
import { hasFailedRequiredVerification } from '../vnv/policy.js';
import {
  APPROVAL_EFFECT_DESCRIPTIONS,
  approvalRequirement,
  approvalScopeFingerprint,
  reusableApprovalDecision,
  stageApprovalBoundaries,
  stageApprovalEffects,
  type ApprovalArtifactReference,
  type ApprovalDecisionRecord,
  type ApprovalFinding,
  type ApprovalRequest,
} from './approvalPolicy.js';
import type {
  ApprovalDecision,
  ApprovalMode,
  OrchestratorSession,
  PipelineStageDefinition,
  StageName,
  StageResult,
} from './types.js';

/**
 * Custom approval callback contract used when {@link ApprovalMode} is
 * `custom`. Returning `approved: false` rejects the stage with the supplied
 * reason. The request carries the same content a person would see.
 */
export type CustomApprovalFn = (
  stage: PipelineStageDefinition,
  priorResults: readonly StageResult[],
  request: ApprovalRequest
) => Promise<ApprovalDecision>;

/**
 * Default `custom` approval callback — always approves. Mirrors the
 * orchestrator's pre-#799 behaviour so existing tests that exercise
 * `approvalMode: 'custom'` without overriding `approveStage` continue to
 * pass.
 * @param _stage - Stage awaiting a decision
 * @param _priorResults - Results available to the stage
 * @param _request - Decision request content
 * @returns An approval decided by the system
 */
export const defaultCustomApproval: CustomApprovalFn = (_stage, _priorResults, _request) => {
  return Promise.resolve({
    approved: true,
    reason: 'Custom approval (default: approved)',
    decidedBy: 'system',
    decidedAt: new Date().toISOString(),
  });
};

/** Answer to a decision request. */
export interface ApprovalAnswer {
  readonly approved: boolean;
  readonly reason: string;
}

/** Asks a person for a decision. */
export type ApprovalPrompter = (request: ApprovalRequest) => Promise<ApprovalAnswer>;

/**
 * Whether a person can answer a prompt: the prompt reads stdin and renders on
 * stderr, so stdout stays free for `--format json` output.
 * @returns True when stdin and stderr are terminals
 */
export function isInteractiveTerminal(): boolean {
  // `isTTY` is undefined, not false, on a pipe or file, despite its declared type.
  const terminal = (stream: { readonly isTTY?: boolean }): boolean => stream.isTTY === true;
  return terminal(process.stdin) && terminal(process.stderr);
}

/** Everything the gate needs for one stage. */
export interface ApprovalGateContext {
  readonly mode: ApprovalMode;
  /** Whether a requested decision can be answered at a terminal prompt */
  readonly interactive: boolean;
  readonly session: OrchestratorSession;
  /** The run's stage graph */
  readonly graph: readonly PipelineStageDefinition[];
  /** Results available to the stage: restored results of a resumed session, then this run's */
  readonly results: readonly StageResult[];
  /** Latest record saved for the stage by an earlier run of the session */
  readonly priorRecord?: ApprovalDecisionRecord;
  readonly customApproval: CustomApprovalFn;
  /** Prompt implementation; defaults to {@link promptForApproval} */
  readonly prompt?: ApprovalPrompter;
}

/** Paths listed per stage in the terminal request. */
const MAX_LISTED_PATHS = 5;
/** Characters of the user request shown in the terminal request. */
const MAX_REQUEST_CHARS = 300;

/**
 * Stages the given stage depends on, directly or transitively, in graph order.
 * @param stage - Stage awaiting a decision
 * @param graph - Stage graph
 * @returns Upstream stage names
 */
function upstreamStages(
  stage: PipelineStageDefinition,
  graph: readonly PipelineStageDefinition[]
): StageName[] {
  const byName = new Map(graph.map((entry) => [entry.name, entry]));
  const seen = new Set<StageName>();
  const queue = [...stage.dependsOn];
  while (queue.length > 0) {
    const name = queue.shift();
    if (name === undefined || seen.has(name)) continue;
    seen.add(name);
    queue.push(...(byName.get(name)?.dependsOn ?? []));
  }
  return graph.map((entry) => entry.name).filter((name) => seen.has(name));
}

/**
 * Digest of a project file for a result without a manifest. Unreadable or
 * escaping paths get a stable marker instead of failing the gate.
 * @param projectDir - Project root
 * @param artifactPath - Artifact path from the stage result
 * @returns SHA-256 digest, `absent`, or `unavailable`
 */
async function artifactDigest(projectDir: string, artifactPath: string): Promise<string> {
  try {
    const observed = await inspectArtifact(projectDir, {
      path: artifactPath,
      kind: 'file',
      operation: 'reused',
    });
    return observed.checksum ?? observed.availability;
  } catch {
    return 'unavailable';
  }
}

/**
 * Build the decision request for a stage, or undefined when it has no boundary.
 * @param stage - Stage about to run
 * @param context - Gate context
 * @returns Request content and its scope fingerprint
 */
export async function buildApprovalRequest(
  stage: PipelineStageDefinition,
  context: Pick<ApprovalGateContext, 'mode' | 'session' | 'graph' | 'results'>
): Promise<ApprovalRequest | undefined> {
  const completed = new Map<StageName, StageResult>();
  for (const result of context.results)
    if (result.status === 'completed' || result.status === 'degraded')
      completed.set(result.name, result);
  const failedVerificationDependencies = stage.dependsOn.filter((name) =>
    hasFailedRequiredVerification(completed.get(name)?.verification)
  );
  const boundaries = stageApprovalBoundaries(stage, failedVerificationDependencies);
  if (boundaries.length === 0) return undefined;

  const { session } = context;
  const effects = [...stageApprovalEffects(stage)];
  const artifacts: (ApprovalArtifactReference & { digests?: readonly string[] })[] = [];
  const findings: ApprovalFinding[] = [];
  for (const name of upstreamStages(stage, context.graph)) {
    const result = completed.get(name);
    if (result === undefined) continue;
    if (result.artifacts.length > 0 || result.manifest !== undefined)
      artifacts.push({
        stage: name,
        ...(result.manifest !== undefined ? { manifest: result.manifest.id } : {}),
        paths: [...result.artifacts],
        // A manifest identifier already covers its files' checksums.
        ...(result.manifest === undefined
          ? {
              digests: await Promise.all(
                result.artifacts.map((item) => artifactDigest(session.projectDir, item))
              ),
            }
          : {}),
      });
    const record = result.verification;
    if (record === undefined) continue;
    for (const check of record.checks)
      if (check.outcome === 'fail')
        findings.push({
          stage: name,
          checkId: check.checkId,
          name: check.name,
          required: check.required,
          message: check.message,
        });
    if (
      hasFailedRequiredVerification(record) &&
      !record.checks.some((check) => check.outcome === 'fail' && check.required)
    )
      findings.push({
        stage: name,
        checkId: 'verifier',
        name: 'Stage verifier',
        required: true,
        message: record.reason ?? 'Verification did not pass',
      });
  }
  const fingerprint = approvalScopeFingerprint({
    pipelineMode: session.mode,
    stage: stage.name,
    agentType: stage.agentType,
    boundaries,
    effects,
    userRequest: session.userRequest,
    artifacts,
    findings,
  });
  const effectText =
    effects.length === 0
      ? ''
      : `; it ${effects.map((effect) => APPROVAL_EFFECT_DESCRIPTIONS[effect]).join(', ')}`;
  return {
    sessionId: session.sessionId,
    mode: context.mode,
    pipelineMode: session.mode,
    localMode: session.localMode,
    stage: {
      name: stage.name,
      agentType: stage.agentType,
      description: stage.description,
      dependsOn: [...stage.dependsOn],
    },
    userRequest: session.userRequest,
    boundaries,
    effects,
    proposedAction: `Run stage "${stage.name}" (${stage.agentType}): ${stage.description}${effectText}`,
    scope: {
      fingerprint,
      artifacts: artifacts.map(({ digests: _digests, ...reference }) => reference),
      findings,
    },
  };
}

/**
 * Terminal rendering of a decision request.
 * @param request - Decision request
 * @returns Output lines
 */
export function formatApprovalRequest(request: ApprovalRequest): string[] {
  const userRequest = request.userRequest.replace(/\s+/gu, ' ').trim();
  const lines = [
    `Decision required before stage "${request.stage.name}" (${request.stage.agentType})`,
    `  Policy: ${request.mode} mode; boundaries: ${request.boundaries.join(', ')}`,
    `  Session: ${request.sessionId}; pipeline ${request.pipelineMode}; local mode: ${request.localMode ? 'yes' : 'no'}`,
    `  Request: ${userRequest.length > MAX_REQUEST_CHARS ? `${userRequest.slice(0, MAX_REQUEST_CHARS)}...` : userRequest}`,
    `  Proposed action: ${request.proposedAction}`,
    `  External effects: ${request.effects.length === 0 ? 'none' : request.effects.join(', ')}`,
    `  Completed artifacts:${request.scope.artifacts.length === 0 ? ' none' : ''}`,
  ];
  for (const artifact of request.scope.artifacts) {
    const listed = artifact.paths.slice(0, MAX_LISTED_PATHS).join(', ');
    const more =
      artifact.paths.length > MAX_LISTED_PATHS
        ? ` (+${String(artifact.paths.length - MAX_LISTED_PATHS)} more)`
        : '';
    lines.push(
      `    ${artifact.stage}${artifact.manifest === undefined ? '' : ` (manifest ${artifact.manifest.slice(0, 12)})`}: ${listed === '' ? 'no files' : listed}${more}`
    );
  }
  lines.push(`  Verification findings:${request.scope.findings.length === 0 ? ' none' : ''}`);
  for (const finding of request.scope.findings)
    lines.push(
      `    ${finding.stage}: [${finding.checkId}, ${finding.required ? 'required' : 'optional'}] ${finding.message}`
    );
  lines.push(`  Scope fingerprint: ${request.scope.fingerprint.slice(0, 16)}`);
  return lines;
}

/**
 * Ask a person at the terminal. inquirer is loaded only when a prompt runs,
 * and it renders on stderr so `--format json` output stays parseable.
 * @param request - Decision request
 * @returns The person's answer
 */
export async function promptForApproval(request: ApprovalRequest): Promise<ApprovalAnswer> {
  const { default: inquirer } = await import('inquirer');
  const prompt = inquirer.createPromptModule({ output: process.stderr });
  const answers = await prompt<{ approve: boolean; reason?: string }>([
    {
      type: 'confirm',
      name: 'approve',
      message: `${formatApprovalRequest(request).join('\n')}\nApprove this stage?`,
      default: false,
    },
    {
      type: 'input',
      name: 'reason',
      message: 'Reason for rejecting (kept in the run result):',
      when: (answered: { approve?: boolean }): boolean => answered.approve !== true,
    },
  ]);
  const reason = answers.reason?.trim() ?? '';
  return answers.approve
    ? { approved: true, reason: 'Approved by user' }
    : { approved: false, reason: reason === '' ? 'Rejected by user' : reason };
}

/**
 * Evaluate the approval gate of a stage.
 *
 * - No boundary: undefined (the stage runs without a record).
 * - The mode does not request a decision at these boundaries: approved by policy.
 * - A matching decision saved by an earlier run of the session: reused.
 * - `custom`: the strategy decides.
 * - `manual` / `critical` with an interactive terminal: the person decides.
 * - `manual` / `critical` without one: `pending` (the run pauses; never approved).
 *
 * @param stage - Stage about to run
 * @param context - Gate context
 * @returns Decision record, or undefined when the stage has no boundary
 */
export async function evaluateApprovalGate(
  stage: PipelineStageDefinition,
  context: ApprovalGateContext
): Promise<ApprovalDecisionRecord | undefined> {
  const request = await buildApprovalRequest(stage, context);
  if (request === undefined) return undefined;
  const base = {
    stage: stage.name,
    agentType: stage.agentType,
    sessionId: request.sessionId,
    mode: context.mode,
    boundaries: request.boundaries,
    effects: request.effects,
    proposedAction: request.proposedAction,
    scope: request.scope,
  };
  if (approvalRequirement(context.mode, request.boundaries) === 'policy')
    return {
      ...base,
      outcome: 'approved',
      basis: 'policy',
      decidedBy: 'system',
      decidedAt: new Date().toISOString(),
      reason: `Approved by policy: ${context.mode} mode requests no decision at this boundary (${request.boundaries.join(', ')})`,
    };

  const reused = reusableApprovalDecision(
    context.priorRecord,
    context.mode,
    request.scope.fingerprint
  );
  if (reused !== undefined) return reused;

  if (context.mode === 'custom') {
    const decision = await context.customApproval(stage, context.results, request);
    return {
      ...base,
      outcome: decision.approved ? 'approved' : 'rejected',
      basis: 'callback',
      decidedBy: decision.decidedBy,
      decidedAt: decision.decidedAt,
      reason: decision.reason,
    };
  }

  if (!context.interactive)
    return {
      ...base,
      outcome: 'pending',
      basis: 'unattended',
      decidedBy: 'system',
      decidedAt: new Date().toISOString(),
      reason: `${context.mode} mode requests a decision before '${stage.name}' (${request.boundaries.join(', ')}), and no interactive terminal is available. Resume the session in an interactive terminal with --resume ${request.sessionId}.`,
    };

  const answer = await (context.prompt ?? promptForApproval)(request);
  return {
    ...base,
    outcome: answer.approved ? 'approved' : 'rejected',
    basis: 'prompt',
    decidedBy: 'user',
    decidedAt: new Date().toISOString(),
    reason: answer.reason,
  };
}
