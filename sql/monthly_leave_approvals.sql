/**
 * Monthly Leave Approvals Table
 * Stores approved paid leave and casual leave data per employee per month
 * This is the single source of truth for leave approvals in payroll calculations
 */

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MonthlyLeaveApprovals]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MonthlyLeaveApprovals] (
        [LeaveApprovalId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        
        -- Employee identification
        [EmployeeCode] NVARCHAR(50) NOT NULL,
        
        -- Month in YYYY-MM format (e.g., '2025-11')
        [Month] NVARCHAR(7) NOT NULL,
        
        -- Leave data stored as comma-separated dates (YYYY-MM-DD format)
        -- Paid Leave: Full day salary (no deduction)
        [PaidLeaveDates] NVARCHAR(MAX) NULL,
        
        -- Casual Leave: Half day salary (0.5 day credit)
        [CasualLeaveDates] NVARCHAR(MAX) NULL,
        
        -- Loss of Pay days (unapproved absences)
        [LossOfPayDays] INT DEFAULT 0,
        
        -- Audit fields
        [ApprovedBy] NVARCHAR(255) NULL,
        [ApprovedAt] DATETIME DEFAULT GETDATE(),
        [Remarks] NVARCHAR(500) NULL,
        
        -- Timestamps
        [CreatedAt] DATETIME DEFAULT GETDATE(),
        [UpdatedAt] DATETIME DEFAULT GETDATE(),
        
        -- Ensure one record per employee per month
        CONSTRAINT [UQ_MonthlyLeaveApprovals_Employee_Month] UNIQUE ([EmployeeCode], [Month])
    );
    
    -- Index for fast lookups by employee code
    CREATE INDEX [IX_MonthlyLeaveApprovals_EmployeeCode] 
    ON [dbo].[MonthlyLeaveApprovals] ([EmployeeCode]);
    
    -- Index for fast lookups by month
    CREATE INDEX [IX_MonthlyLeaveApprovals_Month] 
    ON [dbo].[MonthlyLeaveApprovals] ([Month]);
    
    -- Composite index for common query pattern (employee + month)
    CREATE INDEX [IX_MonthlyLeaveApprovals_EmployeeCode_Month] 
    ON [dbo].[MonthlyLeaveApprovals] ([EmployeeCode], [Month]);
    
    PRINT 'Table [dbo].[MonthlyLeaveApprovals] created successfully';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[MonthlyLeaveApprovals] already exists';
END
GO

