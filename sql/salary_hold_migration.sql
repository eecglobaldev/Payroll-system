/**
 * Salary Hold Migration
 * 
 * Purpose: Add support for salary hold functionality
 * 
 * Changes:
 * 1. Create SalaryHold table
 *    - Stores manual and automatic salary holds
 *    - Persists across sessions
 *    - Excludes employees from salary summary
 * 
 * Business Rules:
 * - Manual hold: Admin can manually hold salary
 * - Automatic hold: If employee is absent on 1-5 of next month
 * - Held salaries are excluded from salary summary
 * - Admin can release holds
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- STEP 1: Create SalaryHold table
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.objects 
               WHERE object_id = OBJECT_ID('dbo.SalaryHold') 
               AND type = 'U')
BEGIN
    CREATE TABLE dbo.SalaryHold (
        -- Primary Key
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Employee reference (links to EmployeeDetails table via EmployeeCode)
        EmployeeCode NVARCHAR(50) NOT NULL,
        
        -- Month reference (YYYY-MM format, e.g., '2025-11')
        Month NVARCHAR(7) NOT NULL,
        
        -- Hold type: 'MANUAL' or 'AUTO'
        HoldType NVARCHAR(20) NOT NULL,
        
        -- Optional reason for hold
        Reason NVARCHAR(255) NULL,
        
        -- Release status: 0 = held, 1 = released
        IsReleased BIT NOT NULL DEFAULT 0,
        
        -- Timestamps
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        ReleasedAt DATETIME NULL,
        
        -- Action by (admin user who created/released)
        ActionBy NVARCHAR(50) NULL,
        
        -- Ensure one hold per employee per month (unique constraint)
        CONSTRAINT UQ_SalaryHold_Employee_Month 
            UNIQUE (EmployeeCode, Month),
        
        -- Foreign key to EmployeeDetails table
        CONSTRAINT FK_SalaryHold_EmployeeDetails 
            FOREIGN KEY (EmployeeCode) 
            REFERENCES dbo.EmployeeDetails(EmployeeCode)
            ON DELETE CASCADE,
        
        -- Check constraint: HoldType must be 'MANUAL' or 'AUTO'
        CONSTRAINT CK_SalaryHold_HoldType 
            CHECK (HoldType IN ('MANUAL', 'AUTO'))
    );
    
    -- Indexes for performance
    CREATE NONCLUSTERED INDEX IX_SalaryHold_EmployeeCode 
        ON dbo.SalaryHold(EmployeeCode);
    
    CREATE NONCLUSTERED INDEX IX_SalaryHold_Month 
        ON dbo.SalaryHold(Month);
    
    CREATE NONCLUSTERED INDEX IX_SalaryHold_Employee_Month 
        ON dbo.SalaryHold(EmployeeCode, Month);
    
    CREATE NONCLUSTERED INDEX IX_SalaryHold_IsReleased 
        ON dbo.SalaryHold(IsReleased);
    
    PRINT 'Created SalaryHold table with indexes';
END
ELSE
BEGIN
    PRINT 'SalaryHold table already exists';
END
GO

PRINT 'Salary hold migration completed successfully!';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Update the database name at the top of this script';
PRINT '2. Run this script on your SQL Server';
PRINT '3. Implement backend API endpoints to use this table';
PRINT '4. Update salary summary to exclude held salaries';
GO

