export const ATTENDANCE_STATUS = {
  FULL_DAY: 'full-day',
  HALF_DAY: 'half-day',
  ABSENT: 'absent',
} as const;

export const ATTENDANCE_STATUS_COLORS = {
  'full-day': 'bg-green-100 text-green-800',
  'half-day': 'bg-yellow-100 text-yellow-800',
  'absent': 'bg-red-100 text-red-800',
} as const;

export const ATTENDANCE_STATUS_LABELS = {
  'full-day': 'Full Day',
  'half-day': 'Half Day',
  'absent': 'Absent',
  'not-active': 'N/A',
  'weekoff': 'Week Off',
} as const;

export const SALARY_CYCLE_INFO = {
  START_DAY: 26,
  END_DAY: 25,
  DESCRIPTION: '26th of previous month to 25th of current month',
} as const;

export const LATE_THRESHOLD = '10:12 AM';
export const EARLY_EXIT_THRESHOLD = '5:30 PM';
export const WORKING_HOURS_PER_DAY = 9;
export const LATE_GRACE_DAYS = 3;
export const LATE_DEDUCTION_PERCENT = 25;

