/**
 * Insert Shifts Data Template
 * 
 * INSTRUCTIONS:
 * 1. Open "All Shift Time.pdf" file
 * 2. Extract shift names and timings from the PDF
 * 3. Replace the example INSERT statements below with actual shift data
 * 4. Format: ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes
 * 
 * Example format:
 * - ShiftName: "10 to 7" or "9 to 6" or "Night Shift"
 * - StartTime: "10:00:00" (10:00 AM)
 * - EndTime: "19:00:00" (7:00 PM)
 * - WorkHours: 9.00 (9 hours)
 * - LateThresholdMinutes: 10 (10 minutes after start time = late)
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
-- Replace these examples with actual data from PDF
-- =============================================

-- Example 1: Standard 10 to 7 shift
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('10 to 7', '10:00:00', '19:00:00', 9.00, 10);
GO

-- Example 2: 9 to 6 shift
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('9 to 6', '09:00:00', '18:00:00', 9.00, 10);
GO

-- Example 3: Night shift (example - adjust based on PDF)
INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
VALUES ('Night Shift', '22:00:00', '06:00:00', 8.00, 10);
GO

-- =============================================
-- ADD MORE SHIFTS HERE BASED ON PDF DATA
-- =============================================
-- Copy the INSERT statement above and modify with actual shift data
-- Example:
-- INSERT INTO dbo.Employee_Shifts (ShiftName, StartTime, EndTime, WorkHours, LateThresholdMinutes)
-- VALUES ('Shift Name from PDF', 'HH:MM:SS', 'HH:MM:SS', HOURS, 10);
-- GO

-- =============================================
-- Verify inserted data
-- =============================================
SELECT 
    ShiftId,
    ShiftName,
    StartTime,
    EndTime,
    WorkHours,
    LateThresholdMinutes
FROM dbo.Employee_Shifts
ORDER BY ShiftName;
GO

PRINT '';
PRINT '✅ Shift data inserted successfully!';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Verify all shifts are correctly inserted';
PRINT '2. Update EmployeeDetails.Shift column for employees';
PRINT '3. Test shift-based attendance calculations';
GO

