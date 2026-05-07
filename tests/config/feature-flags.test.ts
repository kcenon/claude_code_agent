/**
 * FeatureFlagsResolver unit tests (Issue #795).
 *
 * Verifies the env > CLI > config > default priority chain for the
 * worker-pilot flag, env tokenization, YAML opt-in semantics, and
 * malformed-file diagnostics.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FeatureFlagsResolver,
  ENV_USE_SDK_FOR_WORKER,
  FEATURE_FLAGS_FILE_NAME,
  DEFAULT_FEATURE_FLAGS,
  parseBooleanEnv,
  loadFeatureFlagsFile,
  getFeatureFlagsFilePath,
} from '../../src/config/featureFlags.js';

describe('FeatureFlagsResolver', () => {
  describe('parseBooleanEnv', () => {
    it('returns undefined for unset env', () => {
      expect(parseBooleanEnv(undefined)).toBeUndefined();
    });

    it.each([
      ['1', true],
      ['true', true],
      ['TRUE', true],
      ['yes', true],
      ['on', true],
      ['  True  ', true],
    ])('parses %s as truthy', (input, expected) => {
      expect(parseBooleanEnv(input)).toBe(expected);
    });

    it.each([
      ['0', false],
      ['false', false],
      ['FALSE', false],
      ['no', false],
      ['off', false],
      ['', false],
    ])('parses %s as falsy', (input, expected) => {
      expect(parseBooleanEnv(input)).toBe(expected);
    });

    it('throws a readable error for unrecognized values', () => {
      expect(() => parseBooleanEnv('maybe')).toThrow(/Invalid boolean value "maybe"/);
    });
  });

  describe('priority matrix (useSdkForWorker)', () => {
    const emptyEnv: NodeJS.ProcessEnv = {};

    it('returns the default false when no source provides a value', () => {
      const resolver = new FeatureFlagsResolver({ env: emptyEnv });
      expect(resolver.useSdkForWorker()).toBe(DEFAULT_FEATURE_FLAGS.useSdkForWorker);
      expect(resolver.useSdkForWorker()).toBe(false);
    });

    it('returns env value (true) when env is set, ignoring lower layers', () => {
      const resolver = new FeatureFlagsResolver({
        env: { [ENV_USE_SDK_FOR_WORKER]: '1' },
        cli: { useSdkForWorker: false },
        config: { useSdkForWorker: false },
      });
      expect(resolver.useSdkForWorker()).toBe(true);
    });

    it('returns env value (false) when env is set to falsy, ignoring lower layers', () => {
      const resolver = new FeatureFlagsResolver({
        env: { [ENV_USE_SDK_FOR_WORKER]: '0' },
        cli: { useSdkForWorker: true },
        config: { useSdkForWorker: true },
      });
      expect(resolver.useSdkForWorker()).toBe(false);
    });

    it('falls through to CLI when env is unset', () => {
      const resolver = new FeatureFlagsResolver({
        env: emptyEnv,
        cli: { useSdkForWorker: true },
        config: { useSdkForWorker: false },
      });
      expect(resolver.useSdkForWorker()).toBe(true);
    });

    it('CLI false beats config true when env is unset', () => {
      const resolver = new FeatureFlagsResolver({
        env: emptyEnv,
        cli: { useSdkForWorker: false },
        config: { useSdkForWorker: true },
      });
      expect(resolver.useSdkForWorker()).toBe(false);
    });

    it('falls through to YAML config when env and CLI are absent', () => {
      const resolver = new FeatureFlagsResolver({
        env: emptyEnv,
        cli: {},
        config: { useSdkForWorker: true },
      });
      expect(resolver.useSdkForWorker()).toBe(true);
    });

    it('falls through to default when only YAML is absent (CLI present)', () => {
      const resolver = new FeatureFlagsResolver({
        env: emptyEnv,
        cli: {},
        config: {},
      });
      expect(resolver.useSdkForWorker()).toBe(false);
    });

    it('propagates env parsing errors instead of silently coercing', () => {
      const resolver = new FeatureFlagsResolver({
        env: { [ENV_USE_SDK_FOR_WORKER]: 'maybe' },
      });
      expect(() => resolver.useSdkForWorker()).toThrow(/Invalid boolean value "maybe"/);
    });
  });

  describe('YAML opt-in behaviour', () => {
    let tmpRoot: string;
    let configDir: string;
    let yamlPath: string;

    beforeEach(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), 'ad-sdlc-flags-'));
      configDir = join(tmpRoot, '.ad-sdlc', 'config');
      mkdirSync(configDir, { recursive: true });
      yamlPath = join(configDir, FEATURE_FLAGS_FILE_NAME);
    });

    afterEach(() => {
      rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('does NOT auto-create the YAML file', () => {
      // Build the resolver via fromSources without writing the file.
      const resolver = FeatureFlagsResolver.fromSources({
        baseDir: tmpRoot,
        env: {},
      });
      expect(resolver.useSdkForWorker()).toBe(false);
      expect(existsSync(yamlPath)).toBe(false);
    });

    it('treats missing file as "not configured" (returns null)', () => {
      const result = loadFeatureFlagsFile(yamlPath);
      expect(result).toBeNull();
    });

    it('reads useSdkForWorker:true from YAML when env/CLI are absent', () => {
      writeFileSync(yamlPath, 'flags:\n  useSdkForWorker: true\n', 'utf8');
      const resolver = FeatureFlagsResolver.fromSources({
        baseDir: tmpRoot,
        env: {},
      });
      expect(resolver.useSdkForWorker()).toBe(true);
    });

    it('reads useSdkForWorker:false from YAML and overrides nothing higher', () => {
      writeFileSync(yamlPath, 'flags:\n  useSdkForWorker: false\n', 'utf8');
      const resolver = FeatureFlagsResolver.fromSources({
        baseDir: tmpRoot,
        env: {},
      });
      expect(resolver.useSdkForWorker()).toBe(false);
    });

    it('YAML is overridden by env (env wins)', () => {
      writeFileSync(yamlPath, 'flags:\n  useSdkForWorker: false\n', 'utf8');
      const resolver = FeatureFlagsResolver.fromSources({
        baseDir: tmpRoot,
        env: { [ENV_USE_SDK_FOR_WORKER]: 'yes' },
      });
      expect(resolver.useSdkForWorker()).toBe(true);
    });

    it('YAML is overridden by CLI when env is absent (CLI wins)', () => {
      writeFileSync(yamlPath, 'flags:\n  useSdkForWorker: false\n', 'utf8');
      const resolver = FeatureFlagsResolver.fromSources({
        baseDir: tmpRoot,
        env: {},
        cli: { useSdkForWorker: true },
      });
      expect(resolver.useSdkForWorker()).toBe(true);
    });

    it('treats an empty YAML document as unset', () => {
      writeFileSync(yamlPath, '', 'utf8');
      const resolver = FeatureFlagsResolver.fromSources({
        baseDir: tmpRoot,
        env: {},
      });
      expect(resolver.useSdkForWorker()).toBe(false);
    });

    it('rejects malformed YAML with a readable error', () => {
      writeFileSync(yamlPath, 'flags:\n  useSdkForWorker: [not a bool\n', 'utf8');
      expect(() => loadFeatureFlagsFile(yamlPath)).toThrow(/Failed to parse YAML/);
    });

    it('rejects unknown keys in strict mode', () => {
      writeFileSync(yamlPath, 'flags:\n  someUnknownFlag: true\n', 'utf8');
      expect(() => loadFeatureFlagsFile(yamlPath)).toThrow(/Invalid feature-flags file/);
    });

    it('rejects wrong types with a readable error', () => {
      writeFileSync(yamlPath, 'flags:\n  useSdkForWorker: "yes-please"\n', 'utf8');
      expect(() => loadFeatureFlagsFile(yamlPath)).toThrow(/Invalid feature-flags file/);
    });
  });

  describe('getFeatureFlagsFilePath', () => {
    it('places the YAML under .ad-sdlc/config/feature-flags.yaml relative to baseDir', () => {
      const baseDir = '/tmp/some-project';
      const path = getFeatureFlagsFilePath(baseDir);
      expect(path.endsWith('.ad-sdlc/config/feature-flags.yaml')).toBe(true);
      expect(path.startsWith(baseDir)).toBe(true);
    });
  });
});
