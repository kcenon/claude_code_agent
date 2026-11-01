/**
 * Progress report of the AD-SDLC Enhancement acceptance fixture.
 */

/**
 * Count the tasks of a list.
 * @param {readonly object[]} tasks - Task list
 * @returns {{ total: number, done: number, open: number }} Counts
 */
export function progress(tasks) {
  const done = tasks.filter((task) => task.done).length;
  return { total: tasks.length, done, open: tasks.length - done };
}

/**
 * Describe the progress of a list in one line.
 * @param {readonly object[]} tasks - Task list
 * @returns {string} For example `2 of 5 tasks done`
 */
export function formatProgress(tasks) {
  const { total, done } = progress(tasks);
  return `${done} of ${total} tasks done`;
}

/**
 * List the open tasks due before a day, oldest due date first and then lowest
 * identifier.
 * @param {readonly object[]} tasks - Task list
 * @param {string} today - Day as `YYYY-MM-DD`
 * @returns {object[]} Overdue tasks
 */
export function overdueTasks(tasks, today) {
  return tasks
    .filter((task) => !task.done && task.due !== null && task.due < today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id);
}
