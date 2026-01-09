/**
 * Database Configuration
 * Helper functions for dynamic table names
 */

/**
 * Get the current month's DeviceLogs table name
 * Format: dbo.DeviceLogs_MM_YYYY
 */

export function getCurrentDeviceLogsTable(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  return `dbo.DeviceLogs_${month}_${year}`;
}

/**
 * Get DeviceLogs table for a specific month
 * @param month - Month string in YYYY-MM format
 */
export function getDeviceLogsTableForMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  return `dbo.DeviceLogs_${monthNum}_${year}`;
}

/**
 * Get DeviceLogs table for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export function getDeviceLogsTableForDate(date: string): string {
  const [year, month] = date.split('-');
  return `dbo.DeviceLogs_${month}_${year}`;
}

/**
 * Get array of table names for a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 */
export function getDeviceLogsTablesForRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const tables: string[] = [];
  
  // Get tables by iterating from start month to end month
  const startMonth = start.getFullYear() * 12 + start.getMonth();
  const endMonth = end.getFullYear() * 12 + end.getMonth();
  
  for (let monthNum = startMonth; monthNum <= endMonth; monthNum++) {
    const year = Math.floor(monthNum / 12);
    const month = (monthNum % 12) + 1;
    const tableName = `dbo.DeviceLogs_${month}_${year}`;
    
    if (!tables.includes(tableName)) {
      tables.push(tableName);
    }
  }
  
  return tables;
}

export default {
  getCurrentDeviceLogsTable,
  getDeviceLogsTableForMonth,
  getDeviceLogsTableForDate,
  getDeviceLogsTablesForRange,
};

