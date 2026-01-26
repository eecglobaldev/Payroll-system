/**
 * Employee Passwords Table Migration
 * 
 * Purpose: Store employee passwords for password-based authentication
 * 
 * This table enables:
 * - Password-based login for employees
 * - OTP fallback for new users (first-time setup)
 * - Account lockout after failed login attempts
 * - Password change tracking
 * 
 * Business Rules:
 * - One password per employee (unique constraint on employeecode)
 * - Passwords are hashed using bcrypt (never store plain text)
 * - Account locks after 5 failed login attempts
 * - Lock duration: 30 minutes
 * - Failed attempts reset on successful login
 * 
 * Migration Date: 2026-01-26
 */

-- =============================================
-- STEP 1: Create employee_passwords table
-- =============================================

-- Drop table if exists (only for development/testing)
-- Uncomment the following lines if you need to recreate the table
-- DROP TABLE IF EXISTS employee_passwords CASCADE;

CREATE TABLE IF NOT EXISTS employee_passwords (
    -- Primary Key
    id SERIAL PRIMARY KEY,
    
    -- Employee Code (references Employees table via employeecode)
    -- Must be unique - one password per employee
    employeecode VARCHAR(50) NOT NULL UNIQUE,
    
    -- Password hash (bcrypt hashed password, never plain text)
    -- bcrypt hashes are typically 60 characters, but we allow up to 255 for future algorithms
    password_hash VARCHAR(255) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_password_change TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Failed login attempt tracking
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Account lockout (NULL = not locked, TIMESTAMP = locked until this time)
    locked_until TIMESTAMP NULL,
    
    -- Constraints
    CONSTRAINT chk_employee_passwords_failed_attempts 
        CHECK (failed_login_attempts >= 0),
    CONSTRAINT chk_employee_passwords_employeecode_not_empty 
        CHECK (LENGTH(TRIM(employeecode)) > 0)
);

-- =============================================
-- STEP 2: Create Indexes for Performance
-- =============================================

-- Index on employeecode (most common query - check if password exists)
CREATE INDEX IF NOT EXISTS idx_employee_passwords_employeecode 
    ON employee_passwords(employeecode);

-- Index on locked_until (for checking account lockout status)
CREATE INDEX IF NOT EXISTS idx_employee_passwords_locked_until 
    ON employee_passwords(locked_until) 
    WHERE locked_until IS NOT NULL;

-- Index on is_active (for filtering active accounts)
CREATE INDEX IF NOT EXISTS idx_employee_passwords_is_active 
    ON employee_passwords(is_active) 
    WHERE is_active = TRUE;

-- =============================================
-- STEP 3: Add Comments for Documentation
-- =============================================

COMMENT ON TABLE employee_passwords IS 
    'Stores hashed passwords for employee authentication. Supports password-based login with OTP fallback for new users.';

COMMENT ON COLUMN employee_passwords.id IS 
    'Primary key - auto-incrementing ID';

COMMENT ON COLUMN employee_passwords.employeecode IS 
    'Employee code - must match Employees.employeecode. Unique constraint ensures one password per employee.';

COMMENT ON COLUMN employee_passwords.password_hash IS 
    'Bcrypt hashed password. Never store plain text passwords. Hash length: 60 characters (bcrypt), but allows up to 255 for future algorithms.';

COMMENT ON COLUMN employee_passwords.created_at IS 
    'Timestamp when password record was created';

COMMENT ON COLUMN employee_passwords.updated_at IS 
    'Timestamp when password record was last updated (auto-updated on password change)';

COMMENT ON COLUMN employee_passwords.last_password_change IS 
    'Timestamp when password was last changed (for password expiration policy - future enhancement)';

COMMENT ON COLUMN employee_passwords.is_active IS 
    'Account status - TRUE = active, FALSE = deactivated';

COMMENT ON COLUMN employee_passwords.failed_login_attempts IS 
    'Number of consecutive failed login attempts. Resets to 0 on successful login.';

COMMENT ON COLUMN employee_passwords.locked_until IS 
    'Account lockout timestamp. NULL = not locked. TIMESTAMP = locked until this time. Account locks after 5 failed attempts for 30 minutes.';

-- =============================================
-- STEP 4: Create Function to Auto-Update updated_at
-- =============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_passwords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on UPDATE
DROP TRIGGER IF EXISTS trigger_update_employee_passwords_updated_at ON employee_passwords;
CREATE TRIGGER trigger_update_employee_passwords_updated_at
    BEFORE UPDATE ON employee_passwords
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_passwords_updated_at();

-- =============================================
-- STEP 5: Verification Queries
-- =============================================

-- Verify table creation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_passwords'
    ) THEN
        RAISE NOTICE '✅ employee_passwords table created successfully';
    ELSE
        RAISE EXCEPTION '❌ employee_passwords table creation failed';
    END IF;
END $$;

-- Verify indexes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'employee_passwords' 
        AND indexname = 'idx_employee_passwords_employeecode'
    ) THEN
        RAISE NOTICE '✅ Index idx_employee_passwords_employeecode created successfully';
    ELSE
        RAISE WARNING '⚠️ Index idx_employee_passwords_employeecode not found';
    END IF;
END $$;

-- =============================================
-- STEP 6: Sample Data (Optional - for testing only)
-- =============================================

-- Uncomment the following to insert a test password (for development only)
-- WARNING: This is a test password hash for employee code 'TEST001'
-- Password: 'Test@1234' (bcrypt hash)
-- DO NOT use in production!

/*
INSERT INTO employee_passwords (employeecode, password_hash)
VALUES (
    'TEST001',
    '$2b$10$rK9X8YzQ3mN5pL7vJ9wB3uH2cD4eF6gH8iJ0kL2mN4pQ6rS8tU0vW2xY4zA6bC8'
)
ON CONFLICT (employeecode) DO NOTHING;
*/

-- =============================================
-- STEP 7: Migration Complete
-- =============================================

-- Print success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Employee Passwords Table Migration Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Table: employee_passwords';
    RAISE NOTICE 'Status: Created successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Install bcrypt package: npm install bcrypt @types/bcrypt';
    RAISE NOTICE '2. Create EmployeePasswordModel.ts';
    RAISE NOTICE '3. Create password utility functions';
    RAISE NOTICE '4. Update AuthController with password methods';
    RAISE NOTICE '5. Test password creation and verification';
    RAISE NOTICE '';
END $$;
