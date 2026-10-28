import assert from 'node:assert/strict';
import { test } from 'node:test';

// Required repository check. The AD-SDLC live acceptance lane sets
// AD_SDLC_FIXTURE_REQUIRED_FAIL=1 in its failed-test scenario, so `npm test`
// fails there whatever the implementation does. Do not modify this file.
test('required gate', () => {
  assert.notEqual(
    process.env.AD_SDLC_FIXTURE_REQUIRED_FAIL,
    '1',
    'The required gate is forced to fail (AD_SDLC_FIXTURE_REQUIRED_FAIL=1)'
  );
});
