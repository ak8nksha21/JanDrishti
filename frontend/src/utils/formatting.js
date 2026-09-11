/**
 * Utility functions for Indian currency, number formatting, dates and units.
 * Strictly adheres to non-defaulting null values rule (displays 'N/A' for missing/null data).
 */

/**
 * Format a number using the Indian number grouping system (e.g. 1,23,45,678).
 * Returns 'N/A' for null, undefined, or invalid inputs.
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatIndianNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  const num = Number(value);
  if (isNaN(num)) {
    return 'N/A';
  }
  const isNegative = num < 0;
  const absVal = Math.abs(num);

  // Format with integer and decimal parts
  const parts = absVal.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] === '00' ? '' : `.${parts[1]}`;

  if (integerPart.length <= 3) {
    return (isNegative ? '-' : '') + integerPart + decimalPart;
  }

  // Last 3 digits
  const last3 = integerPart.substring(integerPart.length - 3);
  const rest = integerPart.substring(0, integerPart.length - 3);

  // Group rest by pairs of 2
  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return (isNegative ? '-' : '') + groupedRest + ',' + last3 + decimalPart;
}

/**
 * Format currency with ₹ symbol and Indian comma separators (exact value).
 * Returns 'N/A' for null or undefined values.
 *
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatIndianCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return 'N/A';
  }
  const num = Number(amount);
  if (isNaN(num)) {
    return 'N/A';
  }
  return `₹${formatIndianNumber(amount)}`;
}

/**
 * Compact formatting in Crores / Lakhs / Thousands for large financial numbers
 * e.g., ₹12.4 Cr, ₹84.2 Lakh, ₹45.6 K.
 * Returns { compact: 'N/A', exact: 'N/A', raw: null } for null/missing values.
 *
 * @param {number|string|null|undefined} amount
 * @param {number} [decimals=2]
 * @returns {{ compact: string, exact: string, raw: number|null }}
 */
export function formatCroresLakhs(amount, decimals = 2) {
  if (amount === null || amount === undefined || amount === '') {
    return { compact: 'N/A', exact: 'N/A', raw: null };
  }

  const num = Number(amount);
  if (isNaN(num)) {
    return { compact: 'N/A', exact: 'N/A', raw: null };
  }

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const exact = formatIndianCurrency(num);

  // 1 Crore = 10,000,000 (10^7)
  if (abs >= 10000000) {
    const cr = (num / 10000000).toFixed(decimals);
    return { compact: `${sign}₹${cr} Cr`, exact, raw: num };
  }

  // 1 Lakh = 100,000 (10^5)
  if (abs >= 100000) {
    const lk = (num / 100000).toFixed(decimals);
    return { compact: `${sign}₹${lk} Lakh`, exact, raw: num };
  }

  // 1 Thousand = 1,000
  if (abs >= 1000) {
    const k = (num / 1000).toFixed(1);
    return { compact: `${sign}₹${k} K`, exact, raw: num };
  }

  return { compact: `${sign}₹${num.toFixed(0)}`, exact, raw: num };
}

/**
 * Format dates cleanly in Indian standard DD MMM YYYY format.
 * Returns 'N/A' for null or empty values.
 *
 * @param {string|Date|null|undefined} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Format relative time (e.g. 'Just now', '10 mins ago')
 * @param {string|Date|null|undefined} dateStr
 * @returns {string}
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Never';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return formatDate(dateStr);
  } catch (e) {
    return 'Recently';
  }
}
