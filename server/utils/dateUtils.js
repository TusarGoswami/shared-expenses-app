/**
 * Utility functions for date parsing and validation.
 */

/**
 * Attempt to parse a date string in multiple common formats.
 * Returns a valid Date object or null if unparseable.
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try native parsing first (handles ISO 8601, "YYYY-MM-DD", etc.)
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) return native;

  // Try DD/MM/YYYY and DD-MM-YYYY
  const ddmmyyyy = trimmed.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/
  );
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Try MM/DD/YYYY
  const mmddyyyy = trimmed.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
  );
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Check if a date falls within a member's active period.
 * @param {Date} date
 * @param {Date} joinDate
 * @param {Date|null} leaveDate
 * @returns {boolean}
 */
function isDateInMemberPeriod(date, joinDate, leaveDate) {
  const d = new Date(date);
  const join = new Date(joinDate);

  if (d < join) return false;
  if (leaveDate) {
    const leave = new Date(leaveDate);
    if (d > leave) return false;
  }
  return true;
}

/**
 * Format a date to YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

module.exports = { parseDate, isDateInMemberPeriod, formatDate };
