/**
 * EmployeeDetails Table - HR and Salary Data
 * 
 * Purpose: Replace Excel as the source of employee salary and HR data
 * 
 * IMPORTANT BUSINESS RULES:
 * - employeeCode MUST match Employees.EmployeeCode (existing table)
 * - Do NOT delete employees; use exitDate for inactive employees
 * - This table is the SINGLE source of truth for salary calculations
 * 
 * Migration Strategy:
 * 1. Create this table
 * 2. Import existing Excel data into this table
 * 3. Update APIs to read from this table instead of Excel
 * 4. Remove Excel dependency from salary calculations
 */

USE [etimetracklite1]; -- Replace with your actual database name
GO

-- =============================================
-- Drop table if exists (only for development)
-- =============================================
-- IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('dbo.EmployeeDetails') AND type = 'U')
-- BEGIN
--     DROP TABLE dbo.EmployeeDetails;
--     PRINT 'Dropped existing EmployeeDetails table';
-- END
-- GO

-- =============================================
-- Create EmployeeDetails Table
-- =============================================
CREATE TABLE dbo.EmployeeDetails (
    -- Primary Key
    EmployeeDetailsId INT IDENTITY(1,1) PRIMARY KEY,
    
    -- Employee Identification (MUST match Employees.EmployeeCode)
    EmployeeCode NVARCHAR(50) NOT NULL UNIQUE,
    
    -- HR Information
    JoiningDate DATE NULL,
    ExitDate DATE NULL, -- NULL = active employee; NOT NULL = exited employee
    BranchLocation NVARCHAR(100) NULL,
    Department NVARCHAR(100) NULL,
    Designation NVARCHAR(100) NULL,
    
    -- Salary Information (in INR)
    BasicSalary DECIMAL(18, 2) NOT NULL DEFAULT 0, -- Monthly basic salary
    MonthlyCTC DECIMAL(18, 2) NULL, -- Monthly Cost to Company
    AnnualCTC DECIMAL(18, 2) NULL, -- Annual Cost to Company
    
    -- Personal Information
    Gender NVARCHAR(10) NULL, -- 'Male', 'Female', 'Other'
    PhoneNumber NVARCHAR(20) NULL,
    
    -- Audit Fields
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CreatedBy NVARCHAR(100) NULL, -- Admin who created the record
    UpdatedBy NVARCHAR(100) NULL, -- Admin who last updated
    
    -- Constraints
    CONSTRAINT CK_EmployeeDetails_BasicSalary CHECK (BasicSalary >= 0),
    CONSTRAINT CK_EmployeeDetails_MonthlyCTC CHECK (MonthlyCTC IS NULL OR MonthlyCTC >= 0),
    CONSTRAINT CK_EmployeeDetails_AnnualCTC CHECK (AnnualCTC IS NULL OR AnnualCTC >= 0),
    CONSTRAINT CK_EmployeeDetails_ExitDate CHECK (ExitDate IS NULL OR ExitDate >= JoiningDate)
);
GO

-- =============================================
-- Create Indexes for Performance
-- =============================================

-- Index on EmployeeCode (most common query)
CREATE NONCLUSTERED INDEX IX_EmployeeDetails_EmployeeCode 
ON dbo.EmployeeDetails(EmployeeCode);
GO

-- Index on Department (for department-wise queries)
CREATE NONCLUSTERED INDEX IX_EmployeeDetails_Department 
ON dbo.EmployeeDetails(Department);
GO

-- Index on ExitDate (to filter active vs exited employees)
CREATE NONCLUSTERED INDEX IX_EmployeeDetails_ExitDate 
ON dbo.EmployeeDetails(ExitDate);
GO

-- =============================================
-- Create Stored Procedures
-- =============================================

/**
 * SP: Get Employee Details by EmployeeCode
 */
CREATE PROCEDURE dbo.GetEmployeeDetails
    @EmployeeCode NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        EmployeeDetailsId,
        EmployeeCode,
        JoiningDate,
        ExitDate,
        BranchLocation,
        Department,
        Designation,
        BasicSalary,
        MonthlyCTC,
        AnnualCTC,
        Gender,
        PhoneNumber,
        CreatedAt,
        UpdatedAt,
        CreatedBy,
        UpdatedBy
    FROM dbo.EmployeeDetails
    WHERE EmployeeCode = @EmployeeCode;
END
GO

/**
 * SP: Get All Active Employees (ExitDate IS NULL)
 */
CREATE PROCEDURE dbo.GetAllActiveEmployeeDetails
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        EmployeeDetailsId,
        EmployeeCode,
        JoiningDate,
        ExitDate,
        BranchLocation,
        Department,
        Designation,
        BasicSalary,
        MonthlyCTC,
        AnnualCTC,
        Gender,
        PhoneNumber,
        CreatedAt,
        UpdatedAt,
        CreatedBy,
        UpdatedBy
    FROM dbo.EmployeeDetails
    WHERE ExitDate IS NULL
    ORDER BY EmployeeCode;
END
GO

/**
 * SP: Insert New Employee Details
 * Validates that EmployeeCode exists in Employees table
 */
CREATE PROCEDURE dbo.InsertEmployeeDetails
    @EmployeeCode NVARCHAR(50),
    @JoiningDate DATE = NULL,
    @BranchLocation NVARCHAR(100) = NULL,
    @Department NVARCHAR(100) = NULL,
    @Designation NVARCHAR(100) = NULL,
    @BasicSalary DECIMAL(18, 2),
    @MonthlyCTC DECIMAL(18, 2) = NULL,
    @AnnualCTC DECIMAL(18, 2) = NULL,
    @Gender NVARCHAR(10) = NULL,
    @PhoneNumber NVARCHAR(20) = NULL,
    @CreatedBy NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Validate that EmployeeCode exists in Employees table
    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeCode = @EmployeeCode)
    BEGIN
        RAISERROR('EmployeeCode %s does not exist in Employees table', 16, 1, @EmployeeCode);
        RETURN;
    END
    
    -- Check for duplicate EmployeeCode in EmployeeDetails
    IF EXISTS (SELECT 1 FROM dbo.EmployeeDetails WHERE EmployeeCode = @EmployeeCode)
    BEGIN
        RAISERROR('EmployeeCode %s already exists in EmployeeDetails', 16, 1, @EmployeeCode);
        RETURN;
    END
    
    -- Insert new record
    INSERT INTO dbo.EmployeeDetails (
        EmployeeCode,
        JoiningDate,
        BranchLocation,
        Department,
        Designation,
        BasicSalary,
        MonthlyCTC,
        AnnualCTC,
        Gender,
        PhoneNumber,
        CreatedBy
    )
    VALUES (
        @EmployeeCode,
        @JoiningDate,
        @BranchLocation,
        @Department,
        @Designation,
        @BasicSalary,
        @MonthlyCTC,
        @AnnualCTC,
        @Gender,
        @PhoneNumber,
        @CreatedBy
    );
    
    -- Return the inserted record
    SELECT 
        EmployeeDetailsId,
        EmployeeCode,
        JoiningDate,
        ExitDate,
        BranchLocation,
        Department,
        Designation,
        BasicSalary,
        MonthlyCTC,
        AnnualCTC,
        Gender,
        PhoneNumber,
        CreatedAt,
        UpdatedAt,
        CreatedBy,
        UpdatedBy
    FROM dbo.EmployeeDetails
    WHERE EmployeeCode = @EmployeeCode;
END
GO

/**
 * SP: Update Employee Details
 */
CREATE PROCEDURE dbo.UpdateEmployeeDetails
    @EmployeeCode NVARCHAR(50),
    @JoiningDate DATE = NULL,
    @ExitDate DATE = NULL,
    @BranchLocation NVARCHAR(100) = NULL,
    @Department NVARCHAR(100) = NULL,
    @Designation NVARCHAR(100) = NULL,
    @BasicSalary DECIMAL(18, 2) = NULL,
    @MonthlyCTC DECIMAL(18, 2) = NULL,
    @AnnualCTC DECIMAL(18, 2) = NULL,
    @Gender NVARCHAR(10) = NULL,
    @PhoneNumber NVARCHAR(20) = NULL,
    @UpdatedBy NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if employee exists
    IF NOT EXISTS (SELECT 1 FROM dbo.EmployeeDetails WHERE EmployeeCode = @EmployeeCode)
    BEGIN
        RAISERROR('EmployeeCode %s not found in EmployeeDetails', 16, 1, @EmployeeCode);
        RETURN;
    END
    
    -- Update record (only update fields that are provided)
    UPDATE dbo.EmployeeDetails
    SET 
        JoiningDate = COALESCE(@JoiningDate, JoiningDate),
        ExitDate = @ExitDate, -- Allow NULL to be set
        BranchLocation = COALESCE(@BranchLocation, BranchLocation),
        Department = COALESCE(@Department, Department),
        Designation = COALESCE(@Designation, Designation),
        BasicSalary = COALESCE(@BasicSalary, BasicSalary),
        MonthlyCTC = COALESCE(@MonthlyCTC, MonthlyCTC),
        AnnualCTC = COALESCE(@AnnualCTC, AnnualCTC),
        Gender = COALESCE(@Gender, Gender),
        PhoneNumber = COALESCE(@PhoneNumber, PhoneNumber),
        UpdatedAt = GETDATE(),
        UpdatedBy = @UpdatedBy
    WHERE EmployeeCode = @EmployeeCode;
    
    -- Return the updated record
    SELECT 
        EmployeeDetailsId,
        EmployeeCode,
        JoiningDate,
        ExitDate,
        BranchLocation,
        Department,
        Designation,
        BasicSalary,
        MonthlyCTC,
        AnnualCTC,
        Gender,
        PhoneNumber,
        CreatedAt,
        UpdatedAt,
        CreatedBy,
        UpdatedBy
    FROM dbo.EmployeeDetails
    WHERE EmployeeCode = @EmployeeCode;
END
GO

/**
 * SP: Mark Employee as Exited
 * Sets ExitDate instead of deleting the record
 */
CREATE PROCEDURE dbo.MarkEmployeeExited
    @EmployeeCode NVARCHAR(50),
    @ExitDate DATE,
    @UpdatedBy NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.EmployeeDetails
    SET 
        ExitDate = @ExitDate,
        UpdatedAt = GETDATE(),
        UpdatedBy = @UpdatedBy
    WHERE EmployeeCode = @EmployeeCode;
    
    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

-- =============================================
-- Grant Permissions (adjust as needed)
-- =============================================
-- GRANT SELECT, INSERT, UPDATE ON dbo.EmployeeDetails TO [YourAppUser];
-- GRANT EXECUTE ON dbo.GetEmployeeDetails TO [YourAppUser];
-- GRANT EXECUTE ON dbo.GetAllActiveEmployeeDetails TO [YourAppUser];
-- GRANT EXECUTE ON dbo.InsertEmployeeDetails TO [YourAppUser];
-- GRANT EXECUTE ON dbo.UpdateEmployeeDetails TO [YourAppUser];
-- GRANT EXECUTE ON dbo.MarkEmployeeExited TO [YourAppUser];
-- GO

PRINT '✅ EmployeeDetails table and stored procedures created successfully';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Import existing Excel data into this table';
PRINT '2. Update backend APIs to use this table';
PRINT '3. Test salary calculations with database data';
PRINT '4. Remove Excel dependency';
GO

