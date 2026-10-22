import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Root of the package containing this module: the checkout in development, the install directory once published. */
export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const packageVersionSchema = z.object({ version: z.string().min(1) });

/**
 * Read the version declared in a package's `package.json` at runtime.
 * @param packageRoot - Package directory; defaults to the package containing this module.
 * @returns The `version` field of `package.json`.
 */
export function readPackageVersion(packageRoot: string = PACKAGE_ROOT): string {
  const raw: unknown = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  return packageVersionSchema.parse(raw).version;
}
