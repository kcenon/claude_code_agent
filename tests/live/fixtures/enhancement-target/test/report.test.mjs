import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatProgress, progress } from '../src/report.mjs';

// Required repository check. The AD-SDLC live acceptance lane sets
// AD_SDLC_FIXTURE_REGRESSION=1 in its regression scenario, so these retained
// tests fail there whatever the implementation does. The marker file tells the
// lane that the variable reached this process. Do not modify this file.
function failWhenRegressionIsForced() {
  if (process.env.AD_SDLC_FIXTURE_REGRESSION !== '1') return;
  mkdirSync(new URL('../.ad-sdlc/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../.ad-sdlc/fixture-regression-seen', import.meta.url), 'seen\n');
  assert.fail('Retained report behavior is forced to fail (AD_SDLC_FIXTURE_REGRESSION=1)');
}

const tasks = [
  { id: 1, title: 'First', due: null, done: true },
  { id: 2, title: 'Second', due: null, done: false },
  { id: 3, title: 'Third', due: null, done: false },
];

test('progress counts total, done, and open tasks', () => {
  failWhenRegressionIsForced();
  assert.deepEqual(progress(tasks), { total: 3, done: 1, open: 2 });
  assert.deepEqual(progress([]), { total: 0, done: 0, open: 0 });
});

test('formatProgress describes the progress in one line', () => {
  failWhenRegressionIsForced();
  assert.equal(formatProgress(tasks), '1 of 3 tasks done');
});
