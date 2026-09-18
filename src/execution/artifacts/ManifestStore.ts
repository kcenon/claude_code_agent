/** Durable capture records and immutable, content-identified metadata snapshots. */
import * as path from 'node:path';
import { Scratchpad } from '../../scratchpad/Scratchpad.js';
import { loadScratchpadConfig } from '../../scratchpad/backends/configLoader.js';
import type { ScratchpadBackendConfig } from '../../scratchpad/backends/types.js';
import {
  ArtifactManifestSchema,
  CaptureRecordSchema,
  ManifestReferenceSchema,
  artifactError,
  metadataHash,
  parseArtifact,
  type ArtifactManifest,
  type CaptureRecord,
  type ManifestReference,
} from './schemas.js';
import { inspectArtifact, normalizeArtifactPath, assertPhysicalContainment } from './paths.js';

/** One project-scoped store. Individual event keys avoid shared read-modify-write indexes. */
export class ManifestStore {
  constructor(
    readonly projectDir: string,
    readonly basePath: string,
    private readonly scratchpad: Scratchpad
  ) {}

  /**
   * Initialize once before admitting concurrent operations, including lazy backend setup.
   * @param projectDir - Explicit absolute target project root.
   * @param scratchpadDir - Session scratchpad location relative to the project or absolute.
   * @param selected - Optional backend configuration override for an owned store.
   * @returns Initialized project-scoped store.
   */
  static async open(
    projectDir: string,
    scratchpadDir: string,
    selected?: ScratchpadBackendConfig
  ): Promise<ManifestStore> {
    const config = selected ?? (await loadScratchpadConfig(projectDir));
    const basePath = path.resolve(projectDir, config.file?.basePath ?? scratchpadDir);
    const scratchpad = new Scratchpad({
      projectRoot: projectDir,
      basePath,
      ...(config.backend !== undefined ? { backend: config.backend } : {}),
      sqlite: {
        ...config.sqlite,
        dbPath: path.resolve(projectDir, config.sqlite?.dbPath ?? '.ad-sdlc/scratchpad.db'),
      },
      ...(config.redis !== undefined
        ? {
            redis: {
              ...config.redis,
              // A durable manifest must not expire while a checkpoint still references it.
              ttl: 0,
              ...(config.redis.fallback !== undefined
                ? {
                    fallback: {
                      ...config.redis.fallback,
                      fileConfig: {
                        ...config.redis.fallback.fileConfig,
                        basePath: path.resolve(
                          projectDir,
                          config.redis.fallback.fileConfig?.basePath ?? basePath
                        ),
                      },
                    },
                  }
                : {}),
            },
          }
        : {}),
    });
    try {
      await scratchpad.listKeys(path.join(basePath, 'pipeline', 'artifacts'));
      return new ManifestStore(projectDir, basePath, scratchpad);
    } catch (error) {
      await scratchpad.cleanup();
      throw error;
    }
  }

  private directory(sessionId: string): string {
    if (!/^[\w-]{1,256}$/.test(sessionId))
      throw artifactError('Invalid manifest session identifier');
    return path.join(this.basePath, 'pipeline', 'artifacts', sessionId);
  }

  private captureKey(record: CaptureRecord): string {
    return `capture-${metadataHash(record.stageName)}-${record.provenance.eventId}.json`;
  }

  /**
   * Persistence acknowledgement is the backend write completion, never a queued write.
   * @param value - Metadata to validate, hash, or persist.
   */
  async recordCapture(value: CaptureRecord): Promise<void> {
    const record = parseArtifact(CaptureRecordSchema, value, 'capture');
    const target = path.join(this.directory(record.sessionId), this.captureKey(record));
    const existing = await this.scratchpad.readJson<unknown>(target, { allowMissing: true });
    if (existing !== null) {
      const previous = parseArtifact(CaptureRecordSchema, existing, 'stored capture');
      if (
        metadataHash({ ...previous, provenance: { ...previous.provenance, capturedAt: '' } }) !==
        metadataHash({ ...record, provenance: { ...record.provenance, capturedAt: '' } })
      )
        throw artifactError(`Conflicting capture identity: ${record.provenance.eventId}`);
      return;
    }
    await this.scratchpad.writeJson(target, record);
  }

  /**
   * Read captures across attempts of one stage, including interrupted attempts.
   * @param sessionId - Pipeline identity, distinct from the SDK session ID.
   * @param stageName - Canonical producer stage name.
   * @returns Chronologically ordered persisted capture observations.
   */
  async captures(sessionId: string, stageName: string): Promise<CaptureRecord[]> {
    const directory = this.directory(sessionId);
    const recordPattern = new RegExp(`^capture-${metadataHash(stageName)}-[a-f0-9]{64}\\.json$`);
    const keys = (await this.scratchpad.listKeys(directory)).filter((key) =>
      recordPattern.test(key)
    );
    const records: CaptureRecord[] = [];
    for (const key of keys) {
      if (path.basename(key) !== key) throw artifactError('Invalid backend capture key');
      const record = parseArtifact(
        CaptureRecordSchema,
        await this.scratchpad.readJson<unknown>(path.join(directory, key)),
        key
      );
      if (
        record.sessionId !== sessionId ||
        record.stageName !== stageName ||
        key !== this.captureKey(record)
      )
        throw artifactError(`Capture ownership mismatch: ${key}`);
      records.push(record);
    }
    return records.sort(
      (a, b) =>
        a.provenance.capturedAt.localeCompare(b.provenance.capturedAt) ||
        a.provenance.eventId.localeCompare(b.provenance.eventId)
    );
  }

  /**
   * Immutable metadata is published before its reference can be used by a stage.
   * @param value - Metadata to validate, hash, or persist.
   * @returns Reference to the immutable published metadata.
   */
  async publish(value: ArtifactManifest): Promise<ManifestReference> {
    const manifest = parseArtifact(ArtifactManifestSchema, value, 'manifest');
    const ref: ManifestReference = {
      version: 1,
      sessionId: manifest.sessionId,
      stageName: manifest.stageName,
      id: metadataHash(manifest),
    };
    await this.scratchpad.writeJson(
      path.join(this.directory(ref.sessionId), `manifest-${ref.id}.json`),
      manifest
    );
    return ref;
  }

  /**
   * Validate integrity and ownership before returning stored metadata.
   * @param value - Metadata to validate, hash, or persist.
   * @returns Integrity-checked manifest belonging to the reference.
   */
  async load(value: ManifestReference): Promise<ArtifactManifest> {
    const ref = parseArtifact(ManifestReferenceSchema, value, 'manifest reference');
    const raw = await this.scratchpad.readJson<unknown>(
      path.join(this.directory(ref.sessionId), `manifest-${ref.id}.json`),
      { allowMissing: true }
    );
    if (raw === null)
      throw artifactError(
        `Missing manifest ${ref.stageName}/${ref.id}; restore its scratchpad backend or rerun the stage`
      );
    const manifest = parseArtifact(ArtifactManifestSchema, raw, `manifest ${ref.id}`);
    if (
      manifest.sessionId !== ref.sessionId ||
      manifest.stageName !== ref.stageName ||
      metadataHash(manifest) !== ref.id
    )
      throw artifactError(`Manifest integrity/ownership mismatch: ${ref.stageName}/${ref.id}`);
    return manifest;
  }

  /**
   * Discover a committed result after a crash between publication and checkpointing.
   * @param sessionId - Pipeline identity, distinct from the SDK session ID.
   * @param stageName - Canonical producer stage name.
   * @param upstream - Immutable references consumed by the stage.
   * @returns Newest compatible completed reference, if available.
   */
  async findCompleted(
    sessionId: string,
    stageName: string,
    upstream: readonly ManifestReference[]
  ): Promise<ManifestReference | undefined> {
    const candidates: { ref: ManifestReference; createdAt: string; attemptId: string }[] = [];
    const failedAttempts = new Set<string>();
    for (const key of await this.scratchpad.listKeys(this.directory(sessionId))) {
      const match = /^manifest-([a-f0-9]{64})\.json$/.exec(key);
      if (match?.[1] === undefined) continue;
      const raw = await this.scratchpad.readJson<unknown>(
        path.join(this.directory(sessionId), key)
      );
      const manifest = parseArtifact(ArtifactManifestSchema, raw, key);
      if (manifest.stageName !== stageName) continue;
      const ref: ManifestReference = { version: 1, sessionId, stageName, id: match[1] };
      await this.load(ref);
      if (manifest.status !== 'complete') failedAttempts.add(manifest.attemptId);
      if (
        manifest.status === 'complete' &&
        metadataHash(manifest.upstream) === metadataHash(upstream)
      )
        candidates.push({ ref, createdAt: manifest.createdAt, attemptId: manifest.attemptId });
    }
    candidates.sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.ref.id.localeCompare(a.ref.id)
    );
    return candidates.find((candidate) => !failedAttempts.has(candidate.attemptId))?.ref;
  }

  /**
   * Required files must still match their recorded type and bytes before reuse.
   * @param manifest - Validated artifact metadata for one attempt.
   */
  async validateForReuse(manifest: ArtifactManifest): Promise<void> {
    if (manifest.status !== 'complete')
      throw artifactError(
        `Manifest is ${manifest.status}: ${manifest.stageName}/${manifest.attemptId}`
      );
    for (const entry of manifest.entries) {
      if (!entry.required) {
        // Optional entries (including tombstones) are historical observations;
        // later stages may legitimately replace or recreate their locations.
        if (entry.kind === 'file' || entry.kind === 'directory') {
          if (normalizeArtifactPath(this.projectDir, entry.path) !== entry.path)
            throw artifactError(`Noncanonical manifest location: ${entry.path}`);
          await assertPhysicalContainment(
            this.projectDir,
            path.resolve(this.projectDir, entry.path)
          );
        } else if (!manifest.externalReferences.includes(entry.path))
          throw artifactError(`Unapproved stored external reference: ${entry.path}`);
        continue;
      }
      const { checksum, ...declaration } = entry;
      const observed = await inspectArtifact(
        this.projectDir,
        { ...declaration, ...(checksum !== undefined ? { checksum } : {}) },
        manifest.externalReferences
      );
      if (observed.path !== entry.path)
        throw artifactError(`Noncanonical manifest location: ${entry.path}`);
      if (observed.availability !== 'present')
        throw artifactError(
          `Required ${entry.kind} missing on resume: ${manifest.stageName}/${entry.path}`
        );
    }
  }

  /** Close only this store's backend; callers join all writes before invoking this. */
  async close(): Promise<void> {
    await this.scratchpad.cleanup();
  }
}
