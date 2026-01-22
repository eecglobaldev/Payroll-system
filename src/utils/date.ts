/**
 * Date Utilities
 * Helper functions for date manipulation and formatting
 */

import { DateRange } from '../types/index.js';

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  
  // Use local components to avoid timezone shifts
  // This ensures that "2025-11-12" always formats back to "2025-11-12"
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Create a Date object from a YYYY-MM-DD string that is timezone-neutral (local midnight)
 */
export function createLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Parse date string to Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Check if a string is a valid date in YYYY-MM-DD format
 */
export function isValidDateFormat(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get the salary cycle date range (26th to 25th)
 * @param monthStr - Month string in YYYY-MM format
 * @example "2025-11" returns Oct 26, 2025 to Nov 25, 2025
 */
export function getMonthRange(monthStr: string): DateRange {
  const [year, month] = monthStr.split('-').map(Number);
  
  // Salary cycle: 26th of previous month to 25th of current month
  const startDate = new Date(year, month - 2, 26); // Previous month, 26th
  const endDate = new Date(year, month - 1, 25);   // Current month, 25th
  
  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
}

/**
 * Check if a string is a valid month in YYYY-MM format
 */
export function isValidMonthFormat(monthStr: string): boolean {
  const regex = /^\d{4}-\d{2}$/;
  if (!regex.test(monthStr)) return false;
  
  const [year, month] = monthStr.split('-').map(Number);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Calculate hours difference between two times
 */
export function calculateHours(
  startTime: Date | string,
  endTime: Date | string
): number {
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function today(): string {
  return formatDate(new Date());
}

/**
 * Get current month in YYYY-MM format
 */
export function currentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format time to HH:MM:SS
 */
export function formatTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format datetime to YYYY-MM-DD HH:MM:SS
 */
export function formatDateTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return `${formatDate(d)} ${formatTime(d)}`;
}

