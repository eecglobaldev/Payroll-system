/**
 * Fix Employee 3002 Split Shift
 * 
 * Based on attendance logs:
 * - 07:57 IN  (Slot 1 start)
 * - 13:00 OUT (Slot 1 end)
 * - 15:59 IN  (Slot 2 start)
 * - 20:25 OUT (Slot 2 end)
 * 
 * Creating split shift: 08:00-13:00 | 16:00-21:00
 */

USE [etimetracklite1];
GO

-- Step 1: Check if split shift support columns exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') 
    AND name = 'IsSplitShift'
)
BEGIN
    PRINT '❌ ERROR: Split shift columns not found!';
    PRINT '   Please run: sql/add_split_shift_support.sql first';
    RETURN;
END

PRINT '✅ Split shift columns exist';
GO

-- Step 2: Create or update split shift for this pattern
IF EXISTS (SELECT * FROM dbo.Employee_Shifts WHERE ShiftName = 'SPLIT-M')
BEGIN
    PRINT 'Updating existing SPLIT-M shift...';
    
    UPDATE dbo.Employee_Shifts
    SET 
        IsSplitShift = 1,
        StartTime_1 = '08:00:00',
        EndTime_1 = '13:00:00',
        StartTime_2 = '16:00:00',
        EndTime_2 = '21:00:00',
        WorkHours = 10.00,
        LateThresholdMinutes = 10,
        UpdatedAt = GETDATE()
    WHERE ShiftName = 'SPLIT-M';
    
    PRINT '✅ Updated SPLIT-M shift';
END
ELSE
BEGIN
    PRINT 'Creating new SPLIT-M shift...';
    
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
        'SPLIT-M',           -- Shift name: SPLIT-M (Morning+Evening)
        '00:00:00',          -- Not used for split shifts
        '00:00:00',          -- Not used for split shifts
        1,                   -- IsSplitShift = TRUE
        '08:00:00',          -- Slot 1: 8 AM start
        '13:00:00',          -- Slot 1: 1 PM end (5 hours)
        '16:00:00',          -- Slot 2: 4 PM start
        '21:00:00',          -- Slot 2: 9 PM end (5 hours)
        10.00,               -- Total: 10 hours
        10                   -- Late threshold: 10 minutes
    );
    
    PRINT '✅ Created SPLIT-M shift (08:00-13:00 | 16:00-21:00)';
END
GO

-- Step 3: Assign split shift to employee 3002
PRINT '';
PRINT 'Assigning SPLIT-M to employee 3002...';

UPDATE dbo.EmployeeDetails
SET Shift = 'SPLIT-M',
    UpdatedBy = 'Admin',
    UpdatedAt = GETDATE()
WHERE EmployeeCode = '3002';

PRINT '✅ Employee 3002 assigned to SPLIT-M shift';
GO

-- Step 4: Verify configuration
PRINT '';
PRINT '=== Verification ===';
PRINT '';

SELECT 
    ed.EmployeeCode,
    ed.Shift AS AssignedShift,
    es.IsSplitShift,
    CASE 
        WHEN es.IsSplitShift = 1 THEN 
            CONCAT(
                FORMAT(es.StartTime_1, 'HH:mm'), '-', FORMAT(es.EndTime_1, 'HH:mm'),
                ' | ',
                FORMAT(es.StartTime_2, 'HH:mm'), '-', FORMAT(es.EndTime_2, 'HH:mm'),
                ' (', es.WorkHours, ' hours)'
            )
        ELSE 
            CONCAT(FORMAT(es.StartTime, 'HH:mm'), '-', FORMAT(es.EndTime, 'HH:mm'))
    END AS ShiftTiming,
    es.LateThresholdMinutes
FROM dbo.EmployeeDetails ed
LEFT JOIN dbo.Employee_Shifts es ON ed.Shift = es.ShiftName
WHERE ed.EmployeeCode = '3002';

PRINT '';
PRINT '✅ Configuration complete!';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Restart backend server';
PRINT '2. Refresh salary page for employee 3002';
PRINT '3. Check backend logs for split shift calculation';
PRINT '';
GO

