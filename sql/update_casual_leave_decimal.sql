/**
 * Migration: Update CasualLeaveDaysUsed to DECIMAL
 * 
 * Purpose: Support storing 0.5 for half-day leaves and 1.0 for absent days
 * 
 * Changes:
 * 1. Alter MonthlyLeaveUsage.CasualLeaveDaysUsed from INT to DECIMAL(5,2)
 * 2. Update stored procedure parameter type to DECIMAL(5,2)
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- STEP 1: Update MonthlyLeaveUsage table column
-- Change CasualLeaveDaysUsed from INT to DECIMAL(5,2)
-- =============================================

IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.MonthlyLeaveUsage') 
           AND name = 'CasualLeaveDaysUsed'
           AND system_type_id = 56) -- 56 = INT type
BEGIN
    ALTER TABLE dbo.MonthlyLeaveUsage
    ALTER COLUMN CasualLeaveDaysUsed DECIMAL(5,2) NOT NULL DEFAULT 0;
    
    PRINT 'Updated CasualLeaveDaysUsed column to DECIMAL(5,2)';
END
ELSE
BEGIN
    PRINT 'CasualLeaveDaysUsed column already DECIMAL or does not exist';
END
GO

-- =============================================
-- STEP 2: Update stored procedure parameter
-- Change @CasualLeaveDaysUsed parameter to DECIMAL(5,2)
-- =============================================

IF EXISTS (SELECT * FROM sys.objects 
           WHERE object_id = OBJECT_ID('dbo.UpsertMonthlyLeaveUsage') 
           AND type = 'P')
BEGIN
    DROP PROCEDURE dbo.UpsertMonthlyLeaveUsage;
    PRINT 'Dropped existing UpsertMonthlyLeaveUsage stored procedure';
END
GO

CREATE PROCEDURE dbo.UpsertMonthlyLeaveUsage
    @EmployeeCode NVARCHAR(50),
    @LeaveMonth VARCHAR(7),
    @PaidLeaveDaysUsed INT,
    @CasualLeaveDaysUsed DECIMAL(5,2), -- Changed from INT to DECIMAL(5,2)
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

PRINT 'Updated UpsertMonthlyLeaveUsage stored procedure with DECIMAL parameter';
GO

-- =============================================
-- STEP 3: Update EmployeeLeaves table column
-- Change UsedCasualLeaves from INT to DECIMAL(5,2)
-- This tracks annual cumulative casual leave usage
-- =============================================

IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.EmployeeLeaves') 
           AND name = 'UsedCasualLeaves'
           AND system_type_id = 56) -- 56 = INT type
BEGIN
    ALTER TABLE dbo.EmployeeLeaves
    ALTER COLUMN UsedCasualLeaves DECIMAL(5,2) NOT NULL DEFAULT 0;
    
    PRINT 'Updated EmployeeLeaves.UsedCasualLeaves column to DECIMAL(5,2)';
END
ELSE
BEGIN
    PRINT 'UsedCasualLeaves column already DECIMAL or does not exist';
END
GO

