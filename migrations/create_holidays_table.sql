-- Create Holidays table for PostgreSQL
-- This table stores company holidays

CREATE TABLE IF NOT EXISTS holidays (
    holidayid SERIAL PRIMARY KEY,
    holidaydate DATE NOT NULL UNIQUE,
    holidayname VARCHAR(200) NOT NULL,
    description VARCHAR(500) NULL,
    isactive BOOLEAN NOT NULL DEFAULT true,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdby VARCHAR(100) NULL,
    updatedat TIMESTAMP NULL,
    updatedby VARCHAR(100) NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS ix_holidays_holidaydate ON holidays(holidaydate);
CREATE INDEX IF NOT EXISTS ix_holidays_isactive ON holidays(isactive);

-- Add comment to table
COMMENT ON TABLE holidays IS 'Company holidays - dates when office is closed';
COMMENT ON COLUMN holidays.holidaydate IS 'Date of the holiday (YYYY-MM-DD)';
COMMENT ON COLUMN holidays.holidayname IS 'Name of the holiday (e.g., New Year, Independence Day)';
COMMENT ON COLUMN holidays.isactive IS 'Soft delete flag - false means holiday is deleted but record is kept';
