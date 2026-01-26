# Employee Passwords Table Migration

## Quick Start

### Prerequisites
- PostgreSQL database connection
- Database credentials configured in `.env` file
- Access to the target database

### Running the Migration

#### Option 1: Using psql (Command Line)

```bash
# Connect to your database
psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME>

# Run the migration
\i sql/create_employee_passwords_table.sql

# Or from command line directly:
psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> -f sql/create_employee_passwords_table.sql
```

#### Option 2: Using Database GUI Tool

1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open the file: `sql/create_employee_passwords_table.sql`
4. Execute the script

#### Option 3: Using Node.js Script (Future Enhancement)

```bash
# From Payroll-system directory
npm run migrate:passwords
```

### Verification

After running the migration, verify the table was created:

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'employee_passwords';

-- Check table structure
\d employee_passwords

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'employee_passwords';
```

### Expected Output

You should see:
- ✅ Table `employee_passwords` created
- ✅ Indexes created (3 indexes)
- ✅ Trigger created for auto-updating `updated_at`
- ✅ Success message printed

### Rollback (if needed)

If you need to remove the table:

```sql
-- WARNING: This will delete all password data!
DROP TABLE IF EXISTS employee_passwords CASCADE;
```

## Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `employeecode` | VARCHAR(50) | Employee code (unique) |
| `password_hash` | VARCHAR(255) | Bcrypt hashed password |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time (auto-updated) |
| `last_password_change` | TIMESTAMP | Last password change time |
| `is_active` | BOOLEAN | Account active status |
| `failed_login_attempts` | INTEGER | Failed login counter |
| `locked_until` | TIMESTAMP | Account lockout expiry |

## Indexes

1. `idx_employee_passwords_employeecode` - Primary lookup index
2. `idx_employee_passwords_locked_until` - Lockout status queries
3. `idx_employee_passwords_is_active` - Active account filtering

## Next Steps

After successful migration:

1. ✅ Install bcrypt: `npm install bcrypt @types/bcrypt`
2. ✅ Create `EmployeePasswordModel.ts`
3. ✅ Create password utility functions
4. ✅ Update `AuthController.ts`
5. ✅ Test password operations

## Troubleshooting

### Error: "relation already exists"
- The table already exists. Either:
  - Skip the migration (if table is correct)
  - Drop and recreate (WARNING: deletes all data)
  - Modify the script to use `CREATE TABLE IF NOT EXISTS` (already included)

### Error: "permission denied"
- Ensure your database user has CREATE TABLE permissions
- Check database connection credentials

### Error: "syntax error"
- Ensure you're using PostgreSQL (not SQL Server)
- Check PostgreSQL version (9.5+ recommended)

## Support

For issues or questions, check:
- Migration script comments
- Progress tracker: `LOGIN_WORKFLOW_UPDATE_PROGRESS.md`
- Backend documentation
