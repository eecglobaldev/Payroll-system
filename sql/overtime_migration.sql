-- =============================================
-- Overtime Management Migration
-- Creates MonthlyOT table for overtime toggle per employee per month
-- =============================================

-- Create MonthlyOT table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.MonthlyOT') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.MonthlyOT (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeCode NVARCHAR(20) NOT NULL,
        Month NVARCHAR(7) NOT NULL, -- Format: YYYY-MM
        IsOvertimeEnabled BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        -- Unique constraint: one record per employee per month
        CONSTRAINT UQ_MonthlyOT_EmployeeCode_Month UNIQUE (EmployeeCode, Month)
    );
    
    -- Create index for faster lookups
    CREATE INDEX IX_MonthlyOT_EmployeeCode_Month ON dbo.MonthlyOT(EmployeeCode, Month);
    
    PRINT 'MonthlyOT table created successfully';
END
ELSE
BEGIN
    PRINT 'MonthlyOT table already exists';
END
GO

-- =============================================
-- Stored Procedure: Get Overtime Status
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.sp_GetMonthlyOT') AND type in (N'P'))
    DROP PROCEDURE dbo.sp_GetMonthlyOT;
GO

CREATE PROCEDURE dbo.sp_GetMonthlyOT
    @EmployeeCode NVARCHAR(20),
    @Month NVARCHAR(7)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        Id,
        EmployeeCode,
        Month,
        IsOvertimeEnabled,
        CreatedAt,
        UpdatedAt
    FROM dbo.MonthlyOT
    WHERE EmployeeCode = @EmployeeCode 
      AND Month = @Month;
END
GO

-- =============================================
-- Stored Procedure: Upsert Overtime Status
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.sp_UpsertMonthlyOT') AND type in (N'P'))
    DROP PROCEDURE dbo.sp_UpsertMonthlyOT;
GO

CREATE PROCEDURE dbo.sp_UpsertMonthlyOT
    @EmployeeCode NVARCHAR(20),
    @Month NVARCHAR(7),
    @IsOvertimeEnabled BIT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if record exists
    IF EXISTS (SELECT 1 FROM dbo.MonthlyOT WHERE EmployeeCode = @EmployeeCode AND Month = @Month)
    BEGIN
        -- Update existing record
        UPDATE dbo.MonthlyOT
        SET IsOvertimeEnabled = @IsOvertimeEnabled,
            UpdatedAt = GETDATE()
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month;
        
        SELECT 'updated' AS Operation;
    END
    ELSE
    BEGIN
        -- Insert new record
        INSERT INTO dbo.MonthlyOT (EmployeeCode, Month, IsOvertimeEnabled, CreatedAt)
        VALUES (@EmployeeCode, @Month, @IsOvertimeEnabled, GETDATE());
        
        SELECT 'created' AS Operation;
    END
END
GO

PRINT 'Overtime migration completed successfully';
GO

