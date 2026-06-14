/**
 * Name normalisation utility.
 * Handles case-insensitive matching, whitespace trimming, and common variants.
 */

/**
 * Normalise a name to a canonical lowercase, trimmed form.
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find the canonical name from a list of known names.
 * Returns the original-case canonical name if a match is found, otherwise null.
 * @param {string} rawName - The name to look up.
 * @param {string[]} canonicalNames - Array of correctly-cased canonical names.
 * @returns {{ canonical: string, wasVariant: boolean } | null}
 */
function findCanonicalName(rawName, canonicalNames) {
  if (!rawName) return null;

  const normalised = normalizeName(rawName);

  for (const canonical of canonicalNames) {
    if (normalizeName(canonical) === normalised) {
      const wasVariant = canonical !== rawName.trim();
      return { canonical, wasVariant };
    }
  }

  return null;
}

module.exports = { normalizeName, findCanonicalName };
