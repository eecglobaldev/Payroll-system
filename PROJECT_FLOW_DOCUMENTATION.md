# 📘 Complete Project Flow Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Salary Cycle & Date Logic](#salary-cycle--date-logic)
4. [Complete Data Flow](#complete-data-flow)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Structure](#frontend-structure)
8. [Business Rules](#business-rules)
9. [Salary Calculation Flow](#salary-calculation-flow)
10. [Attendance Processing](#attendance-processing)
11. [Leave Management](#leave-management)
12. [PDF Generation](#pdf-generation)
13. [Integration Points](#integration-points)

---

## 🎯 Project Overview

### Purpose
A comprehensive **Payroll & Attendance Management System** that:
- Tracks employee attendance from biometric devices (SQL Server)
- Calculates monthly salaries with pro-rata, deductions, and overtime
- Manages leave approvals and balances
- Generates detailed PDF reports
- Provides admin dashboard for salary processing

### Technology Stack

**Backend:**
- Node.js + TypeScript
- Express.js (REST API)
- SQL Server (Attendance data)
- Excel files (Legacy salary data)
- PM2 (Process management)

**Frontend:**
- React + TypeScript
- Vite (Build tool)
- Tailwind CSS (Styling)
- jsPDF (PDF generation)

**Database:**
- SQL Server (192.168.10.31:1433)
- Monthly partitioned tables: `DeviceLogs_MM_YYYY`
- Employee management tables

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Dashboard (React)                   │
│  - Salary Page (Individual calculations)                    │
│  - Salary Summary (Batch processing)                         │
│  - Attendance View                                           │
│  - Employee Management                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Express.js Backend (TypeScript)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Controllers │  │   Services   │  │    Models    │      │
│  │  - Salary     │  │  - Payroll   │  │  - Attendance│      │
│  │  - Attendance │  │  - Excel     │  │  - Employee  │      │
│  │  - Employee   │  │  - Leave     │  │  - Leave     │      │
│  │  - Leave      │  │              │  │  - Shift     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
│ SQL Server  │  │  Excel Files  │  │  Employee    │
│ (Attendance)│  │  (Salary Data) │  │  Details DB  │
└─────────────┘  └───────────────┘  └──────────────┘
```

### MVC Pattern

**Model Layer** (`src/models/`)
- `AttendanceModel.ts` - Attendance log queries
- `EmployeeModel.ts` - Employee data queries
- `EmployeeDetailsModel.ts` - HR details (joining, exit, salary)
- `LeaveModel.ts` - Leave approvals and balances
- `ShiftModel.ts` - Shift timing configurations

**Controller Layer** (`src/controllers/`)
- `SalaryController.ts` - Salary calculation endpoints
- `AttendanceController.ts` - Attendance data endpoints
- `EmployeeController.ts` - Employee management
- `LeaveController.ts` - Leave approval endpoints
- `EmployeeDetailsController.ts` - HR data management

**Service Layer** (`src/services/`)
- `payroll.ts` - Core salary calculation logic
- `excelService.ts` - Excel file reading (legacy)
- `leaveService.ts` - Leave balance calculations
- `employeeDetailsService.ts` - Employee HR operations

---

## 📅 Salary Cycle & Date Logic

### Custom Salary Cycle: 26th to 25th

**Key Concept:** Salary is calculated from **26th of previous month to 25th of current month**

#### Example: November 2025 Salary
```
Request Month: "2025-11"
Salary Cycle: Oct 26, 2025 → Nov 25, 2025 (30 days)
```

#### Month-by-Month Cycle Table

| Request Month | Cycle Start | Cycle End | Total Days |
|---------------|-------------|-----------|------------|
| January 2025 | Dec 26, 2024 | Jan 25, 2025 | 30 |
| February 2025 | Jan 26, 2025 | Feb 25, 2025 | 30 |
| March 2025 | Feb 26, 2025 | Mar 25, 2025 | 30 |
| ... | ... | ... | 30 |
| November 2025 | Oct 26, 2025 | Nov 25, 2025 | 30 |
| December 2025 | Nov 26, 2025 | Dec 25, 2025 | 30 |

**Every cycle is exactly 30 days!**

### Implementation

**File:** `src/utils/date.ts`

```typescript
export function getMonthRange(monthStr: string): DateRange {
  const [year, month] = monthStr.split('-').map(Number);
  
  // Salary cycle: 26th of previous month to 25th of current month
  const startDate = new Date(year, month - 2, 26); // Previous month, 26th
  const endDate = new Date(year, month - 1, 25);   // Current month, 25th
  
  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
}
```

### Joining Date Logic

**Rule:** "New Joining" toggle is enabled if joining date falls within the salary cycle

**Example:**
- Employee joins: **Oct 29, 2025**
- Calculating: **November 2025** salary
- Cycle: **Oct 26 - Nov 25, 2025**
- Result: ✅ **Toggle enabled** (Oct 29 is within cycle)

**Implementation:** `admin-dashboard/src/pages/Salary.tsx`
```typescript
const isDateInSalaryCycle = (dateStr: string, month: string): boolean => {
  const cycle = getSalaryCycleRange(month);
  return dateStr >= cycle.start && dateStr <= cycle.end;
};
```

---

## 🔄 Complete Data Flow

### 1. Salary Calculation Flow (Individual Employee)

```
User Action (Frontend)
  ↓
Select Employee + Month
  ↓
Frontend: Salary.tsx
  ├─ Load Employee Details (joining/exit dates)
  ├─ Load Leave Approvals (from DB)
  └─ Call API: GET /api/salary/:userId?month=2025-11&joinDate=2025-10-29&...
  ↓
Backend: SalaryController.calculateSalary()
  ├─ Extract query params (joinDate, exitDate, paidLeave, casualLeave)
  └─ Call: payroll.calculateSalary()
  ↓
Service: payroll.calculateSalary()
  ├─ Get salary cycle range (Oct 26 - Nov 25)
  ├─ Apply effective range (joinDate/exitDate)
  ├─ Fetch attendance: calculateMonthlyHours()
  │   ├─ Query DeviceLogs_10_2025 + DeviceLogs_11_2025
  │   ├─ Group logs by date
  │   ├─ Calculate day hours (first entry, last exit)
  │   ├─ Determine status (full-day, half-day, absent)
  │   └─ Mark Sundays as weekoff (paid/unpaid)
  ├─ Count payable Sundays (sandwich rule)
  ├─ Calculate base salary (from Excel or EmployeeDetails)
  ├─ Calculate per-day rate
  ├─ Apply leave approvals
  ├─ Calculate deductions (late, absent, LOP)
  ├─ Calculate overtime
  └─ Return: SalaryCalculation object
  ↓
Backend: Return JSON response
  ↓
Frontend: Display in UI + Generate PDF
```

### 2. Attendance Processing Flow

```
Biometric Device
  ↓
DeviceLogs_MM_YYYY Table (SQL Server)
  ↓
API Request: GET /api/attendance/summary/:userId?month=2025-11
  ↓
AttendanceController.getSummary()
  ↓
AttendanceModel.getSummaryByEmployeeAndDateRange()
  ├─ Query DeviceLogs_10_2025 (Oct 26-31)
  ├─ Query DeviceLogs_11_2025 (Nov 1-25)
  └─ Combine results
  ↓
payroll.calculateMonthlyHours()
  ├─ Group logs by date
  ├─ For each date:
  │   ├─ Find first entry (earliest "in")
  │   ├─ Find last exit (latest "out")
  │   ├─ Calculate total hours
  │   ├─ Check if late (after shift start + grace period)
  │   ├─ Check if early exit (before shift end - threshold)
  │   └─ Determine status:
  │       ├─ full-day: hours >= halfDayThreshold
  │       ├─ half-day: hours >= 5 but < full-day
  │       └─ absent: no logs or hours < 5
  └─ Mark Sundays as weekoff (paid/unpaid)
  ↓
Return: MonthlyAttendance object
```

### 3. Leave Management Flow

```
User Action: Approve Leave
  ↓
Frontend: Salary.tsx
  ├─ User selects absent dates
  ├─ Marks as Paid Leave or Casual Leave
  └─ Auto-save: POST /api/leave/approve
  ↓
Backend: LeaveController.approve()
  ├─ Save to MonthlyLeaveUsage table
  └─ Update EmployeeLeaves table (balance)
  ↓
Recalculate Salary
  ├─ Fetch leave approvals from DB
  ├─ Apply to salary calculation
  └─ Paid Leave = 1.0 day, Casual Leave = 0.5 day
```

### 4. Summary Salary Flow (Batch Processing)

```
User Action: View Summary for Month
  ↓
Frontend: SalarySummary.tsx
  └─ Call: GET /api/salary/summary?month=2025-11
  ↓
Backend: SalaryController.getSalarySummary()
  ├─ Get all active employees from EmployeeDetails
  ├─ Process in chunks (10 at a time)
  ├─ For each employee:
  │   ├─ Auto-fetch joining/exit dates
  │   ├─ Check if joining date in cycle
  │   ├─ Calculate salary with dates
  │   └─ Collect results
  └─ Return aggregated data
  ↓
Frontend: Display table + Generate batch PDF
```

---

## 🗄️ Database Schema

### Core Tables

#### 1. DeviceLogs_MM_YYYY (Monthly Partitioned)
**Purpose:** Store attendance logs from biometric devices

**Key Columns:**
- `DeviceLogId` (INT, PK)
- `UserId` (INT) - Employee ID
- `LogDate` (DATETIME) - Attendance timestamp
- `Direction` (NVARCHAR) - "in" or "out"
- `DeviceId` (INT) - Biometric device ID

**Naming:** `DeviceLogs_10_2025` (October 2025), `DeviceLogs_11_2025` (November 2025)

#### 2. Employees
**Purpose:** Basic employee information

**Key Columns:**
- `UserId` (INT, PK)
- `EmployeeCode` (NVARCHAR) - Employee number
- `EmployeeName` (NVARCHAR) - Full name

#### 3. EmployeeDetails
**Purpose:** HR and salary details

**Key Columns:**
- `EmployeeCode` (NVARCHAR, PK)
- `JoiningDate` (DATE) - For pro-rata calculation
- `ExitDate` (DATE, NULL) - NULL = active
- `BasicSalary` (DECIMAL) - Monthly base salary
- `MonthlyCTC` (DECIMAL) - Cost to Company
- `Department` (NVARCHAR)
- `Designation` (NVARCHAR)
- `Shift` (NVARCHAR) - References Shifts table

#### 4. MonthlyLeaveUsage
**Purpose:** Store leave approvals per month

**Key Columns:**
- `EmployeeCode` (NVARCHAR)
- `Month` (NVARCHAR) - "YYYY-MM"
- `PaidLeaveDates` (NVARCHAR(MAX)) - JSON array
- `CasualLeaveDates` (NVARCHAR(MAX)) - JSON array
- `UpdatedBy` (NVARCHAR)
- `UpdatedAt` (DATETIME)

#### 5. EmployeeLeaves
**Purpose:** Annual leave balance tracking

**Key Columns:**
- `EmployeeCode` (NVARCHAR)
- `Year` (INT)
- `AllowedLeaves` (INT)
- `UsedPaidLeaves` (INT)
- `UsedCasualLeaves` (INT)

#### 6. Shifts
**Purpose:** Shift timing configurations

**Key Columns:**
- `ShiftName` (NVARCHAR, PK)
- `StartHour` (INT)
- `StartMinute` (INT)
- `EndHour` (INT)
- `EndMinute` (INT)
- `WorkHours` (DECIMAL)

---

## 🌐 API Endpoints

### Salary Endpoints

#### 1. Calculate Individual Salary
```
GET /api/salary/:userId?month=2025-11&joinDate=2025-10-29&exitDate=&paidLeave=2025-11-12&casualLeave=
```

**Query Parameters:**
- `month` (required) - "YYYY-MM"
- `joinDate` (optional) - "YYYY-MM-DD" for pro-rata
- `exitDate` (optional) - "YYYY-MM-DD" for final settlement
- `paidLeave` (optional, multiple) - Dates for paid leave
- `casualLeave` (optional, multiple) - Dates for casual leave

**Response:**
```json
{
  "success": true,
  "data": {
    "employeeCode": "1466",
    "baseSalary": 25000,
    "grossSalary": 15000,
    "netSalary": 14800,
    "attendance": {
      "totalDays": 31,
      "fullDays": 20,
      "halfDays": 2,
      "absentDays": 3,
      "sundaysInMonth": 2,
      "totalPayableDays": 14
    },
    "breakdown": {
      "perDayRate": 806.45,
      "sundayPay": 1612.90,
      "overtimeAmount": 500,
      "lateDeduction": 100,
      "totalDeductions": 200
    }
  }
}
```

#### 2. Get Salary Summary (Batch)
```
GET /api/salary/summary?month=2025-11&chunkSize=10
```

**Response:**
```json
{
  "success": true,
  "month": "2025-11",
  "totalEmployees": 50,
  "processed": 48,
  "failed": 2,
  "totalNetSalary": 1200000,
  "data": [/* array of SalaryCalculation */],
  "errors": [/* array of errors */]
}
```

### Attendance Endpoints

#### 1. Get Attendance Summary
```
GET /api/attendance/summary/:userId?month=2025-11
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 1466,
    "month": "2025-11",
    "summary": {
      "totalWorkedHours": 202.17,
      "fullDays": 21,
      "halfDays": 2,
      "absentDays": 3
    },
    "dailyBreakdown": [/* array of daily records */]
  }
}
```

### Leave Endpoints

#### 1. Approve Leave
```
POST /api/leave/approve
Body: {
  "employeeCode": "1466",
  "month": "2025-11",
  "paidLeaveDates": ["2025-11-12"],
  "casualLeaveDates": [],
  "approvedBy": "admin"
}
```

#### 2. Get Monthly Leave Usage
```
GET /api/leave/monthly-usage/:employeeCode?month=2025-11
```

---

## 💻 Frontend Structure

### Main Pages

#### 1. Salary Page (`admin-dashboard/src/pages/Salary.tsx`)
**Purpose:** Individual employee salary calculation

**Features:**
- Employee selection
- Month selection
- Leave approval (Paid/Casual)
- New Joining toggle (pro-rata)
- Contract Cessation toggle (exit date)
- Salary display
- PDF generation

**State Management:**
- `salary` - Current salary calculation
- `attendanceBreakdown` - Daily attendance data
- `paidLeaveDates` - Approved paid leave dates
- `casualLeaveDates` - Approved casual leave dates
- `joinDate` / `isNewJoiner` - Pro-rata calculation
- `exitDate` / `isExited` - Final settlement

**Key Functions:**
- `fetchSalary()` - Calculate salary with all parameters
- `loadEmployeeDetails()` - Auto-load joining/exit dates
- `loadPersistedLeaveApprovals()` - Load saved leaves
- `handleDownloadPDF()` - Generate PDF report

#### 2. Salary Summary Page (`admin-dashboard/src/pages/SalarySummary.tsx`)
**Purpose:** Batch salary processing for all employees

**Features:**
- Month selection
- Batch calculation
- Progress tracking
- Summary table
- Batch PDF generation

#### 3. Attendance Page (`admin-dashboard/src/pages/Attendance.tsx`)
**Purpose:** View attendance records

**Features:**
- Daily attendance view
- Calendar view
- Filter by date range

### Component Structure

```
admin-dashboard/src/
├── pages/
│   ├── Salary.tsx          # Individual salary calculation
│   ├── SalarySummary.tsx   # Batch salary processing
│   ├── Attendance.tsx      # Attendance viewing
│   └── ...
├── components/
│   ├── UI/
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── SearchableSelect.tsx
│   │   └── ...
│   └── Layout/
│       └── Sidebar.tsx
├── lib/
│   └── api.ts              # API client wrapper
└── utils/
    └── format.ts            # Currency, date formatting
```

---

## 📋 Business Rules

### 1. Salary Cycle Rule
- **Cycle:** 26th of previous month to 25th of current month
- **Always 30 days** (consistent calculation)
- **Per-day rate:** Base Salary ÷ 30

### 2. Pro-Rata Calculation Rule
- **Trigger:** "New Joining" toggle ON + joinDate provided
- **Effective Start:** `max(cycleStart, joinDate)`
- **Calculation:** Only count days from joinDate onwards

### 3. Final Settlement Rule
- **Trigger:** "Contract Cessation" toggle ON + exitDate provided
- **Effective End:** `min(cycleEnd, exitDate)`
- **Calculation:** Only count days up to exitDate

### 4. Sunday Pay Rule (Sandwich Rule)
- **Rule 1:** If employee has 5+ absent days → NO Sundays paid
- **Rule 2:** Sunday is NOT paid if absent on BOTH Saturday AND Monday
- **Otherwise:** Sunday is paid

### 5. Leave Approval Rules
- **Paid Leave:** Full day salary (1.0 day credit)
- **Casual Leave:** Half day salary (0.5 day credit)
- **Persisted:** Saved to `MonthlyLeaveUsage` table
- **Auto-loaded:** Fetched when employee/month changes

### 6. Attendance Status Rules
- **Full-Day:** Hours >= `halfDayHoursThreshold` (default: 5 hours)
- **Half-Day:** Hours >= 5 but < full-day threshold
- **Absent:** No logs or hours < 5
- **Late:** Entry after shift start + grace period (default: 15 min)
- **Early Exit:** Exit before shift end - threshold (default: 30 min)

### 7. Deduction Rules
- **Late Deduction:** 25% of per-day rate per late day (after 3 grace days)
- **Absent Deduction:** Per-day rate × absent days
- **Half-Day Deduction:** 50% of per-day rate per half-day
- **LOP (Loss of Pay):** Applied if leaves exceed annual entitlement

### 8. Overtime Rules
- **Calculation:** `max(0, totalWorkedHours - expectedHours)`
- **Rate:** Hourly rate × 1.5 (configurable)
- **Only if:** Worked more than expected hours

---

## 💰 Salary Calculation Flow

### Step-by-Step Calculation

#### Step 1: Get Salary Cycle Range
```typescript
const { start, end } = getMonthRange(month); // Oct 26 - Nov 25
```

#### Step 2: Apply Effective Range (Join/Exit Dates)
```typescript
const effectiveStart = joinDate && joinDate > start ? joinDate : start;
const effectiveEnd = exitDate && exitDate < end ? exitDate : end;
```

#### Step 3: Fetch Attendance Data
```typescript
const attendance = await calculateMonthlyHours(
  userId,
  month,
  joinDate,
  exitDate
);
// Returns: fullDays, halfDays, absentDays, totalWorkedHours, dailyBreakdown
```

#### Step 4: Calculate Base Salary
```typescript
// From EmployeeDetails table or Excel file
const baseSalary = employeeDetails.BasicSalary || excelData.fullBasic;
```

#### Step 5: Calculate Per-Day Rate
```typescript
const fullCycleDays = 30; // Always 30 days (26th to 25th)
const perDayRate = baseSalary / fullCycleDays;
```

#### Step 6: Count Payable Sundays
```typescript
const payableSundays = countPayableSundaysRange(
  effectiveStart,
  effectiveEnd,
  attendance.dailyBreakdown
);
// Applies sandwich rule
```

#### Step 7: Apply Leave Approvals
```typescript
const paidLeaveDays = paidLeaveDates.filter(date => 
  attendance.dailyBreakdown.find(d => d.date === date && d.status === 'absent')
).length;

const casualLeaveDays = casualLeaveDates.filter(date => 
  attendance.dailyBreakdown.find(d => d.date === date && d.status === 'absent')
).length * 0.5; // Half day credit
```

#### Step 8: Calculate Payable Days
```typescript
const actualDaysWorked = attendance.fullDays + (attendance.halfDays * 0.5);
const totalPayableDays = actualDaysWorked + payableSundays + paidLeaveDays + casualLeaveDays;
```

#### Step 9: Calculate Gross Salary
```typescript
const grossSalary = perDayRate * totalPayableDays;
```

#### Step 10: Calculate Deductions
```typescript
const lateDeduction = (lateDays - 3) * (perDayRate * 0.25); // After 3 grace days
const absentDeduction = (expectedDays - totalPayableDays) * perDayRate;
const lopDeduction = lossOfPayDays * perDayRate; // If leaves exceeded
```

#### Step 11: Calculate Overtime
```typescript
const overtimeHours = max(0, totalWorkedHours - expectedHours);
const overtimeAmount = overtimeHours * hourlyRate * 1.5;
```

#### Step 12: Calculate Net Salary
```typescript
const netSalary = grossSalary - totalDeductions + overtimeAmount;
```

---

## 📊 Attendance Processing

### Daily Attendance Calculation

**File:** `src/services/payroll.ts` → `calculateDayHours()`

#### Process:
1. **Group Logs by Date**
   ```typescript
   const dayLogs = logs.filter(log => formatDate(log.LogDate) === dateStr);
   ```

2. **Find First Entry & Last Exit**
   ```typescript
   const entries = dayLogs.filter(log => log.Direction === 'in');
   const exits = dayLogs.filter(log => log.Direction === 'out');
   
   const firstEntry = entries.sort((a, b) => a.LogDate - b.LogDate)[0];
   const lastExit = exits.sort((a, b) => b.LogDate - a.LogDate)[0];
   ```

3. **Calculate Hours**
   ```typescript
   const totalHours = (lastExit.LogDate - firstEntry.LogDate) / (1000 * 60 * 60);
   ```

4. **Determine Status**
   ```typescript
   if (totalHours >= config.halfDayHoursThreshold) {
     status = 'full-day';
   } else if (totalHours >= 5) {
     status = 'half-day';
   } else {
     status = 'absent';
   }
   ```

5. **Check Late/Early**
   ```typescript
   const isLate = firstEntry.LogDate > (shiftStart + gracePeriod);
   const isEarlyExit = lastExit.LogDate < (shiftEnd - threshold);
   ```

### Sunday Marking Logic

**File:** `src/services/payroll.ts` → `calculateMonthlyHours()`

```typescript
// Second pass: Mark Sundays as weekoff
for (each day in cycle) {
  if (isSunday && isWithinEffectiveRange) {
    // Rule 1: 5+ absent days → unpaid
    if (absentDays >= 5) {
      weekoffType = 'unpaid';
    } else {
      // Rule 2: Sandwich rule
      const saturdayStatus = getStatus(saturdayDate);
      const mondayStatus = getStatus(mondayDate);
      
      if (saturdayStatus === 'absent' && mondayStatus === 'absent') {
        weekoffType = 'unpaid'; // Sandwich rule
      } else {
        weekoffType = 'paid';
      }
    }
  }
}
```

---

## 🎫 Leave Management

### Leave Types

#### 1. Paid Leave (PL)
- **Credit:** 1.0 full day
- **Use Case:** Approved absence with full pay
- **Storage:** `MonthlyLeaveUsage.PaidLeaveDates` (JSON array)

#### 2. Casual Leave (CL)
- **Credit:** 0.5 half day
- **Use Case:** Approved absence with half pay
- **Storage:** `MonthlyLeaveUsage.CasualLeaveDates` (JSON array)

### Leave Approval Flow

```
1. User views absent dates in Salary page
2. User selects dates → Paid Leave or Casual Leave
3. Frontend auto-saves to backend (debounced 1 second)
4. Backend saves to MonthlyLeaveUsage table
5. Backend updates EmployeeLeaves table (balance)
6. Salary recalculates with leave credits
```

### Leave Balance Tracking

**Table:** `EmployeeLeaves`

```sql
EmployeeCode | Year | AllowedLeaves | UsedPaidLeaves | UsedCasualLeaves
1466        | 2025 | 12            | 3              | 2
```

**LOP Calculation:**
```typescript
const totalUsed = usedPaidLeaves + usedCasualLeaves;
const lossOfPayDays = totalUsed > allowedLeaves ? (totalUsed - allowedLeaves) : 0;
```

---

## 📄 PDF Generation

### PDF Sections

#### 1. Header
- Employee Information
- Pro-rata indicator (if applicable)
- Exit date indicator (if applicable)

#### 2. Salary Summary
- Base Salary
- Gross Salary
- Total Deductions
- Net Salary

#### 3. Attendance Summary
- Present, Half Present, Paid Leave, Casual Leave
- WO (Week Off - paid count only)
- LOP (Loss of Pay)
- TOTAL (payable/total days)
- PAY DAYS

#### 4. Salary Breakdown
- Present Days Salary
- Half Day Salary
- Paid Leave Salary
- Casual Leave Salary
- Sunday Pay
- Overtime
- Deductions (Late, Absent, Half Day, LOP, TDS, Professional Tax)

#### 5. Daily Attendance Record
- Date, First Entry, Last Exit, Hours
- Status, Flags (LATE, EARLY EXIT)
- Leave (PAID LEAVE, CASUAL LEAVE, PAID, UNPAID)
- Value (0, 0.5, or 1)
- TOTAL value

### PDF Filtering Logic

**File:** `admin-dashboard/src/pages/Salary.tsx` → `handleDownloadPDF()`

```typescript
// Filter attendance breakdown based on join/exit dates
const filteredDays = attendanceBreakdown.dailyBreakdown.filter(day => {
  if (isNewJoiner && joinDate && day.date < joinDate) return false;
  if (isExited && exitDate && day.date > exitDate) return false;
  return true;
});

// Mark Sundays as paid based on backend calculation
const paidSundaysFromBackend = salary.attendance.sundaysInMonth;
// Mark first N Sundays as paid
```

---

## 🔗 Integration Points

### 1. SQL Server Integration
- **Connection:** `src/db/pool.ts`
- **Config:** `src/config/database.ts`
- **Tables:** Monthly partitioned `DeviceLogs_MM_YYYY`
- **Query:** Multi-table queries for cross-month cycles

### 2. Excel Integration (Legacy)
- **File:** `Salary Register (53).xls`
- **Service:** `src/services/excelService.ts`
- **Usage:** Fallback for base salary if EmployeeDetails not available
- **Migration:** Moving to EmployeeDetails table

### 3. EmployeeDetails Integration
- **Purpose:** Single source of truth for HR data
- **Tables:** `EmployeeDetails`, `Shifts`
- **Data:** Joining date, exit date, base salary, shift timing

### 4. Leave Persistence
- **Table:** `MonthlyLeaveUsage`
- **Auto-save:** Debounced 1 second
- **Auto-load:** On employee/month change
- **Cross-session:** Persists across page refreshes

---

## 🔐 Security & Middleware

### 1. API Key Authentication
**File:** `src/middleware/apiKey.ts`

```typescript
// Validates X-API-Key header
if (req.headers['x-api-key'] !== process.env.API_KEY) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

### 2. IP Allowlisting
**File:** `src/middleware/ipAllowlist.ts`

```typescript
// Only allows requests from configured IP ranges
const clientIP = req.ip;
if (!isIPAllowed(clientIP)) {
  return res.status(403).json({ error: 'IP not allowed' });
}
```

### 3. Rate Limiting
**File:** `src/index.ts`

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
});
```

---

## 📈 Key Metrics & Calculations

### Attendance Metrics
- **Total Days:** Full cycle days (30)
- **Expected Working Days:** Days in effective range
- **Full Days:** Days with >= threshold hours
- **Half Days:** Days with 5+ hours but < full-day
- **Absent Days:** Days with no logs or < 5 hours
- **Late Days:** Days with late entry
- **Early Exits:** Days with early departure
- **Sunday Paid Count:** Sundays marked as paid (after sandwich rule)

### Salary Metrics
- **Base Salary:** Monthly salary from EmployeeDetails/Excel
- **Per-Day Rate:** Base Salary ÷ 30 (cycle days)
- **Hourly Rate:** Base Salary ÷ (30 × workHoursPerDay)
- **Gross Salary:** Per-day rate × total payable days
- **Net Salary:** Gross - Deductions + Overtime

### Payable Days Calculation
```
Payable Days = 
  Full Days + 
  (Half Days × 0.5) + 
  Paid Leave Days + 
  (Casual Leave Days × 0.5) + 
  Paid Sundays
```

---

## 🚀 Deployment

### Backend Deployment
- **Process Manager:** PM2
- **Config:** `ecosystem.config.js`
- **Build:** `npm run build` (TypeScript compilation)
- **Start:** `pm2 start ecosystem.config.js`

### Frontend Deployment
- **Build:** `npm run build` (Vite)
- **Output:** `admin-dashboard/dist/`
- **Serve:** Static file server (Nginx, Apache, etc.)

### Environment Variables
```env
# Database
DB_SERVER=192.168.10.31
DB_PORT=1433
DB_NAME=eTimeTrackLite
DB_USER=sa
DB_PASSWORD=your_password

# API Security
API_KEY=your_api_key
ALLOWED_IP_RANGES=192.168.10.0/24

# Payroll Config
DEFAULT_WORK_HOURS_PER_DAY=8
LATE_ENTRY_THRESHOLD_MINUTES=15
EARLY_EXIT_THRESHOLD_MINUTES=30
HALF_DAY_HOURS_THRESHOLD=5
OVERTIME_RATE_MULTIPLIER=1.5
```

---

## 📝 Key Files Reference

### Backend Core Files
- `src/index.ts` - Express app entry point
- `src/services/payroll.ts` - Salary calculation logic
- `src/controllers/SalaryController.ts` - Salary API endpoints
- `src/models/AttendanceModel.ts` - Attendance queries
- `src/models/EmployeeDetailsModel.ts` - HR data queries
- `src/utils/date.ts` - Date utilities (cycle calculation)

### Frontend Core Files
- `admin-dashboard/src/pages/Salary.tsx` - Individual salary page
- `admin-dashboard/src/pages/SalarySummary.tsx` - Batch processing
- `admin-dashboard/src/lib/api.ts` - API client
- `admin-dashboard/src/utils/format.ts` - Formatting utilities

### Database Files
- `sql/schema.sql` - Main schema
- `sql/create_employee_details_table.sql` - EmployeeDetails table
- `sql/leave_management_migration.sql` - Leave tables
- `sql/shift_management_migration.sql` - Shift tables

---

## 🎯 Summary

This system provides a complete payroll and attendance management solution with:

1. **Flexible Salary Cycles:** 26th to 25th (always 30 days)
2. **Pro-Rata Support:** Automatic calculation for new joiners
3. **Leave Management:** Persistent leave approvals with balance tracking
4. **Sunday Pay Logic:** Sandwich rule for paid/unpaid Sundays
5. **Comprehensive PDFs:** Detailed reports with all calculations
6. **Batch Processing:** Summary salary for all employees
7. **Database Integration:** SQL Server for attendance, EmployeeDetails for HR data
8. **Security:** API key + IP allowlisting

All calculations are consistent across:
- Individual Salary page
- Salary Summary page
- PDF generation
- Backend API responses

---

**Last Updated:** Based on current implementation
**Version:** 1.0
**Maintained By:** Development Team

