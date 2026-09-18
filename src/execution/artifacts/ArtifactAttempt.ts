/** Invocation-owned capture and reconciliation. No adapter-wide current-stage state. */
import { randomUUID } from 'node:crypto';
import type { ArtifactCaptureEntry, ArtifactSink } from '../hooks.js';
import type { StageExecutionResult } from '../types.js';
import { ManifestStore } from './ManifestStore.js';
import { inspectArtifact, normalizeArtifactPath } from './paths.js';
import {
  ArtifactContextSchema,
  ArtifactOutputSchema,
  artifactError,
  artifactId,
  metadataHash,
  parseArtifact,
  matchesArtifactPattern,
  type ArtifactContext,
  type ArtifactDeclaration,
  type ArtifactEntry,
  type ArtifactManifest,
  type ManifestReference,
  type ArtifactProvenance,
} from './schemas.js';

/** Owns durable observations and the terminal manifest for one invocation. */
export class ArtifactAttempt implements ArtifactSink {
  readonly context: ArtifactContext;
  private readonly pending = new Set<Promise<void>>();
  private captureFailure: Error | undefined;
  private sealed = false;

  constructor(
    readonly store: ManifestStore,
    context: ArtifactContext,
    private readonly agentType: string,
    private readonly signal: AbortSignal
  ) {
    this.context = parseArtifact(ArtifactContextSchema, context, 'artifact context');
  }

  /**
   * Retain a sticky failure even if the SDK catches the hook rejection.
   * @param entry - Official tool observation to persist.
   * @returns Durable capture acknowledgement.
   */
  recordArtifact(entry: ArtifactCaptureEntry): Promise<void> {
    const work = this.capture(entry).catch((error: unknown) => {
      this.captureFailure ??=
        error instanceof Error ? error : new Error('Artifact capture failed', { cause: error });
      throw error;
    });
    this.pending.add(work);
    void work.then(
      () => this.pending.delete(work),
      () => this.pending.delete(work)
    );
    return work;
  }

  private async capture(entry: ArtifactCaptureEntry): Promise<void> {
    if (this.sealed || this.signal.aborted)
      throw artifactError('Artifact capture after invocation shutdown');
    const declaration: ArtifactDeclaration = {
      path: entry.filePath,
      kind: 'file',
      operation: 'written',
    };
    const observed = await inspectArtifact(this.store.projectDir, declaration);
    const provenance: ArtifactProvenance = {
      eventId: metadataHash([
        this.context.attemptId,
        entry.sessionId,
        entry.toolUseId ?? randomUUID(),
        observed.path,
        observed.checksum,
      ]),
      source: 'hook',
      attemptId: this.context.attemptId,
      capturedAt: entry.capturedAt,
      toolName: entry.toolName,
      ...(entry.sessionId !== undefined ? { sdkSessionId: entry.sessionId } : {}),
      ...(entry.toolUseId !== undefined ? { toolUseId: entry.toolUseId } : {}),
    };
    await this.store.recordCapture({
      schemaVersion: 1,
      sessionId: this.context.sessionId,
      stageName: this.context.stageName,
      agentType: this.agentType,
      upstream: this.context.upstream,
      artifact: {
        ...declaration,
        path: observed.path,
        ...(observed.checksum !== undefined ? { checksum: observed.checksum } : {}),
      },
      provenance,
    });
  }

  /**
   * Retain a durable failed-attempt marker when reconciliation or capture failed.
   * @param result - SDK execution outcome and available usage observations.
   * @param diagnostic - Failure detail retained for recovery.
   * @returns Reference to the failed or aborted attempt.
   */
  async fail(result: StageExecutionResult, diagnostic: string): Promise<ManifestReference> {
    this.sealed = true;
    await Promise.allSettled([...this.pending]);
    return this.store.publish({
      schemaVersion: 1,
      sessionId: this.context.sessionId,
      stageName: this.context.stageName,
      attemptId: this.context.attemptId,
      agentType: this.agentType,
      sdkSessionId: result.sessionId,
      createdAt: new Date().toISOString(),
      status: result.status === 'aborted' ? 'aborted' : 'failed',
      entries: [],
      upstream: this.context.upstream,
      requiredOutputs: this.context.requiredOutputs,
      externalReferences: this.context.externalReferences ?? [],
      diagnostic,
      execution: { tokenUsage: result.tokenUsage, toolCallCount: result.toolCallCount },
    });
  }

  /**
   * Called only after SDK cleanup; joins writes, validates outputs, then publishes.
   * @param result - SDK execution outcome and available usage observations.
   * @param structuredOutput - Untrusted SDK structured output attachment.
   * @returns Finalized metadata and its immutable reference.
   */
  async finish(
    result: StageExecutionResult,
    structuredOutput: unknown
  ): Promise<{ manifest: ArtifactManifest; reference: ManifestReference }> {
    this.sealed = true;
    await Promise.allSettled([...this.pending]);
    if (this.captureFailure !== undefined) throw this.captureFailure;
    const { context } = this;
    const captures = await this.store.captures(context.sessionId, context.stageName);
    const entries = new Map<string, ArtifactEntry>();
    for (const capture of captures) {
      if (metadataHash(capture.upstream) !== metadataHash(context.upstream)) continue;
      if (capture.agentType !== this.agentType)
        throw artifactError(`Capture agent mismatch: ${context.stageName}`);
      const declaration = { ...capture.artifact };
      delete declaration.checksum;
      const id = artifactId(context.sessionId, declaration.kind, declaration.path);
      const previous = entries.get(id);
      entries.set(id, {
        ...declaration,
        id,
        required: false,
        availability: 'absent',
        provenance: [...(previous?.provenance ?? []), capture.provenance],
      });
    }

    if (result.status === 'success') {
      const parents = await Promise.all(context.upstream.map((ref) => this.store.load(ref)));
      for (const parent of parents)
        if (parent.status !== 'complete')
          throw artifactError(
            `Upstream manifest is not complete: ${parent.stageName}/${parent.attemptId}`
          );
      // A missing attachment is allowed for capture-only stages. An attachment, if
      // present, must be valid; malformed structured output never falls back to prose.
      const declarations =
        structuredOutput === undefined
          ? []
          : parseArtifact(ArtifactOutputSchema, structuredOutput, 'SDK artifact output').artifacts;
      const declared = new Map<string, ArtifactDeclaration>();
      for (const value of declarations) {
        const observed = await inspectArtifact(
          this.store.projectDir,
          value,
          context.externalReferences
        );
        const declaration = { ...value, path: observed.path };
        const id = artifactId(context.sessionId, declaration.kind, declaration.path);
        const duplicate = declared.get(id);
        if (duplicate !== undefined && metadataHash(duplicate) !== metadataHash(declaration))
          throw artifactError(`Conflicting artifact declarations: ${declaration.path}`);
        if (duplicate !== undefined) continue;
        declared.set(id, declaration);
        const captured = entries.get(id);
        if (captured !== undefined && captured.kind !== declaration.kind)
          throw artifactError(`Captured/declaration kind mismatch: ${declaration.path}`);
        if (declaration.operation === 'reused' && !declaration.kind.startsWith('external-')) {
          let inherited = false;
          for (const parent of parents) {
            if (parent.entries.some((entry) => entry.id === id && entry.availability === 'present'))
              inherited = true;
          }
          if (
            !inherited &&
            !context.requiredOutputs.some(
              (spec) =>
                spec.allowExisting === true &&
                matchesArtifactPattern(declaration.path, spec.pattern)
            )
          )
            throw artifactError(
              `Reused artifact requires upstream provenance: ${declaration.path}`
            );
        }
        entries.set(id, {
          ...declaration,
          id,
          required: false,
          availability: observed.availability,
          provenance: [
            ...(captured?.provenance ?? []),
            {
              eventId: metadataHash([context.attemptId, 'declaration', declaration]),
              source: 'declaration',
              attemptId: context.attemptId,
              capturedAt: new Date().toISOString(),
              sdkSessionId: result.sessionId,
            },
          ],
        });
      }

      for (const spec of context.requiredOutputs) {
        if (spec.allowExisting === true && !spec.pattern.includes('*')) {
          const location = normalizeArtifactPath(this.store.projectDir, spec.pattern);
          const id = artifactId(context.sessionId, spec.kind, location);
          if (!entries.has(id))
            entries.set(id, {
              id,
              path: location,
              kind: spec.kind,
              operation: 'reused',
              required: true,
              availability: 'absent',
              provenance: [
                {
                  eventId: metadataHash([context.attemptId, 'infrastructure', location]),
                  source: 'infrastructure',
                  attemptId: context.attemptId,
                  capturedAt: new Date().toISOString(),
                },
              ],
            });
        }
      }
    }

    for (const [id, entry] of entries) {
      const observed = await inspectArtifact(
        this.store.projectDir,
        entry,
        context.externalReferences
      );
      const required =
        entry.operation !== 'deleted' &&
        context.requiredOutputs.some(
          (spec) => entry.kind === spec.kind && matchesArtifactPattern(entry.path, spec.pattern)
        );
      const withoutChecksum = { ...entry };
      delete withoutChecksum.checksum;
      entries.set(id, { ...withoutChecksum, ...observed, required });
    }
    if (result.status === 'success') {
      for (const spec of context.requiredOutputs) {
        if (
          ![...entries.values()].some(
            (entry) =>
              entry.kind === spec.kind &&
              entry.operation !== 'deleted' &&
              entry.availability === 'present' &&
              matchesArtifactPattern(entry.path, spec.pattern)
          )
        )
          throw artifactError(
            `Required ${spec.kind} output missing: ${context.stageName}/${context.attemptId}: ${spec.pattern}`
          );
      }
    }
    const manifest: ArtifactManifest = {
      schemaVersion: 1,
      sessionId: context.sessionId,
      stageName: context.stageName,
      attemptId: context.attemptId,
      agentType: this.agentType,
      sdkSessionId: result.sessionId,
      createdAt: new Date().toISOString(),
      status:
        result.status === 'failed'
          ? 'failed'
          : this.signal.aborted
            ? 'aborted'
            : result.status === 'success'
              ? 'complete'
              : result.status,
      upstream: context.upstream,
      entries: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
      requiredOutputs: context.requiredOutputs,
      externalReferences: context.externalReferences ?? [],
      execution: { toolCallCount: result.toolCallCount, tokenUsage: result.tokenUsage },
      ...(result.error !== undefined ? { diagnostic: result.error.message } : {}),
    };
    let reference = await this.store.publish(manifest);
    // Cancellation can arrive during an asynchronous backend write. Publish an
    // abort record for the same attempt so recovery never reuses that success.
    if (this.signal.aborted && manifest.status === 'complete') {
      manifest.status = 'aborted';
      manifest.createdAt = new Date().toISOString();
      reference = await this.store.publish(manifest);
    }
    return { manifest, reference };
  }
}

/**
 * Compatibility arrays contain project files/directories recorded as present.
 * @param manifest - Validated artifact metadata for one attempt.
 * @returns Compatibility view of present project artifacts.
 */
export function manifestArtifacts(manifest: ArtifactManifest): StageExecutionResult['artifacts'] {
  return manifest.entries
    .filter(
      (entry) =>
        (entry.kind === 'file' || entry.kind === 'directory') &&
        entry.availability === 'present' &&
        entry.operation !== 'deleted'
    )
    .map((entry) => ({
      path: entry.path,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      ...(entry.checksum !== undefined ? { checksum: entry.checksum } : {}),
    }));
}
