USE [etimetracklite1]; -- Replace with your actual database name
GO

PRINT '--- Checking Leave Data Format Issues ---';
PRINT '';

-- Check for employees with problematic leave data
SELECT 
    EmployeeCode,
    Month,
    PaidLeaveDates,
    CasualLeaveDates,
    CASE 
        WHEN PaidLeaveDates IS NOT NULL AND PaidLeaveDates <> '' 
             AND LEFT(PaidLeaveDates, 1) <> '[' 
        THEN 'INVALID JSON (PaidLeave)'
        WHEN CasualLeaveDates IS NOT NULL AND CasualLeaveDates <> '' 
             AND LEFT(CasualLeaveDates, 1) <> '[' 
        THEN 'INVALID JSON (CasualLeave)'
        ELSE 'OK'
    END AS Status
FROM dbo.MonthlyLeaveUsage
WHERE EmployeeCode IN ('1162', '1353', '1457', '1461', '1464', '1466', '8161')
  AND Month = '2025-11'
ORDER BY EmployeeCode;

PRINT '';
PRINT '--- Checking all November 2025 leave data ---';

SELECT 
    COUNT(*) AS TotalRecords,
    SUM(CASE WHEN PaidLeaveDates IS NOT NULL AND PaidLeaveDates <> '' 
             AND LEFT(PaidLeaveDates, 1) <> '[' THEN 1 ELSE 0 END) AS InvalidPaidLeave,
    SUM(CASE WHEN CasualLeaveDates IS NOT NULL AND CasualLeaveDates <> '' 
             AND LEFT(CasualLeaveDates, 1) <> '[' THEN 1 ELSE 0 END) AS InvalidCasualLeave
FROM dbo.MonthlyLeaveUsage
WHERE Month = '2025-11';

