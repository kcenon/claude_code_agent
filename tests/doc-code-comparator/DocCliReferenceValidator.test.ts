import { describe, expect, it } from 'vitest';
import {
  checkCliCommand,
  markdownCodeLines,
  shellWords,
  validateCliReferences,
} from '../../src/doc-code-comparator/DocCliReferenceValidator.js';

/** Wrap shell lines in a fenced block. */
function fenced(...lines: string[]): string {
  return ['```bash', ...lines, '```'].join('\n');
}

describe('markdownCodeLines', () => {
  it('returns fenced lines without shell comments and joins continuations', () => {
    const markdown = [
      'Prose with `ad-sdlc status` inline.',
      '```bash',
      '# a comment',
      'ad-sdlc run "x" \\',
      '  --mode import # trailing comment',
      '```',
    ].join('\n');

    expect(markdownCodeLines(markdown)).toEqual([
      { line: 1, text: 'ad-sdlc status' },
      { line: 3, text: '' },
      { line: 4, text: 'ad-sdlc run "x"    --mode import' },
    ]);
  });
});

describe('shellWords', () => {
  it('groups quoted words and stops at a shell separator', () => {
    expect(shellWords(' run "two words" --mode=import && echo done')).toEqual([
      'run',
      'two words',
      '--mode=import',
    ]);
  });
});

describe('checkCliCommand', () => {
  it('accepts registered commands, subcommands, options, and values', () => {
    expect(checkCliCommand(['run', 'x', '--mode', 'import', '--stop-after', 'review'])).toEqual([]);
    expect(checkCliCommand(['assets', 'update', '--project-dir', '.', '--dry-run'])).toEqual([]);
    expect(checkCliCommand(['telemetry', 'enable', '--yes'])).toEqual([]);
    expect(checkCliCommand(['--version'])).toEqual([]);
  });

  it('skips placeholders', () => {
    expect(checkCliCommand(['run', '<requirements>', '--resume', '<session-id>'])).toEqual([]);
    expect(checkCliCommand(['run', 'x', '--mode', '$MODE', '--stop-after', '<stage>'])).toEqual([]);
    expect(checkCliCommand(['<command>'])).toEqual([]);
  });

  it('reports an unknown command, subcommand, or option', () => {
    expect(checkCliCommand(['resume'])).toEqual([
      expect.stringContaining("unknown command 'resume'"),
    ]);
    expect(checkCliCommand(['telemetry', 'purge'])).toEqual([
      expect.stringContaining("unknown subcommand 'telemetry purge'"),
    ]);
    expect(checkCliCommand(['run', 'x', '--skip-stages', 'prd'])).toEqual([
      "'ad-sdlc run' has no option --skip-stages",
    ]);
  });

  it('reports an invalid mode, stage, or enumerated value', () => {
    expect(checkCliCommand(['run', 'x', '--mode', 'brownfield'])).toEqual([
      '--mode brownfield is not one of: greenfield, enhancement, import',
    ]);
    expect(checkCliCommand(['run', 'x', '--stop-after', 'deployment'])).toEqual([
      expect.stringMatching(/^--stop-after deployment is not one of: initialization, /u),
    ]);
    expect(checkCliCommand(['run', 'x', '--approval-mode=never'])).toEqual([
      '--approval-mode never is not one of: auto, manual, critical',
    ]);
  });
});

describe('validateCliReferences', () => {
  it('reports each invalid command line with its document line', () => {
    const markdown = [
      '# Guide',
      '',
      fenced('ad-sdlc status', 'ad-sdlc resume'),
      '',
      'Then run `ad-sdlc run "x" --mode brownfield`.',
    ].join('\n');

    expect(validateCliReferences(markdown)).toEqual([
      expect.objectContaining({ line: 5, command: 'ad-sdlc resume' }),
      expect.objectContaining({ line: 8, command: 'ad-sdlc run x --mode brownfield' }),
    ]);
  });

  it('finds invocations after prompts, operators, npx, YAML run keys, and YAML list dashes', () => {
    const markdown = [
      fenced('$ ad-sdlc resume', 'cd app && ad-sdlc reset', 'npx ad-sdlc pause'),
      '```yaml',
      'run: ad-sdlc implement',
      'script:',
      '  - ad-sdlc diagnose',
      '```',
    ].join('\n');

    expect(validateCliReferences(markdown).map((finding) => finding.command)).toEqual([
      'ad-sdlc resume',
      'ad-sdlc reset',
      'ad-sdlc pause',
      'ad-sdlc implement',
      'ad-sdlc diagnose',
    ]);
  });

  it('ignores the package name and prose outside code', () => {
    const markdown = [
      'The ad-sdlc resume command does not exist, and prose is not checked.',
      fenced('npm install ad-sdlc --save-dev', 'ls ad-sdlc-output'),
    ].join('\n');

    expect(validateCliReferences(markdown)).toEqual([]);
  });
});
