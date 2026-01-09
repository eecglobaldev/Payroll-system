/**
 * Shift Management Migration
 * 
 * Purpose: Support multiple shifts with different timings
 * - Creates Employee_Shifts table to store shift names and timings
 * - Adds Shift column to EmployeeDetails table
 * - Enables dynamic shift-based attendance and salary calculations
 * 
 * IMPORTANT: After running this migration, populate the Employee_Shifts table
 * with data from the "All Shift Time.pdf" file using the template
 * in sql/insert_shifts_template.sql
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- 1. Create Employee_Shifts Table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.Employee_Shifts') AND type = 'U')
BEGIN
    CREATE TABLE dbo.Employee_Shifts (
        ShiftId INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName NVARCHAR(100) NOT NULL UNIQUE, -- e.g., "D", "B", "C", "W"
        StartTime TIME NOT NULL, -- e.g., "10:00:00" for 10:00 AM
        EndTime TIME NOT NULL, -- e.g., "19:00:00" for 7:00 PM
        WorkHours DECIMAL(4,2) NOT NULL, -- e.g., 9.00 for 9 hours
        LateThresholdMinutes INT NOT NULL DEFAULT 10, -- Minutes after start time to be considered late (default 10 min)
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        CONSTRAINT CK_Employee_Shifts_WorkHours CHECK (WorkHours > 0 AND WorkHours <= 24),
        CONSTRAINT CK_Employee_Shifts_LateThreshold CHECK (LateThresholdMinutes >= 0)
    );
    
    PRINT '✅ Created Employee_Shifts table';
END
ELSE
BEGIN
    PRINT 'ℹ️  Employee_Shifts table already exists';
END
GO

-- =============================================
-- 2. Create Index on ShiftName for quick lookups
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employee_Shifts_ShiftName' AND object_id = OBJECT_ID('dbo.Employee_Shifts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Employee_Shifts_ShiftName 
    ON dbo.Employee_Shifts(ShiftName);
    PRINT '✅ Created index on ShiftName';
END
GO

-- =============================================
-- 3. Add Shift Column to EmployeeDetails Table
-- =============================================
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
    AND name = 'Shift'
)
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD Shift NVARCHAR(100) NULL; -- References Employee_Shifts.ShiftName
    
    PRINT '✅ Added Shift column to EmployeeDetails table';
END
ELSE
BEGIN
    PRINT 'ℹ️  Shift column already exists in EmployeeDetails table';
END
GO

-- =============================================
-- 4. Add Foreign Key Constraint (Optional - can be added after data is populated)
-- =============================================
-- Uncomment this after populating Employee_Shifts table:
/*
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_EmployeeDetails_Employee_Shifts'
)
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD CONSTRAINT FK_EmployeeDetails_Employee_Shifts
    FOREIGN KEY (Shift) REFERENCES dbo.Employee_Shifts(ShiftName);
    
    PRINT '✅ Added foreign key constraint FK_EmployeeDetails_Employee_Shifts';
END
GO
*/

-- =============================================
-- 5. Create Stored Procedure: Get Shift by Name
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
        WorkHours,
        LateThresholdMinutes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Employee_Shifts
    WHERE ShiftName = @ShiftName;
END
GO

-- =============================================
-- 6. Create Stored Procedure: Get All Shifts
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
        WorkHours,
        LateThresholdMinutes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Employee_Shifts
    ORDER BY ShiftName;
END
GO

PRINT '';
PRINT '✅ Shift management migration completed successfully!';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Populate Employee_Shifts table using sql/insert_shifts_data.sql';
PRINT '2. Update EmployeeDetails.Shift column for existing employees';
PRINT '3. Test the shift-based calculations';
GO

