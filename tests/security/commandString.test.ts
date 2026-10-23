import { describe, it, expect } from 'vitest';
import { formatGhCommand, quoteCommandArgument } from '../../src/security/commandString.js';
import { CommandSanitizer } from '../../src/security/CommandSanitizer.js';

describe('commandString', () => {
  const sanitizer = new CommandSanitizer();

  describe('quoteCommandArgument', () => {
    it('should leave arguments without whitespace, quotes, or backslashes unchanged', () => {
      expect(quoteCommandArgument('--json')).toBe('--json');
      expect(quoteCommandArgument('url,state')).toBe('url,state');
    });

    it('should escape double quotes inside double quotes', () => {
      expect(quoteCommandArgument('say "hi"')).toBe('"say \\"hi\\""');
    });

    it('should escape every backslash before the double quotes', () => {
      expect(quoteCommandArgument('C:\\temp\\new')).toBe('"C:\\\\temp\\\\new"');
      expect(quoteCommandArgument('a\\"b')).toBe('"a\\\\\\"b"');
      expect(quoteCommandArgument('ends with \\')).toBe('"ends with \\\\"');
    });
  });

  describe('formatGhCommand', () => {
    it('should prefix gh and join the quoted arguments', () => {
      expect(formatGhCommand(['pr', 'view', '42', '--body', 'two words'])).toBe(
        'gh pr view 42 --body "two words"'
      );
    });

    it.each([
      [['api', '-f', 'body=Use C:\\temp\\new'] as string[]],
      [['pr', 'comment', '1', '--body', 'regex \\d+ and \\\\ and \\"x\\"'] as string[]],
      [['pr', 'edit', '1', '--title', 'trailing backslash \\'] as string[]],
      [['pr', 'edit', '1', '--body', 'it\'s a\n"multi-line"\tbody\\n'] as string[]],
    ])('should round-trip %j through parseCommandString', (args) => {
      expect(sanitizer.parseCommandString(formatGhCommand(args))).toEqual({
        command: 'gh',
        args,
      });
    });

    it('should round-trip generated arguments with repeated quotes and backslashes', () => {
      const alphabet = ['a', ' ', '\t', '\n', '"', "'", '\\', '\\\\', '""', 'b'];
      let seed = 7;
      const next = (n: number): number => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % n;
      };
      for (let i = 0; i < 2000; i++) {
        const args: string[] = [];
        for (let a = 1 + next(4); a > 0; a--) {
          let arg = 'x';
          for (let c = next(12); c > 0; c--) arg += alphabet[next(alphabet.length)] ?? '';
          args.push(arg);
        }
        expect(sanitizer.parseCommandString(formatGhCommand(args))).toEqual({
          command: 'gh',
          args,
        });
      }
    });
  });
});
