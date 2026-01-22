/**
 * Check Bank Account Columns in EmployeeDetails Table
 * 
 * This script checks if BankAccNo and IFSCCode columns exist
 * and shows sample data to verify if values are populated
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

PRINT '================================================';
PRINT 'Checking BankAccNo and IFSCCode columns...';
PRINT '================================================';
PRINT '';

-- Check if BankAccNo column exists
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
           AND name = 'BankAccNo')
BEGIN
    PRINT '✅ BankAccNo column EXISTS';
    
    -- Check if it has any non-null values
    DECLARE @BankAccCount INT;
    SELECT @BankAccCount = COUNT(*) 
    FROM dbo.EmployeeDetails 
    WHERE BankAccNo IS NOT NULL AND BankAccNo <> '';
    
    PRINT '   - Records with BankAccNo: ' + CAST(@BankAccCount AS NVARCHAR(10));
END
ELSE
BEGIN
    PRINT '❌ BankAccNo column DOES NOT EXIST';
    PRINT '   - Run: sql/add_missing_columns_employee_details.sql';
END
GO

-- Check if IFSCCode column exists
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
           AND (name = 'IFSCCode' OR name = 'IFSCcode'))
BEGIN
    PRINT '✅ IFSCCode column EXISTS';
    
    -- Check if it has any non-null values
    DECLARE @IFSCCount INT;
    
    -- Try IFSCCode first
    IF EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') 
               AND name = 'IFSCCode')
    BEGIN
        SELECT @IFSCCount = COUNT(*) 
        FROM dbo.EmployeeDetails 
        WHERE IFSCCode IS NOT NULL AND IFSCCode <> '';
        
        PRINT '   - Column name: IFSCCode';
    END
    ELSE
    BEGIN
        SELECT @IFSCCount = COUNT(*) 
        FROM dbo.EmployeeDetails 
        WHERE IFSCcode IS NOT NULL AND IFSCcode <> '';
        
        PRINT '   - Column name: IFSCcode';
    END
    
    PRINT '   - Records with IFSCCode: ' + CAST(@IFSCCount AS NVARCHAR(10));
END
ELSE
BEGIN
    PRINT '❌ IFSCCode column DOES NOT EXIST';
    PRINT '   - Run: sql/add_missing_columns_employee_details.sql';
END
GO

PRINT '';
PRINT '================================================';
PRINT 'Sample Data (First 5 Records):';
PRINT '================================================';

-- Show sample data
SELECT TOP 5
    EmployeeCode,
    BranchLocation AS Center,
    BankAccNo AS AccountNumber,
    IFSCCode AS IFSC_Code
FROM dbo.EmployeeDetails
ORDER BY EmployeeCode;
GO

PRINT '';
PRINT '================================================';
PRINT 'Summary:';
PRINT '================================================';
PRINT '';
PRINT 'If columns are MISSING:';
PRINT '  1. Run: sql/add_missing_columns_employee_details.sql';
PRINT '  2. Restart backend server';
PRINT '';
PRINT 'If columns EXIST but have no data:';
PRINT '  1. Populate bank account data in EmployeeDetails table';
PRINT '  2. Update records with BankAccNo and IFSCCode values';
PRINT '';
GO

