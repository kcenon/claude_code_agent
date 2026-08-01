/** Minimum Node.js release supported by the current dependency set. */
export const MINIMUM_NODE_VERSION = '22.22.1';

const MINIMUM_NODE_VERSION_PARTS = MINIMUM_NODE_VERSION.split('.').map(Number);

/**
 * Check a Node.js version against the supported runtime floor.
 * @param version - A version such as `22.22.1` or `v22.22.1`.
 * @returns Whether the version meets the minimum supported release.
 */
export function isSupportedNodeVersion(version: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(version.trim());
  if (match === null) return false;

  const actual = match.slice(1).map(Number);
  for (let index = 0; index < MINIMUM_NODE_VERSION_PARTS.length; index += 1) {
    const actualPart = actual[index] ?? 0;
    const minimumPart = MINIMUM_NODE_VERSION_PARTS[index] ?? 0;
    if (actualPart > minimumPart) return true;
    if (actualPart < minimumPart) return false;
  }
  return true;
}
