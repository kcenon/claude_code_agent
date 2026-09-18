/** Versioned artifact metadata shared by execution, storage and recovery. */
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AppError } from '../../errors/AppError.js';

const identifier = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[\w-]+$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const ManifestReferenceSchema = z
  .object({
    version: z.literal(1),
    sessionId: identifier,
    stageName: identifier,
    id: digest,
  })
  .strict();
export type ManifestReference = z.infer<typeof ManifestReferenceSchema>;

export const ArtifactDeclarationSchema = z
  .object({
    path: z.string().min(1),
    kind: z.enum(['file', 'directory', 'external-file', 'external-uri']),
    operation: z.enum(['created', 'modified', 'written', 'deleted', 'reused']),
    description: z.string().optional(),
    checksum: digest.optional(),
  })
  .strict();
export type ArtifactDeclaration = z.infer<typeof ArtifactDeclarationSchema>;

export const ArtifactOutputSchema = z
  .object({
    schemaVersion: z.literal(1),
    artifacts: z.array(ArtifactDeclarationSchema),
  })
  .strict();
export const ARTIFACT_OUTPUT_FORMAT = {
  type: 'json_schema' as const,
  schema: z.toJSONSchema(ArtifactOutputSchema),
};

const RequiredOutputSchema = z
  .object({
    pattern: z.string().min(1),
    kind: z.enum(['file', 'directory']),
    allowExisting: z.boolean().optional(),
  })
  .strict();

export const ArtifactContextSchema = z
  .object({
    sessionId: identifier,
    stageName: identifier,
    attemptId: identifier,
    scratchpadDir: z.string().min(1),
    requiredOutputs: z.array(RequiredOutputSchema),
    upstream: z.array(ManifestReferenceSchema),
    /** Exact locations approved by the caller, never by an agent declaration. */
    externalReferences: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type ArtifactContext = z.infer<typeof ArtifactContextSchema>;

export const ProvenanceSchema = z
  .object({
    eventId: digest,
    source: z.enum(['hook', 'declaration', 'infrastructure']),
    attemptId: identifier,
    capturedAt: z.iso.datetime(),
    sdkSessionId: z.string().min(1).optional(),
    toolName: z.string().min(1).optional(),
    toolUseId: z.string().min(1).optional(),
  })
  .strict();
export type ArtifactProvenance = z.infer<typeof ProvenanceSchema>;

export const ArtifactEntrySchema = ArtifactDeclarationSchema.extend({
  id: digest,
  required: z.boolean(),
  availability: z.enum(['present', 'absent', 'external-unverified']),
  provenance: z.array(ProvenanceSchema).min(1),
})
  .strict()
  .superRefine((entry, ctx) => {
    if (
      entry.operation === 'deleted' &&
      (entry.availability !== 'absent' || entry.checksum !== undefined)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Deletion requires absence and no current checksum',
      });
    if (entry.kind !== 'file' && entry.kind !== 'external-file' && entry.checksum !== undefined)
      ctx.addIssue({ code: 'custom', message: 'Only files have SHA-256 content checksums' });
    if (entry.kind === 'external-uri' && entry.availability !== 'external-unverified')
      ctx.addIssue({ code: 'custom', message: 'Remote existence is not verified' });
    if (entry.kind !== 'external-uri' && entry.availability === 'external-unverified')
      ctx.addIssue({
        code: 'custom',
        message: 'Filesystem artifacts require a local availability observation',
      });
    if (entry.availability !== 'present' && entry.checksum !== undefined)
      ctx.addIssue({
        code: 'custom',
        message: 'Only present files have current content checksums',
      });
    if (entry.kind === 'external-uri' && entry.operation !== 'reused')
      ctx.addIssue({
        code: 'custom',
        message: 'External URIs are references, not filesystem changes',
      });
    if (entry.kind.startsWith('external-') && entry.required)
      ctx.addIssue({
        code: 'custom',
        message: 'External references cannot satisfy required project outputs',
      });
    if (new Set(entry.provenance.map((event) => event.eventId)).size !== entry.provenance.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate provenance event' });
  });
export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

export const ArtifactManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: identifier,
    stageName: identifier,
    attemptId: identifier,
    agentType: identifier,
    sdkSessionId: z.string().min(1).optional(),
    createdAt: z.iso.datetime(),
    status: z.enum(['complete', 'failed', 'aborted']),
    upstream: z.array(ManifestReferenceSchema),
    entries: z.array(ArtifactEntrySchema),
    requiredOutputs: z.array(RequiredOutputSchema),
    externalReferences: z.array(z.string().min(1)),
    diagnostic: z.string().optional(),
    execution: z
      .object({
        toolCallCount: z.number().int().nonnegative(),
        tokenUsage: z
          .object({
            input: z.number().nonnegative(),
            output: z.number().nonnegative(),
            cache: z.number().nonnegative(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (new Set(manifest.entries.map((entry) => entry.id)).size !== manifest.entries.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate artifact identity' });
    for (const entry of manifest.entries) {
      if (entry.id !== artifactId(manifest.sessionId, entry.kind, entry.path))
        ctx.addIssue({ code: 'custom', message: `Invalid artifact identity: ${entry.path}` });
      const required =
        entry.operation !== 'deleted' &&
        manifest.requiredOutputs.some(
          (spec) => spec.kind === entry.kind && matchesArtifactPattern(entry.path, spec.pattern)
        );
      if (entry.required !== required)
        ctx.addIssue({
          code: 'custom',
          message: `Entry requiredness contradicts stage contract: ${entry.path}`,
        });
      if (manifest.status === 'complete' && entry.required && entry.availability !== 'present')
        ctx.addIssue({ code: 'custom', message: `Required output is absent: ${entry.path}` });
    }
    if (
      manifest.upstream.some(
        (ref) => ref.sessionId !== manifest.sessionId || ref.stageName === manifest.stageName
      )
    )
      ctx.addIssue({ code: 'custom', message: 'Upstream ownership mismatch or self-reference' });
    if (manifest.status === 'complete')
      for (const spec of manifest.requiredOutputs) {
        if (
          !manifest.entries.some(
            (entry) =>
              entry.required &&
              entry.kind === spec.kind &&
              entry.availability === 'present' &&
              matchesArtifactPattern(entry.path, spec.pattern)
          )
        )
          ctx.addIssue({
            code: 'custom',
            message: `Required output contract is unsatisfied: ${spec.pattern}`,
          });
      }
  });
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;

export const CaptureRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: identifier,
    stageName: identifier,
    agentType: identifier,
    upstream: z.array(ManifestReferenceSchema),
    artifact: ArtifactDeclarationSchema,
    provenance: ProvenanceSchema,
  })
  .strict();
export type CaptureRecord = z.infer<typeof CaptureRecordSchema>;

/**
 * Hash metadata deterministically, including object keys from parsed/unparsed inputs.
 * @param value - Metadata to validate, hash, or persist.
 * @returns Lowercase SHA-256 of canonical metadata.
 */
export function metadataHash(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item !== null && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, canonical(v)])
      );
    return item;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

/**
 * The same local path keeps its identity when its kind or content changes.
 * @param sessionId - Pipeline identity, distinct from the SDK session ID.
 * @param kind - Local artifact kind or external reference namespace.
 * @param location - Normalized artifact location.
 * @returns Stable artifact identity within the pipeline session.
 */
export function artifactId(
  sessionId: string,
  kind: ArtifactDeclaration['kind'],
  location: string
): string {
  return metadataHash([sessionId, kind.startsWith('external-') ? kind : 'local', location]);
}

/**
 * Translate schema failures into the scheduler's fatal contract diagnostics.
 * @param schema - Runtime schema defining the expected metadata shape.
 * @param value - Metadata to validate, hash, or persist.
 * @param source - Diagnostic label for the metadata boundary.
 * @returns Validated and typed schema result.
 */
export function parseArtifact<T>(schema: z.ZodType<T>, value: unknown, source: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw artifactError(`Invalid ${source}: ${parsed.error.message}`);
  return parsed.data;
}

/**
 * Artifact contract failures must not be mistaken for retryable SDK transport errors.
 * @param message - Human-readable artifact contract violation.
 * @returns Fatal error carrying the artifact contract code.
 */
export function artifactError(message: string): AppError {
  return new AppError('EXEC-110', message, { category: 'fatal' });
}

/**
 * Match declared locations with the existing single-segment wildcard convention.
 * @param location - Normalized artifact location.
 * @param pattern - Trusted stage pattern using single-segment wildcards.
 * @returns Whether the location matches the stage pattern.
 */
export function matchesArtifactPattern(location: string, pattern: string): boolean {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  return new RegExp(`^${expression}$`, 'u').test(location);
}
