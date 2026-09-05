/** Canonical package assets. No project-directory or Claude-home fallback. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseFrontmatter, validateAgentFile } from '../agent-validator/validator.js';
import type { AgentFrontmatter } from '../agent-validator/types.js';
import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
  LOCAL_AGENT_SUBSTITUTIONS,
  CI_FIXER_SKILLS,
} from '../ad-sdlc-orchestrator/types.js';

export const ASSET_PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ASSET_MANIFEST_PATH = 'agent-assets.manifest.json';
export const ASSET_VERSION_SCHEMA = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
export const DIGEST_SCHEMA = z.string().regex(/^[a-f0-9]{64}$/);
const idSchema = z.string().regex(/^(agent|command):[a-z][a-z0-9-]*$/);
const entrySchema = z.strictObject({
  id: idSchema,
  kind: z.enum(['agent', 'command']),
  path: z.string(),
  digest: DIGEST_SCHEMA,
  role: z.enum(['direct', 'local', 'support', 'command']),
  requires: z.array(idSchema),
});
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  bundleVersion: ASSET_VERSION_SCHEMA,
  assets: z.array(entrySchema).min(1),
  localSubstitutions: z.record(z.string(), z.string()),
  optionalExternalSkills: z.array(
    z.strictObject({
      plugin: z.literal('claude-config'),
      name: z.string().min(1),
      required: z.literal(false),
    })
  ),
});

export type AssetManifest = z.infer<typeof manifestSchema>;
export type AssetEntry = AssetManifest['assets'][number];
export interface ValidatedAsset extends AssetEntry {
  bytes: Buffer;
  frontmatter?: AgentFrontmatter;
}
export interface AssetBundle {
  packageRoot: string;
  packageVersion: string;
  manifest: AssetManifest;
  /** Digest of the complete logical manifest, including dependencies. */
  manifestDigest: string;
  assets: ValidatedAsset[];
  warnings: string[];
}

/** SHA-256 over exact bytes; used for installed ownership baselines.
 * @param content - Exact bytes or UTF-8 text to hash
 * @returns Lowercase SHA-256 hex digest
 */
export function byteDigest(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Manifest digests normalize CRLF only. Whitespace and final newlines matter.
 * @param bytes - Canonical UTF-8 file bytes
 * @returns Digest after CRLF normalization
 */
export function contentDigest(bytes: Buffer): string {
  return byteDigest(
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes).replace(/\r\n/g, '\n')
  );
}

/** Discover only production prompts in the two declared canonical roots.
 * @param root - Package root containing the canonical directories
 * @returns Sorted production asset paths
 */
export function discoverAssetPaths(root: string): string[] {
  return ['agents', 'commands']
    .flatMap((kind) => {
      const dir = join(root, '.claude', kind);
      return readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => `.claude/${kind}/${name}`);
    })
    .sort();
}

/** Runtime stage types are the independent direct-agent contract.
 * @returns Sorted unique runtime agent types
 */
export function directAgentTypes(): string[] {
  return [
    ...new Set(
      [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES].map(
        (stage) => stage.agentType
      )
    ),
  ].sort();
}

function optionalSkills(): AssetManifest['optionalExternalSkills'] {
  return [
    ...new Set(
      [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES]
        .flatMap((stage) => stage.skills ?? [])
        .concat([...CI_FIXER_SKILLS])
    ),
  ]
    .sort()
    .map((name) => ({ plugin: 'claude-config', name, required: false }));
}

/** Recognize invocations, not arbitrary filenames, email addresses, or example paths.
 * @param content - Canonical Markdown content
 * @param kind - Agent or command metadata kind
 * @param filePath - Referencing asset path for diagnostics
 * @returns Sorted required asset IDs
 */
export function assetReferences(
  content: string,
  kind: AssetEntry['kind'],
  filePath = 'asset dependencies'
): string[] {
  const { frontmatter, body } = parseFrontmatter(content, filePath);
  const metadata = z
    .object({ 'required-assets': z.array(idSchema).optional() })
    .safeParse(frontmatter);
  if (!metadata.success)
    throw new Error(`${filePath}: required-assets metadata: ${metadata.error.message}`);
  const refs = new Set(metadata.data['required-assets'] ?? []);
  for (const match of body.matchAll(/\bsubagent_type["']?\s*[:=]\s*["']([a-z][a-z0-9-]*)["']/g)) {
    refs.add(`agent:${match[1] ?? ''}`);
  }
  for (const match of body.matchAll(/^@([a-z][a-z0-9-]*)\b/gm)) refs.add(`agent:${match[1] ?? ''}`);
  for (const match of body.matchAll(/\bCall ([a-z][a-z0-9-]*) subagent/g))
    refs.add(`agent:${match[1] ?? ''}`);
  if (kind === 'command') {
    for (const match of body.matchAll(/`\/([a-z][a-z0-9-]*)(?=[ `])/g)) {
      refs.add(`command:${match[1] ?? ''}`);
    }
  }
  return [...refs].sort();
}

function roleFor(name: string, kind: AssetEntry['kind']): AssetEntry['role'] {
  if (kind === 'command') return 'command';
  if (directAgentTypes().includes(name)) return 'direct';
  return Object.values(LOCAL_AGENT_SUBSTITUTIONS).includes(name) ? 'local' : 'support';
}

/** Deterministically regenerate metadata from source prompts and runtime declarations.
 * @param root - Canonical package root
 * @param bundleVersion - Independent semantic asset version
 * @returns Deterministic manifest metadata
 */
export function generateAssetManifest(root: string, bundleVersion: string): AssetManifest {
  return manifestSchema.parse({
    schemaVersion: 1,
    bundleVersion,
    assets: discoverAssetPaths(root).map((assetPath) => {
      const kind = assetPath.startsWith('.claude/agents/') ? 'agent' : 'command';
      const name = assetPath.split('/').at(-1)?.slice(0, -3) ?? '';
      const bytes = readFileSync(join(root, assetPath));
      const requires = assetReferences(bytes.toString('utf8'), kind, assetPath);
      if (name === 'ad-sdlc-orchestrator' && kind === 'agent') {
        requires.push(...directAgentTypes().map((id) => `agent:${id}`));
        requires.push(...Object.values(LOCAL_AGENT_SUBSTITUTIONS).map((id) => `agent:${id}`));
      }
      return {
        id: `${kind}:${name}`,
        kind,
        path: assetPath,
        digest: contentDigest(bytes),
        role: roleFor(name, kind),
        requires: [...new Set(requires)].sort(),
      };
    }),
    localSubstitutions: LOCAL_AGENT_SUBSTITUTIONS,
    optionalExternalSkills: optionalSkills(),
  });
}

/** Reject traversal, ambiguous filenames and links, including linked parent directories.
 * @param root - Package root
 * @param assetPath - Declared relative asset path
 * @returns Safe absolute asset path
 */
export function assertAssetPath(root: string, assetPath: string): string {
  if (!/^\.claude\/(agents|commands)\/[a-z][a-z0-9-]*\.md$/.test(assetPath)) {
    throw new Error(`Invalid asset path: ${assetPath}`);
  }
  const parts = assetPath.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Asset root must be an ordinary directory: ${assetPath} (${current})`);
    }
  }
  const fullPath = resolve(root, assetPath);
  const canonicalRoot = realpathSync(root);
  if (
    lstatSync(fullPath).isSymbolicLink() ||
    !lstatSync(fullPath).isFile() ||
    relative(canonicalRoot, realpathSync(fullPath)).startsWith('..')
  ) {
    throw new Error(`Asset is not a regular file inside package: ${assetPath}`);
  }
  return fullPath;
}

/** Validate the complete installed bundle before any target project writes.
 * @param packageRoot - Explicit package source; defaults to this module’s package
 * @returns Validated bytes, metadata, provenance and warnings
 */
export function loadAssetBundle(packageRoot = ASSET_PACKAGE_ROOT): AssetBundle {
  let packageVersion = 'unknown';
  let bundleVersion = 'unknown';
  try {
    const pkg = z
      .object({ version: z.string() })
      .parse(JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')));
    packageVersion = pkg.version;
    const raw: unknown = JSON.parse(readFileSync(join(packageRoot, ASSET_MANIFEST_PATH), 'utf8'));
    const provenance = z.object({ bundleVersion: z.string() }).safeParse(raw);
    if (provenance.success) bundleVersion = provenance.data.bundleVersion;
    const manifest = manifestSchema.parse(raw);
    const ids = new Set<string>();
    const targets = new Set<string>();
    const warnings: string[] = [];
    const assets = manifest.assets.map((entry): ValidatedAsset => {
      if (ids.has(entry.id)) throw new Error(`Duplicate asset ID: ${entry.id}`);
      if (targets.has(entry.path)) throw new Error(`Duplicate asset target: ${entry.path}`);
      ids.add(entry.id);
      targets.add(entry.path);
      const name = entry.id.slice(entry.kind.length + 1);
      if (
        entry.id !== `${entry.kind}:${name}` ||
        entry.path !== `.claude/${entry.kind}s/${name}.md`
      ) {
        throw new Error(`${entry.id}: kind/ID/filename mismatch at ${entry.path}`);
      }
      const fullPath = assertAssetPath(packageRoot, entry.path);
      const bytes = readFileSync(fullPath);
      if (contentDigest(bytes) !== entry.digest)
        throw new Error(`${entry.path}: content digest mismatch`);
      if (entry.kind === 'command') {
        const metadata = parseFrontmatter(bytes.toString('utf8'), entry.path).frontmatter;
        const result = z
          .object({ description: z.string().min(1), 'argument-hint': z.string().optional() })
          .safeParse(metadata);
        if (!result.success)
          throw new Error(`${entry.path}: command metadata: ${result.error.message}`);
        return { ...entry, bytes };
      }
      const result = validateAgentFile(fullPath, { checkRegistry: false });
      if (!result.valid || result.agent === undefined) {
        throw new Error(
          `${entry.path}: ${result.errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
        );
      }
      if (result.agent.frontmatter.name !== name)
        throw new Error(`${entry.path}: frontmatter name must be ${name}`);
      warnings.push(...result.warnings.map((w) => `${entry.path}: ${w.message}`));
      return { ...entry, bytes, frontmatter: result.agent.frontmatter };
    });
    for (const entry of assets) {
      for (const ref of entry.requires) {
        if (!ids.has(ref)) throw new Error(`${entry.path}: unresolved required asset ${ref}`);
      }
    }
    for (const name of [
      ...directAgentTypes(),
      ...Object.keys(LOCAL_AGENT_SUBSTITUTIONS),
      ...Object.values(LOCAL_AGENT_SUBSTITUTIONS),
    ]) {
      if (!ids.has(`agent:${name}`)) throw new Error(`Runtime requires .claude/agents/${name}.md`);
    }
    // Required public commands are a CLI contract, independent of manifest agreement.
    for (const name of ['run-greenfield', 'resume', 'status', 'audit-docs']) {
      if (!ids.has(`command:${name}`)) throw new Error(`CLI requires .claude/commands/${name}.md`);
    }
    const expected = generateAssetManifest(packageRoot, bundleVersion);
    const expectedPaths = expected.assets.map((a) => a.path);
    if (JSON.stringify([...targets].sort()) !== JSON.stringify(expectedPaths)) {
      throw new Error(
        `Source inventory differs from manifest: ${expectedPaths.filter((p) => !targets.has(p)).join(', ')}`
      );
    }
    for (const entry of expected.assets) {
      const declared = assets.find((a) => a.id === entry.id);
      if (
        JSON.stringify(declared?.requires) !== JSON.stringify(entry.requires) ||
        declared?.role !== entry.role
      ) {
        throw new Error(
          `${entry.path}: required references/role differ from source/runtime: ${entry.requires.join(', ')}`
        );
      }
    }
    if (JSON.stringify(manifest) !== JSON.stringify(expected)) {
      throw new Error(
        `${ASSET_MANIFEST_PATH}: ordering, local substitutions or optional skills differ from source/runtime; regenerate manifest`
      );
    }
    return {
      packageRoot,
      packageVersion,
      manifest,
      manifestDigest: byteDigest(JSON.stringify(manifest)),
      assets,
      warnings,
    };
  } catch (error) {
    throw new Error(
      `Asset bundle ${bundleVersion} (package ${packageVersion}): ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}
