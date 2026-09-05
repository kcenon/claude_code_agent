import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ASSET_PACKAGE_ROOT,
  ASSET_MANIFEST_PATH,
  assetReferences,
  byteDigest,
  contentDigest,
  discoverAssetPaths,
  loadAssetBundle,
  type AssetManifest,
} from '../../src/project-initializer/AgentAssets.js';
import { ProjectInitializer } from '../../src/project-initializer/ProjectInitializer.js';
import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
  LOCAL_AGENT_SUBSTITUTIONS,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { validateAllAgents } from '../../src/agent-validator/validator.js';
import { validateAllConfigs } from '../../src/config/index.js';
import { copyBundle, regenerate, snapshot, write } from './assetFixtures.js';

let temp: string;
let source: string;
let project: string;
beforeEach(() => {
  temp = fs.mkdtempSync(join(tmpdir(), 'agent assets '));
  source = join(temp, 'package with spaces');
  project = join(temp, 'target project');
  copyBundle(source);
});
afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));
const initialize = (template: 'minimal' | 'standard' | 'enterprise' = 'standard') =>
  new ProjectInitializer(
    {
      projectName: '.',
      targetDir: project,
      techStack: 'typescript',
      template,
      skipValidation: true,
    },
    source
  ).initialize();
const mutateManifest = (change: (m: AssetManifest) => void) => {
  const manifest = JSON.parse(fs.readFileSync(join(source, ASSET_MANIFEST_PATH), 'utf8'));
  change(manifest);
  write(source, ASSET_MANIFEST_PATH, JSON.stringify(manifest));
};
const editPrompt = (change: (s: string) => string) => {
  const file = '.claude/agents/collector.md';
  write(source, file, change(fs.readFileSync(join(source, file), 'utf8')));
  mutateManifest((m) => {
    m.assets.find((a) => a.path === file)!.digest = contentDigest(
      fs.readFileSync(join(source, file))
    );
  });
};

describe('canonical asset inventory and initialization', () => {
  it.each(['minimal', 'standard', 'enterprise'] as const)(
    'installs the exact source-derived inventory for %s with valid registry/configuration',
    async (template) => {
      const result = await initialize(template);
      expect(result.success).toBe(true);
      const bundle = loadAssetBundle(source);
      // Independent directory discovery; expected inventory is never a second list of agent names.
      const discovered = ['agents', 'commands']
        .flatMap((kind) =>
          fs
            .readdirSync(join(ASSET_PACKAGE_ROOT, '.claude', kind))
            .filter((f) => f.endsWith('.md'))
            .map((f) => `.claude/${kind}/${f}`)
        )
        .sort();
      expect(bundle.assets.map((a) => a.path)).toEqual(discovered);
      expect(discoverAssetPaths(project)).toEqual(discovered);
      for (const asset of bundle.assets) {
        expect(fs.readFileSync(join(project, asset.path)).equals(asset.bytes), asset.path).toBe(
          true
        );
        expect(result.createdFiles).toContain(join(project, asset.path));
      }
      const report = validateAllAgents({
        agentsDir: join(project, '.claude/agents'),
        registryPath: join(project, '.ad-sdlc/config/agents.yaml'),
        checkRegistry: true,
      });
      expect(report.totalFiles).toBe(discovered.filter((p) => p.includes('/agents/')).length);
      expect(report.totalFiles).toBeGreaterThan(0);
      expect(report.invalidCount, JSON.stringify(report.results.filter((r) => !r.valid))).toBe(0);
      expect((await validateAllConfigs(project)).valid).toBe(true);
      expect(result.createdFiles.every((p) => fs.statSync(p).isFile())).toBe(true);
      expect(result.warnings).toEqual(bundle.warnings);
    }
  );

  it('covers actual runtime arrays, actual local transformation, and source-declared delegation', () => {
    const bundle = loadAssetBundle(source);
    const ids = new Set(bundle.assets.map((a) => a.id));
    // Call the real private transformation on its prototype; it does not need an SDK session.
    const adapt = (
      AdsdlcOrchestratorAgent.prototype as unknown as {
        adaptStagesForLocalMode(stages: typeof GREENFIELD_STAGES): typeof GREENFIELD_STAGES;
      }
    ).adaptStagesForLocalMode;
    for (const stages of [GREENFIELD_STAGES, ENHANCEMENT_STAGES, IMPORT_STAGES]) {
      for (const stage of stages) expect(ids.has(`agent:${stage.agentType}`)).toBe(true);
      const local = adapt.call(AdsdlcOrchestratorAgent.prototype, stages);
      expect(local.some((s) => s.agentType === 'local-reviewer')).toBe(true);
      for (const stage of local) expect(ids.has(`agent:${stage.agentType}`)).toBe(true);
    }
    expect(
      adapt
        .call(AdsdlcOrchestratorAgent.prototype, IMPORT_STAGES)
        .some((s) => s.agentType === 'local-issue-reader')
    ).toBe(true);
    expect(bundle.manifest.localSubstitutions).toEqual(LOCAL_AGENT_SUBSTITUTIONS);
    expect(bundle.assets.find((a) => a.id === 'agent:pr-reviewer')!.requires).toContain(
      'agent:ci-fixer'
    );
    expect(bundle.assets.find((a) => a.id === 'agent:ad-sdlc-orchestrator')!.requires).toEqual(
      expect.arrayContaining([
        'agent:analysis-orchestrator',
        'agent:rtm-builder',
        'agent:stage-verifier',
      ])
    );
    for (const asset of bundle.assets)
      for (const ref of asset.requires) expect(ids.has(ref), `${asset.id} -> ${ref}`).toBe(true);
    expect(
      bundle.manifest.optionalExternalSkills.every(
        (s) => !s.required && s.plugin === 'claude-config'
      )
    ).toBe(true);
  });

  it('recognizes explicit invocations and slash commands but ignores paths and email/code examples', () => {
    expect(
      assetReferences(
        '---\ndescription: command\n---\n`/resume <id>`\n`/src/example.ts`\nContact noreply@example.com\nTask(subagent_type: "worker")\n@collector\n',
        'command'
      )
    ).toEqual(['agent:collector', 'agent:worker', 'command:resume']);
  });

  it('recognizes quoted JSON invocation keys', () => {
    expect(
      assetReferences(
        '---\ndescription: command\n---\nTask({"subagent_type": "worker"})\n',
        'command'
      )
    ).toEqual(['agent:worker']);
  });

  it('rejects linked package asset roots even when they point inside the package', () => {
    const original = join(source, '.claude/agents');
    const moved = join(source, 'undeclared-agents');
    fs.renameSync(original, moved);
    fs.symlinkSync(moved, original, 'junction');
    expect(() => loadAssetBundle(source)).toThrow(/Asset root must be an ordinary directory/);
  });

  it('rejects linked target roots before scaffold writes', async () => {
    const elsewhere = join(temp, 'user assets');
    fs.mkdirSync(elsewhere);
    fs.mkdirSync(project);
    fs.symlinkSync(elsewhere, join(project, '.claude'), 'junction');
    await expect(initialize()).rejects.toThrow(/Unsafe target path/);
    expect(fs.existsSync(join(project, '.ad-sdlc'))).toBe(false);
    expect(fs.readdirSync(elsewhere)).toEqual([]);
  });

  it('normalizes only CRLF for manifest validation and copies exact bytes', async () => {
    const file = '.claude/agents/collector.md';
    const lf = fs.readFileSync(join(source, file), 'utf8').replace(/\r\n/g, '\n');
    const crlf = Buffer.from(lf.replace(/\n/g, '\r\n'));
    expect(contentDigest(Buffer.from(lf))).toBe(contentDigest(crlf));
    expect(byteDigest(Buffer.from(lf))).not.toBe(byteDigest(crlf));
    expect(contentDigest(Buffer.from(lf + '\n'))).not.toBe(contentDigest(crlf));
    expect(contentDigest(Buffer.from('\ufeff' + lf))).not.toBe(contentDigest(crlf));
    write(source, file, crlf);
    await initialize();
    expect(fs.readFileSync(join(project, file)).equals(crlf)).toBe(true);
  });

  it('preserves unrelated .claude files and adopts identical assets without rewriting them', async () => {
    const file = '.claude/agents/collector.md';
    write(project, '.claude/settings.json', '{"custom":true}');
    write(project, '.claude/agents/my-helper.md', 'custom');
    write(project, file, fs.readFileSync(join(source, file)));
    const before = fs.statSync(join(project, file)).mtimeMs;
    const result = await initialize();
    expect(result.createdFiles).not.toContain(join(project, file));
    expect(fs.statSync(join(project, file)).mtimeMs).toBe(before);
    expect(fs.readFileSync(join(project, '.claude/agents/my-helper.md'), 'utf8')).toBe('custom');
    expect(fs.readFileSync(join(project, '.claude/settings.json'), 'utf8')).toBe('{"custom":true}');
  });

  it.each(['.claude/agents/collector.md', '.claude/commands/resume.md'])(
    'rejects existing customization %s before writes',
    async (file) => {
      write(project, file, 'custom content');
      const before = snapshot(project);
      await expect(initialize()).rejects.toThrow(/existing customization.*1.0.0/);
      expect(snapshot(project)).toEqual(before);
    }
  );
});

describe('asset failures are mandatory preflight even when prerequisites are skipped', () => {
  const cases: [string, () => void, RegExp][] = [
    [
      'duplicate target',
      () =>
        mutateManifest((m) => {
          m.assets[1]!.path = m.assets[0]!.path;
        }),
      /Duplicate asset target/,
    ],
    [
      'invalid source dependencies',
      () =>
        editPrompt((s) =>
          s.replace('model: inherit', 'required-assets: [invalid]\nmodel: inherit')
        ),
      /collector.md[\s\S]*required-assets/,
    ],

    [
      'missing packaged prompt',
      () => fs.unlinkSync(join(source, '.claude/agents/worker.md')),
      /worker.md/,
    ],
    [
      'source removed along with manifest entry',
      () => {
        fs.unlinkSync(join(source, '.claude/agents/worker.md'));
        mutateManifest((m) => {
          m.assets = m.assets.filter((a) => a.id !== 'agent:worker');
        });
      },
      /worker/,
    ],
    [
      'unknown required dependency',
      () =>
        mutateManifest((m) => {
          m.assets[0]!.requires.push('agent:missing-agent');
        }),
      /unresolved.*missing-agent/,
    ],
    [
      'missing command',
      () => fs.unlinkSync(join(source, '.claude/commands/resume.md')),
      /resume.md/,
    ],
    ['malformed frontmatter', () => editPrompt((s) => s.replace('---', 'broken')), /frontmatter/],
    ['invalid tool', () => editPrompt((s) => s.replace('  - Read', '  - BadTool')), /tools/],
    [
      'invalid model',
      () => editPrompt((s) => s.replace('model: inherit', 'model: invalid')),
      /model/,
    ],
    [
      'wrong frontmatter name',
      () => editPrompt((s) => s.replace('name: collector', 'name: other-agent')),
      /frontmatter name/,
    ],
    [
      'digest corruption',
      () =>
        mutateManifest((m) => {
          m.assets[0]!.digest = '0'.repeat(64);
        }),
      /digest/,
    ],
    [
      'unsupported schema',
      () =>
        mutateManifest((m) => {
          (m as unknown as { schemaVersion: number }).schemaVersion = 99;
        }),
      /schemaVersion/,
    ],
    [
      'duplicate ID',
      () =>
        mutateManifest((m) => {
          m.assets.push(m.assets[0]!);
        }),
      /Duplicate asset ID/,
    ],
    [
      'invalid target',
      () =>
        mutateManifest((m) => {
          m.assets[0]!.path = '../../outside.md';
        }),
      /mismatch|Invalid asset path/,
    ],
    [
      'zero inventory',
      () =>
        mutateManifest((m) => {
          m.assets = [];
        }),
      /assets/,
    ],
    [
      'missing directory',
      () => fs.rmSync(join(source, '.claude/agents'), { recursive: true }),
      /\.claude.*agents/,
    ],
    [
      'new unlisted source prompt',
      () =>
        write(
          source,
          '.claude/agents/new-agent.md',
          fs.readFileSync(join(source, '.claude/agents/worker.md'))
        ),
      /inventory.*new-agent/,
    ],
    [
      'missing structured delegation',
      () =>
        mutateManifest((m) => {
          m.assets.find((a) => a.id === 'agent:pr-reviewer')!.requires = [];
        }),
      /pr-reviewer.md.*references/,
    ],
    [
      'wrong local substitution',
      () =>
        mutateManifest((m) => {
          m.localSubstitutions['issue-reader'] = 'worker';
        }),
      /local substitutions/,
    ],
    [
      'missing command description',
      () => {
        const f = '.claude/commands/status.md';
        write(source, f, '---\nargument-hint: hi\n---\nBody\n');
        regenerate(source);
      },
      /status.md[\s\S]*description/,
    ],
    [
      'new explicit invocation',
      () => {
        const f = '.claude/commands/status.md';
        write(source, f, fs.readFileSync(join(source, f), 'utf8') + '\n`/unknown-command`\n');
        regenerate(source);
      },
      /unknown-command/,
    ],
  ];
  it.each(cases)('%s', async (_name, corrupt, message) => {
    corrupt();
    await expect(initialize()).rejects.toThrow(message);
    await expect(initialize()).rejects.toThrow(/bundle 1.0.0 \(package 0.1.0\)/);
    expect(fs.existsSync(project)).toBe(false);
  });
});
