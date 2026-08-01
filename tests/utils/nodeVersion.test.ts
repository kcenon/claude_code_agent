import { describe, expect, it } from 'vitest';
import { isSupportedNodeVersion, MINIMUM_NODE_VERSION } from '../../src/utils/nodeVersion.js';

describe('nodeVersion', () => {
  it('declares the dependency-compatible runtime floor', () => {
    expect(MINIMUM_NODE_VERSION).toBe('22.22.1');
  });

  it.each(['22.22.1', 'v22.22.1', '22.23.0', '23.0.0', 'v24.1.2+build.1'])(
    'accepts supported version %s',
    (version) => {
      expect(isSupportedNodeVersion(version)).toBe(true);
    }
  );

  it.each(['22.22.1-rc.1', '22.22.0', '22.21.99', '21.99.99', 'v18.20.0', '22', 'invalid'])(
    'rejects unsupported or malformed version %s',
    (version) => {
      expect(isSupportedNodeVersion(version)).toBe(false);
    }
  );
});
