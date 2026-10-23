/**
 * Command strings for argument arrays
 *
 * Several agents hand gh argument arrays to string-based executors
 * (CommandSanitizer.execFromString, ICommandExecutor.execute), which split the
 * string again with CommandSanitizer.parseCommandString before execFile runs
 * the command without a shell. The quoting here is the inverse of that parser:
 * inside double quotes it reads `\x` as `x`, so backslashes are escaped before
 * double quotes.
 */

/**
 * Characters that make an argument need quotes for parseCommandString
 */
const NEEDS_QUOTES = /[\s"'\\]/;

/**
 * Quote one argument so that parseCommandString returns it unchanged
 * @param arg - Argument to pass through
 * @returns The argument itself, or the argument double-quoted with its
 *   backslashes and double quotes escaped when it contains whitespace, quotes,
 *   or backslashes
 */
export function quoteCommandArgument(arg: string): string {
  return NEEDS_QUOTES.test(arg) ? `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : arg;
}

/**
 * Join gh arguments into a command string that parseCommandString splits into
 * the same arguments
 * @param args - gh arguments without the leading `gh`
 * @returns Command string starting with `gh `
 */
export function formatGhCommand(args: readonly string[]): string {
  return 'gh ' + args.map(quoteCommandArgument).join(' ');
}
