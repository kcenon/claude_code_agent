import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addTask, completeTask } from '../src/tasks.mjs';

test('addTask appends an open task with the next identifier', () => {
  const tasks = addTask(addTask([], 'First'), '  Second  ', '2026-03-01');
  assert.deepEqual(tasks[1], { id: 2, title: 'Second', due: '2026-03-01', done: false });
});

test('addTask rejects an empty title and one over the limit', () => {
  assert.throws(() => addTask([], '   '), RangeError);
  assert.throws(() => addTask([], 'x'.repeat(121)), RangeError);
  assert.equal(addTask([], 'x'.repeat(120)).length, 1);
});

test('completeTask marks one task done and leaves the input alone', () => {
  const tasks = addTask(addTask([], 'First'), 'Second');
  const updated = completeTask(tasks, 2);
  assert.equal(updated[1].done, true);
  assert.equal(updated[0].done, false);
  assert.equal(tasks[1].done, false);
});

test('completeTask rejects an unknown identifier', () => {
  assert.throws(() => completeTask([], 1), RangeError);
});
