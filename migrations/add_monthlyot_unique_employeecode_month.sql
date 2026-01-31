-- Ensure monthlyot has a unique index on (employeecode, month)
-- so INSERT ... ON CONFLICT (employeecode, month) DO UPDATE works.
-- Run after fix-monthlyot-sequence.cjs if you get duplicate key on monthlyot_pkey.

CREATE UNIQUE INDEX IF NOT EXISTS monthlyot_employeecode_month_key
  ON monthlyot (employeecode, month);
