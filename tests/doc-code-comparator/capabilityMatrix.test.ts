import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  countInstalledAssets,
  renderCapabilityMatrixBlock,
  replaceCapabilityMatrixBlock,
} from '../../src/doc-code-comparator/capabilityMatrix.js';

const block = renderCapabilityMatrixBlock({ agentPrompts: 3, projectCommands: 2 });

/** Cells of the table row with the given label. */
function row(label: string): string[] {
  const line = block.split('\n').find((entry) => entry.startsWith(`| ${label} |`));
  expect(line, label).toBeDefined();
  return (line ?? '')
    .split('|')
    .slice(2, -1)
    .map((cell) => cell.trim());
}

describe('renderCapabilityMatrixBlock', () => {
  it('derives where each mode ends and that no stage deploys', () => {
    expect(row('Run ends after')).toEqual(['`doc_indexing`', '`doc_indexing`', '`review`']);
    expect(row('Deployment stage')).toEqual(['none', 'none', 'none']);
    expect(row('Verification stage')).toEqual([
      '`validation-agent`',
      '`validation-agent`',
      '`validation-agent`',
    ]);
  });

  it('derives the pull request effects with and without GitHub', () => {
    expect(row('Pull request')[0]).toBe(
      '`review` (pr-reviewer: `push_branch`, `open_pull_request`, `merge`)'
    );
    expect(row('Pull request in local mode')[0]).toBe('`review` (local-reviewer: `merge`)');
    expect(row('Stages removed in local mode')).toEqual(['`github_repo_setup`', 'none', 'none']);
    expect(row('Stage slots')[0]).toBe('19 (local: 18)');
  });

  it('derives policy defaults and the CLI-accepted values', () => {
    expect(row('Approval mode')).toEqual([
      '`auto`, `manual`, `critical`, `custom` (programmatic API only)',
      '`auto`',
      '`--approval-mode`, `global.approval_mode`',
    ]);
    expect(row('Verification profile').slice(0, 2)).toEqual([
      '`advisory`, `delivery`',
      '`advisory`',
    ]);
    expect(row('Resume a saved session')[0]).toBe('`--resume`');
    expect(row('Installed assets')[0]).toBe('3 agent prompts, 2 project commands');
  });

  it('replaces only the generated block and requires its markers', () => {
    const document = replaceCapabilityMatrixBlock(
      `Intro\n\n${block.replace('3 agent prompts', '9 agent prompts')}\n\nOutro\n`,
      { agentPrompts: 3, projectCommands: 2 }
    );
    expect(document).toBe(`Intro\n\n${block}\n\nOutro\n`);
    expect(() =>
      replaceCapabilityMatrixBlock('no markers', { agentPrompts: 0, projectCommands: 0 })
    ).toThrow('no generated capability matrix markers');
  });
});

describe('countInstalledAssets', () => {
  it('counts Markdown agent prompts and project commands', () => {
    const root = mkdtempSync(join(tmpdir(), 'capability-assets-'));
    try {
      mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
      writeFileSync(join(root, '.claude', 'agents', 'worker.md'), '');
      writeFileSync(join(root, '.claude', 'agents', 'notes.txt'), '');
      expect(countInstalledAssets(root)).toEqual({ agentPrompts: 1, projectCommands: 0 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
