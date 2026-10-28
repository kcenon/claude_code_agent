/**
 * Documented `ad-sdlc` command lines checked against the CLI definitions.
 *
 * Only code is checked: fenced code blocks (shell comments removed, `\`
 * continuations joined) and inline code spans. A documented command line must
 * name a registered command and subcommand, use options that command accepts,
 * and give an enumerated option one of its values; `--stop-after` takes a
 * canonical stage name. Placeholders such as `<stage>`, `$MODE`, or `...` are
 * not checked. The definitions are `CLI_COMMANDS`, which
 * `tests/completion/registeredCommands.test.ts` keeps equal to the commands
 * `src/cli.ts` registers.
 *
 * @module doc-code-comparator/DocCliReferenceValidator
 */

import { CANONICAL_STAGE_NAMES } from '../ad-sdlc-orchestrator/plan.js';
import { CLI_COMMANDS, GLOBAL_OPTIONS } from '../completion/CompletionGenerator.js';
import type { CommandDefinition, OptionDefinition } from '../completion/types.js';

/** One documented command line that does not match the CLI. */
export interface CliReferenceFinding {
  /** 1-based line of the command in the document */
  readonly line: number;
  /** The documented command, from `ad-sdlc` on */
  readonly command: string;
  readonly message: string;
}

/** A line of code in a Markdown document. */
interface CodeLine {
  readonly line: number;
  readonly text: string;
}

/** A word that stands for a value the reader supplies. */
const PLACEHOLDER = /[<>${}[\]]|\.\.\./u;
/**
 * An `ad-sdlc` invocation inside a code line: `ad-sdlc` in command position,
 * at the start of the line or after a shell prompt, `npx`, a pipe or list
 * operator, an opening parenthesis, a YAML sequence dash (CI `script:` lists),
 * or a YAML `run:` key. `npm install ad-sdlc` names the package, not a
 * command, and does not match.
 */
const INVOCATION = /(?:^\s*(?:-\s+)?|[|&;(]\s*|\$\s+|\bnpx\s+|\brun:\s*)ad-sdlc(?=\s|$)/gu;
/** A command or subcommand name. */
const NAME = /^[a-z][a-z-]*$/u;
/** Characters that end a simple command in a shell line. */
const SEPARATORS = new Set(['|', '&', ';', ')']);

/**
 * Remove a shell comment: `#` at the start of the line or after whitespace.
 * @param text - Code line
 * @returns The line without its comment
 */
function withoutShellComment(text: string): string {
  return text.replace(/(^|\s)#.*$/u, '');
}

/**
 * Code lines of a Markdown document: every line of a fenced block (shell
 * comments removed, `\` continuations joined to the following line) and the
 * content of every inline code span.
 * @param markdown - Document text
 * @returns Code lines with the line number where each starts
 */
export function markdownCodeLines(markdown: string): CodeLine[] {
  const lines: CodeLine[] = [];
  let fenced = false;
  let pending: CodeLine | undefined;
  markdown.split(/\r?\n/u).forEach((raw, index) => {
    if (/^\s*(?:```|~~~)/u.test(raw)) {
      if (pending !== undefined) lines.push(pending);
      pending = undefined;
      fenced = !fenced;
      return;
    }
    if (fenced) {
      const text = withoutShellComment(raw);
      const joined: CodeLine =
        pending === undefined
          ? { line: index + 1, text }
          : { line: pending.line, text: `${pending.text} ${text}` };
      if (/\\\s*$/u.test(joined.text))
        pending = { line: joined.line, text: joined.text.replace(/\\\s*$/u, '') };
      else {
        pending = undefined;
        lines.push(joined);
      }
      return;
    }
    for (const match of raw.matchAll(/`([^`]+)`/gu))
      lines.push({ line: index + 1, text: match[1] ?? '' });
  });
  if (pending !== undefined) lines.push(pending);
  return lines;
}

/**
 * Split a shell command into words. Quotes group a word and are removed; the
 * command ends at a shell separator (`|`, `&`, `;`, `)`).
 * @param text - Command text after `ad-sdlc`
 * @returns Words in order
 */
export function shellWords(text: string): string[] {
  const words: string[] = [];
  let current = '';
  let started = false;
  let quote: string | undefined;
  for (const char of text) {
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/u.test(char)) {
      if (started) words.push(current);
      current = '';
      started = false;
      continue;
    }
    if (SEPARATORS.has(char)) break;
    current += char;
    started = true;
  }
  if (started) words.push(current);
  return words;
}

/**
 * Check the options of one command against its definition.
 * @param name - Command path used in messages (`run`, `assets update`)
 * @param options - Options the command accepts
 * @param words - Words after the command
 * @returns Problems found
 */
function checkOptions(
  name: string,
  options: readonly OptionDefinition[],
  words: readonly string[]
): string[] {
  const problems: string[] = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index] ?? '';
    if (!word.startsWith('-') || word === '-' || word === '--' || PLACEHOLDER.test(word)) continue;
    const separator = word.startsWith('--') ? word.indexOf('=') : -1;
    const flag = separator === -1 ? word : word.slice(0, separator);
    const option = options.find((candidate) => candidate.long === flag || candidate.short === flag);
    if (option === undefined) {
      problems.push(`'ad-sdlc ${name}' has no option ${flag}`);
      continue;
    }
    if (!option.takesValue) continue;
    let value: string | undefined;
    if (separator !== -1) value = word.slice(separator + 1);
    else {
      value = words[index + 1];
      index++;
    }
    if (value === undefined || PLACEHOLDER.test(value)) continue;
    const allowed = option.long === '--stop-after' ? CANONICAL_STAGE_NAMES : option.values;
    if (allowed !== undefined && !allowed.includes(value))
      problems.push(`${flag} ${value} is not one of: ${allowed.join(', ')}`);
  }
  return problems;
}

/**
 * Check one documented command against the CLI definitions.
 * @param words - Words after `ad-sdlc`
 * @param commands - Command definitions (defaults to the CLI's)
 * @returns Problems found; empty when the command matches the CLI
 */
export function checkCliCommand(
  words: readonly string[],
  commands: readonly CommandDefinition[] = CLI_COMMANDS
): string[] {
  const [first, ...rest] = words;
  if (first === undefined || PLACEHOLDER.test(first)) return [];
  if (first.startsWith('-')) return checkOptions('', GLOBAL_OPTIONS, words);
  if (!NAME.test(first)) return [];
  const command = commands.find((candidate) => candidate.name === first);
  if (command === undefined)
    return [
      `unknown command '${first}'; the CLI has ${commands.map((candidate) => candidate.name).join(', ')}`,
    ];
  const next = rest[0];
  const subcommand =
    command.subcommands !== undefined && next !== undefined && NAME.test(next)
      ? command.subcommands.find((candidate) => candidate.name === next)
      : undefined;
  if (command.subcommands !== undefined && next !== undefined && NAME.test(next) && !subcommand)
    return [
      `unknown subcommand '${first} ${next}'; '${first}' has ${command.subcommands.map((candidate) => candidate.name).join(', ')}`,
    ];
  return subcommand === undefined
    ? checkOptions(first, [...command.options, ...GLOBAL_OPTIONS], rest)
    : checkOptions(
        `${first} ${subcommand.name}`,
        [...subcommand.options, ...GLOBAL_OPTIONS],
        rest.slice(1)
      );
}

/**
 * Check every documented `ad-sdlc` command line of a Markdown document.
 * @param markdown - Document text
 * @param commands - Command definitions (defaults to the CLI's)
 * @returns Findings in document order
 */
export function validateCliReferences(
  markdown: string,
  commands: readonly CommandDefinition[] = CLI_COMMANDS
): CliReferenceFinding[] {
  const findings: CliReferenceFinding[] = [];
  for (const code of markdownCodeLines(markdown))
    for (const match of code.text.matchAll(INVOCATION)) {
      const start = match.index + match[0].length;
      const rest = code.text.slice(start);
      const words = shellWords(rest);
      for (const message of checkCliCommand(words, commands))
        findings.push({
          line: code.line,
          command: `ad-sdlc ${words.join(' ')}`.trim(),
          message,
        });
    }
  return findings;
}
