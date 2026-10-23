/** Portable project-relative locations and explicit external-reference validation. */
import * as path from 'node:path';
import type { Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { artifactError, type ArtifactDeclaration, type ArtifactEntry } from './schemas.js';

/** Read-only without following a final symlink (Windows has no O_NOFOLLOW; it adds no bit there). */
const READ_NO_FOLLOW = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/**
 * Hash the regular file that an earlier lstat checked. The file is opened without following a
 * final symlink and must be the checked file (same device and inode), so a file or symlink
 * swapped in after the check is rejected instead of read.
 * @param target - Absolute filesystem location of the artifact.
 * @param checked - lstat result for `target` that passed the artifact checks.
 * @param location - Normalized location for error messages.
 * @returns SHA-256 digest of the file bytes.
 */
export async function hashCheckedFile(
  target: string,
  checked: Stats,
  location: string
): Promise<string> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(target, READ_NO_FOLLOW);
  } catch (error) {
    // Linux and macOS report ELOOP for a symlink opened with O_NOFOLLOW, FreeBSD EMLINK
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ELOOP' || code === 'EMLINK')
      throw artifactError(`Artifact itself must not be a symlink: ${location}`);
    throw error;
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== checked.dev || opened.ino !== checked.ino)
      throw artifactError(`Artifact changed while it was inspected: ${location}`);
    return createHash('sha256')
      .update(await handle.readFile())
      .digest('hex');
  } finally {
    await handle.close();
  }
}

/**
 * Normalize without trimming meaningful filename characters or changing Unicode/case.
 * @param projectDir - Explicit absolute target project root.
 * @param input - Untrusted local artifact path.
 * @returns Portable normalized project-relative location.
 */
export function normalizeArtifactPath(projectDir: string, input: string): string {
  if (input.trim() === '') throw artifactError('Artifact path must not be empty');
  for (const character of input)
    if (character.charCodeAt(0) < 32)
      throw artifactError(`Invalid control character in artifact path: ${JSON.stringify(input)}`);
  if (/^[a-z]:/i.test(input) || /^[/\\]{2}/.test(input)) {
    if (process.platform !== 'win32' || !path.win32.isAbsolute(input))
      throw artifactError(`Foreign drive/UNC artifact path: ${input}`);
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !path.win32.isAbsolute(input))
    throw artifactError(`URI requires an external-uri declaration: ${input}`);
  const target = path.resolve(projectDir, input.replace(/\\/g, '/'));
  if (!inside(projectDir, target)) throw artifactError(`Artifact escapes project root: ${input}`);
  return path.relative(projectDir, target).split(path.sep).join('/') || '.';
}

/**
 * A missing/deleted target still has to have a safe nearest existing ancestor.
 * @param projectDir - Explicit absolute target project root.
 * @param target - Absolute filesystem location to check.
 */
export async function assertPhysicalContainment(projectDir: string, target: string): Promise<void> {
  const root = await fs.realpath(projectDir);
  let ancestor = target;
  for (;;) {
    try {
      const resolved = await fs.realpath(ancestor);
      if (!inside(root, resolved))
        throw artifactError(`Artifact symlink escapes project root: ${target}`);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        if ((await fs.lstat(ancestor)).isSymbolicLink())
          throw artifactError(`Unresolvable symlink ancestor: ${ancestor}`);
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') throw statError;
      }
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw artifactError(`Cannot resolve artifact ancestor: ${target}`);
      ancestor = parent;
    }
  }
}

/**
 * Validate a location, returning a checksum of current bytes for existing files.
 * @param projectDir - Explicit absolute target project root.
 * @param declaration - Artifact location, kind, and claimed change.
 * @param externalReferences - Exact external locations permitted by the trusted caller.
 * @returns Validated location, availability, and optional SHA-256 digest.
 */
export async function inspectArtifact(
  projectDir: string,
  declaration: ArtifactDeclaration,
  externalReferences: readonly string[] = []
): Promise<{ path: string; availability: ArtifactEntry['availability']; checksum?: string }> {
  if (
    declaration.checksum !== undefined &&
    (declaration.operation === 'deleted' ||
      (declaration.kind !== 'file' && declaration.kind !== 'external-file'))
  )
    throw artifactError(`Checksum requires a present file: ${declaration.path}`);
  const external = declaration.kind.startsWith('external-');
  if (external && !externalReferences.includes(declaration.path))
    throw artifactError(`External artifact is not permitted: ${declaration.path}`);
  if (declaration.kind === 'external-uri') {
    let url: URL;
    try {
      url = new URL(declaration.path);
    } catch {
      throw artifactError(`Invalid external URI: ${declaration.path}`);
    }
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username !== '' ||
      url.password !== '' ||
      declaration.operation !== 'reused' ||
      declaration.checksum !== undefined
    )
      throw artifactError(
        `External URI must be an HTTP(S) reference without credentials: ${declaration.path}`
      );
    return { path: declaration.path, availability: 'external-unverified' };
  }
  const normalized = external
    ? declaration.path
    : normalizeArtifactPath(projectDir, declaration.path);
  if (external && !path.isAbsolute(normalized))
    throw artifactError(`External file requires a native absolute path: ${normalized}`);
  const target = external ? normalized : path.resolve(projectDir, normalized);
  if (!external) await assertPhysicalContainment(projectDir, target);
  let stat;
  try {
    stat = await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { path: normalized, availability: 'absent' };
  }
  if (stat.isSymbolicLink())
    throw artifactError(`Artifact itself must not be a symlink: ${normalized}`);
  if (declaration.operation === 'deleted')
    throw artifactError(`Deleted artifact still exists: ${normalized}`);
  if (declaration.kind === 'directory' ? !stat.isDirectory() : !stat.isFile())
    throw artifactError(`Expected ${declaration.kind} artifact: ${normalized}`);
  if (stat.isDirectory()) return { path: normalized, availability: 'present' };
  const checksum = await hashCheckedFile(target, stat, normalized);
  if (declaration.checksum !== undefined && declaration.checksum !== checksum)
    throw artifactError(`SHA-256 mismatch for artifact: ${normalized}`);
  return { path: normalized, availability: 'present', checksum };
}
