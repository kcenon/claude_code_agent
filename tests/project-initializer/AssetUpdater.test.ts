import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byteDigest } from '../../src/project-initializer/AgentAssets.js';
import {
  ASSET_LOCK_PATH,
  updateAssets,
  type AssetLock,
} from '../../src/project-initializer/AssetUpdater.js';
import { ProjectInitializer } from '../../src/project-initializer/ProjectInitializer.js';
import { validateAllAgents } from '../../src/agent-validator/validator.js';
import { copyBundle, regenerate, snapshot, write } from './assetFixtures.js';

let temp: string;
let source: string;
let project: string;
const agent = '.claude/agents/collector.md';
const command = '.claude/commands/status.md';
const registry = '.ad-sdlc/config/agents.yaml';
const read = (file: string) => fs.readFileSync(join(project, file), 'utf8');
const lock = (): AssetLock => JSON.parse(read(ASSET_LOCK_PATH));
const update = (dryRun = false) =>
  updateAssets({ projectDir: project, packageRoot: source, dryRun });
function incoming(version = '1.1.0'): void {
  for (const file of [agent, command])
    write(
      source,
      file,
      fs.readFileSync(join(source, file), 'utf8') + '\nUpdated bundle content.\n'
    );
  regenerate(source, version);
}
beforeEach(async () => {
  temp = fs.mkdtempSync(join(tmpdir(), 'asset upgrades '));
  source = join(temp, 'package');
  project = join(temp, 'project');
  copyBundle(source);
  await new ProjectInitializer(
    {
      projectName: '.',
      targetDir: project,
      template: 'standard',
      techStack: 'typescript',
      skipValidation: true,
    },
    source
  ).initialize();
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(temp, { recursive: true, force: true });
});

describe('conservative asset upgrades', () => {
  it('records exact byte baselines and preserves unchanged files', () => {
    expect(lock().files[agent]!.byteDigest).toBe(byteDigest(fs.readFileSync(join(project, agent))));
    const time = fs.statSync(join(project, agent)).mtimeMs;
    expect(update().changes.every((c) => c.action === 'unchanged')).toBe(true);
    expect(fs.statSync(join(project, agent)).mtimeMs).toBe(time);
  });

  it('upgrades clean agents/commands and leaves user configuration and unknown files intact', () => {
    write(project, '.claude/agents/custom.md', 'user prompt');
    write(project, '.claude/settings.json', '{"personal":true}');
    const workflow = read('.ad-sdlc/config/workflow.yaml');
    incoming();
    expect(update().status).toBe('updated');
    for (const file of [agent, command]) {
      expect(read(file)).toBe(fs.readFileSync(join(source, file), 'utf8'));
      expect(lock().files[file]!.installedVersion).toBe('1.1.0');
    }
    expect(read('.claude/agents/custom.md')).toBe('user prompt');
    expect(read('.claude/settings.json')).toBe('{"personal":true}');
    expect(read('.ad-sdlc/config/workflow.yaml')).toBe(workflow);
    expect(update().changes.every((c) => c.action === 'unchanged')).toBe(true);
  });

  it.each([agent, command])(
    'preserves customization and old baseline across repeated conflicts: %s',
    (file) => {
      const baseline = lock().files[file];
      write(project, file, read(file) + '\nMy customization.\n');
      incoming();
      const before = snapshot(project);
      for (let n = 0; n < 2; n++) {
        const result = update();
        expect(result.status).toBe('conflicted');
        expect(result.changes.find((c) => c.path === file)).toMatchObject({
          action: 'conflict',
          oldVersion: '1.0.0',
          targetVersion: '1.1.0',
          message: expect.stringContaining('Compare'),
        });
        expect(snapshot(project)).toEqual(before);
        expect(lock().files[file]).toEqual(baseline);
      }
      // Explicit manual reconciliation to incoming content safely reestablishes ownership.
      write(project, file, fs.readFileSync(join(source, file)));
      expect(update().status).toBe('updated');
      expect(lock().files[file]!.installedVersion).toBe('1.1.0');
    }
  );

  it('treats newline-only edits as a customization, independently of normalized manifest digests', () => {
    write(project, agent, read(agent).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
    // Ensure a different byte sequence regardless of the checkout EOL.
    if (byteDigest(fs.readFileSync(join(project, agent))) === lock().files[agent]!.byteDigest)
      write(project, agent, read(agent).replace(/\r\n/g, '\n'));
    incoming();
    expect(update().changes.find((c) => c.path === agent)!.action).toBe('conflict');
  });

  it('installs missing and newly added assets and merges missing registry entries', () => {
    fs.unlinkSync(join(project, agent));
    write(
      source,
      '.claude/agents/new-helper.md',
      fs.readFileSync(join(source, agent), 'utf8').replace('name: collector', 'name: new-helper')
    );
    regenerate(source, '1.1.0');
    const result = update();
    expect(result.status).toBe('updated');
    expect(result.changes.find((c) => c.path === '.claude/agents/new-helper.md')!.action).toBe(
      'install'
    );
    expect(
      validateAllAgents({
        agentsDir: join(project, '.claude/agents'),
        registryPath: join(project, registry),
        checkRegistry: true,
      }).invalidCount
    ).toBe(0);
  });

  it('does not silently remove retired or unknown assets', () => {
    const retired = '.claude/agents/standalone-helper.md';
    write(
      source,
      retired,
      fs
        .readFileSync(join(source, agent), 'utf8')
        .replace('name: collector', 'name: standalone-helper')
    );
    regenerate(source, '1.1.0');
    update();
    const baseline = lock().files[retired];
    fs.unlinkSync(join(source, retired));
    regenerate(source, '1.2.0');
    expect(update().warnings).toContain(`Retired asset preserved: ${retired}`);
    expect(fs.existsSync(join(project, retired))).toBe(true);
    expect(lock().files[retired]).toEqual(baseline);
  });

  it('dry runs leave the entire project and package unchanged, including missing directories', () => {
    fs.rmSync(join(project, '.claude/commands'), { recursive: true });
    fs.unlinkSync(join(project, ASSET_LOCK_PATH));
    const before = snapshot(project);
    const packageBefore = snapshot(source);
    expect(update(true).status).toBe('ready');
    expect(snapshot(project)).toEqual(before);
    expect(snapshot(source)).toEqual(packageBefore);
  });

  it('preserves abbreviated legacy prompts as unmanaged without inferring ownership', () => {
    fs.unlinkSync(join(project, ASSET_LOCK_PATH));
    write(project, agent, '# Collector Agent\nLegacy abbreviated prompt\n');
    incoming();
    const before = snapshot(project);
    expect(update().changes.find((c) => c.path === agent)).toMatchObject({
      action: 'conflict',
      oldVersion: 'unmanaged',
    });
    expect(snapshot(project)).toEqual(before);
  });

  it('adopts identical legacy assets and normalizes unambiguous legacy entries while preserving unknown settings', () => {
    fs.unlinkSync(join(project, ASSET_LOCK_PATH));
    const original = yaml.load(read(registry)) as {
      agents: Record<string, Record<string, unknown>>;
      [key: string]: unknown;
    };
    original.agents = {
      collector: { ...original.agents.collector!, model: 'haiku', private_setting: { budget: 42 } },
    };
    delete original.agents.collector!.definition_file;
    original.custom_root = { keep: true };
    write(project, registry, yaml.dump(original));
    expect(update().status).toBe('updated');
    const saved = yaml.load(read(registry));
    expect(saved).toMatchObject({
      custom_root: { keep: true },
      agents: {
        collector: {
          definition: agent,
          definition_file: agent,
          model: 'haiku',
          private_setting: { budget: 42 },
        },
      },
    });
    expect(lock().files[agent]!.byteDigest).toBe(byteDigest(fs.readFileSync(join(project, agent))));
  });

  it('preserves comments in complete registries without rewriting them', () => {
    write(project, registry, '# User comment\n' + read(registry));
    const before = read(registry);
    incoming();
    expect(update().status).toBe('updated');
    expect(read(registry)).toBe(before);
  });

  it('leaves commented legacy registries intact and reports required additions', () => {
    write(project, registry, '# Important comment\nversion: 1.0.0\nagents: {}\ncustom: 42\n');
    const before = snapshot(project);
    const result = update();
    expect(result.status).toBe('conflicted');
    expect(result.changes.find((c) => c.path === registry)!.message).toContain('manually add');
    expect(snapshot(project)).toEqual(before);
  });

  it.each(['definition_file', 'id'])(
    'preserves ambiguous registry %s and reports conflict',
    (field) => {
      const config = yaml.load(read(registry)) as {
        agents: Record<string, Record<string, unknown>>;
      };
      config.agents.collector![field] = 'custom-value';
      write(project, registry, yaml.dump(config));
      const before = snapshot(project);
      expect(update().status).toBe('conflicted');
      expect(snapshot(project)).toEqual(before);
    }
  );

  it.each([
    [
      'future bundle',
      (l: AssetLock) => {
        l.bundleVersion = '1.99.0';
      },
      /downgrade/,
    ],
    [
      'incompatible bundle',
      (l: AssetLock) => {
        l.bundleVersion = '2.0.0';
      },
      /Incompatible/,
    ],
    [
      'future file',
      (l: AssetLock) => {
        l.files[agent]!.installedVersion = '1.99.0';
      },
      /downgrade/,
    ],
    [
      'unsupported lock schema',
      (l: AssetLock) => {
        (l as unknown as { schemaVersion: number }).schemaVersion = 9;
      },
      /schemaVersion/,
    ],
    [
      'corrupt baseline',
      (l: AssetLock) => {
        l.files[agent]!.byteDigest = 'bad';
      },
      /byteDigest/,
    ],
    [
      'wrong lock ID',
      (l: AssetLock) => {
        l.files[agent]!.id = 'agent:other';
      },
      /ID mismatch/,
    ],
  ] as const)('rejects %s without mutation', (_name, corrupt, message) => {
    const prior = lock();
    corrupt(prior);
    write(project, ASSET_LOCK_PATH, JSON.stringify(prior));
    const before = snapshot(project);
    expect(() => update()).toThrow(message);
    expect(snapshot(project)).toEqual(before);
  });

  it('rejects duplicate IDs introduced by a renamed legacy entry', () => {
    const config = yaml.load(read(registry)) as { agents: Record<string, Record<string, unknown>> };
    config.agents['my-collector'] = config.agents.collector!;
    delete config.agents.collector;
    write(project, registry, yaml.dump(config));
    const before = snapshot(project);
    const result = update();
    expect(result.status).toBe('conflicted');
    expect(result.changes.find((c) => c.path === registry)!.message).toContain(
      'duplicate ID collector'
    );
    expect(snapshot(project)).toEqual(before);
  });

  it('validates the proposed registry before any asset writes', () => {
    const config = yaml.load(read(registry)) as { agents: Record<string, Record<string, unknown>> };
    config.agents.collector!.name = null;
    write(project, registry, yaml.dump(config));
    incoming();
    const before = snapshot(project);
    expect(update().status).toBe('conflicted');
    expect(snapshot(project)).toEqual(before);
  });

  it('keeps the old lock when the final atomic lock commit fails', () => {
    incoming();
    const priorLock = read(ASSET_LOCK_PATH);
    const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (to.toString() === join(project, ASSET_LOCK_PATH))
        throw new Error('simulated lock failure');
      rename(from, to);
    });
    expect(() => update()).toThrow(/simulated lock failure/);
    expect(read(ASSET_LOCK_PATH)).toBe(priorLock);
    vi.restoreAllMocks();
    expect(update().status).toBe('updated');
    expect(lock().bundleVersion).toBe('1.1.0');
  });

  it('rejects conflicting content that reuses an existing bundle version', () => {
    incoming('1.0.0');
    const before = snapshot(project);
    expect(() => update()).toThrow(/reuses bundle version 1.0.0/);
    expect(snapshot(project)).toEqual(before);
  });

  it('leaves the lock unchanged on write failure and can safely retry completed writes', () => {
    incoming();
    const priorLock = read(ASSET_LOCK_PATH);
    const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (to.toString() === join(project, command)) throw new Error('simulated write failure');
      rename(from, to);
    });
    expect(() => update()).toThrow(/simulated write failure.*lock was not advanced/);
    expect(read(ASSET_LOCK_PATH)).toBe(priorLock);
    expect(read(agent)).toBe(fs.readFileSync(join(source, agent), 'utf8'));
    vi.restoreAllMocks();
    expect(update().status).toBe('updated');
    expect(lock().bundleVersion).toBe('1.1.0');
    expect(Object.keys(snapshot(project)).some((p) => p.endsWith('.tmp'))).toBe(false);
  });
});
