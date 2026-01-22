/**
 * Split Shift Examples
 * 
 * Sample INSERT statements for common split shift patterns
 * Run AFTER executing sql/add_split_shift_support.sql
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- Example 1: Morning + Evening Split (Restaurant/Retail)
-- =============================================
-- Shift: SPLIT-A
-- Slot 1: 08:00 - 13:00 (5 hours)
-- Slot 2: 17:00 - 21:00 (4 hours)
-- Total: 9 hours
-- Use Case: Restaurant staff (breakfast/lunch + dinner service)

INSERT INTO dbo.Employee_Shifts (
  ShiftName, 
  StartTime, 
  EndTime, 
  IsSplitShift, 
  StartTime_1, 
  EndTime_1, 
  StartTime_2, 
  EndTime_2, 
  WorkHours, 
  LateThresholdMinutes
)
VALUES (
  'SPLIT-A',
  '00:00:00',     -- Dummy value (not used for split shifts)
  '00:00:00',     -- Dummy value (not used for split shifts)
  1,              -- IsSplitShift = TRUE
  '08:00:00',     -- Slot 1 start
  '13:00:00',     -- Slot 1 end
  '17:00:00',     -- Slot 2 start
  '21:00:00',     -- Slot 2 end
  9.00,           -- Total work hours
  10              -- Late threshold: 10 minutes
);

PRINT '✅ Added SPLIT-A: 08:00-13:00 | 17:00-21:00 (9 hours)';
GO

-- =============================================
-- Example 2: Early Morning + Afternoon Split
-- =============================================
-- Shift: SPLIT-B
-- Slot 1: 06:00 - 10:00 (4 hours)
-- Slot 2: 14:00 - 19:00 (5 hours)
-- Total: 9 hours
-- Use Case: Delivery/logistics staff

INSERT INTO dbo.Employee_Shifts (
  ShiftName, 
  StartTime, 
  EndTime, 
  IsSplitShift, 
  StartTime_1, 
  EndTime_1, 
  StartTime_2, 
  EndTime_2, 
  WorkHours, 
  LateThresholdMinutes
)
VALUES (
  'SPLIT-B',
  '00:00:00',
  '00:00:00',
  1,
  '06:00:00',     -- Slot 1 start
  '10:00:00',     -- Slot 1 end
  '14:00:00',     -- Slot 2 start
  '19:00:00',     -- Slot 2 end
  9.00,
  10
);

PRINT '✅ Added SPLIT-B: 06:00-10:00 | 14:00-19:00 (9 hours)';
GO

-- =============================================
-- Example 3: Part-Time Split Shift
-- =============================================
-- Shift: SPLIT-PT
-- Slot 1: 09:00 - 12:00 (3 hours)
-- Slot 2: 16:00 - 19:00 (3 hours)
-- Total: 6 hours
-- Use Case: Part-time staff

INSERT INTO dbo.Employee_Shifts (
  ShiftName, 
  StartTime, 
  EndTime, 
  IsSplitShift, 
  StartTime_1, 
  EndTime_1, 
  StartTime_2, 
  EndTime_2, 
  WorkHours, 
  LateThresholdMinutes
)
VALUES (
  'SPLIT-PT',
  '00:00:00',
  '00:00:00',
  1,
  '09:00:00',     -- Slot 1 start
  '12:00:00',     -- Slot 1 end
  '16:00:00',     -- Slot 2 start
  '19:00:00',     -- Slot 2 end
  6.00,           -- Part-time: 6 hours
  10
);

PRINT '✅ Added SPLIT-PT: 09:00-12:00 | 16:00-19:00 (6 hours - Part Time)';
GO

-- =============================================
-- Example 4: Long Break Split (Healthcare/Security)
-- =============================================
-- Shift: SPLIT-C
-- Slot 1: 07:00 - 11:00 (4 hours)
-- Slot 2: 15:00 - 20:00 (5 hours)
-- Total: 9 hours
-- Use Case: Healthcare workers, security guards

INSERT INTO dbo.Employee_Shifts (
  ShiftName, 
  StartTime, 
  EndTime, 
  IsSplitShift, 
  StartTime_1, 
  EndTime_1, 
  StartTime_2, 
  EndTime_2, 
  WorkHours, 
  LateThresholdMinutes
)
VALUES (
  'SPLIT-C',
  '00:00:00',
  '00:00:00',
  1,
  '07:00:00',     -- Slot 1 start
  '11:00:00',     -- Slot 1 end
  '15:00:00',     -- Slot 2 start
  '20:00:00',     -- Slot 2 end
  9.00,
  10
);

PRINT '✅ Added SPLIT-C: 07:00-11:00 | 15:00-20:00 (9 hours)';
GO

-- =============================================
-- Verify All Shifts
-- =============================================
PRINT '';
PRINT '📊 Current Shifts in Database:';
PRINT '';

SELECT 
  ShiftName,
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
  WorkHours,
  CASE WHEN IsSplitShift = 1 THEN 'Split Shift' ELSE 'Normal Shift' END AS Type
FROM dbo.Employee_Shifts
ORDER BY IsSplitShift DESC, ShiftName;

GO

PRINT '';
PRINT '✅ Split shift examples added successfully!';
PRINT '';
PRINT 'To assign a split shift to an employee:';
PRINT '  UPDATE dbo.EmployeeDetails SET Shift = ''SPLIT-A'' WHERE EmployeeCode = ''12345'';';
PRINT '';
GO

