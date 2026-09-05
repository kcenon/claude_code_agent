/** Conservative file ownership and asset-only updates, separate from template migrations. */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { validateAgentsConfig } from '../config/validation.js';
import { ASSET_VERSION_SCHEMA, DIGEST_SCHEMA, byteDigest, loadAssetBundle } from './AgentAssets.js';
import type { AssetBundle } from './AgentAssets.js';
import { generateAgentsConfig } from './generatedConfig.js';
import { compareVersions, parseVersion } from './TemplateVersioning.js';

export const ASSET_LOCK_PATH = '.ad-sdlc/asset-lock.json';
const REGISTRY_PATH = '.ad-sdlc/config/agents.yaml';
const baselineSchema = z.strictObject({
  installedVersion: ASSET_VERSION_SCHEMA,
  packageVersion: z.string(),
  byteDigest: DIGEST_SCHEMA,
});
const lockSchema = z.strictObject({
  schemaVersion: z.literal(1),
  bundleVersion: ASSET_VERSION_SCHEMA,
  packageVersion: z.string(),
  manifestDigest: DIGEST_SCHEMA,
  files: z.record(z.string(), baselineSchema.extend({ id: z.string() })),
  registry: baselineSchema.optional(),
});
export type AssetLock = z.infer<typeof lockSchema>;
export interface AssetUpdateChange {
  path: string;
  action: 'install' | 'replace' | 'unchanged' | 'conflict';
  oldVersion: string;
  targetVersion: string;
  message?: string;
}
export interface AssetUpdateResult {
  status: 'ready' | 'updated' | 'conflicted';
  dryRun: boolean;
  changes: AssetUpdateChange[];
  warnings: string[];
}
export interface AssetUpdateOptions {
  projectDir: string;
  dryRun?: boolean;
  /** Explicit test/package source; never used as an automatic fallback. */
  packageRoot?: string;
}

/** Reject links and non-directory parents in paths the installer owns.
 * @param projectDir - Target project root
 * @param assetPath - Relative managed file path
 * @returns Safe absolute destination path
 */
export function targetAssetPath(projectDir: string, assetPath: string): string {
  let current = resolve(projectDir);
  for (const [index, part] of assetPath.split('/').entries()) {
    if (part === '..' || part === '' || part === '.')
      throw new Error(`Invalid target path: ${assetPath}`);
    current = join(current, part);
    if (fs.existsSync(current) || fs.lstatSync(current, { throwIfNoEntry: false }) !== undefined) {
      const stat = fs.lstatSync(current);
      if (
        stat.isSymbolicLink() ||
        (index < assetPath.split('/').length - 1 && !stat.isDirectory())
      ) {
        throw new Error(`Unsafe target path: ${current}`);
      }
    }
  }
  return current;
}

/** Atomic per-file replacement. The lock is committed only after all writes succeed.
 * @param filePath - Destination file
 * @param bytes - Exact content to install
 */
export function atomicAssetWrite(filePath: string, bytes: Buffer | string): void {
  fs.mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = join(dirname(filePath), `.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tempPath, bytes, { flag: 'wx' });
    fs.renameSync(tempPath, filePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function readTarget(filePath: string): Buffer | undefined {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
}

/** Check every collision before init creates even the scaffold directories.
 * @param projectDir - Target project root
 * @param bundle - Fully validated incoming inventory
 */
export function preflightAssetInstallation(projectDir: string, bundle: AssetBundle): void {
  for (const asset of bundle.assets) {
    const existing = readTarget(targetAssetPath(projectDir, asset.path));
    if (existing !== undefined && !existing.equals(asset.bytes)) {
      throw new Error(
        `${asset.path}: existing customization differs from bundle ${bundle.manifest.bundleVersion} (package ${bundle.packageVersion}); preserve or move it before initialization`
      );
    }
  }
  targetAssetPath(projectDir, ASSET_LOCK_PATH);
  targetAssetPath(projectDir, REGISTRY_PATH);
}

function baseline(bundle: AssetBundle, bytes: Buffer): z.infer<typeof baselineSchema> {
  return {
    installedVersion: bundle.manifest.bundleVersion,
    packageVersion: bundle.packageVersion,
    byteDigest: byteDigest(bytes),
  };
}

/** Record ownership only after the caller has successfully installed the whole scaffold.
 * @param projectDir - Successfully initialized project
 * @param bundle - Validated installed inventory
 * @returns Ownership lock with exact-byte baselines
 */
export function createAssetLock(projectDir: string, bundle: AssetBundle): AssetLock {
  return {
    schemaVersion: 1,
    bundleVersion: bundle.manifest.bundleVersion,
    packageVersion: bundle.packageVersion,
    manifestDigest: bundle.manifestDigest,
    files: Object.fromEntries(
      bundle.assets.map((asset) => {
        const bytes = fs.readFileSync(targetAssetPath(projectDir, asset.path));
        if (!bytes.equals(asset.bytes))
          throw new Error(`${asset.path}: content changed during installation`);
        return [asset.path, { ...baseline(bundle, bytes), id: asset.id }];
      })
    ),
    registry: baseline(bundle, fs.readFileSync(join(projectDir, REGISTRY_PATH))),
  };
}

function checkVersion(oldVersion: string, incomingVersion: string): void {
  const old = parseVersion(oldVersion);
  const incoming = parseVersion(incomingVersion);
  if (old === null || incoming === null || old.major !== incoming.major) {
    throw new Error(
      `Incompatible asset versions ${oldVersion} -> ${incomingVersion}; manual migration required`
    );
  }
  if (compareVersions(old, incoming) > 0)
    throw new Error(`Refusing asset downgrade ${oldVersion} -> ${incomingVersion}`);
}

function loadLock(projectDir: string, bundle: AssetBundle): AssetLock | undefined {
  const bytes = readTarget(targetAssetPath(projectDir, ASSET_LOCK_PATH));
  if (bytes === undefined) return undefined;
  let lock: AssetLock;
  try {
    lock = lockSchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch (error) {
    throw new Error(
      `${ASSET_LOCK_PATH}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  checkVersion(lock.bundleVersion, bundle.manifest.bundleVersion);
  for (const [assetPath, entry] of Object.entries(lock.files)) {
    if (!/^\.claude\/(agents|commands)\/[a-z][a-z0-9-]*\.md$/.test(assetPath))
      throw new Error(`Invalid lock path: ${assetPath}`);
    const kind = assetPath.startsWith('.claude/agents/') ? 'agent' : 'command';
    const expectedId = `${kind}:${assetPath.split('/').at(-1)?.slice(0, -3) ?? ''}`;
    if (entry.id !== expectedId) throw new Error(`${assetPath}: lock ID mismatch`);
    checkVersion(entry.installedVersion, lock.bundleVersion);
  }
  if (lock.registry !== undefined) checkVersion(lock.registry.installedVersion, lock.bundleVersion);
  if (
    lock.bundleVersion === bundle.manifest.bundleVersion &&
    lock.manifestDigest !== bundle.manifestDigest
  ) {
    throw new Error(
      `Conflicting content reuses bundle version ${lock.bundleVersion}; bump the bundle version`
    );
  }
  return lock;
}

/** Merge original YAML data, never a stripped schema result. Comments force manual reconciliation.
 * @param current - Existing registry bytes, if present
 * @param bundle - Validated incoming inventory
 * @returns Validated merged registry bytes
 */
function registryProposal(current: Buffer | undefined, bundle: AssetBundle): Buffer {
  const generated = generateAgentsConfig(bundle);
  if (current === undefined) {
    const validation = validateAgentsConfig(generated);
    if (!validation.success)
      throw new Error(
        `agents.yaml: proposed registry invalid: ${JSON.stringify(validation.errors)}`
      );
    return Buffer.from(yaml.dump(generated, { lineWidth: 100 }));
  }
  const recordSchema = z.record(z.string(), z.unknown());
  const original = recordSchema.parse(yaml.load(current.toString('utf8')));
  const entries = recordSchema.parse(original['agents']);
  const changes: string[] = [];
  for (const [id, incoming] of Object.entries(generated.agents)) {
    if (entries[id] === undefined) {
      entries[id] = incoming;
      changes.push(`add ${id}`);
      continue;
    }
    const entry = recordSchema.parse(entries[id]);
    const canonical = incoming.definition_file;
    for (const field of ['definition_file', 'definition']) {
      if (entry[field] !== undefined && entry[field] !== canonical) {
        throw new Error(
          `agents.yaml: ${id}.${field} is customized; reconcile with ${String(canonical)}`
        );
      }
    }
    if (entry['id'] !== undefined && entry['id'] !== id)
      throw new Error(
        `agents.yaml: preserve existing ID ${JSON.stringify(entry['id'])}; manually register ${id}`
      );
    for (const field of ['id', 'name', 'definition_file', 'definition'] as const) {
      if (entry[field] === undefined) {
        entry[field] = incoming[field];
        changes.push(`set ${id}.${field}`);
      }
    }
    entries[id] = entry;
  }
  const registeredIds = new Set<string>();
  for (const [key, value] of Object.entries(entries)) {
    const entry = recordSchema.parse(value);
    const id = entry['id'];
    if (typeof id !== 'string') continue; // Schema validation below reports invalid ID fields.
    if (registeredIds.has(id))
      throw new Error(`agents.yaml: duplicate ID ${id} at ${key}; manually reconcile aliases`);
    registeredIds.add(id);
  }
  const proposed = { ...original, agents: entries };
  const validation = validateAgentsConfig(proposed);
  if (!validation.success)
    throw new Error(`agents.yaml: proposed registry invalid: ${JSON.stringify(validation.errors)}`);
  if (changes.length === 0) return current;
  // js-yaml does not retain comments, anchors or presentation. Leave such documents intact.
  if (/(^|\s)[#&*]|^\s*<<:/m.test(current.toString('utf8'))) {
    throw new Error(
      `agents.yaml: preserve commented/anchored registry; manually ${changes.join(', ')}`
    );
  }
  return Buffer.from(yaml.dump(proposed, { lineWidth: 100 }));
}

/** Validate and plan all updates before writing; conflicts make the entire plan read-only.
 * @param options - Project, dry-run preference and optional explicit asset source
 * @returns Reviewable plan and explicit application/conflict status
 */
export function updateAssets(options: AssetUpdateOptions): AssetUpdateResult {
  const bundle = loadAssetBundle(options.packageRoot);
  const projectDir = resolve(options.projectDir);
  const version = bundle.manifest.bundleVersion;
  try {
    if (!fs.existsSync(join(projectDir, '.ad-sdlc')))
      throw new Error('Project is not initialized; run ad-sdlc init . --quick first');
    const lock = loadLock(projectDir, bundle);
    const changes: AssetUpdateChange[] = [];
    const writes: { path: string; after: Buffer }[] = [];
    const reads: { path: string; bytes: Buffer | undefined }[] = [
      {
        path: join(projectDir, ASSET_LOCK_PATH),
        bytes: readTarget(join(projectDir, ASSET_LOCK_PATH)),
      },
    ];
    const nextLock: AssetLock = {
      schemaVersion: 1,
      bundleVersion: version,
      packageVersion: bundle.packageVersion,
      manifestDigest: bundle.manifestDigest,
      files: { ...lock?.files },
    };
    const warnings = [...bundle.warnings];
    for (const asset of bundle.assets) {
      const target = targetAssetPath(projectDir, asset.path);
      const current = readTarget(target);
      reads.push({ path: target, bytes: current });
      const previous = lock?.files[asset.path];
      const action =
        current === undefined
          ? 'install'
          : current.equals(asset.bytes)
            ? 'unchanged'
            : previous !== undefined && byteDigest(current) === previous.byteDigest
              ? 'replace'
              : 'conflict';
      changes.push({
        path: asset.path,
        action,
        oldVersion: previous?.installedVersion ?? 'unmanaged',
        targetVersion: version,
        ...(action === 'conflict'
          ? {
              message: `Preserved customization. Compare ${target} with ${join(bundle.packageRoot, asset.path)} using diff; manually reconcile or copy the incoming file, then rerun assets update.`,
            }
          : {}),
      });
      if (action === 'conflict') continue;
      nextLock.files[asset.path] = { ...baseline(bundle, asset.bytes), id: asset.id };
      if (action !== 'unchanged') writes.push({ path: target, after: asset.bytes });
    }
    for (const retired of Object.keys(lock?.files ?? {})) {
      if (!bundle.assets.some((asset) => asset.path === retired))
        warnings.push(`Retired asset preserved: ${retired}`);
    }
    const registryPath = targetAssetPath(projectDir, REGISTRY_PATH);
    const currentRegistry = readTarget(registryPath);
    reads.push({ path: registryPath, bytes: currentRegistry });
    try {
      const proposed = registryProposal(currentRegistry, bundle);
      const action =
        currentRegistry === undefined
          ? 'install'
          : currentRegistry.equals(proposed)
            ? 'unchanged'
            : 'replace';
      changes.push({
        path: REGISTRY_PATH,
        action,
        oldVersion: lock?.registry?.installedVersion ?? 'unmanaged',
        targetVersion: version,
      });
      nextLock.registry = baseline(bundle, proposed);
      if (action !== 'unchanged') writes.push({ path: registryPath, after: proposed });
    } catch (error) {
      changes.push({
        path: REGISTRY_PATH,
        action: 'conflict',
        oldVersion: lock?.registry?.installedVersion ?? 'unmanaged',
        targetVersion: version,
        message: `${error instanceof Error ? error.message : String(error)}. Reconcile the required entries and rerun assets update.`,
      });
    }
    const conflicted = changes.some((change) => change.action === 'conflict');
    if (conflicted || options.dryRun === true) {
      return {
        status: conflicted ? 'conflicted' : 'ready',
        dryRun: options.dryRun === true,
        changes,
        warnings,
      };
    }
    // Recheck the entire read set, including unchanged files and the lock, before committing.
    for (const read of reads) {
      const now = readTarget(read.path);
      if (
        now === undefined
          ? read.bytes !== undefined
          : read.bytes === undefined || !now.equals(read.bytes)
      ) {
        throw new Error(`${read.path}: changed during planning; retry`);
      }
    }
    for (const write of writes) atomicAssetWrite(write.path, write.after);
    for (const asset of bundle.assets) {
      if (!fs.readFileSync(targetAssetPath(projectDir, asset.path)).equals(asset.bytes))
        throw new Error(`${asset.path}: changed during update; lock not advanced`);
    }
    if (byteDigest(fs.readFileSync(registryPath)) !== nextLock.registry?.byteDigest) {
      throw new Error(`${REGISTRY_PATH}: changed during update; lock not advanced`);
    }
    atomicAssetWrite(join(projectDir, ASSET_LOCK_PATH), `${JSON.stringify(nextLock, null, 2)}\n`);
    return { status: 'updated', dryRun: false, changes, warnings };
  } catch (error) {
    throw new Error(
      `Asset update to bundle ${version} (package ${bundle.packageVersion}) failed: ${error instanceof Error ? error.message : String(error)}. The lock was not advanced; completed atomic writes are safe to retry.`,
      { cause: error }
    );
  }
}
