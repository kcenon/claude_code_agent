/**
 * Markup helpers for plain-text extraction (kcenon/claude_code_agent#973).
 */

import { describe, it, expect } from 'vitest';
import {
  decodeCharacterReferences,
  findHtmlComments,
  removeHtmlComments,
  removeScriptAndStyleElements,
} from '../../src/utils/markupText.js';
import { LONG_INPUT_LENGTH, LONG_INPUT_TIME_LIMIT_MS, timed } from '../helpers/longInput.js';

const COMMENT = /<!--[\s\S]*?-->/g;

describe('markupText', () => {
  describe('findHtmlComments', () => {
    it('should find the same comments as the lazy expression', () => {
      const text = 'a<!-- 1 -->b<!---->c<!-- unterminated';

      const found = findHtmlComments(text).map(([start, end]) => text.slice(start, end));

      expect(found).toEqual(text.match(COMMENT));
    });
  });

  describe('removeHtmlComments', () => {
    it.each([
      'plain text',
      'a<!-- one -->b',
      'a<!--\nmulti\nline\n-->b<!-- two -->c',
      'a<!---->b<!-->c',
      'a<!--->b-->c',
      '<!-- unterminated',
      '-->a<!--b',
    ])('should remove what one pass of the lazy expression removes from %j', (text) => {
      expect(removeHtmlComments(text)).toBe(text.replace(COMMENT, ''));
    });

    it.each([
      ['<!<!-- -->-- x -->y', 'y'],
      ['<!-<!-- -->- x -->y', 'y'],
      ['<<!-- -->!-- x -->y', 'y'],
      ['<!<!<!-- -->-- -->-- x -->y', 'y'],
    ])('should also remove a comment joined by removing another in %j', (text, expected) => {
      expect(removeHtmlComments(text)).toBe(expected);
      expect(removeHtmlComments(text)).not.toMatch(COMMENT);
    });

    it('should keep characters outside the Basic Multilingual Plane and lone surrogates', () => {
      const text = `\u{1F600} \uD800 <!-- x --> \uDC00 end`;

      expect(removeHtmlComments(text)).toBe(`\u{1F600} \uD800  \uDC00 end`);
    });

    it('should scan many unterminated comments quickly', () => {
      const text = '<!--'.repeat(LONG_INPUT_LENGTH);

      const { result, elapsedMs } = timed(() => removeHtmlComments(text));

      expect(result).toBe(text);
      expect(elapsedMs).toBeLessThan(LONG_INPUT_TIME_LIMIT_MS);
    });

    it('should remove many nested joined comments quickly', () => {
      const text = '<!'.repeat(LONG_INPUT_LENGTH) + '<!---->' + '-- -->'.repeat(LONG_INPUT_LENGTH);

      const { result, elapsedMs } = timed(() => removeHtmlComments(text));

      expect(result).toBe('');
      expect(elapsedMs).toBeLessThan(LONG_INPUT_TIME_LIMIT_MS);
    });
  });

  describe('removeScriptAndStyleElements', () => {
    it.each([
      ['a<script>x()</script>b', 'ab'],
      ['a<SCRIPT type="module">x()</Script>b<style>p {}</STYLE>c', 'abc'],
      ['a<script>if (x < 1) {}</script>b', 'ab'],
      ['a<script>x</script>b<script>y</script>c', 'abc'],
      ['a<script>x<style>y</style>z</script>b', 'ab'],
      ['a<script>never closed', 'a<script>never closed'],
      ['a<scripts>x</scripts>b', 'a<scripts>x</scripts>b'],
      ['a<script</script>b', 'ab'],
    ])('should remove the elements of %j', (html, expected) => {
      expect(removeScriptAndStyleElements(html)).toBe(expected);
    });

    it.each([
      ['a<script>x</script >b', 'ab'],
      ['a<script>x</SCRIPT foo="bar">b', 'ab'],
      ['a<script>x</script\t\n bar>b', 'ab'],
      ['a<style>x</style >b', 'ab'],
    ])('should accept the end tag of %j', (html, expected) => {
      expect(removeScriptAndStyleElements(html)).toBe(expected);
    });

    it.each([
      ['<scr<script></script>ipt>alert(1)</script>after', 'after'],
      ['<sty<style></style>le>p{}</style>after', 'after'],
      ['<scr<style></style>ipt>alert(1)</script>after', 'after'],
    ])('should also remove an element joined by removing another in %j', (html, expected) => {
      expect(removeScriptAndStyleElements(html)).toBe(expected);
    });

    it('should not end a style at a script end tag', () => {
      expect(
        removeScriptAndStyleElements('<style>/* <script */</style>keep<script>x</script>')
      ).toBe('keep');
    });

    it('should scan many unterminated script start tags quickly', () => {
      const html = '<script'.repeat(LONG_INPUT_LENGTH);

      const { result, elapsedMs } = timed(() => removeScriptAndStyleElements(html));

      expect(result).toBe(html);
      expect(elapsedMs).toBeLessThan(LONG_INPUT_TIME_LIMIT_MS);
    });

    it('should scan many end tags without a closing bracket quickly', () => {
      const html = '<script>' + '</script'.repeat(LONG_INPUT_LENGTH);

      const { result, elapsedMs } = timed(() => removeScriptAndStyleElements(html));

      expect(result).toBe(html);
      expect(elapsedMs).toBeLessThan(LONG_INPUT_TIME_LIMIT_MS);
    });
  });

  describe('decodeCharacterReferences', () => {
    const references = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'" };

    it('should decode each reference once', () => {
      expect(decodeCharacterReferences('&amp;lt;b&amp;gt; &amp;amp; &lt;i&gt;', references)).toBe(
        '&lt;b&gt; &amp; <i>'
      );
    });

    it('should keep references that are not in the table', () => {
      expect(decodeCharacterReferences('&copy; &AMP; &#60; &#39; & ;', references)).toBe(
        "&copy; &AMP; &#60; ' & ;"
      );
    });

    it('should scan a long run of letters after an ampersand quickly', () => {
      const text = '&' + 'a'.repeat(LONG_INPUT_LENGTH);

      const { result, elapsedMs } = timed(() => decodeCharacterReferences(text, references));

      expect(result).toBe(text);
      expect(elapsedMs).toBeLessThan(LONG_INPUT_TIME_LIMIT_MS);
    });
  });
});
