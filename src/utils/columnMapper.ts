/**
 * Column Name Mapper
 * Maps PostgreSQL lowercase column names to PascalCase for TypeScript interfaces
 * PostgreSQL returns lowercase by default, but our TypeScript interfaces expect PascalCase
 */

/**
 * Map a single row from PostgreSQL format to TypeScript interface format
 * @param row - Row from PostgreSQL query (lowercase keys)
 * @param mapping - Object mapping lowercase keys to PascalCase keys
 * @returns Mapped row with PascalCase keys
 */
export function mapRow<T>(row: any, mapping: Record<string, string>): T {
  const mapped: any = {};
  
  for (const [lowercaseKey, pascalCaseKey] of Object.entries(mapping)) {
    if (row[lowercaseKey] !== undefined) {
      mapped[pascalCaseKey] = row[lowercaseKey];
    }
  }
  
  return mapped as T;
}

/**
 * Map multiple rows from PostgreSQL format to TypeScript interface format
 */
export function mapRows<T>(rows: any[], mapping: Record<string, string>): T[] {
  return rows.map(row => mapRow<T>(row, mapping));
}

/**
 * AttendanceLog column mapping (devicelogs table)
 * Maps lowercase PostgreSQL column names to PascalCase TypeScript interface
 */
export const ATTENDANCE_LOG_MAPPING: Record<string, string> = {
  devicelogid: 'DeviceLogId',
  downloaddate: 'DownloadDate',
  deviceid: 'DeviceId',
  userid: 'UserId',
  logdate: 'LogDate',
  direction: 'Direction',
  attdirection: 'AttDirection',
  c1: 'C1',
  c2: 'C2',
  c3: 'C3',
  c4: 'C4',
  c5: 'C5',
  c6: 'C6',
  c7: 'C7',
  workcode: 'WorkCode',
  updateflag: 'UpdateFlag',
  employeeimage: 'EmployeeImage',
  filename: 'FileName',
  longitude: 'Longitude',
  latitude: 'Latitude',
  isapproved: 'IsApproved',
  createddate: 'CreatedDate',
  lastmodifieddate: 'LastModifiedDate',
  locationaddress: 'LocationAddress',
  bodytemperature: 'BodyTemperature',
  ismaskon: 'IsMaskOn',
};

/**
 * Map AttendanceLog rows from PostgreSQL format
 */
export function mapAttendanceLogs(rows: any[]): any[] {
  return mapRows(rows, ATTENDANCE_LOG_MAPPING);
}

/**
 * Map a single AttendanceLog row
 */
export function mapAttendanceLog(row: any): any {
  return mapRow(row, ATTENDANCE_LOG_MAPPING);
}

/**
 * AttendanceSummary column mapping
 */
export const ATTENDANCE_SUMMARY_MAPPING: Record<string, string> = {
  userid: 'UserId',
  dayspresent: 'DaysPresent',
  totallogs: 'TotalLogs',
  firstentry: 'FirstEntry',
  lastentry: 'LastEntry',
};

/**
 * Map AttendanceSummary from PostgreSQL format
 */
export function mapAttendanceSummary(row: any): any {
  return mapRow(row, ATTENDANCE_SUMMARY_MAPPING);
}
