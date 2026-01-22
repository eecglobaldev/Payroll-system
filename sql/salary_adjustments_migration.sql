/**
 * Salary Adjustments Migration
 * 
 * Purpose: Add support for salary deductions and additions
 * 
 * Changes:
 * 1. Create SalaryAdjustments table
 *    - Stores deductions (e.g., T-shirt cost)
 *    - Stores additions (e.g., reimbursements)
 *    - Persists across sessions
 *    - Affects net salary calculation
 * 
 * Business Rules:
 * - Deductions reduce net salary
 * - Additions increase net salary
 * - One adjustment per employee per month per type per category
 * - Amount must be >= 0
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- STEP 1: Create SalaryAdjustments table
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.objects 
               WHERE object_id = OBJECT_ID('dbo.SalaryAdjustments') 
               AND type = 'U')
BEGIN
    CREATE TABLE dbo.SalaryAdjustments (
        -- Primary Key
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Employee reference (links to EmployeeDetails table via EmployeeCode)
        EmployeeCode NVARCHAR(50) NOT NULL,
        
        -- Month reference (YYYY-MM format, e.g., '2025-11')
        Month NVARCHAR(7) NOT NULL,
        
        -- Adjustment type: 'DEDUCTION' or 'ADDITION'
        Type NVARCHAR(20) NOT NULL,
        
        -- Category: 'T_SHIRT', 'REIMBURSEMENT', etc.
        Category NVARCHAR(50) NOT NULL,
        
        -- Amount (must be >= 0)
        Amount DECIMAL(10,2) NOT NULL,
        
        -- Optional description
        Description NVARCHAR(255) NULL,
        
        -- Audit fields
        CreatedBy NVARCHAR(50) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        
        -- Ensure one adjustment per employee per month per type per category
        CONSTRAINT UQ_SalaryAdjustments_Employee_Month_Type_Category 
            UNIQUE (EmployeeCode, Month, Type, Category),
        
        -- Foreign key to EmployeeDetails table
        CONSTRAINT FK_SalaryAdjustments_EmployeeDetails 
            FOREIGN KEY (EmployeeCode) 
            REFERENCES dbo.EmployeeDetails(EmployeeCode)
            ON DELETE CASCADE,
        
        -- Check constraint: Type must be 'DEDUCTION' or 'ADDITION'
        CONSTRAINT CK_SalaryAdjustments_Type 
            CHECK (Type IN ('DEDUCTION', 'ADDITION')),
        
        -- Check constraint: Amount must be >= 0
        CONSTRAINT CK_SalaryAdjustments_Amount 
            CHECK (Amount >= 0)
    );
    
    -- Indexes for performance
    CREATE NONCLUSTERED INDEX IX_SalaryAdjustments_EmployeeCode 
        ON dbo.SalaryAdjustments(EmployeeCode);
    
    CREATE NONCLUSTERED INDEX IX_SalaryAdjustments_Month 
        ON dbo.SalaryAdjustments(Month);
    
    CREATE NONCLUSTERED INDEX IX_SalaryAdjustments_Employee_Month 
        ON dbo.SalaryAdjustments(EmployeeCode, Month);
    
    PRINT 'Created SalaryAdjustments table with indexes';
END
ELSE
BEGIN
    PRINT 'SalaryAdjustments table already exists';
END
GO

-- =============================================
-- STEP 2: Create stored procedure for upserting adjustments
-- Idempotent operation: insert if not exists, update if exists
-- =============================================

IF EXISTS (SELECT * FROM sys.objects 
           WHERE object_id = OBJECT_ID('dbo.UpsertSalaryAdjustment') 
           AND type = 'P')
BEGIN
    DROP PROCEDURE dbo.UpsertSalaryAdjustment;
END
GO

CREATE PROCEDURE dbo.UpsertSalaryAdjustment
    @EmployeeCode NVARCHAR(50),
    @Month NVARCHAR(7),
    @Type NVARCHAR(20),
    @Category NVARCHAR(50),
    @Amount DECIMAL(10,2),
    @Description NVARCHAR(255) = NULL,
    @CreatedBy NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Validate Type
    IF @Type NOT IN ('DEDUCTION', 'ADDITION')
    BEGIN
        RAISERROR('Type must be DEDUCTION or ADDITION', 16, 1);
        RETURN;
    END
    
    -- Validate Amount
    IF @Amount < 0
    BEGIN
        RAISERROR('Amount must be >= 0', 16, 1);
        RETURN;
    END
    
    -- Check if record exists
    IF EXISTS (SELECT 1 FROM dbo.SalaryAdjustments 
               WHERE EmployeeCode = @EmployeeCode 
                 AND Month = @Month 
                 AND Type = @Type 
                 AND Category = @Category)
    BEGIN
        -- Update existing record
        UPDATE dbo.SalaryAdjustments
        SET Amount = @Amount,
            Description = @Description,
            UpdatedAt = GETDATE()
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month 
          AND Type = @Type 
          AND Category = @Category;
        
        SELECT 'UPDATED' AS Operation;
    END
    ELSE
    BEGIN
        -- Insert new record
        INSERT INTO dbo.SalaryAdjustments 
            (EmployeeCode, Month, Type, Category, Amount, Description, CreatedBy)
        VALUES 
            (@EmployeeCode, @Month, @Type, @Category, @Amount, @Description, @CreatedBy);
        
        SELECT 'INSERTED' AS Operation;
    END
END
GO

PRINT 'Created UpsertSalaryAdjustment stored procedure';
GO

PRINT 'Salary adjustments migration completed successfully!';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Update the database name at the top of this script';
PRINT '2. Run this script on your SQL Server';
PRINT '3. Implement backend API endpoints to use this table';
PRINT '4. Update salary calculation to include adjustments';
GO

