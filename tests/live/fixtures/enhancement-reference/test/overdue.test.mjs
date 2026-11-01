import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overdueTasks } from '../src/report.mjs';

const task = (id, due, done = false) => ({ id, title: `Task ${id}`, due, done });

test('overdueTasks returns open tasks due before the given day', () => {
  const tasks = [task(1, '2026-03-01'), task(2, '2026-03-05'), task(3, '2026-02-01', true)];
  assert.deepEqual(overdueTasks(tasks, '2026-03-05'), [tasks[0]]);
});

test('overdueTasks ignores tasks without a due date', () => {
  assert.deepEqual(overdueTasks([task(1, null)], '2026-03-05'), []);
});

test('overdueTasks orders by due date, then identifier, and leaves its input alone', () => {
  const tasks = [task(3, '2026-02-02'), task(2, '2026-02-01'), task(1, '2026-02-02')];
  const ids = overdueTasks(tasks, '2026-03-05').map((entry) => entry.id);
  assert.deepEqual(ids, [2, 1, 3]);
  assert.deepEqual(
    tasks.map((entry) => entry.id),
    [3, 2, 1]
  );
});
