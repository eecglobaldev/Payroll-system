USE [etimetracklite1]; -- Replace with your actual database name
GO

PRINT '--- Fixing Invalid Leave Data Format ---';
PRINT '';

-- Fix PaidLeaveDates: Convert to JSON arrays
-- Handles both single dates (2025-11-06) and comma-separated (2025-11-22,2025-11-12)
UPDATE dbo.MonthlyLeaveUsage
SET PaidLeaveDates = '["' + REPLACE(PaidLeaveDates, ',', '","') + '"]'
WHERE PaidLeaveDates IS NOT NULL 
  AND PaidLeaveDates <> ''
  AND LEFT(PaidLeaveDates, 1) <> '[';

PRINT 'Fixed PaidLeaveDates: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' records';

-- Fix CasualLeaveDates: Convert to JSON arrays
-- Handles both single dates (2025-11-06) and comma-separated (2025-11-22,2025-11-12)
UPDATE dbo.MonthlyLeaveUsage
SET CasualLeaveDates = '["' + REPLACE(CasualLeaveDates, ',', '","') + '"]'
WHERE CasualLeaveDates IS NOT NULL 
  AND CasualLeaveDates <> ''
  AND LEFT(CasualLeaveDates, 1) <> '[';

PRINT 'Fixed CasualLeaveDates: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' records';

PRINT '';
PRINT '--- Verification: Check fixed data ---';

SELECT 
    EmployeeCode,
    Month,
    PaidLeaveDates,
    CasualLeaveDates
FROM dbo.MonthlyLeaveUsage
WHERE EmployeeCode IN ('1162', '1353', '1457', '1461', '1464', '1466', '8161')
  AND Month = '2025-11'
ORDER BY EmployeeCode;

PRINT '';
PRINT '✅ Leave data format fixed! Restart backend server and refresh Salary Summary.';

