/**
 * Debug Employee Shift Assignment
 * Check if employee 3002 has a split shift configured
 */

USE [etimetracklite1];
GO

PRINT '=== Employee Shift Assignment ===';

-- Check employee's assigned shift
SELECT 
    ed.EmployeeCode,
    ed.Shift AS AssignedShiftName,
    es.IsSplitShift,
    CASE 
        WHEN es.IsSplitShift = 1 THEN 
            CONCAT(
                FORMAT(es.StartTime_1, 'HH:mm'), '-', FORMAT(es.EndTime_1, 'HH:mm'),
                ' | ',
                FORMAT(es.StartTime_2, 'HH:mm'), '-', FORMAT(es.EndTime_2, 'HH:mm')
            )
        ELSE 
            CONCAT(FORMAT(es.StartTime, 'HH:mm'), '-', FORMAT(es.EndTime, 'HH:mm'))
    END AS ShiftTiming,
    es.WorkHours,
    es.LateThresholdMinutes
FROM dbo.EmployeeDetails ed
LEFT JOIN dbo.Employee_Shifts es ON ed.Shift = es.ShiftName
WHERE ed.EmployeeCode = '3002';

PRINT '';
PRINT '=== All Shift Definitions ===';

-- Show all available shifts
SELECT 
    ShiftName,
    IsSplitShift,
    CASE 
        WHEN IsSplitShift = 1 THEN 
            CONCAT(
                FORMAT(StartTime_1, 'HH:mm'), '-', FORMAT(EndTime_1, 'HH:mm'),
                ' | ',
                FORMAT(StartTime_2, 'HH:mm'), '-', FORMAT(EndTime_2, 'HH:mm')
            )
        ELSE 
            CONCAT(FORMAT(StartTime, 'HH:mm'), '-', FORMAT(EndTime, 'HH:mm'))
    END AS Timing,
    WorkHours
FROM dbo.Employee_Shifts
ORDER BY IsSplitShift DESC, ShiftName;

PRINT '';
PRINT '=== Employee 3002 Attendance Logs for Dec 4, 2025 ===';

-- Show attendance logs
SELECT 
    UserId,
    LogDate,
    DATEPART(HOUR, LogDate) AS Hour,
    DATEPART(MINUTE, LogDate) AS Minute,
    (DATEPART(HOUR, LogDate) * 60 + DATEPART(MINUTE, LogDate)) AS MinutesSinceMidnight
FROM dbo.DeviceLogs_C
WHERE UserId = 3002
  AND CONVERT(DATE, LogDate) = '2025-12-04'
ORDER BY LogDate;

GO

