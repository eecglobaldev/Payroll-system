/**
 * Leave Management Migration
 * 
 * Purpose: Add persistent leave tracking to support monthly leave approvals
 * 
 * Changes:
 * 1. Add UsedPaidLeaves and UsedCasualLeaves columns to EmployeeLeaves table
 *    - Tracks cumulative annual usage against AllowedLeaves
 * 
 * 2. Create MonthlyLeaveUsage table
 *    - Tracks month-by-month leave usage for salary calculation
 *    - Stores which specific dates were approved as paid/casual leave
 *    - Persists leave approvals across sessions
 * 
 * Business Rules:
 * - Paid Leave = FULL DAY (no salary deduction)
 * - Casual Leave = HALF DAY (0.5 day credit)
 * - AllowedLeaves is annual entitlement from EmployeeLeaves table
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- STEP 1: Extend EmployeeLeaves table
-- Add columns to track annual used leaves
-- =============================================

-- Check if columns don't exist before adding
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeLeaves') 
               AND name = 'UsedPaidLeaves')
BEGIN
    ALTER TABLE dbo.EmployeeLeaves
    ADD UsedPaidLeaves INT NOT NULL DEFAULT 0;
    
    PRINT 'Added UsedPaidLeaves column to EmployeeLeaves table';
END
ELSE
BEGIN
    PRINT 'UsedPaidLeaves column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeLeaves') 
               AND name = 'UsedCasualLeaves')
BEGIN
    ALTER TABLE dbo.EmployeeLeaves
    ADD UsedCasualLeaves INT NOT NULL DEFAULT 0;
    
    PRINT 'Added UsedCasualLeaves column to EmployeeLeaves table';
END
ELSE
BEGIN
    PRINT 'UsedCasualLeaves column already exists';
END
GO

-- =============================================
-- STEP 2: Create MonthlyLeaveUsage table
-- Stores month-by-month leave approvals
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.objects 
               WHERE object_id = OBJECT_ID('dbo.MonthlyLeaveUsage') 
               AND type = 'U')
BEGIN
    CREATE TABLE dbo.MonthlyLeaveUsage (
        -- Primary Key
        MonthlyLeaveUsageId INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Employee reference (links to Employees table via EmployeeCode, which is the PK)
        EmployeeCode NVARCHAR(50) NOT NULL,
        
        -- Month reference (YYYY-MM format, e.g., '2025-11')
        LeaveMonth VARCHAR(7) NOT NULL,
        
        -- Leave counts for this month
        PaidLeaveDaysUsed INT NOT NULL DEFAULT 0,
        CasualLeaveDaysUsed INT NOT NULL DEFAULT 0,
        
        -- Comma-separated dates for audit trail
        -- e.g., '2025-11-06,2025-11-15' for paid leaves
        PaidLeaveDates VARCHAR(500) NULL,
        CasualLeaveDates VARCHAR(500) NULL,
        
        -- Audit fields
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedBy VARCHAR(100) NULL, -- Admin who approved
        
        -- Ensure one record per employee per month
        CONSTRAINT UQ_MonthlyLeaveUsage_Employee_Month 
            UNIQUE (EmployeeCode, LeaveMonth),
        
        -- Foreign key to Employees table (EmployeeCode is the PK in Employees)
        CONSTRAINT FK_MonthlyLeaveUsage_Employee 
            FOREIGN KEY (EmployeeCode) 
            REFERENCES dbo.Employees(EmployeeCode)
            ON DELETE CASCADE
    );
    
    -- Indexes for performance
    CREATE NONCLUSTERED INDEX IX_MonthlyLeaveUsage_EmployeeCode 
        ON dbo.MonthlyLeaveUsage(EmployeeCode);
    
    CREATE NONCLUSTERED INDEX IX_MonthlyLeaveUsage_LeaveMonth 
        ON dbo.MonthlyLeaveUsage(LeaveMonth);
    
    PRINT 'Created MonthlyLeaveUsage table with indexes';
END
ELSE
BEGIN
    PRINT 'MonthlyLeaveUsage table already exists';
END
GO

-- =============================================
-- STEP 3: Create stored procedure for upserting leave usage
-- Idempotent operation: insert if not exists, update if exists
-- =============================================

IF EXISTS (SELECT * FROM sys.objects 
           WHERE object_id = OBJECT_ID('dbo.UpsertMonthlyLeaveUsage') 
           AND type = 'P')
BEGIN
    DROP PROCEDURE dbo.UpsertMonthlyLeaveUsage;
END
GO

CREATE PROCEDURE dbo.UpsertMonthlyLeaveUsage
    @EmployeeCode NVARCHAR(50),
    @LeaveMonth VARCHAR(7),
    @PaidLeaveDaysUsed INT,
    @CasualLeaveDaysUsed INT,
    @PaidLeaveDates VARCHAR(500) = NULL,
    @CasualLeaveDates VARCHAR(500) = NULL,
    @UpdatedBy VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if record exists
    IF EXISTS (SELECT 1 FROM dbo.MonthlyLeaveUsage 
               WHERE EmployeeCode = @EmployeeCode AND LeaveMonth = @LeaveMonth)
    BEGIN
        -- Update existing record
        UPDATE dbo.MonthlyLeaveUsage
        SET PaidLeaveDaysUsed = @PaidLeaveDaysUsed,
            CasualLeaveDaysUsed = @CasualLeaveDaysUsed,
            PaidLeaveDates = @PaidLeaveDates,
            CasualLeaveDates = @CasualLeaveDates,
            UpdatedAt = GETDATE(),
            UpdatedBy = @UpdatedBy
        WHERE EmployeeCode = @EmployeeCode AND LeaveMonth = @LeaveMonth;
        
        SELECT 'UPDATED' AS Operation;
    END
    ELSE
    BEGIN
        -- Insert new record
        INSERT INTO dbo.MonthlyLeaveUsage 
            (EmployeeCode, LeaveMonth, PaidLeaveDaysUsed, CasualLeaveDaysUsed, 
             PaidLeaveDates, CasualLeaveDates, UpdatedBy)
        VALUES 
            (@EmployeeCode, @LeaveMonth, @PaidLeaveDaysUsed, @CasualLeaveDaysUsed,
             @PaidLeaveDates, @CasualLeaveDates, @UpdatedBy);
        
        SELECT 'INSERTED' AS Operation;
    END
END
GO

PRINT 'Created UpsertMonthlyLeaveUsage stored procedure';
GO

-- =============================================
-- STEP 4: Sample data for testing (optional)
-- =============================================

-- Uncomment to insert sample leave entitlements
/*
-- Ensure some employees have leave entitlements
-- LeaveTypeId: 1 = Paid Leave, 2 = Casual Leave (adjust based on your LeaveType table)

IF NOT EXISTS (SELECT 1 FROM dbo.EmployeeLeaves WHERE EmployeeCode = '1162' AND LeaveYear = 2025)
BEGIN
    INSERT INTO dbo.EmployeeLeaves (EmployeeCode, LeaveTypeId, LeaveYear, AllowedLeaves, UsedPaidLeaves, UsedCasualLeaves)
    VALUES 
        ('1162', 1, 2025, 12, 0, 0); -- 12 days paid leave for employee 1162
END
*/

PRINT 'Leave management migration completed successfully!';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Update the database name at the top of this script';
PRINT '2. Run this script on your SQL Server';
PRINT '3. Implement backend API endpoints to use these tables';
PRINT '4. Update salary calculation to respect leave approvals';
GO

