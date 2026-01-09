# Paid Leave (PL) and Casual Leave (CL) - Complete Documentation

## 📋 Overview

This document explains how **Paid Leave (PL)** and **Casual Leave (CL)** work in the Payroll & Attendance Management System, including their storage, calculation logic, and impact on salary.

---

## 🎯 Key Business Rules

### **Paid Leave (PL)**
- **Credit:** Full Day (1.0 day)
- **Salary Impact:** No deduction - employee receives full day salary
- **Usage:** Counts as 1 full day against annual entitlement
- **Applicable To:** Days marked as `'absent'` or `'half-day'` in attendance

### **Casual Leave (CL)**
- **Credit:** Half Day (0.5 day)
- **Salary Impact:** Partial payment - employee receives 0.5 day salary
- **Usage:** Counts as 0.5 day against annual entitlement
- **Applicable To:** Days marked as `'absent'` or `'half-day'` in attendance
- **Special Rule:** Adds 0.5 days on top of existing attendance status

---

## 💾 Database Storage

### **Table: `MonthlyLeaveUsage`**

Stores month-by-month leave approvals that persist across sessions.

**Schema:**
```sql
CREATE TABLE dbo.MonthlyLeaveUsage (
    MonthlyLeaveUsageId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeCode NVARCHAR(50) NOT NULL,
    LeaveMonth VARCHAR(7) NOT NULL,  -- Format: YYYY-MM
    PaidLeaveDaysUsed INT NOT NULL DEFAULT 0,
    CasualLeaveDaysUsed DECIMAL(5,2) NOT NULL DEFAULT 0,  -- Supports 0.5 per date
    PaidLeaveDates VARCHAR(500) NULL,  -- Comma-separated dates: '2025-11-06,2025-11-15'
    CasualLeaveDates VARCHAR(500) NULL,  -- Comma-separated dates: '2025-11-10,2025-11-20'
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedBy VARCHAR(100) NULL,
    
    CONSTRAINT UQ_MonthlyLeaveUsage_Employee_Month 
        UNIQUE (EmployeeCode, LeaveMonth)
);
```

### **Table: `EmployeeLeaves`**

Tracks annual leave entitlements and cumulative usage.

**Schema:**
```sql
CREATE TABLE dbo.EmployeeLeaves (
    EmployeeLeavesId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeCode NVARCHAR(50) NOT NULL,
    LeaveYear INT NOT NULL,
    AllowedLeaves INT NOT NULL,  -- Annual entitlement (e.g., 12 days)
    UsedPaidLeaves INT NOT NULL DEFAULT 0,  -- Cumulative paid leaves used
    UsedCasualLeaves DECIMAL(5,2) NOT NULL DEFAULT 0,  -- Cumulative casual leaves used (0.5 per date)
    
    CONSTRAINT UQ_EmployeeLeaves_Employee_Year 
        UNIQUE (EmployeeCode, LeaveYear)
);
```

---

## 🔄 Data Flow

### **1. User Approval (Frontend)**

**Location:** `admin-dashboard/src/pages/Salary.tsx`

1. User selects employee and month
2. System loads persisted leave approvals from database
3. User opens "Paid Leave" or "Casual Leave" modal
4. User selects absent/half-day dates to approve
5. System auto-saves to database (debounced 1 second)
6. Salary automatically recalculates

**API Call:**
```typescript
POST /api/leave/approve
Body: {
  employeeCode: string,
  month: string,  // YYYY-MM
  paidLeaveDates: string[],  // ['2025-11-06', '2025-11-15']
  casualLeaveDates: string[],  // ['2025-11-10']
  approvedBy?: string
}
```

### **2. Database Storage**

**Location:** `src/models/LeaveModel.ts`

- Dates stored as comma-separated strings: `'2025-11-06,2025-11-15'`
- `PaidLeaveDaysUsed` = count of dates (1 per date)
- `CasualLeaveDaysUsed` = count of dates × 0.5 (0.5 per date)
- Uses stored procedure `UpsertMonthlyLeaveUsage` for atomic upsert

### **3. Salary Calculation**

**Location:** `src/services/payroll.ts`

**Process:**
1. Fetch leave approvals from `MonthlyLeaveUsage` table
2. Apply paid leave adjustments (convert `'absent'`/`'half-day'` → `'paid-leave'`)
3. Apply casual leave adjustments (convert `'absent'`/`'half-day'` → `'casual-leave'`)
4. Calculate payable days: `actualDaysWorked + payableSundays + approvedLeaveDays`
5. Calculate gross salary: `perDayRate × totalPayableDays`

---

## 📊 Salary Calculation Impact

### **Formula:**

```
Total Payable Days = 
  Actual Days Worked 
  + Payable Sundays 
  + Paid Leave Days (1.0 per date)
  + Casual Leave Days (0.5 per date)

Gross Salary = Per Day Rate × Total Payable Days
```

### **Example Calculation:**

**Scenario:**
- Base Salary: ₹30,000
- Salary Cycle: 30 days (26th to 25th)
- Per Day Rate: ₹30,000 / 30 = ₹1,000
- Actual Days Worked: 22 days
- Payable Sundays: 4 days
- Paid Leave Approved: 2 dates → 2.0 days
- Casual Leave Approved: 1 date → 0.5 days

**Calculation:**
```
Total Payable Days = 22 + 4 + 2.0 + 0.5 = 28.5 days
Gross Salary = ₹1,000 × 28.5 = ₹28,500
```

---

## 🎯 Detailed Business Rules

### **Paid Leave (PL) Processing**

**When Applied:**
- Only to dates marked as `'absent'` or `'half-day'` in attendance
- If date is already `'full-day'`, leave approval is ignored (with warning)

**Status Conversion:**
```
'absent' → 'paid-leave'     (absentDays decreases by 1)
'half-day' → 'paid-leave'   (halfDays decreases by 1, fullDays increases by 1)
```

**Salary Credit:**
- **1.0 full day** added to payable days
- No salary deduction

**Example:**
- Employee was absent on `2025-11-06`
- Approved as Paid Leave
- Result: `2025-11-06` counts as 1.0 payable day (full salary)

---

### **Casual Leave (CL) Processing**

**When Applied:**
- Only to dates marked as `'absent'` or `'half-day'` in attendance
- If date is already `'full-day'`, leave approval is ignored (with warning)

**Status Conversion:**
```
'absent' → 'casual-leave'     (absentDays decreases by 1, 0.5 day credit)
'half-day' → 'casual-leave'   (halfDays stays same, 0.5 day credit added)
```

**Salary Credit:**
- **0.5 day** added to payable days (always)
- If original status was `'absent'`: 0.5 day paid, 0.5 day not paid
- If original status was `'half-day'`: 0.5 worked + 0.5 casual = 1.0 day total

**Example 1: Absent Day Approved as CL**
- Employee was absent on `2025-11-10`
- Approved as Casual Leave
- Result: `2025-11-10` counts as 0.5 payable day (half salary)

**Example 2: Half-Day Approved as CL**
- Employee worked half-day on `2025-11-15` (4 hours)
- Approved as Casual Leave
- Result: 0.5 day worked + 0.5 day casual leave = 1.0 day total (full salary)

---

## 📅 Sunday Payment Rules

### **Impact of Leave Approvals on Sunday Payment**

**Important Rule:** Leave approvals affect Sunday payment via the **Sandwich Rule**.

**Sandwich Rule:**
- Sunday is **PAID** unless employee was **UNPAID ABSENT** on **BOTH** Saturday AND Monday
- Paid leave and casual leave days are **NOT** considered "absent" for sandwich rule
- Only days with status `'absent'` (unpaid) count as truly absent

**Example:**
```
Saturday: 'paid-leave' (approved PL)
Sunday: 'weekoff'
Monday: 'absent' (unpaid)

Result: Sunday is PAID (because Saturday was paid-leave, not unpaid absent)
```

**5+ Days Rule:**
- If employee has **5+ LOP days** (original absent + half-days AFTER regularization, BEFORE PL/CL), **ALL Sundays are unpaid**
- PL/CL approvals do **NOT** change this rule
- Uses **ORIGINAL** count (before PL/CL adjustments)

---

## 💰 Loss of Pay (LOP) Calculation

### **When LOP is Applied:**

LOP is triggered when total used leaves exceed annual entitlement.

**Formula:**
```
Total Used Leaves = UsedPaidLeaves + UsedCasualLeaves
LOP Days = Total Used Leaves - AllowedLeaves (if > 0)
LOP Deduction = LOP Days × Per Day Rate
```

**Example:**
- Allowed Leaves: 12 days
- Used Paid Leaves: 10 days
- Used Casual Leaves: 3.0 days (6 dates × 0.5)
- Total Used: 10 + 3.0 = 13 days
- LOP Days: 13 - 12 = 1 day
- LOP Deduction: 1 × ₹1,000 = ₹1,000

---

## 🔌 API Endpoints

### **1. Save Leave Approvals**

```
POST /api/leave/approve
```

**Request Body:**
```json
{
  "employeeCode": "1162",
  "month": "2025-11",
  "paidLeaveDates": ["2025-11-06", "2025-11-15"],
  "casualLeaveDates": ["2025-11-10"],
  "approvedBy": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operation": "UPDATED",
    "record": {
      "MonthlyLeaveUsageId": 1,
      "EmployeeCode": "1162",
      "LeaveMonth": "2025-11",
      "PaidLeaveDaysUsed": 2,
      "CasualLeaveDaysUsed": 0.5,
      "PaidLeaveDates": "2025-11-06,2025-11-15",
      "CasualLeaveDates": "2025-11-10"
    }
  }
}
```

### **2. Get Monthly Leave Usage**

```
GET /api/leave/{employeeCode}/monthly/{month}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "MonthlyLeaveUsageId": 1,
    "EmployeeCode": "1162",
    "LeaveMonth": "2025-11",
    "PaidLeaveDaysUsed": 2,
    "CasualLeaveDaysUsed": 0.5,
    "PaidLeaveDates": "2025-11-06,2025-11-15",
    "CasualLeaveDates": "2025-11-10",
    "CreatedAt": "2025-11-01T10:00:00Z",
    "UpdatedAt": "2025-11-15T14:30:00Z",
    "UpdatedBy": "admin"
  }
}
```

### **3. Get Leave Balance**

```
GET /api/leave/{employeeCode}/balance?year=2025
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowedLeaves": 12,
    "usedPaidLeaves": 10,
    "usedCasualLeaves": 3.0,
    "totalUsedLeaves": 13.0,
    "remainingLeaves": 0,
    "isExceeded": true,
    "lossOfPayDays": 1
  }
}
```

---

## 🖥️ Frontend UI Workflow

### **1. Loading Leave Approvals**

**When:** Employee or month changes

**Process:**
1. System calls `GET /api/leave/{employeeCode}/monthly/{month}`
2. Parses comma-separated dates from database
3. Populates leave date arrays in UI state
4. Displays selected dates in modals

**Code Location:** `admin-dashboard/src/pages/Salary.tsx` → `loadPersistedLeaveApprovals()`

### **2. Approving Leaves**

**Process:**
1. User clicks "Paid Leave" or "Casual Leave" button
2. Modal opens showing absent/half-day dates
3. User selects dates to approve
4. System auto-saves (debounced 1 second)
5. Salary automatically recalculates

**Code Location:** `admin-dashboard/src/pages/Salary.tsx` → `saveLeaveApprovals()`

### **3. Display in Salary Breakdown**

**Shown As:**
- **Paid Leave:** Counted in `totalPayableDays`
- **Casual Leave:** Counted as 0.5 days in `totalPayableDays`
- **LOP:** Shown as deduction if leaves exceed entitlement

---

## 📝 Examples

### **Example 1: Basic Leave Approval**

**Scenario:**
- Employee absent on: `2025-11-06`, `2025-11-07`
- Approved as Paid Leave: `2025-11-06`
- Approved as Casual Leave: `2025-11-07`

**Result:**
- `2025-11-06`: Status = `'paid-leave'`, Credit = 1.0 day
- `2025-11-07`: Status = `'casual-leave'`, Credit = 0.5 day
- Total Leave Credit: 1.5 days
- Salary Impact: +1.5 days × perDayRate

---

### **Example 2: Half-Day with Casual Leave**

**Scenario:**
- Employee worked half-day on `2025-11-10` (4 hours)
- Approved as Casual Leave: `2025-11-10`

**Result:**
- Original: 0.5 day worked
- Casual Leave: +0.5 day credit
- Total: 1.0 day payable
- Salary Impact: Full day salary (no deduction)

---

### **Example 3: Leave Entitlement Exceeded**

**Scenario:**
- Allowed Leaves: 12 days
- Used Paid Leaves: 11 days
- Used Casual Leaves: 2.0 days (4 dates)
- Total Used: 13 days

**Result:**
- LOP Days: 13 - 12 = 1 day
- LOP Deduction: 1 × ₹1,000 = ₹1,000
- Net Salary: Gross Salary - ₹1,000

---

## 🔍 Important Notes

### **1. Leave Validation**
- Only dates marked as `'absent'` or `'half-day'` can be approved
- Dates already `'full-day'` are ignored (with console warning)
- Dates must be in the selected month (YYYY-MM format)

### **2. Persistence**
- Leave approvals are **automatically saved** to database
- Survive page refresh and browser restart
- Loaded automatically when employee/month changes

### **3. Salary Recalculation**
- Salary **automatically recalculates** after leave approval
- No manual refresh needed
- Gross salary updates immediately

### **4. Sunday Payment**
- PL/CL approvals affect Sunday payment via sandwich rule
- PL/CL days are **NOT** considered "absent" for sandwich rule
- 5+ days rule uses **ORIGINAL** count (before PL/CL)

### **5. Loss of Pay (LOP)**
- Calculated based on **annual** entitlement
- Includes both paid and casual leaves
- Casual leave counts as 0.5 day towards entitlement
- LOP deduction applied to final net salary

---

## 🗂️ File Locations

### **Backend:**
- **Model:** `src/models/LeaveModel.ts`
- **Controller:** `src/controllers/LeaveController.ts`
- **Routes:** `src/routes/leave.ts`
- **Service:** `src/services/payroll.ts` (calculation logic)
- **Migration:** `sql/leave_management_migration.sql`

### **Frontend:**
- **UI Component:** `admin-dashboard/src/pages/Salary.tsx`
- **API Client:** `admin-dashboard/src/lib/api.ts`
- **Types:** `admin-dashboard/src/types/index.ts`

---

## 📊 Database Tables Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `MonthlyLeaveUsage` | Month-by-month leave approvals | `PaidLeaveDates`, `CasualLeaveDates` |
| `EmployeeLeaves` | Annual leave entitlements | `AllowedLeaves`, `UsedPaidLeaves`, `UsedCasualLeaves` |

---

## ✅ Summary

**Paid Leave (PL):**
- ✅ Full day credit (1.0 day)
- ✅ No salary deduction
- ✅ Counts as 1 day against entitlement
- ✅ Converts absent/half-day to paid-leave status

**Casual Leave (CL):**
- ✅ Half day credit (0.5 day)
- ✅ Partial salary payment
- ✅ Counts as 0.5 day against entitlement
- ✅ Adds 0.5 days on top of existing attendance

**Both:**
- ✅ Persist in database
- ✅ Survive page refresh
- ✅ Auto-save on approval
- ✅ Auto-recalculate salary
- ✅ Affect Sunday payment (sandwich rule)
- ✅ Included in LOP calculation

---

**Last Updated:** 2025-12-30

