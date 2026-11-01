// Independent acceptance test of the feature the Enhancement live scenarios
// request. The live lane copies it into `acceptance/` of the pull request checkout
// after the run; AD-SDLC never sees it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overdueTasks } from '../src/report.mjs';

const task = (id, due, done = false) => ({ id, title: `Task ${id}`, due, done });

test('feature AC-001: returns the open tasks due before the given day', () => {
  const tasks = [task(1, '2026-03-01'), task(2, '2026-03-10'), task(3, '2026-02-01', true)];
  assert.deepEqual(overdueTasks(tasks, '2026-03-05'), [tasks[0]]);
});

test('feature AC-002: a task due on the given day is not overdue', () => {
  assert.deepEqual(overdueTasks([task(1, '2026-03-05')], '2026-03-05'), []);
});

test('feature AC-003: a task without a due date is never overdue', () => {
  assert.deepEqual(overdueTasks([task(1, null)], '2026-03-05'), []);
});

test('feature AC-004: the oldest due date comes first, then the lowest identifier', () => {
  const tasks = [task(3, '2026-02-02'), task(2, '2026-02-01'), task(1, '2026-02-02')];
  assert.deepEqual(
    overdueTasks(tasks, '2026-03-05').map((entry) => entry.id),
    [2, 1, 3]
  );
});

test('feature AC-005: the input list is left alone', () => {
  const tasks = [task(2, '2026-02-02'), task(1, '2026-02-01')];
  const copy = structuredClone(tasks);
  overdueTasks(tasks, '2026-03-05');
  assert.deepEqual(tasks, copy);
});
