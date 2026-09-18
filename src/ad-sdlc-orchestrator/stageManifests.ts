/** Manifest handoff keeps storage details out of the scheduling loop. */
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ManifestStore } from '../execution/artifacts/ManifestStore.js';
import { manifestArtifacts } from '../execution/artifacts/ArtifactAttempt.js';
import {
  artifactError,
  metadataHash,
  type ArtifactContext,
  type ArtifactManifest,
} from '../execution/artifacts/schemas.js';
import type { StageExecutionRequest, StageExecutionResult } from '../execution/types.js';
import type { ArtifactValidator } from './ArtifactValidator.js';
import type { OrchestratorSession, PipelineStageDefinition, StageResult } from './types.js';

/**
 * Required outputs are supplied by the trusted stage contract, not SDK declarations.
 * @param stage - Canonical pipeline stage definition.
 * @param session - Owning pipeline session and project context.
 * @param validator - Existing trusted stage output contract provider.
 * @returns Trusted identity and output policy for a new invocation.
 */
export function stageArtifactContext(
  stage: PipelineStageDefinition,
  session: OrchestratorSession,
  validator: ArtifactValidator
): ArtifactContext {
  const scratchpadPath = path
    .relative(session.projectDir, session.scratchpadDir)
    .split(path.sep)
    .join('/');
  const requiredOutputs =
    validator
      .getArtifactMap(session.mode)
      .find((entry) => entry.stage === stage.name)
      ?.requiredArtifacts.filter((spec) => spec.required)
      .map((spec) => ({
        pattern: spec.pathPattern.replace(/^\.ad-sdlc\/scratchpad(?=\/|$)/, scratchpadPath),
        kind: stage.name === 'initialization' ? ('directory' as const) : ('file' as const),
        ...(stage.name === 'initialization' ? { allowExisting: true } : {}),
      })) ?? [];
  return {
    sessionId: session.sessionId,
    stageName: stage.name,
    attemptId: randomUUID(),
    scratchpadDir: session.scratchpadDir,
    requiredOutputs,
    upstream: session.stageResults
      .filter((result) => result.status === 'completed' || result.status === 'degraded')
      .flatMap((result) => (result.manifest === undefined ? [] : [result.manifest]))
      .sort((a, b) => a.stageName.localeCompare(b.stageName)),
  };
}

/**
 * Load references through the configured backend and check the producer's identity.
 * @param session - Owning pipeline session and project context.
 * @param results - Previously completed or degraded stage results.
 * @returns Validated upstream manifests loaded from the selected backend.
 */
export async function loadStageManifests(
  session: OrchestratorSession,
  results: readonly StageResult[]
): Promise<ArtifactManifest[]> {
  const referenced = results.filter(
    (result) =>
      result.manifest !== undefined &&
      (result.status === 'completed' || result.status === 'degraded')
  );
  if (referenced.length === 0) return [];
  const store = await ManifestStore.open(session.projectDir, session.scratchpadDir);
  try {
    const manifests: ArtifactManifest[] = [];
    for (const result of referenced) {
      const ref = result.manifest;
      if (ref === undefined) continue;
      if (ref.sessionId !== session.sessionId || ref.stageName !== result.name)
        throw artifactError(`Stage manifest reference ownership mismatch: ${result.name}`);
      const manifest = await store.load(ref);
      if (manifest.agentType !== result.agentType)
        throw artifactError(`Manifest agent mismatch: ${result.name}`);
      await store.validateForReuse(manifest);
      manifests.push(manifest);
    }
    return manifests;
  } finally {
    await store.close();
  }
}

/**
 * Reuse only a committed attempt with the same upstream lineage on a resumed run.
 * @param request - Invocation context and required upstream lineage.
 * @returns Recovered execution result, or undefined when none can be reused.
 */
export async function recoverStageManifest(
  request: StageExecutionRequest
): Promise<StageExecutionResult | undefined> {
  const context = request.artifactContext;
  if (context === undefined) return undefined;
  const store = await ManifestStore.open(request.projectDir, context.scratchpadDir);
  try {
    const reference = await store.findCompleted(
      context.sessionId,
      context.stageName,
      context.upstream
    );
    if (reference === undefined) return undefined;
    const manifest = await store.load(reference);
    if (metadataHash(manifest.requiredOutputs) !== metadataHash(context.requiredOutputs))
      throw artifactError(
        `Recovered output contract changed: ${context.stageName}; start a fresh run`
      );
    if (manifest.agentType !== request.agentType)
      throw artifactError(`Recovered manifest agent mismatch: ${context.stageName}`);
    await store.validateForReuse(manifest);
    return {
      status: 'success',
      artifacts: manifestArtifacts(manifest),
      manifest: reference,
      sessionId: manifest.sdkSessionId ?? 'unknown',
      ...manifest.execution,
    };
  } finally {
    await store.close();
  }
}

/**
 * Compatibility arrays are derived from the manifest, even for a custom adapter.
 * @param session - Owning pipeline session and project context.
 * @param stage - Canonical pipeline stage definition.
 * @param result - SDK execution outcome and available usage observations.
 * @returns Execution result with compatibility paths derived from stored metadata.
 */
export async function resolveStageManifest(
  session: OrchestratorSession,
  stage: PipelineStageDefinition,
  result: StageExecutionResult
): Promise<StageExecutionResult> {
  if (result.manifest === undefined) return result;
  const store = await ManifestStore.open(session.projectDir, session.scratchpadDir);
  try {
    if (result.manifest.sessionId !== session.sessionId || result.manifest.stageName !== stage.name)
      throw artifactError(`Adapter manifest ownership mismatch: ${stage.name}`);
    const manifest = await store.load(result.manifest);
    if (manifest.agentType !== stage.agentType)
      throw artifactError(`Adapter manifest agent mismatch: ${stage.name}`);
    if (result.status === 'success') await store.validateForReuse(manifest);
    return { ...result, artifacts: result.status === 'success' ? manifestArtifacts(manifest) : [] };
  } finally {
    await store.close();
  }
}
