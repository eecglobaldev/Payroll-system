# Payroll & Attendance System API

Internal Node.js + Express backend for payroll and attendance management with SQL Server integration.

**Now with TypeScript + ES Modules!** 🎉

## 🚀 Features

- **TypeScript**: Full type safety and modern JavaScript features
- **ES Modules**: Modern import/export syntax
- **SQL Server Integration**: Connects to internal LAN-based SQL Server (192.168.10.31:1433)
- **Attendance Tracking**: Retrieve and analyze attendance logs
- **Payroll Calculation**: Automatic salary calculation with overtime, deductions, and late penalties
- **API Security**: API key authentication, IP allowlisting, rate limiting
- **Production Ready**: PM2 process management, error handling, graceful shutdown

## 📋 Tech Stack

- **Node.js** (v18+)
- **TypeScript** (v5.3+) - Type safety
- **Express.js** - Web framework
- **mssql** - SQL Server client
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - API rate limiting
- **Joi** - Input validation
- **PM2** - Process manager (production)
- **tsx** - TypeScript execution (development)

## 📁 Project Structure

```
project/
├─ src/
│   ├─ index.ts              # Main Express application (TypeScript)
│   ├─ types/
│   │   └─ index.ts          # TypeScript type definitions
│   ├─ routes/
│   │   ├─ attendance.ts     # Attendance endpoints
│   │   └─ salary.ts         # Salary calculation endpoints
│   ├─ services/
│   │   └─ payroll.ts        # Payroll business logic
│   ├─ db/
│   │   └─ pool.ts           # SQL Server connection pool
│   ├─ middleware/
│   │   ├─ apiKey.ts         # API key authentication
│   │   └─ ipAllowlist.ts    # IP filtering
│   └─ utils/
│       ├─ date.ts           # Date utilities
│       ├─ ipRange.ts        # IP range checking
│       └─ validation.ts     # Input validation schemas
├─ dist/                     # Compiled JavaScript (generated)
├─ tsconfig.json             # TypeScript configuration
├─ package.json              # With ES module support
├─ .env.example              # Environment variables template
└─ README.md
```

## 🔧 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# API Security
API_KEY=your-secure-api-key-here-change-this

# SQL Server Database Configuration
DB_HOST=192.168.10.31
DB_PORT=1433
DB_USER=essl
DB_PASS=YOUR_PASSWORD_HERE
DB_NAME=etimetracklite1

# Database Connection Pool Settings
DB_CONNECTION_TIMEOUT=30000
DB_REQUEST_TIMEOUT=15000
DB_POOL_MAX=10
DB_POOL_MIN=2

# Security Settings
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200

# IP Allowlist (comma-separated, leave empty to allow all LAN)
IP_ALLOWLIST=

# CORS Settings (comma-separated origins, leave empty to allow all LAN)
CORS_ORIGINS=

# Payroll Configuration
DEFAULT_WORK_HOURS_PER_DAY=8
LATE_ENTRY_THRESHOLD_MINUTES=15
EARLY_EXIT_THRESHOLD_MINUTES=30
OVERTIME_RATE_MULTIPLIER=1.5
HALF_DAY_HOURS_THRESHOLD=4
```

**Important**: Change `API_KEY` and `DB_PASS` to your actual values!

### 3. Database Setup

Ensure your SQL Server has the following table structure (example):

```sql
-- Attendance Logs Table
CREATE TABLE dbo.AttendanceLogs (
    id INT PRIMARY KEY IDENTITY(1,1),
    EmployeeCode NVARCHAR(50) NOT NULL,
    SubmittedAt DATETIME NOT NULL,
    -- Add other fields as needed
);

-- Employees Table (optional, for salary data)
CREATE TABLE dbo.Employees (
    EmployeeCode NVARCHAR(50) PRIMARY KEY,
    FullName NVARCHAR(100),
    BaseSalary DECIMAL(10,2),
    HourlyRate DECIMAL(10,2),
    -- Add other fields as needed
);
```

## 🏃 Running the Application

### Development Mode (with auto-reload, no build needed)

```bash
npm run dev
```

Uses `tsx` to run TypeScript directly with hot-reload.

### Production Mode

```bash
# Build TypeScript to JavaScript
npm run build

# Run compiled JavaScript
npm start
```

### Using PM2 (Recommended for Production)

```bash
# Build and start the application
npm run pm2:start

# View logs
npm run pm2:logs

# Restart the application
npm run pm2:restart

# Stop the application
npm run pm2:stop
```

Or use PM2 directly (after building):

```bash
npm run build
pm2 start dist/index.js --name payroll-api
pm2 logs payroll-api
pm2 restart payroll-api
pm2 stop payroll-api
```

## 📡 API Endpoints

### Important: Database Schema

This API connects to **eTimeTrackLite** SQL Server database with monthly partitioned tables:
- Table format: `dbo.DeviceLogs_MM_YYYY` (e.g., `DeviceLogs_12_2025`)
- Employee identifier: `UserId` (integer, e.g., 1464)
- Attendance timestamp: `LogDate`
- See `DATABASE_SCHEMA.md` for complete schema documentation

### Authentication

All protected endpoints require the `x-api-key` header:

```
x-api-key: your-api-key-here
```

### Public Endpoints

#### Health Check

```http
GET /api/ping
```

Response:
```json
{
  "ok": true,
  "time": "2025-12-08T10:30:00.000Z",
  "service": "Payroll & Attendance API",
  "version": "1.0.0"
}
```

#### Database Health

```http
GET /api/health
```

### Attendance Endpoints

#### 1. Get Latest Attendance Logs

```http
GET /api/attendance/latest?limit=100
```

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100, max: 1000)

**Response:**
```json
{
  "success": true,
  "count": 100,
  "data": [...]
}
```

#### 2. Get Attendance by Date

```http
GET /api/attendance/by-date?date=2025-12-08
```

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "date": "2025-12-08",
  "count": 45,
  "data": [...]
}
```

#### 3. Get Employee Attendance

```http
GET /api/attendance/employee/1464?start=2025-12-01&end=2025-12-31
```

**Path Parameters:**
- `userId`: Employee user ID (integer)

**Query Parameters:**
- `start` (required): Start date (YYYY-MM-DD)
- `end` (required): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "userId": 1464,
  "dateRange": {
    "start": "2025-12-01",
    "end": "2025-12-31"
  },
  "count": 22,
  "data": [...]
}
```

#### 4. Get Attendance Summary

```http
GET /api/attendance/summary/1464?start=2025-12-01&end=2025-12-31
```

**Response:**
```json
{
  "success": true,
  "userId": 1464,
  "dateRange": {...},
  "data": {
    "UserId": 1464,
    "DaysPresent": 22,
    "TotalLogs": 44,
    "FirstEntry": "2025-12-01T09:00:00.000Z",
    "LastEntry": "2025-12-31T18:00:00.000Z"
  }
}
```

#### 5. Get Daily Attendance

```http
GET /api/attendance/daily/1464/2025-12-08
```

### Salary Endpoints

#### 1. Calculate Employee Salary

```http
GET /api/salary/1464?month=2025-12
```

**Path Parameters:**
- `userId`: Employee user ID (integer)

**Query Parameters:**
- `month` (optional): Month in YYYY-MM format (defaults to current month)

**Response:**
```json
{
  "success": true,
  "data": {
    "employeeCode": "1464",
    "month": "2025-12",
    "baseSalary": 50000.00,
    "grossSalary": 50000.00,
    "netSalary": 48750.50,
    "attendance": {
      "totalDays": 31,
      "expectedWorkingDays": 26,
      "fullDays": 24,
      "halfDays": 1,
      "absentDays": 1,
      "lateDays": 3,
      "earlyExits": 2,
      "totalWorkedHours": 192.5,
      "expectedHours": 208,
      "overtimeHours": 0
    },
    "breakdown": {
      "perDayRate": 1923.08,
      "hourlyRate": 240.38,
      "absentDeduction": 1923.08,
      "halfDayDeduction": 961.54,
      "lateDeduction": 288.46,
      "totalDeductions": 3173.08,
      "overtimeAmount": 0.00
    }
  }
}
```

#### 2. Get Monthly Hours Breakdown

```http
GET /api/salary/1464/hours?month=2025-12
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employeeCode": "1464",
    "month": "2025-12",
    "totalDaysInMonth": 31,
    "totalWorkedHours": 192.5,
    "fullDays": 24,
    "halfDays": 1,
    "absentDays": 1,
    "lateDays": 3,
    "earlyExits": 2,
    "dailyBreakdown": [...]
  }
}
```

#### 3. Get Daily Breakdown

```http
GET /api/salary/1464/breakdown/2025-12
```

**Response includes detailed daily attendance breakdown**

#### 4. Batch Salary Calculation

```http
POST /api/salary/batch
Content-Type: application/json

{
  "employeeCodes": [1464, 1465, 1466],
  "month": "2025-12"
}
```

**Response:**
```json
{
  "success": true,
  "month": "2025-12",
  "processed": 3,
  "failed": 0,
  "data": [...]
}
```

## 🔒 Security Features

### 1. API Key Authentication

All protected endpoints require the `x-api-key` header matching the value in `.env`.

### 2. IP Allowlisting

Configure `IP_ALLOWLIST` in `.env` to restrict access:

```env
# Single IP
IP_ALLOWLIST=192.168.10.50

# Multiple IPs
IP_ALLOWLIST=192.168.10.50,192.168.10.51

# CIDR notation
IP_ALLOWLIST=192.168.10.0/24
```

### 3. CORS Configuration

Configure `CORS_ORIGINS` to whitelist specific origins:

```env
CORS_ORIGINS=http://192.168.10.50:3000,http://192.168.10.51
```

Leave empty to allow all origins (suitable for internal LAN).

### 4. Rate Limiting

Default: 200 requests per minute per IP. Configure in `.env`:

```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200
```

### 5. Security Headers

Helmet middleware automatically adds security headers:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Removes X-Powered-By

## 🎯 Payroll Configuration

Adjust payroll rules in `.env`:

```env
DEFAULT_WORK_HOURS_PER_DAY=8          # Expected work hours
LATE_ENTRY_THRESHOLD_MINUTES=15       # Minutes after 9 AM
EARLY_EXIT_THRESHOLD_MINUTES=30       # Minutes before 6 PM
OVERTIME_RATE_MULTIPLIER=1.5          # 1.5x for overtime
HALF_DAY_HOURS_THRESHOLD=4            # Hours for half-day
```

## 🐛 Troubleshooting

### Connection Issues

**Error**: `Failed to connect to SQL Server`

**Solutions**:
1. Verify SQL Server is accessible: `ping 192.168.10.31`
2. Check SQL Server is running and listening on port 1433
3. Verify firewall allows connections from your IP
4. Confirm credentials in `.env` are correct
5. Test with SQL Server Management Studio first

### Authentication Errors

**Error**: `Missing x-api-key header`

**Solution**: Include the header in all protected API requests:

```bash
curl -H "x-api-key: your-api-key-here" http://localhost:3000/api/attendance/latest
```

### Rate Limit Exceeded

**Error**: `Rate limit exceeded`

**Solution**: Increase limits in `.env` or wait for the time window to reset.

## 📝 Logs

View logs in real-time:

```bash
# PM2 logs
pm2 logs payroll-api

# Or direct output
npm run dev
```

## 🔄 Updates & Maintenance

### Updating Dependencies

```bash
npm update
```

### Database Backup

Regularly backup your SQL Server database:

```sql
BACKUP DATABASE etimetracklite1
TO DISK = 'C:\\Backups\\etimetracklite1.bak'
WITH FORMAT;
```

## 📞 Support

For issues or questions:
1. Check logs: `pm2 logs payroll-api`
2. Verify database connectivity
3. Review `.env` configuration
4. Test endpoints with `/api/ping` and `/api/health`

## 📄 License

Internal use only - Proprietary

---

**Built with ❤️ for internal payroll management**

