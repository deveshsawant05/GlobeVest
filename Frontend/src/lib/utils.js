import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency with the specified currency code
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - The currency code (e.g., USD, EUR)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currencyCode = 'USD') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Converts a UTC timestamp to the user's local time
 * @param {string|Date} utcTimestamp - UTC timestamp as string or Date object
 * @returns {Date} - Date object in local time
 */
export function convertUTCToLocal(utcTimestamp) {
  if (!utcTimestamp) return null;
  // If it's already a Date object, no need to parse
  if (utcTimestamp instanceof Date) return utcTimestamp;
  
  // Parse the UTC timestamp to a Date object (which will convert to local time)
  return new Date(utcTimestamp);
}

/**
 * Formats a timestamp for display based on the specified format
 * @param {string|Date} timestamp - The timestamp to format
 * @param {string} format - The format to use: 'date', 'time', 'datetime', 'relative'
 * @returns {string} - Formatted timestamp
 */
export function formatTimestamp(timestamp, format = 'datetime') {
  if (!timestamp) return '';
  
  const date = convertUTCToLocal(timestamp);
  
  switch (format) {
    case 'date':
      return date.toLocaleDateString();
    case 'time':
      return date.toLocaleTimeString();
    case 'datetime':
      return date.toLocaleString();
    case 'relative':
      return getRelativeTimeString(date);
    default:
      return date.toLocaleString();
  }
}

/**
 * Calculates relative time string (e.g., "2 hours ago", "just now")
 * @param {Date} date - The date to get relative time for
 * @returns {string} - Relative time string
 */
export function getRelativeTimeString(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}
