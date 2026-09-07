/** Serializable, credential-free contract for a resolved CLI run. */
import type {
  PipelineMode,
  PipelineStageDefinition,
  ResolvedOrchestratorConfig,
  StageName,
} from '../ad-sdlc-orchestrator/types.js';

/** A finding refers to the original input, before schema stripping or defaults. */
export interface RuntimeDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code:
    | 'invalid'
    | 'unknown'
    | 'unsupported'
    | 'inactive'
    | 'deprecated'
    | 'conflict'
    | 'legacy-session';
  readonly source: string;
  readonly path: string;
  readonly reason: string;
  readonly action: string;
}

/** Winning layer and original property name for a normalized value. */
export interface RuntimeValueSource {
  readonly source: string;
  readonly path: string;
}

/** Reuses live orchestrator values and defaults; no independent default set. */
export type ResolvedRuntimeConfig = Pick<
  ResolvedOrchestratorConfig,
  'approvalMode' | 'maxParallelAgents' | 'maxRetries' | 'retryBackoff' | 'timeouts' | 'localMode'
> & {
  readonly mode: PipelineMode;
  readonly vnv: Pick<ResolvedOrchestratorConfig['vnv'], 'rigor' | 'haltOnVerificationFailure'>;
};

/** The exact graph and policy used by execution, dry-run, status, and resume. */
export interface EffectiveExecutionPlan {
  readonly version: 1;
  readonly config: ResolvedRuntimeConfig;
  /** Total attempts and resolved delays; derived from the retained programmatic retry API. */
  readonly retryPolicy: ResolvedOrchestratorConfig['retryBackoff'] & {
    readonly maxAttempts: number;
  };
  readonly stages: readonly (PipelineStageDefinition & { readonly timeoutMs: number })[];
  readonly stopAfterStage?: StageName;
  readonly stopBehavior: string;
  readonly sources: Readonly<Record<string, RuntimeValueSource>>;
  readonly diagnostics: readonly RuntimeDiagnostic[];
  readonly featureFlags: { readonly useSdkForWorker: boolean };
}

/** Untrusted project layer, in ascending priority order. */
export interface RuntimeConfigLayer {
  readonly source: string;
  readonly value: unknown;
}

/** Failure is structured for JSON commands and readable for text commands. */
export class RuntimeConfigError extends Error {
  constructor(readonly diagnostics: readonly RuntimeDiagnostic[]) {
    super(diagnostics.map((d) => `${d.source}: ${d.path}: ${d.reason} ${d.action}`).join('\n'));
    this.name = 'RuntimeConfigError';
  }
}
