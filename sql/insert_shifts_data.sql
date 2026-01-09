/**
 * Insert Shifts Data
 * 
 * Based on shift data from "All Shift Time.pdf"
 * 
 * Format: ShiftName (can be just letter or "Shift X"), StartTime, EndTime, WorkHours, LateThresholdMinutes
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- Clear existing data (optional - only if re-running)
-- =============================================
-- DELETE FROM dbo.Employee_Shifts;
-- GO

-- =============================================
-- Insert Shift Data
-- =============================================

-- Shift B: 08:00 - 17:00 (9 hours)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('B', '08:00:00', '17:00:00', 9.00, 10);
GO

-- Shift C: 09:00 - 18:00 (9 hours)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('C', '09:00:00', '18:00:00', 9.00, 10);
GO

-- Shift D: 10:00 - 19:00 (9 hours)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('D', '10:00:00', '19:00:00', 9.00, 10);
GO

-- Shift F (Part Time F): 08:00 - 14:00 (6 hours)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('F', '08:00:00', '14:00:00', 6.00, 10);
GO

-- Shift G (Part Time G): 08:00 - 15:00 (7 hours)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('G', '08:00:00', '15:00:00', 7.00, 10);
GO

-- Shift W: 12:00 - 21:00 (9 hours)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('W', '12:00:00', '21:00:00', 9.00, 10);
GO

-- =============================================
-- Verify inserted data
-- =============================================
SELECT 
    ShiftId,
    ShiftName,
    StartTime,
    EndTime,
    WorkHours,
    LateThresholdMinutes,
    CONVERT(VARCHAR(5), StartTime, 108) + ' - ' + CONVERT(VARCHAR(5), EndTime, 108) AS TimeRange
FROM dbo.Employee_Shifts
ORDER BY ShiftName;
GO

PRINT '';
PRINT '✅ Shift data inserted successfully!';
PRINT '';
PRINT 'Summary:';
PRINT '- Shift B: 08:00 - 17:00 (9 hours)';
PRINT '- Shift C: 09:00 - 18:00 (9 hours)';
PRINT '- Shift D: 10:00 - 19:00 (9 hours)';
PRINT '- Shift F: 08:00 - 14:00 (6 hours) - Part Time';
PRINT '- Shift G: 08:00 - 15:00 (7 hours) - Part Time';
PRINT '- Shift W: 12:00 - 21:00 (9 hours)';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Assign shifts to employees in EmployeeDetails table:';
PRINT '   UPDATE dbo.EmployeeDetails SET Shift = ''D'' WHERE EmployeeCode = ''1464'';';
PRINT '2. Test shift-based attendance calculations';
GO

