/**
 * Markup helpers for plain-text extraction
 *
 * These helpers turn HTML or XML into text for content checks and information
 * extraction; they are not HTML sanitizers. Each one scans its input once, so
 * the cost stays linear in the input length, where the lazy regular
 * expressions they replace rescanned the rest of the text from every
 * unterminated start.
 *
 * The removal helpers build their result while they scan. When the text on
 * both sides of a removed region joins into a new comment or element
 * (`<!<!-- -->-- x -->`, `<scr<script></script>ipt>`), the joined region is
 * removed as well, so the result contains no complete comment or element that
 * a second pass would remove. For such joined input the result can differ
 * from applying the old expression repeatedly, because a joined start may
 * pair with a different end.
 */

const GREATER_THAN = 0x3e;
const HYPHEN = 0x2d;

/**
 * Elements whose content is not text, removed before tags are stripped
 */
const RAW_TEXT_ELEMENTS = ['script', 'style'] as const;

/**
 * Result of one scan: characters are appended, and a removed region is
 * dropped by truncating back to its start.
 */
class TextBuffer {
  private readonly codes: Uint16Array;
  private size = 0;

  /**
   * @param capacity - Upper bound of the result length (the input length)
   */
  constructor(capacity: number) {
    this.codes = new Uint16Array(capacity);
  }

  /**
   * Number of UTF-16 code units in the result
   * @returns Current result length
   */
  get length(): number {
    return this.size;
  }

  /**
   * Append one UTF-16 code unit
   * @param code - Code unit to append
   */
  push(code: number): void {
    this.codes[this.size++] = code;
  }

  /**
   * Drop everything from `length` on
   * @param length - New result length
   */
  truncate(length: number): void {
    this.size = length;
  }

  /**
   * Check whether the result before `end` ends with `suffix`
   * @param suffix - Lower-case ASCII text to compare with
   * @param end - Index after the last compared code unit
   * @param ignoreCase - Compare ASCII letters case-insensitively
   * @returns True when the code units before `end` equal `suffix`
   */
  endsWith(suffix: string, end: number, ignoreCase: boolean): boolean {
    const start = end - suffix.length;
    if (start < 0) {
      return false;
    }
    for (let offset = 0; offset < suffix.length; offset++) {
      let code = this.codes[start + offset] ?? 0;
      if (ignoreCase && code >= 0x41 && code <= 0x5a) {
        code += 0x20;
      }
      if (code !== suffix.charCodeAt(offset)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Convert the result to a string without changing any code unit
   * @returns The result text
   */
  toString(): string {
    let text = '';
    for (let start = 0; start < this.size; start += 0x2000) {
      text += String.fromCharCode(
        ...this.codes.subarray(start, Math.min(start + 0x2000, this.size))
      );
    }
    return text;
  }
}

/**
 * Check for a character of `\w` (ASCII letters, digits, and `_`)
 * @param code - UTF-16 code unit
 * @returns True when a regular expression `\b` cannot fall before this character
 */
function isWordCharacter(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    code === 0x5f
  );
}

/**
 * Find HTML comments (`<!-- ... -->`).
 *
 * Same matches as `content.match(/<!--[\s\S]*?-->/g)` in linear time. The lazy
 * expression rescanned the rest of the text from every `<!--` when no `-->`
 * followed.
 * @param content - Text to scan
 * @returns Start (inclusive) and end (exclusive) index of each comment
 */
export function findHtmlComments(content: string): Array<readonly [number, number]> {
  const comments: Array<readonly [number, number]> = [];
  let start = content.indexOf('<!--');
  while (start !== -1) {
    const close = content.indexOf('-->', start + 4);
    if (close === -1) {
      break;
    }
    comments.push([start, close + 3]);
    start = content.indexOf('<!--', close + 3);
  }
  return comments;
}

/**
 * Remove HTML comments (`<!-- ... -->`) until none is left.
 *
 * Same result as `content.replace(/<!--[\s\S]*?-->/g, '')`, except that a
 * comment formed by the text around a removed one is removed too. An
 * unterminated `<!--` stays.
 * @param content - Text to clean
 * @returns Text without HTML comments
 */
export function removeHtmlComments(content: string): string {
  const output = new TextBuffer(content.length);
  // Start of the earliest `<!--` in the result that is not closed yet
  let open = -1;
  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index);
    output.push(code);
    if (open < 0) {
      if (code === HYPHEN && output.endsWith('<!--', output.length, false)) {
        open = output.length - 4;
      }
    } else if (
      code === GREATER_THAN &&
      output.length - 3 >= open + 4 &&
      output.endsWith('-->', output.length, false)
    ) {
      output.truncate(open);
      open = -1;
    }
  }
  return output.toString();
}

/**
 * Remove `<script>` and `<style>` elements, start tag to end tag, until none
 * is left.
 *
 * Same result as removing the matches of
 * `/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi` and then of the same
 * expression for `style`, except that:
 * - an end tag may have spaces or attributes before its `>` (`</script >`,
 *   `</script foo="bar">`), as HTML parsers accept;
 * - an element formed by the text around a removed one is removed too;
 * - when a script and a style element overlap without nesting
 *   (`<style><script></style></script>`), the one that starts first is
 *   removed up to its end tag, instead of the script first.
 * Tag names are matched case-insensitively. A start tag without a later end
 * tag stays.
 * @param html - HTML to clean
 * @returns HTML without script and style elements
 */
export function removeScriptAndStyleElements(html: string): string {
  const output = new TextBuffer(html.length);
  // For each element name: start of its earliest unclosed start tag in the
  // result, and whether that element's end tag has begun
  const elements = RAW_TEXT_ELEMENTS.map((name) => ({ name, start: -1, inEndTag: false }));
  for (let index = 0; index < html.length; index++) {
    const code = html.charCodeAt(index);
    output.push(code);
    if (!isWordCharacter(code)) {
      // A tag name ends before this character (`\b`)
      const nameEnd = output.length - 1;
      for (const element of elements) {
        const name = element.name;
        if (element.start < 0) {
          if (output.endsWith(`<${name}`, nameEnd, true)) {
            element.start = nameEnd - name.length - 1;
          }
        } else if (
          !element.inEndTag &&
          nameEnd - name.length - 2 >= element.start + name.length + 1 &&
          output.endsWith(`</${name}`, nameEnd, true)
        ) {
          element.inEndTag = true;
        }
      }
    }
    if (code === GREATER_THAN) {
      // `>` ends the end tag; the earliest element with an end tag is removed
      let removed: (typeof elements)[number] | undefined;
      for (const element of elements) {
        if (element.inEndTag && (removed === undefined || element.start < removed.start)) {
          removed = element;
        }
      }
      if (removed !== undefined) {
        const start = removed.start;
        output.truncate(start);
        for (const element of elements) {
          if (element.start >= start) {
            element.start = -1;
            element.inEndTag = false;
          }
        }
      }
    }
  }
  return output.toString();
}

/**
 * Decode character references in one pass.
 *
 * Text produced by decoding is not decoded again: `&amp;lt;` becomes the text
 * `&lt;`. Decoding `&amp;` before `&lt;` in chained replacements turned it
 * into `<`. References that are not in the table stay as they are.
 * @param text - Text with character references
 * @param references - Decoded text of each reference, such as `{ '&amp;': '&' }`
 * @returns Decoded text
 */
export function decodeCharacterReferences(
  text: string,
  references: Readonly<Record<string, string>>
): string {
  return text.replace(/&(?:#39|[a-z]+);/g, (reference) => references[reference] ?? reference);
}
