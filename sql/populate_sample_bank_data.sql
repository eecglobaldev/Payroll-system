/**
 * Populate Sample Bank Account Data
 * 
 * This script adds sample bank account numbers and IFSC codes
 * for testing the Excel download functionality
 * 
 * ⚠️ IMPORTANT: Replace with actual employee bank details in production
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

PRINT '================================================';
PRINT 'Populating Sample Bank Account Data...';
PRINT '================================================';
PRINT '';

-- Update employees with sample bank account data
-- Replace these with actual bank account details

-- Sample IFSC codes for different banks:
-- SBIN0001234 - State Bank of India
-- HDFC0001234 - HDFC Bank
-- ICIC0001234 - ICICI Bank
-- AXIS0001234 - Axis Bank
-- PUNB0001234 - Punjab National Bank

UPDATE dbo.EmployeeDetails
SET 
    BankAccNo = '1234567890' + CAST(EmployeeDetailsId AS NVARCHAR(10)),
    IFSCCode = 'SBIN0001234'
WHERE BankAccNo IS NULL OR BankAccNo = '';

PRINT 'Updated ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' records with sample bank account data';
PRINT '';

-- Verify the update
SELECT TOP 10
    EmployeeCode,
    BranchLocation AS Center,
    BankAccNo AS AccountNumber,
    IFSCCode AS IFSC_Code
FROM dbo.EmployeeDetails
ORDER BY EmployeeCode;

PRINT '';
PRINT '================================================';
PRINT 'Sample Data Populated Successfully!';
PRINT '================================================';
PRINT '';
PRINT '⚠️ IMPORTANT:';
PRINT '  - These are SAMPLE values for testing';
PRINT '  - Replace with ACTUAL bank account details';
PRINT '  - Update BankAccNo and IFSCCode for each employee';
PRINT '';
PRINT 'Next Steps:';
PRINT '  1. Restart backend server';
PRINT '  2. Refresh admin portal';
PRINT '  3. Download Excel to verify columns are populated';
PRINT '';
GO

