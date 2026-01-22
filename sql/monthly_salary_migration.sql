-- MonthlySalary Table Migration
-- Stores calculated salary snapshots (single source of truth)
-- Created: 2025-01-XX

-- Create MonthlySalary table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.MonthlySalary') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.MonthlySalary (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeCode NVARCHAR(50) NOT NULL,
        Month NVARCHAR(7) NOT NULL, -- YYYY-MM format
        GrossSalary DECIMAL(10,2) NULL,
        NetSalary DECIMAL(10,2) NULL,
        BaseSalary DECIMAL(10,2) NULL,
        PaidDays DECIMAL(4,2) NULL,
        AbsentDays DECIMAL(4,2) NULL,
        LeaveDays DECIMAL(4,2) NULL,
        TotalDeductions DECIMAL(10,2) NULL,
        TotalAdditions DECIMAL(10,2) NULL,
        IsHeld BIT DEFAULT 0,
        HoldReason NVARCHAR(255) NULL,
        CalculatedAt DATETIME DEFAULT GETDATE(),
        CalculatedBy NVARCHAR(50) NULL,
        
        -- Additional fields for detailed breakdown
        PerDayRate DECIMAL(10,2) NULL,
        TotalWorkedHours DECIMAL(10,2) NULL,
        OvertimeHours DECIMAL(10,2) NULL,
        OvertimeAmount DECIMAL(10,2) NULL,
        TdsDeduction DECIMAL(10,2) NULL,
        ProfessionalTax DECIMAL(10,2) NULL,
        IncentiveAmount DECIMAL(10,2) NULL,
        
        -- JSON field for storing full breakdown (optional, for future extensibility)
        BreakdownJson NVARCHAR(MAX) NULL,
        
        CONSTRAINT UQ_MonthlySalary_EmployeeCode_Month UNIQUE (EmployeeCode, Month)
    );
    
    -- Create indexes for better query performance
    CREATE INDEX IX_MonthlySalary_EmployeeCode ON dbo.MonthlySalary(EmployeeCode);
    CREATE INDEX IX_MonthlySalary_Month ON dbo.MonthlySalary(Month);
    CREATE INDEX IX_MonthlySalary_CalculatedAt ON dbo.MonthlySalary(CalculatedAt);
    
    PRINT 'MonthlySalary table created successfully';
END
ELSE
BEGIN
    PRINT 'MonthlySalary table already exists';
END
GO

