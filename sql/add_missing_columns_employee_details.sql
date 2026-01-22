/**
 * Add Missing Audit Columns to EmployeeDetails Table
 * 
 * This script adds the CreatedBy and UpdatedBy columns if they don't exist
 * 
 * Run this script on your database to fix the "Invalid column name 'UpdatedBy'" error
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- Add CreatedBy column if it doesn't exist
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
               AND name = 'CreatedBy')
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD CreatedBy NVARCHAR(100) NULL;
    
    PRINT 'Added CreatedBy column to EmployeeDetails table';
END
ELSE
BEGIN
    PRINT 'CreatedBy column already exists';
END
GO

-- =============================================
-- Add UpdatedBy column if it doesn't exist
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
               AND name = 'UpdatedBy')
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD UpdatedBy NVARCHAR(100) NULL;
    
    PRINT 'Added UpdatedBy column to EmployeeDetails table';
END
ELSE
BEGIN
    PRINT 'UpdatedBy column already exists';
END
GO

-- =============================================
-- Add Shift column if it doesn't exist
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
               AND name = 'Shift')
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD Shift NVARCHAR(50) NULL;
    
    PRINT 'Added Shift column to EmployeeDetails table';
END
ELSE
BEGIN
    PRINT 'Shift column already exists';
END
GO

-- =============================================
-- Add BankAccNo column if it doesn't exist
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
               AND name = 'BankAccNo')
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD BankAccNo NVARCHAR(50) NULL;
    
    PRINT 'Added BankAccNo column to EmployeeDetails table';
END
ELSE
BEGIN
    PRINT 'BankAccNo column already exists';
END
GO

-- =============================================
-- Add IFSCCode column if it doesn't exist
-- Note: Check for both IFSCcode and IFSCCode variations
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
               AND (name = 'IFSCCode' OR name = 'IFSCcode'))
BEGIN
    ALTER TABLE dbo.EmployeeDetails
    ADD IFSCCode VARCHAR(15) NULL;
    
    PRINT 'Added IFSCCode column to EmployeeDetails table';
END
ELSE IF EXISTS (SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
                AND name = 'IFSCcode')
BEGIN
    -- Rename IFSCcode to IFSCCode if it exists with lowercase 'c'
    EXEC sp_rename 'dbo.EmployeeDetails.IFSCcode', 'IFSCCode', 'COLUMN';
    PRINT 'Renamed IFSCcode to IFSCCode column';
END
ELSE
BEGIN
    PRINT 'IFSCCode column already exists';
END
GO

PRINT '';
PRINT 'Migration completed successfully!';
PRINT 'EmployeeDetails table now has all required columns.';
GO

