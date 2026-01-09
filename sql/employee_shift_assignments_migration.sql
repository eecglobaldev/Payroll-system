/**
 * Employee Shift Assignments Migration
 * 
 * Purpose: Support date-wise shift assignments for employees
 * - Creates Employee_Shift_Assignments table
 * - Allows multiple shifts per employee within a month
 * - Supports week-wise and single-day shift changes
 * - Maintains backward compatibility with EmployeeDetails.Shift
 * 
 * IMPORTANT: This does NOT modify existing Employee_Shifts or EmployeeDetails tables
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- 1. Create Employee_Shift_Assignments Table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.Employee_Shift_Assignments') AND type = 'U')
BEGIN
    CREATE TABLE dbo.Employee_Shift_Assignments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeCode NVARCHAR(50) NOT NULL,
        ShiftName NVARCHAR(100) NOT NULL,  -- References Employee_Shifts.ShiftName
        FromDate DATE NOT NULL,
        ToDate DATE NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_Employee_Shift_Assignments_DateRange CHECK (FromDate <= ToDate),
        
        -- Foreign key to Employee_Shifts (optional, for data integrity)
        CONSTRAINT FK_Employee_Shift_Assignments_Shift 
            FOREIGN KEY (ShiftName) 
            REFERENCES dbo.Employee_Shifts(ShiftName)
            ON DELETE NO ACTION
            ON UPDATE CASCADE
    );
    
    PRINT '✅ Created Employee_Shift_Assignments table';
END
ELSE
BEGIN
    PRINT 'ℹ️  Employee_Shift_Assignments table already exists';
END
GO

-- =============================================
-- 2. Create Indexes for Performance
-- =============================================

-- Index for querying by employee and date range
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employee_Shift_Assignments_Employee_Date' AND object_id = OBJECT_ID('dbo.Employee_Shift_Assignments'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Employee_Shift_Assignments_Employee_Date
    ON dbo.Employee_Shift_Assignments (EmployeeCode, FromDate, ToDate);
    
    PRINT '✅ Created index IX_Employee_Shift_Assignments_Employee_Date';
END
ELSE
BEGIN
    PRINT 'ℹ️  Index IX_Employee_Shift_Assignments_Employee_Date already exists';
END
GO

-- Index for querying by date range (for bulk operations)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employee_Shift_Assignments_DateRange' AND object_id = OBJECT_ID('dbo.Employee_Shift_Assignments'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Employee_Shift_Assignments_DateRange
    ON dbo.Employee_Shift_Assignments (FromDate, ToDate);
    
    PRINT '✅ Created index IX_Employee_Shift_Assignments_DateRange';
END
ELSE
BEGIN
    PRINT 'ℹ️  Index IX_Employee_Shift_Assignments_DateRange already exists';
END
GO

-- =============================================
-- 3. Create Stored Procedure for Getting Shift for Date
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.sp_GetEmployeeShiftForDate') AND type = 'P')
BEGIN
    DROP PROCEDURE dbo.sp_GetEmployeeShiftForDate;
END
GO

CREATE PROCEDURE dbo.sp_GetEmployeeShiftForDate
    @EmployeeCode NVARCHAR(50),
    @Date DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get the most recent assignment that covers the given date
    -- If multiple assignments overlap, the one with latest CreatedAt takes precedence
    SELECT TOP 1
        ShiftName,
        FromDate,
        ToDate,
        CreatedAt
    FROM dbo.Employee_Shift_Assignments
    WHERE EmployeeCode = @EmployeeCode
        AND @Date >= FromDate
        AND @Date <= ToDate
    ORDER BY CreatedAt DESC;
END
GO

PRINT '✅ Created stored procedure sp_GetEmployeeShiftForDate';
GO

-- =============================================
-- 4. Create Stored Procedure for Getting All Assignments in Range
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.sp_GetEmployeeShiftAssignments') AND type = 'P')
BEGIN
    DROP PROCEDURE dbo.sp_GetEmployeeShiftAssignments;
END
GO

CREATE PROCEDURE dbo.sp_GetEmployeeShiftAssignments
    @EmployeeCode NVARCHAR(50),
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get all assignments that overlap with the given date range
    SELECT
        Id,
        EmployeeCode,
        ShiftName,
        FromDate,
        ToDate,
        CreatedAt
    FROM dbo.Employee_Shift_Assignments
    WHERE EmployeeCode = @EmployeeCode
        AND (
            -- Assignment starts within range
            (FromDate >= @StartDate AND FromDate <= @EndDate)
            -- Assignment ends within range
            OR (ToDate >= @StartDate AND ToDate <= @EndDate)
            -- Assignment completely covers range
            OR (FromDate <= @StartDate AND ToDate >= @EndDate)
        )
    ORDER BY FromDate ASC, CreatedAt DESC;
END
GO

PRINT '✅ Created stored procedure sp_GetEmployeeShiftAssignments';
GO

-- =============================================
-- 5. Verification
-- =============================================
PRINT '';
PRINT '✅ Employee Shift Assignments migration completed successfully!';
PRINT '';
PRINT 'Table: dbo.Employee_Shift_Assignments';
PRINT 'Stored Procedures:';
PRINT '  - sp_GetEmployeeShiftForDate';
PRINT '  - sp_GetEmployeeShiftAssignments';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Use the API to assign shifts to employees';
PRINT '2. The payroll system will automatically use date-wise shifts';
PRINT '3. Existing employees without assignments will use EmployeeDetails.Shift';
PRINT '';

