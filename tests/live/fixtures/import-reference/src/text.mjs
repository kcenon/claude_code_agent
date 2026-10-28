/**
 * Reference solution of the seeded issues. Used only by the offline fixture
 * validation to prove that the acceptance tests can pass; it is never pushed
 * to the target repository.
 */

/**
 * Upper-case the first character of a string.
 * @param {string} text - Input text
 * @returns {string} The text with its first character in upper case
 */
export function capitalize(text) {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/**
 * Turn a title into a URL slug.
 * @param {string} text - Input text
 * @returns {string} Lower-case ASCII letters and digits joined by single hyphens
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Count the whitespace-separated words of a text.
 * @param {string} text - Input text
 * @returns {number} Number of words
 */
export function countWords(text) {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
