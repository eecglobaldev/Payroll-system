-- Add Status column to MonthlySalary table
-- Status: 0 = DRAFT, 1 = FINALIZED
-- Created: 2025-01-XX

-- Check if Status column already exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.MonthlySalary') 
    AND name = 'Status'
)
BEGIN
    -- Add Status column with default value 0 (DRAFT)
    ALTER TABLE dbo.MonthlySalary
    ADD Status TINYINT NOT NULL DEFAULT 0;
    
    -- Create index for better query performance on Status
    CREATE INDEX IX_MonthlySalary_Status ON dbo.MonthlySalary(Status);
    
    -- Create composite index for employee queries with status
    CREATE INDEX IX_MonthlySalary_EmployeeCode_Status ON dbo.MonthlySalary(EmployeeCode, Status);
    
    PRINT 'Status column added to MonthlySalary table successfully';
END
ELSE
BEGIN
    PRINT 'Status column already exists in MonthlySalary table';
END
GO

