/**
 * Text helpers of the AD-SDLC Import acceptance fixture. The seeded issues
 * ask for new functions in this module.
 */

/**
 * Upper-case the first character of a string.
 * @param {string} text - Input text
 * @returns {string} The text with its first character in upper case
 */
export function capitalize(text) {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}
