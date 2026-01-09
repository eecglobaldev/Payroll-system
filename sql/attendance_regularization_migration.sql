-- =====================================================
-- Attendance Regularization Migration
-- =====================================================
-- Purpose: Store attendance regularizations (Absent/Half-Day → Full-Day)
-- Version: 1.0
-- Date: 2025-12-25
-- =====================================================

USE eTimeTrackLite;
GO

-- Create AttendanceRegularization table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AttendanceRegularization')
BEGIN
    CREATE TABLE dbo.AttendanceRegularization (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeCode NVARCHAR(20) NOT NULL,
        RegularizationDate DATE NOT NULL,
        OriginalStatus NVARCHAR(20) NOT NULL, -- 'absent' or 'half-day'
        RegularizedStatus NVARCHAR(20) NOT NULL DEFAULT 'full-day', -- 'full-day' (present)
        Month NVARCHAR(7) NOT NULL, -- 'YYYY-MM'
        Reason NVARCHAR(255) NULL,
        RequestedBy NVARCHAR(50) NULL,
        ApprovedBy NVARCHAR(50) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'APPROVED', -- 'APPROVED', 'PENDING', 'REJECTED'
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        -- Ensure one regularization per employee per date
        CONSTRAINT UQ_AttendanceRegularization_EmployeeDate 
            UNIQUE (EmployeeCode, RegularizationDate)
    );
    
    PRINT '✓ Table AttendanceRegularization created successfully';
END
ELSE
BEGIN
    PRINT '⚠ Table AttendanceRegularization already exists';
END
GO

-- Create indexes for performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AttendanceRegularization_EmployeeMonth' AND object_id = OBJECT_ID('dbo.AttendanceRegularization'))
BEGIN
    CREATE INDEX IX_AttendanceRegularization_EmployeeMonth 
        ON dbo.AttendanceRegularization(EmployeeCode, Month);
    PRINT '✓ Index IX_AttendanceRegularization_EmployeeMonth created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AttendanceRegularization_Status' AND object_id = OBJECT_ID('dbo.AttendanceRegularization'))
BEGIN
    CREATE INDEX IX_AttendanceRegularization_Status 
        ON dbo.AttendanceRegularization(Status);
    PRINT '✓ Index IX_AttendanceRegularization_Status created';
END
GO

PRINT '=====================================================';
PRINT 'Attendance Regularization Migration Completed';
PRINT '=====================================================';
GO

