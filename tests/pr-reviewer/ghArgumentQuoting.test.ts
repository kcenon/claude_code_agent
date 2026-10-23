/**
 * gh argument arrays are joined into a command string that
 * CommandSanitizer.parseCommandString splits again before execFile runs gh.
 * Every caller has to quote the arguments so that they come back unchanged
 * (kcenon/claude_code_agent#973).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCommandSanitizer } from '../../src/security/index.js';
import { MockCommandExecutor } from '../../src/utilities/CommandExecutor.js';
import { CIFixAgent } from '../../src/ci-fixer/CIFixAgent.js';
import { PRReviewerAgent } from '../../src/pr-reviewer/PRReviewerAgent.js';
import { PRCreator } from '../../src/pr-reviewer/PRCreator.js';
import { MergeDecision } from '../../src/pr-reviewer/MergeDecision.js';
import { GitHubReviewClient } from '../../src/pr-reviewer/GitHubReviewClient.js';

type CommandCaller = { executeCommand(command: string | string[]): Promise<unknown> };
type CommandFor = (args: string[]) => Promise<string>;

/**
 * Command string a caller hands to an injected ICommandExecutor.
 * @param create - Builds the caller around the executor
 * @returns Function that runs an argument array and returns the command string
 */
function viaExecutor(create: (executor: MockCommandExecutor) => object): CommandFor {
  return async (args) => {
    const executor = new MockCommandExecutor();
    await (create(executor) as CommandCaller).executeCommand(args);
    return executor.getExecutedCommands()[0]?.command ?? '';
  };
}

/**
 * Command string a caller hands to CommandSanitizer.execFromString.
 * @param create - Builds the caller
 * @returns Function that runs an argument array and returns the command string
 */
function viaSanitizer(create: () => object): CommandFor {
  return async (args) => {
    const execFromString = vi
      .spyOn(getCommandSanitizer(), 'execFromString')
      .mockResolvedValue({ success: true, stdout: '', stderr: '', command: 'gh' });
    await (create() as CommandCaller).executeCommand(args);
    return String(execFromString.mock.calls[0]?.[0] ?? '');
  };
}

const CALLERS: ReadonlyArray<readonly [string, CommandFor]> = [
  ['CIFixAgent', viaExecutor((executor) => new CIFixAgent({ projectRoot: '/p' }, executor))],
  [
    'PRReviewerAgent',
    viaExecutor((executor) => new PRReviewerAgent({ projectRoot: '/p' }, executor)),
  ],
  ['PRCreator', viaSanitizer(() => new PRCreator({ projectRoot: '/p' }))],
  ['MergeDecision', viaSanitizer(() => new MergeDecision({ projectRoot: '/p' }))],
  ['GitHubReviewClient', viaSanitizer(() => new GitHubReviewClient({ projectRoot: '/p' }))],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(CALLERS)('%s gh argument quoting', (_caller, commandFor) => {
  it('should quote arguments with spaces and double quotes', async () => {
    const args = ['pr', 'comment', '42', '--body', 'Say "hi" to the owner\'s team', '-R', 'o/r'];

    const command = await commandFor(args);

    expect(command).toBe('gh pr comment 42 --body "Say \\"hi\\" to the owner\'s team" -R o/r');
    expect(getCommandSanitizer().parseCommandString(command)).toEqual({ command: 'gh', args });
  });

  it('should keep a multi-line body in one argument', async () => {
    const args = ['pr', 'create', '--body', '## Summary\n\n- "first"\n- second'];

    const command = await commandFor(args);

    expect(getCommandSanitizer().parseCommandString(command)).toEqual({ command: 'gh', args });
  });

  it('should leave plain arguments unquoted', async () => {
    expect(await commandFor(['pr', 'view', '42', '--json', 'url,state'])).toBe(
      'gh pr view 42 --json url,state'
    );
  });
});
