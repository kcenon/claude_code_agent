/**
 * Task store of the AD-SDLC Enhancement acceptance fixture. A task list is a
 * plain array; every function returns a new array and leaves its input alone.
 */

const TITLE_LIMIT = 120;

/**
 * Add an open task to a list.
 * @param {readonly object[]} tasks - Current list
 * @param {string} title - Title; surrounding whitespace is removed
 * @param {string | null} due - Due date as `YYYY-MM-DD`, or null
 * @returns {object[]} New list ending with the added task
 * @throws {RangeError} When the title is empty or longer than the limit
 */
export function addTask(tasks, title, due = null) {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > TITLE_LIMIT)
    throw new RangeError(`A task title has 1 to ${TITLE_LIMIT} characters`);
  const id = tasks.reduce((highest, task) => Math.max(highest, task.id), 0) + 1;
  return [...tasks, { id, title: trimmed, due, done: false }];
}

/**
 * Mark a task as done.
 * @param {readonly object[]} tasks - Current list
 * @param {number} id - Task identifier
 * @returns {object[]} New list with the task done
 * @throws {RangeError} When no task has the identifier
 */
export function completeTask(tasks, id) {
  if (!tasks.some((task) => task.id === id)) throw new RangeError(`Unknown task ${id}`);
  return tasks.map((task) => (task.id === id ? { ...task, done: true } : task));
}
