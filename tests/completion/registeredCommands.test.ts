/**
 * Keeps shell completion in step with the CLI: every command, subcommand, and
 * option that src/cli.ts registers with commander must be in CLI_COMMANDS and
 * in the bash, zsh, and fish scripts, and CLI_COMMANDS must list nothing else.
 *
 * The test imports src/cli.ts with commander's parse() stubbed, so it reads
 * the program that the CLI really builds without parsing the test's argv and
 * without a subprocess or help-text parsing.
 */

import { Command, type Option } from 'commander';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CompletionGenerator } from '../../src/completion/CompletionGenerator.js';
import type { CommandDefinition } from '../../src/completion/types.js';

type ProcessEvent = 'uncaughtException' | 'unhandledRejection';
type Listener = (...args: unknown[]) => void;

/**
 * Import src/cli.ts and capture the program it registers instead of parsing argv.
 * @returns The root commander program
 */
async function loadRegisteredProgram(): Promise<Command> {
  let registered: Command | undefined;
  const parse = vi.spyOn(Command.prototype, 'parse').mockImplementation(function (this: Command) {
    registered = this;
    return this;
  });
  const events: ProcessEvent[] = ['uncaughtException', 'unhandledRejection'];
  const listeners = (event: ProcessEvent): Listener[] =>
    process.listeners(event) as unknown as Listener[];
  const before = new Map(events.map((event) => [event, listeners(event)]));
  try {
    await import('../../src/cli.js');
  } finally {
    parse.mockRestore();
    // The CLI installs process-wide handlers that exit; keep them out of the test worker.
    for (const event of events) {
      for (const listener of listeners(event)) {
        if (before.get(event)?.includes(listener) !== true) process.removeListener(event, listener);
      }
    }
  }
  if (registered === undefined) throw new Error('src/cli.ts did not parse a commander program');
  return registered;
}

interface Flag {
  readonly long: string;
  readonly short: string | undefined;
  readonly takesValue: boolean;
}

interface RegisteredCommand {
  readonly path: readonly string[];
  readonly flags: readonly Flag[];
  readonly subcommands: readonly string[];
}

function commanderFlag(option: Option): Flag {
  return {
    long: option.long ?? option.flags,
    short: option.short,
    takesValue: option.required || option.optional,
  };
}

function registeredCommands(command: Command, prefix: readonly string[] = []): RegisteredCommand[] {
  return command.commands.flatMap((sub) => {
    const path = [...prefix, sub.name()];
    return [
      {
        path,
        flags: sub.options.map(commanderFlag),
        subcommands: sub.commands.map((child) => child.name()),
      },
      ...registeredCommands(sub, path),
    ];
  });
}

function completionCommands(
  commands: readonly CommandDefinition[],
  prefix: readonly string[] = []
): RegisteredCommand[] {
  return commands.flatMap((cmd) => {
    const path = [...prefix, cmd.name];
    return [
      {
        path,
        flags: cmd.options.map((opt) => ({
          long: opt.long,
          short: opt.short,
          takesValue: opt.takesValue,
        })),
        subcommands: (cmd.subcommands ?? []).map((sub) => sub.name),
      },
      ...completionCommands(cmd.subcommands ?? [], path),
    ];
  });
}

/** Order-independent form of a command list for toEqual. */
function normalized(commands: readonly RegisteredCommand[]): unknown[] {
  return commands
    .map((cmd) => ({
      path: cmd.path.join(' '),
      flags: cmd.flags
        .map((flag) => `${flag.long} ${flag.short ?? '-'} ${flag.takesValue ? 'value' : 'flag'}`)
        .sort(),
      subcommands: [...cmd.subcommands].sort(),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

const sorted = (words: readonly string[]): string[] => [...words].sort();
const flagWords = (flags: readonly Flag[]): string[] =>
  flags.flatMap((flag) => (flag.short === undefined ? [flag.long] : [flag.short, flag.long]));

describe('completion covers the commands registered in src/cli.ts', () => {
  let program: Command;
  let registered: RegisteredCommand[];
  /** Commander's implicit help option plus the root program's options (--version). */
  let globalFlags: Flag[];
  const generator = new CompletionGenerator();

  beforeAll(async () => {
    program = await loadRegisteredProgram();
    registered = registeredCommands(program);
    globalFlags = [
      { long: '--help', short: '-h', takesValue: false },
      ...program.options.map(commanderFlag),
    ];
  }, 60_000);

  it('reads a program with commands, subcommands, and options', () => {
    expect(program.name()).toBe('ad-sdlc');
    expect(registered.map((cmd) => cmd.path.join(' '))).toEqual(
      expect.arrayContaining(['init', 'run', 'doctor', 'telemetry enable', 'assets update'])
    );
    expect(globalFlags.map((flag) => flag.long)).toEqual(['--help', '--version']);
  });

  it('lists exactly the registered commands, subcommands, and options in CLI_COMMANDS', () => {
    expect(normalized(completionCommands(generator.getCommands()))).toEqual(normalized(registered));
  });

  it('offers every registered command and option in the bash script', () => {
    const script = generator.generate('bash').script;
    const topLevel = /local commands="([^"]*)"/.exec(script)?.[1]?.split(' ') ?? [];
    expect(sorted(topLevel)).toEqual(sorted(program.commands.map((cmd) => cmd.name())));

    // Every word list the script offers through compgen -W, as sorted arrays.
    const offered = [...script.matchAll(/compgen -W "([^"$]*)"/g)].map((match) =>
      sorted((match[1] ?? '').split(' '))
    );
    for (const cmd of registered) {
      const expected = [...cmd.subcommands, ...flagWords([...cmd.flags, ...globalFlags])];
      expect(offered, cmd.path.join(' ')).toContainEqual(sorted(expected));
    }
  });

  it('offers every registered command and option in the zsh script', () => {
    const lines = generator.generate('zsh').script.split('\n');
    const describedLists = (arrayName: string): string[][] => {
      const lists: string[][] = [];
      lines.forEach((line, index) => {
        if (line.trim() !== `${arrayName}=(`) return;
        const names: string[] = [];
        for (const entry of lines.slice(index + 1)) {
          if (entry.trim() === ')') break;
          names.push(/^\s*'([^:]+):/.exec(entry)?.[1] ?? entry);
        }
        lists.push(sorted(names));
      });
      return lists;
    };
    // Long flags of each _arguments -s block, which completes the options of one command.
    const optionBlocks: string[][] = [];
    lines.forEach((line, index) => {
      if (!line.trimEnd().endsWith('_arguments -s \\')) return;
      const specs: string[] = [];
      for (const spec of lines.slice(index + 1)) {
        const flag = /^\s+'(--[a-z-]+)\[/.exec(spec)?.[1];
        if (flag === undefined) break;
        specs.push(flag);
      }
      optionBlocks.push(sorted(specs));
    });

    expect(describedLists('commands')).toEqual([sorted(program.commands.map((c) => c.name()))]);
    const parents = registered.filter((cmd) => cmd.subcommands.length > 0);
    const leaves = registered.filter((cmd) => cmd.subcommands.length === 0);
    expect(describedLists('subcommands')).toHaveLength(parents.length);
    for (const parent of parents) {
      expect(describedLists('subcommands'), parent.path.join(' ')).toContainEqual(
        sorted(parent.subcommands)
      );
    }
    expect(optionBlocks).toHaveLength(leaves.length);
    for (const leaf of leaves) {
      const expected = [...leaf.flags, ...globalFlags].map((flag) => flag.long);
      expect(optionBlocks, leaf.path.join(' ')).toContainEqual(sorted(expected));
    }
  });

  it('offers every registered command and option in the fish script', () => {
    const lines = generator.generate('fish').script.split('\n');
    const parsed = lines
      .filter((line) => line.startsWith('complete -c ad-sdlc -n '))
      .map((line) => ({
        conditions: (/-n "([^"]*)"/.exec(line)?.[1] ?? '').split('; and '),
        argument: /-a "([^"]*)"/.exec(line)?.[1],
        long: /-l "([^"]*)"/.exec(line)?.[1],
      }));

    const topLevel = parsed
      .filter((entry) => entry.conditions.includes('__fish_use_subcommand'))
      .map((entry) => entry.argument ?? '');
    expect(sorted(topLevel)).toEqual(sorted(program.commands.map((cmd) => cmd.name())));

    const inside = (path: readonly string[]): ((conditions: string[]) => boolean) => {
      return (conditions) =>
        path.every((name) => conditions.includes(`__fish_seen_subcommand_from ${name}`));
    };
    for (const cmd of registered) {
      const within = inside(cmd.path);
      for (const sub of cmd.subcommands) {
        expect(
          parsed.some((entry) => entry.argument === sub && within(entry.conditions)),
          `${cmd.path.join(' ')} ${sub}`
        ).toBe(true);
      }
      for (const flag of [...cmd.flags, ...globalFlags]) {
        const long = flag.long.replace(/^--/, '');
        expect(
          parsed.some((entry) => entry.long === long && within(entry.conditions)),
          `${cmd.path.join(' ')} ${flag.long}`
        ).toBe(true);
      }
    }
  });
});
