/**
 * Split Shift Support Migration
 * 
 * Purpose: Add support for split shifts (e.g., 08:00-13:00 and 17:00-21:00)
 * - Adds split shift columns to existing Employee_Shifts table
 * - No new tables created
 * - Backwards compatible with existing shifts
 * 
 * Business Rules:
 * - If IsSplitShift = 0 → use StartTime & EndTime (existing behavior)
 * - If IsSplitShift = 1 → use StartTime_1, EndTime_1, StartTime_2, EndTime_2
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- Add Split Shift Columns to Employee_Shifts
-- =============================================

PRINT 'Starting Split Shift Migration...';
GO

-- Add IsSplitShift flag
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') 
    AND name = 'IsSplitShift'
)
BEGIN
    ALTER TABLE dbo.Employee_Shifts
    ADD IsSplitShift BIT NOT NULL DEFAULT 0;
    
    PRINT '✅ Added IsSplitShift column (default 0)';
END
ELSE
BEGIN
    PRINT 'ℹ️  IsSplitShift column already exists';
END
GO

-- Add StartTime_1 for first slot
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') 
    AND name = 'StartTime_1'
)
BEGIN
    ALTER TABLE dbo.Employee_Shifts
    ADD StartTime_1 TIME NULL;
    
    PRINT '✅ Added StartTime_1 column';
END
ELSE
BEGIN
    PRINT 'ℹ️  StartTime_1 column already exists';
END
GO

-- Add EndTime_1 for first slot
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') 
    AND name = 'EndTime_1'
)
BEGIN
    ALTER TABLE dbo.Employee_Shifts
    ADD EndTime_1 TIME NULL;
    
    PRINT '✅ Added EndTime_1 column';
END
ELSE
BEGIN
    PRINT 'ℹ️  EndTime_1 column already exists';
END
GO

-- Add StartTime_2 for second slot
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') 
    AND name = 'StartTime_2'
)
BEGIN
    ALTER TABLE dbo.Employee_Shifts
    ADD StartTime_2 TIME NULL;
    
    PRINT '✅ Added StartTime_2 column';
END
ELSE
BEGIN
    PRINT 'ℹ️  StartTime_2 column already exists';
END
GO

-- Add EndTime_2 for second slot
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') 
    AND name = 'EndTime_2'
)
BEGIN
    ALTER TABLE dbo.Employee_Shifts
    ADD EndTime_2 TIME NULL;
    
    PRINT '✅ Added EndTime_2 column';
END
ELSE
BEGIN
    PRINT 'ℹ️  EndTime_2 column already exists';
END
GO

-- =============================================
-- Update Stored Procedure: Get Shift by Name
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.GetShiftByName') AND type = 'P')
    DROP PROCEDURE dbo.GetShiftByName;
GO

CREATE PROCEDURE dbo.GetShiftByName
    @ShiftName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        ShiftId,
        ShiftName,
        StartTime,
        EndTime,
        IsSplitShift,
        StartTime_1,
        EndTime_1,
        StartTime_2,
        EndTime_2,
        WorkHours,
        LateThresholdMinutes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Employee_Shifts
    WHERE ShiftName = @ShiftName;
END
GO

PRINT '✅ Updated GetShiftByName stored procedure';
GO

-- =============================================
-- Update Stored Procedure: Get All Shifts
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.GetAllShifts') AND type = 'P')
    DROP PROCEDURE dbo.GetAllShifts;
GO

CREATE PROCEDURE dbo.GetAllShifts
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        ShiftId,
        ShiftName,
        StartTime,
        EndTime,
        IsSplitShift,
        StartTime_1,
        EndTime_1,
        StartTime_2,
        EndTime_2,
        WorkHours,
        LateThresholdMinutes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Employee_Shifts
    ORDER BY ShiftName;
END
GO

PRINT '✅ Updated GetAllShifts stored procedure';
GO

-- =============================================
-- Add Check Constraint
-- =============================================
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_Employee_Shifts_SplitShiftTimes'
)
BEGIN
    ALTER TABLE dbo.Employee_Shifts
    ADD CONSTRAINT CK_Employee_Shifts_SplitShiftTimes CHECK (
        (IsSplitShift = 0) OR 
        (IsSplitShift = 1 AND StartTime_1 IS NOT NULL AND EndTime_1 IS NOT NULL 
         AND StartTime_2 IS NOT NULL AND EndTime_2 IS NOT NULL)
    );
    
    PRINT '✅ Added check constraint for split shift validation';
END
ELSE
BEGIN
    PRINT 'ℹ️  Check constraint already exists';
END
GO

PRINT '';
PRINT '✅ Split Shift Migration completed successfully!';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. To add a split shift, use:';
PRINT '   INSERT INTO Employee_Shifts (ShiftName, StartTime, EndTime, IsSplitShift, StartTime_1, EndTime_1, StartTime_2, EndTime_2, WorkHours, LateThresholdMinutes)';
PRINT '   VALUES (''SPLIT-A'', ''00:00:00'', ''00:00:00'', 1, ''08:00:00'', ''13:00:00'', ''17:00:00'', ''21:00:00'', 9.00, 10);';
PRINT '';
PRINT '2. Existing shifts will continue to work normally (IsSplitShift = 0)';
PRINT '';
PRINT '3. Backend and frontend have been updated to handle split shifts automatically';
GO

