import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capitalize } from '../src/text.mjs';

test('capitalize upper-cases the first character', () => {
  assert.equal(capitalize('hello'), 'Hello');
});

test('capitalize keeps an empty string', () => {
  assert.equal(capitalize(''), '');
});
