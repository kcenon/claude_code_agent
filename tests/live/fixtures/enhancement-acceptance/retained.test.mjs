// Independent acceptance test of the behavior the Enhancement fixture had before
// the run. The live lane copies it into `acceptance/` of the pull request checkout
// after the run; AD-SDLC never sees it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatProgress, progress } from '../src/report.mjs';
import { addTask, completeTask } from '../src/tasks.mjs';

test('retained: addTask appends an open task and trims its title', () => {
  const tasks = addTask([], '  Write the report  ', '2026-03-01');
  assert.deepEqual(tasks, [{ id: 1, title: 'Write the report', due: '2026-03-01', done: false }]);
});

test('retained: addTask keeps the title limit', () => {
  assert.throws(() => addTask([], ' '), RangeError);
  assert.throws(() => addTask([], 'x'.repeat(121)), RangeError);
});

test('retained: completeTask returns a new list and rejects an unknown task', () => {
  const tasks = addTask(addTask([], 'First'), 'Second');
  assert.equal(completeTask(tasks, 1)[0].done, true);
  assert.equal(tasks[0].done, false);
  assert.throws(() => completeTask(tasks, 9), RangeError);
});

test('retained: progress counts the tasks', () => {
  const tasks = completeTask(addTask(addTask([], 'First'), 'Second'), 2);
  assert.deepEqual(progress(tasks), { total: 2, done: 1, open: 1 });
  assert.deepEqual(progress([]), { total: 0, done: 0, open: 0 });
});

test('retained: formatProgress keeps its wording', () => {
  const tasks = completeTask(addTask(addTask([], 'First'), 'Second'), 2);
  assert.equal(formatProgress(tasks), '1 of 2 tasks done');
  assert.equal(formatProgress([]), '0 of 0 tasks done');
});
