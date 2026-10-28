// Independent acceptance test of the `slugify` issue. The live lane copies it
// into `acceptance/` of the pull request checkout after the run; AD-SDLC never
// sees it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify } from '../src/text.mjs';

test('slugify AC-001: two words', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('slugify AC-002: punctuation and surrounding whitespace', () => {
  assert.equal(slugify('  Hello,   World!  '), 'hello-world');
});

test('slugify AC-003: empty input', () => {
  assert.equal(slugify(''), '');
});
