// Independent acceptance test of the `count-words` issue. The live lane copies
// it into `acceptance/` of the pull request checkout after the run; AD-SDLC
// never sees it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countWords } from '../src/text.mjs';

test('countWords AC-001: words separated by one or more spaces', () => {
  assert.equal(countWords('one two  three'), 3);
});

test('countWords AC-002: blank and empty input', () => {
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(''), 0);
});
