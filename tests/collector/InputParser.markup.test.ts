/**
 * Text extraction from fetched HTML and XML (kcenon/claude_code_agent#973).
 */

import { describe, it, expect } from 'vitest';
import { InputParser } from '../../src/collector/index.js';

type MarkupStripper = {
  stripHtml(html: string): string;
  stripXml(xml: string): string;
};

const parser = new InputParser() as unknown as MarkupStripper;

describe('InputParser markup text', () => {
  describe('stripHtml', () => {
    it('should extract the text of a page without scripts and styles', () => {
      const html = [
        '<!DOCTYPE html>',
        '<html><head><title>Docs</title>',
        '<style type="text/css">body { color: red; }</style>',
        '<script type="text/javascript">if (a < b && c > d) { render("<b>x</b>"); }</script>',
        '</head><body><h1>Hello</h1>',
        '<p>Tom &amp; Jerry &lt;3 &quot;quotes&quot; and &#39;apostrophes&#39;&nbsp;here</p>',
        '<!-- footer note --></body></html>',
      ].join('\n');

      expect(parser.stripHtml(html)).toBe(
        'Docs Hello Tom & Jerry <3 "quotes" and \'apostrophes\' here'
      );
    });

    it.each([
      ['upper-case tags', 'a<SCRIPT>x()</SCRIPT>b<Style>p{}</Style>c', 'abc'],
      ['several elements', 'a<script>1</script>b<script>2</script>c', 'abc'],
      ['a start tag without an end tag', 'a<script>never closed', 'a never closed'],
      ['a longer tag name', 'a<scripts>x</scripts>b', 'a x b'],
      ['a style nested in a script', 'a<script>x<style>y</style>z</script>b', 'ab'],
      ['a script nested in a style', 'a<style>x<script>y</script>z</style>b', 'ab'],
      ['text with angle brackets', 'if a < b and c > d', 'if a d'],
      ['a lone angle bracket', 'if a < b', 'if a < b'],
      ['a comment', 'x<!-- note -->y', 'x y'],
      ['an encoded ampersand entity', '&amp;amp; and &amp;nbsp;', '&amp; and &nbsp;'],
      ['unknown entities', '&copy; &AMP; &#60;', '&copy; &AMP; &#60;'],
    ])('should handle %s', (_label, html, expected) => {
      expect(parser.stripHtml(html)).toBe(expected);
    });

    it.each([
      ['</script >', 'a<script>secret()</script >b', 'ab'],
      ['</SCRIPT foo="bar">', 'a<script>secret()</SCRIPT foo="bar">b', 'ab'],
      ['</script\\t\\n bar>', 'a<script>secret()</script\t\n bar>b', 'ab'],
      ['</style >', 'a<style>p { color: red }</style >b', 'ab'],
    ])('should remove a script or style element ending in %s', (_label, html, expected) => {
      expect(parser.stripHtml(html)).toBe(expected);
    });

    it('should remove a script element joined by removing another', () => {
      expect(parser.stripHtml('<scr<script></script>ipt>alert(1)</script>after')).toBe('after');
    });

    it('should decode an encoded entity only once', () => {
      expect(parser.stripHtml('&amp;lt;b&amp;gt; and &amp;quot;q&amp;quot; &amp;#39;')).toBe(
        '&lt;b&gt; and &quot;q&quot; &#39;'
      );
    });
  });

  describe('stripXml', () => {
    it('should extract the text, CDATA content, and decoded entities of a document', () => {
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<root>',
        '  <item id="1">A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;</item>',
        '  <!-- a comment -->',
        '  <raw><![CDATA[<keep> this]]></raw>',
        '</root>',
      ].join('\n');

      expect(parser.stripXml(xml)).toBe('A & B <c> "d" \'e\' <keep> this');
    });

    it.each([
      ['a multi-line comment', '<a>x<!--\n<b>hidden</b>\n-->y</a>', 'xy'],
      ['two comments', '<a>x<!-- 1 -->y<!-- 2 -->z</a>', 'xyz'],
      ['an unterminated comment', '<a>x<!-- open</a>', 'x'],
      ['an encoded ampersand entity', '<a>&amp;amp;</a>', '&amp;'],
    ])('should handle %s', (_label, xml, expected) => {
      expect(parser.stripXml(xml)).toBe(expected);
    });

    it('should remove a comment joined by removing another', () => {
      expect(parser.stripXml('<r>x<!<!-- -->-- a > b -->y</r>')).toBe('xy');
    });

    it('should decode an encoded entity only once', () => {
      expect(parser.stripXml('<r>&amp;lt;x&amp;gt; &amp;apos;</r>')).toBe('&lt;x&gt; &apos;');
    });
  });
});
