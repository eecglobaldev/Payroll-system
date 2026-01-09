# 🚀 Attendance & Payroll System - Implementation Journey

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Implementation Timeline](#implementation-timeline)
3. [System Architecture](#system-architecture)
4. [Core Features](#core-features)
5. [Feature Flowcharts](#feature-flowcharts)
6. [Business Rules](#business-rules)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [System Integration](#system-integration)

---

## 🎯 Project Overview

### What We Built

A comprehensive **Payroll & Attendance Management System** that automates the entire employee salary calculation process. The system connects biometric devices, processes attendance data, manages leaves, and generates detailed salary reports.

### Key Capabilities

- ✅ Real-time attendance tracking from biometric devices
- ✅ Automatic salary calculation with complex business rules
- ✅ Leave management with approval workflow
- ✅ Shift-based attendance processing
- ✅ Pro-rata salary for new joiners
- ✅ Final settlement for exiting employees
- ✅ PDF report generation
- ✅ Batch processing for multiple employees

---

## 📅 Implementation Timeline

### Phase 1: Foundation Setup

**What We Did:**
- Set up Node.js backend with TypeScript
- Connected to SQL Server database (biometric attendance data)
- Created basic API structure with Express.js
- Implemented security middleware (API keys, IP allowlisting)

**Result:**
- Basic REST API ready to receive requests
- Secure connection to attendance database
- Foundation for all future features

---

### Phase 2: Attendance Data Retrieval

**What We Did:**
- Created models to query monthly partitioned attendance tables
- Built attendance summary endpoints
- Implemented daily attendance breakdown
- Added cross-month query support (for salary cycles spanning two months)

**Result:**
- System can fetch attendance logs from biometric devices
- Daily attendance status calculation (present, half-day, absent)
- Entry/exit time tracking

---

### Phase 3: Salary Calculation Engine

**What We Did:**
- Implemented custom salary cycle (26th to 25th of next month)
- Created payroll calculation service
- Added pro-rata calculation for new joiners
- Implemented final settlement for exiting employees
- Built deduction logic (late, absent, half-day)
- Added overtime calculation

**Result:**
- Complete salary calculation with all business rules
- Accurate per-day rate calculation
- Automatic deduction handling

---

### Phase 4: Leave Management System

**What We Did:**
- Created leave approval database tables
- Built persistent leave storage (survives page refresh)
- Implemented paid leave and casual leave types
- Added leave balance tracking
- Created Loss of Pay (LOP) calculation
- Integrated leave approvals into salary calculation

**Result:**
- Leave approvals persist in database
- Automatic leave balance tracking
- Leave credits applied to salary automatically

---

### Phase 5: Shift Management

**What We Did:**
- Created shift configuration tables
- Implemented dynamic shift timing
- Added shift-based late entry detection
- Built shift-based early exit detection
- Updated salary calculation to use shift work hours

**Result:**
- Support for multiple shifts (8 AM, 9 AM, 10 AM, etc.)
- Accurate late/early detection per shift
- Flexible work hours per shift

---

### Phase 6: Attendance Regularization

**What We Did:**
- Created regularization database table
- Built regularization approval workflow
- Integrated regularization into salary calculation
- Added regularization markers in PDF reports

**Result:**
- Admins can regularize absent/half-day attendance
- Regularized days count as present in salary
- Audit trail for all regularizations

---

### Phase 7: Frontend Dashboard

**What We Did:**
- Built React-based admin dashboard
- Created individual salary calculation page
- Built batch salary summary page
- Implemented PDF generation
- Added employee management interface

**Result:**
- User-friendly interface for salary processing
- Real-time salary calculation
- Professional PDF reports

---

### Phase 8: Advanced Features

**What We Did:**
- Implemented Sunday pay logic (sandwich rule)
- Added salary hold functionality
- Created overtime tracking
- Built salary adjustment system
- Added date-wise shift assignments

**Result:**
- Complete payroll system with all edge cases handled
- Flexible salary modifications
- Comprehensive reporting

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Dashboard (React)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Salary Page  │  │ Salary Summary│  │ Attendance    │    │
│  │ (Individual) │  │ (Batch)       │  │ View          │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
                       │ (API Key Protected)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Express.js Backend (TypeScript)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Controllers  │  │   Services   │  │    Models    │      │
│  │ - Salary     │  │  - Payroll    │  │  - Attendance│      │
│  │ - Attendance │  │  - Leave      │  │  - Employee   │      │
│  │ - Leave      │  │  - Excel      │  │  - Leave      │      │
│  │ - Employee   │  │               │  │  - Shift     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
│ SQL Server  │  │  Excel Files  │  │  Employee    │
│ (Attendance)│  │  (Salary Data) │  │  Details DB  │
│             │  │                │  │              │
│ DeviceLogs  │  │  Base Salary   │  │  HR Data     │
│ Tables      │  │  Information   │  │  Joining/Exit│
└─────────────┘  └───────────────┘  └──────────────┘
```

### MVC Pattern Implementation

**Model Layer:**
- Handles all database queries
- Returns raw data
- No business logic

**Controller Layer:**
- Processes HTTP requests
- Calls services for business logic
- Formats responses

**Service Layer:**
- Contains all business rules
- Performs calculations
- Coordinates between models

---

## 🎨 Core Features

### 1. Attendance Tracking

**Description:**
Automatically fetches attendance logs from biometric devices stored in SQL Server. Processes daily attendance to determine present, half-day, or absent status.

**Key Capabilities:**
- Real-time attendance data retrieval
- Cross-month query support
- Entry/exit time tracking
- Late entry detection
- Early exit detection

---

### 2. Salary Calculation

**Description:**
Comprehensive salary calculation engine that handles all business rules including pro-rata, deductions, overtime, and leave credits.

**Key Capabilities:**
- Custom salary cycle (26th to 25th)
- Pro-rata for new joiners
- Final settlement for exits
- Automatic deduction calculation
- Overtime calculation
- Leave credit application

---

### 3. Leave Management

**Description:**
Persistent leave approval system that tracks paid leaves and casual leaves with annual balance management.

**Key Capabilities:**
- Leave approval storage
- Auto-save functionality
- Leave balance tracking
- Loss of Pay calculation
- Monthly leave usage tracking

---

### 4. Shift Management

**Description:**
Dynamic shift timing system that supports multiple shifts with different start/end times and work hours.

**Key Capabilities:**
- Multiple shift configurations
- Shift-based late detection
- Shift-based early exit detection
- Date-wise shift assignments
- Split shift support

---

### 5. Attendance Regularization

**Description:**
Allows admins to regularize absent or half-day attendance, converting them to present days for salary calculation.

**Key Capabilities:**
- Regularization approval workflow
- Automatic salary recalculation
- Audit trail
- PDF report markers

---

### 6. PDF Report Generation

**Description:**
Generates professional PDF salary reports with complete breakdown of attendance, deductions, and earnings.

**Key Capabilities:**
- Detailed attendance table
- Salary breakdown
- Leave information
- Regularization markers
- Professional formatting

---

### 7. Batch Processing

**Description:**
Processes salary for multiple employees at once with progress tracking and summary reports.

**Key Capabilities:**
- Bulk salary calculation
- Progress tracking
- Error handling
- Summary statistics
- Batch PDF generation

---

## 📊 Feature Flowcharts

### Salary Calculation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Action                              │
│         Select Employee + Month                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend: Salary Page                           │
│  • Load Employee Details (joining/exit dates)                │
│  • Load Leave Approvals (from database)                      │
│  • Send API Request                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           Backend: Salary Controller                         │
│  • Extract parameters (dates, leaves)                         │
│  • Call Payroll Service                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Service: Payroll Calculation                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 1: Get Salary Cycle Range                     │    │
│  │         (26th previous month to 25th current month) │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 2: Apply Effective Range                       │    │
│  │         (Join date / Exit date if applicable)       │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 3: Fetch Attendance Data                       │    │
│  │         • Query DeviceLogs tables                   │    │
│  │         • Group by date                             │    │
│  │         • Calculate daily hours                     │    │
│  │         • Determine status (present/half/absent)    │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 4: Count Payable Sundays                      │    │
│  │         • Apply sandwich rule                       │    │
│  │         • Check 5+ absent days rule                 │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 5: Get Base Salary                             │    │
│  │         • From EmployeeDetails or Excel             │    │
│  │         • Calculate per-day rate                    │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 6: Apply Leave Approvals                      │    │
│  │         • Paid Leave = 1.0 day credit              │    │
│  │         • Casual Leave = 0.5 day credit             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 7: Calculate Deductions                       │    │
│  │         • Late deduction (after 3 grace days)       │    │
│  │         • Absent deduction                          │    │
│  │         • Half-day deduction                        │    │
│  │         • Loss of Pay (if leaves exceeded)          │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 8: Calculate Overtime                        │    │
│  │         • Extra hours worked                        │    │
│  │         • Overtime rate (1.5x)                     │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 9: Calculate Net Salary                       │    │
│  │         Net = Gross - Deductions + Overtime        │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Return Salary Calculation                       │
│  • Base Salary                                               │
│  • Gross Salary                                              │
│  • Net Salary                                                │
│  • Attendance Summary                                        │
│  • Breakdown Details                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend Display                                │
│  • Show Salary Details                                       │
│  • Display Attendance Breakdown                             │
│  • Generate PDF Report                                       │
└─────────────────────────────────────────────────────────────┘
```

---

### Attendance Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Biometric Device                                 │
│         Records Entry/Exit Timestamps                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         SQL Server: DeviceLogs Tables                        │
│  • DeviceLogs_10_2025 (October)                              │
│  • DeviceLogs_11_2025 (November)                             │
│  • Monthly partitioned tables                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         API Request: Get Attendance Summary                  │
│  GET /api/attendance/summary/:userId?month=2025-11           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Attendance Model: Query Database                    │
│  • Query DeviceLogs_10_2025 (Oct 26-31)                     │
│  • Query DeviceLogs_11_2025 (Nov 1-25)                       │
│  • Combine results                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Payroll Service: Process Attendance                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │ For Each Day:                                      │     │
│  │  • Group logs by date                              │     │
│  │  • Find first entry (earliest "in")                │     │
│  │  • Find last exit (latest "out")                  │     │
│  │  • Calculate total hours                           │     │
│  │  • Check if late (after shift start + grace)      │     │
│  │  • Check if early exit (before shift end)          │     │
│  │  • Determine status:                               │     │
│  │    - Full-day: hours >= threshold                  │     │
│  │    - Half-day: hours >= 5 but < full-day          │     │
│  │    - Absent: no logs or hours < 5                  │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Mark Sundays:                                       │     │
│  │  • Check if Sunday                                  │     │
│  │  • Apply sandwich rule                               │     │
│  │  • Mark as paid/unpaid weekoff                      │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Return Monthly Attendance Summary                    │
│  • Total Days                                                │
│  • Full Days                                                 │
│  • Half Days                                                 │
│  • Absent Days                                               │
│  • Late Days                                                 │
│  • Total Worked Hours                                        │
│  • Daily Breakdown                                           │
└─────────────────────────────────────────────────────────────┘
```

---

### Leave Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Admin Action: Approve Leave                      │
│  • View absent dates in Salary page                          │
│  • Select dates for Paid Leave or Casual Leave               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: Auto-Save (Debounced 1 second)            │
│  • Prepare leave approval data                               │
│  • Send POST request to backend                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend: Leave Controller                            │
│  • Validate request data                                     │
│  • Check employee exists                                     │
│  • Validate leave entitlement                                │
│  • Call Leave Service                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Leave Service: Save Approvals                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Step 1: Save to MonthlyLeaveUsage Table            │     │
│  │         • Upsert operation (insert or update)      │     │
│  │         • Store paid leave dates                   │     │
│  │         • Store casual leave dates                 │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Step 2: Update Annual Leave Balance                │     │
│  │         • Update UsedPaidLeaves                     │     │
│  │         • Update UsedCasualLeaves                  │     │
│  │         • Calculate remaining leaves                │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Step 3: Calculate Loss of Pay (if exceeded)        │     │
│  │         • Check if used > allowed                   │     │
│  │         • Calculate LOP days                        │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Return Leave Balance                                 │
│  • Monthly leave usage saved                                │
│  • Annual balance updated                                   │
│  • Remaining leaves                                          │
│  • Loss of Pay days (if any)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: Recalculate Salary                        │
│  • Fetch updated salary with leave credits                   │
│  • Display new salary amount                                 │
│  • Show leave balance                                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Page Refresh Persistence Flow

```
┌─────────────────────────────────────────────────────────────┐
│         User Refreshes Salary Page                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: Load Employee & Month                      │
│  • Employee selected                                         │
│  • Month selected                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: Load Persisted Leave Approvals             │
│  • Call API: GET /api/leave/:employeeId/monthly/:month      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend: Fetch from Database                         │
│  • Query MonthlyLeaveUsage table                             │
│  • Return paid leave dates                                   │
│  • Return casual leave dates                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: Restore Leave Approvals                    │
│  • Set paid leave dates state                                │
│  • Set casual leave dates state                              │
│  • Mark as loaded from database                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Frontend: Calculate Salary                           │
│  • Use persisted leave dates                                 │
│  • Fetch salary calculation                                  │
│  • Display same salary as before refresh                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Shift-Based Attendance Flow

```
┌─────────────────────────────────────────────────────────────┐
│         Employee Has Assigned Shift                          │
│  • Shift B: 08:00 - 17:00                                   │
│  • Shift C: 09:00 - 18:00                                   │
│  • Shift D: 10:00 - 19:00 (Default)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Fetch Employee Shift Configuration                   │
│  • Get shift from EmployeeDetails table                     │
│  • Get shift timing from Shifts table                       │
│  • Get work hours per day                                    │
│  • Get late threshold minutes                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Process Daily Attendance                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │ For Each Day:                                      │     │
│  │  • Get first entry time                            │     │
│  │  • Get last exit time                               │     │
│  │  • Calculate total hours                           │     │
│  │  • Check Late Entry:                               │     │
│  │    - Entry time > (Shift Start + Threshold)        │     │
│  │  • Check Early Exit:                                │     │
│  │    - Exit time < (Shift End - Threshold)          │     │
│  │  • Determine Status:                                │     │
│  │    - Based on shift work hours                     │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Calculate Salary with Shift                          │
│  • Use shift work hours for expected hours                   │
│  • Calculate hourly rate based on shift                      │
│  • Apply shift-based late deductions                        │
│  • Calculate overtime based on shift hours                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Attendance Regularization Flow

```
┌─────────────────────────────────────────────────────────────┐
│         Admin Views Absent/Half-Day Dates                    │
│  • Salary page shows attendance breakdown                   │
│  • Absent dates highlighted                                  │
│  • Half-day dates highlighted                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Admin Clicks "Attendance Regularization"            │
│  • Modal opens with eligible dates                          │
│  • Shows absent and half-day dates                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Admin Selects Dates to Regularize                   │
│  • Check dates to regularize                                 │
│  • Enter reason (optional)                                  │
│  • Submit regularization                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend: Save Regularization                         │
│  • Save to AttendanceRegularization table                    │
│  • Store date, employee, reason                              │
│  • Mark as approved                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Recalculate Salary                                   │
│  • Regularized absent → Full day present                     │
│  • Regularized half-day → Full day present                   │
│  • Salary increases accordingly                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         PDF Report Shows Regularization                      │
│  • Daily table shows "REG (ABSENT)" or "REG (HALF-DAY)"      │
│  • Attendance summary includes regularized days               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Business Rules

### 1. Salary Cycle Rule

**Rule:** Salary is calculated from 26th of previous month to 25th of current month

**Example:**
- Request Month: November 2025
- Salary Cycle: October 26, 2025 → November 25, 2025
- Total Days: Always 30 days

**Why:** Ensures consistent monthly calculation period

---

### 2. Pro-Rata Calculation Rule

**Rule:** New joiners get salary only for days worked from joining date

**Trigger:** "New Joining" toggle enabled + joining date provided

**Calculation:**
- Effective Start = Maximum of (Cycle Start, Joining Date)
- Only count days from effective start onwards

**Example:**
- Joining Date: October 29, 2025
- Cycle: October 26 - November 25
- Effective Start: October 29 (later date)
- Salary calculated for: October 29 - November 25

---

### 3. Final Settlement Rule

**Rule:** Exiting employees get salary only up to exit date

**Trigger:** "Contract Cessation" toggle enabled + exit date provided

**Calculation:**
- Effective End = Minimum of (Cycle End, Exit Date)
- Only count days up to effective end

**Example:**
- Exit Date: November 15, 2025
- Cycle: October 26 - November 25
- Effective End: November 15 (earlier date)
- Salary calculated for: October 26 - November 15

---

### 4. Sunday Pay Rule (Sandwich Rule)

**Rule 1:** If employee has 5 or more absent days in the cycle, NO Sundays are paid

**Rule 2:** A Sunday is NOT paid if employee was absent on BOTH Saturday AND Monday (sandwich rule)

**Rule 3:** Otherwise, Sunday is paid

**Example:**
- Sunday: November 2, 2025
- Saturday (Nov 1): Present
- Monday (Nov 3): Absent
- Result: Sunday is PAID (only Monday absent, not both)

---

### 5. Leave Approval Rules

**Paid Leave:**
- Credit: 1.0 full day
- No salary deduction
- Counts as 1 day against annual entitlement

**Casual Leave:**
- Credit: 0.5 half day
- No salary deduction for 0.5 day
- Counts as 0.5 day against annual entitlement

**Storage:**
- Saved to MonthlyLeaveUsage table
- Auto-loaded when employee/month changes
- Persists across page refreshes

---

### 6. Attendance Status Rules

**Full-Day:**
- Hours worked >= Full-day threshold (based on shift)
- Gets full day salary credit

**Half-Day:**
- Hours worked >= 5 but < Full-day threshold
- Gets 0.5 day salary credit

**Absent:**
- No attendance logs OR hours < 5
- No salary credit (unless leave approved or regularized)

**Late Entry:**
- Entry after (Shift Start + Grace Period)
- First 3 late days per month are free
- After 3 days: 25% deduction per late day

**Early Exit:**
- Exit before (Shift End - Threshold)
- Flagged but no deduction (unless causes half-day)

---

### 7. Deduction Rules

**Late Deduction:**
- Grace Period: First 3 late days free
- After 3 days: 25% of per-day rate per late day

**Absent Deduction:**
- Per-day rate × number of absent days
- Not applied if leave approved or regularized

**Half-Day Deduction:**
- 50% of per-day rate per half-day
- Not applied if leave approved or regularized

**Loss of Pay (LOP):**
- Triggered when: Used Leaves > Allowed Leaves
- LOP Days = (UsedPaidLeaves + UsedCasualLeaves) - AllowedLeaves
- Deduction = LOP Days × Per Day Rate

---

### 8. Overtime Rules

**Calculation:**
- Overtime Hours = Maximum of (0, Total Worked Hours - Expected Hours)
- Expected Hours = (Working Days × Shift Work Hours)

**Rate:**
- Overtime Rate = Hourly Rate × 1.5 (configurable multiplier)

**Payment:**
- Overtime Amount = Overtime Hours × Overtime Rate
- Added to gross salary

---

### 9. Shift Management Rules

**Multiple Shifts:**
- Each employee can have different shift timing
- Shift determines: start time, end time, work hours

**Late Detection:**
- Based on shift start time + late threshold
- Example: Shift 10:00 AM, Late = after 10:10 AM

**Early Exit Detection:**
- Based on shift end time - early exit threshold
- Example: Shift 7:00 PM, Early = before 6:30 PM

**Work Hours:**
- Based on shift configuration
- Used for expected hours calculation
- Used for overtime calculation

---

### 10. Regularization Rules

**Eligibility:**
- Only absent or half-day dates can be regularized
- Regularization converts to full-day present

**Salary Impact:**
- Regularized Absent → +1 day pay
- Regularized Half-Day → +0.5 day pay

**Storage:**
- Saved to AttendanceRegularization table
- Includes reason and approval timestamp
- Shown in PDF reports

---

## 🔄 Data Flow Diagrams

### Complete Salary Calculation Data Flow

```
┌──────────────┐
│   Frontend   │
│  (React App) │
└──────┬───────┘
       │ HTTP Request
       │ (Employee ID, Month, Dates, Leaves)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  • API Key Validation                                       │
│  • IP Allowlist Check                                        │
│  • Rate Limiting                                             │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              Salary Controller                              │
│  • Extract Parameters                                       │
│  • Validate Input                                            │
│  • Call Payroll Service                                      │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              Payroll Service                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 1. Get Employee Details                            │     │
│  │    └─→ EmployeeDetails Model                       │     │
│  │         └─→ SQL Server: EmployeeDetails Table     │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 2. Get Base Salary                                │     │
│  │    └─→ Excel Service                              │     │
│  │         └─→ Excel File: Salary Register           │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 3. Get Attendance Data                             │     │
│  │    └─→ Attendance Model                            │     │
│  │         └─→ SQL Server: DeviceLogs Tables           │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 4. Get Leave Approvals                              │     │
│  │    └─→ Leave Model                                  │     │
│  │         └─→ SQL Server: MonthlyLeaveUsage Table     │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 5. Get Leave Entitlement                            │     │
│  │    └─→ Leave Model                                  │     │
│  │         └─→ SQL Server: EmployeeLeaves Table        │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 6. Get Shift Configuration                         │     │
│  │    └─→ Shift Model                                 │     │
│  │         └─→ SQL Server: Shifts Table               │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 7. Get Regularizations                              │     │
│  │    └─→ Attendance Model                            │     │
│  │         └─→ SQL Server: AttendanceRegularization    │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 8. Calculate Salary                                │     │
│  │    • Process attendance                            │     │
│  │    • Apply leave credits                           │     │
│  │    • Calculate deductions                         │     │
│  │    • Calculate overtime                           │     │
│  │    • Apply regularizations                        │     │
│  └────────────────────────────────────────────────────┘     │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              Return Salary Calculation                       │
│  • Base Salary                                               │
│  • Gross Salary                                              │
│  • Net Salary                                                │
│  • Attendance Summary                                        │
│  • Breakdown Details                                         │
│  • Leave Information                                         │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Frontend   │
│  (React App) │
│  • Display   │
│  • PDF Gen   │
└──────────────┘
```

---

### Database Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SQL Server Database                       │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ DeviceLogs_MM_YYYY Tables                          │     │
│  │ • DeviceLogs_10_2025 (October)                     │     │
│  │ • DeviceLogs_11_2025 (November)                    │     │
│  │ • Monthly partitioned attendance logs              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ EmployeeDetails Table                               │     │
│  │ • Joining Date                                       │     │
│  │ • Exit Date                                          │     │
│  │ • Base Salary                                        │     │
│  │ • Shift Assignment                                   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ MonthlyLeaveUsage Table                             │     │
│  │ • Paid Leave Dates                                  │     │
│  │ • Casual Leave Dates                                │     │
│  │ • Monthly leave approvals                           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ EmployeeLeaves Table                                │     │
│  │ • Annual Leave Entitlement                          │     │
│  │ • Used Paid Leaves                                  │     │
│  │ • Used Casual Leaves                                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Shifts Table                                        │     │
│  │ • Shift Name                                        │     │
│  │ • Start Time                                        │     │
│  │ • End Time                                          │     │
│  │ • Work Hours                                        │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ AttendanceRegularization Table                     │     │
│  │ • Regularized Dates                                 │     │
│  │ • Reason                                           │     │
│  │ • Approval Timestamp                               │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ SQL Queries
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Database Connection Pool                       │
│  • Manages SQL Server connections                          │
│  • Handles connection pooling                              │
│  • Executes parameterized queries                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Query Results
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Model Layer                                    │
│  • AttendanceModel                                         │
│  • EmployeeDetailsModel                                    │
│  • LeaveModel                                              │
│  • ShiftModel                                              │
│  • Returns typed data                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 System Integration

### Component Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Components                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Salary Page  │  │ Salary       │  │ Attendance    │    │
│  │              │  │ Summary      │  │ Page          │    │
│  │ • Individual │  │              │  │               │    │
│  │   Calculation│  │ • Batch      │  │ • View Logs   │    │
│  │ • Leave      │  │   Processing  │  │ • Calendar    │    │
│  │   Approval   │  │ • Progress    │  │               │    │
│  │ • PDF Gen    │  │   Tracking    │  │               │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           │                                  │
│                           ▼                                  │
│              ┌─────────────────────┐                        │
│              │   API Client        │                        │
│              │   (api.ts)          │                        │
│              └──────────┬──────────┘                        │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP Requests
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Backend API                              │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Salary       │  │ Attendance    │  │ Leave        │     │
│  │ Controller   │  │ Controller   │  │ Controller   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                  │
│                           ▼                                  │
│              ┌─────────────────────┐                        │
│              │   Service Layer     │                        │
│              │                     │                        │
│              │ • Payroll Service   │                        │
│              │ • Leave Service     │                        │
│              │ • Excel Service     │                        │
│              └──────────┬──────────┘                        │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │   Model Layer       │                        │
│              │                     │                        │
│              │ • AttendanceModel   │                        │
│              │ • EmployeeModel     │                        │
│              │ • LeaveModel        │                        │
│              │ • ShiftModel        │                        │
│              └──────────┬──────────┘                        │
└──────────────────────────┼──────────────────────────────────┘
                           │ SQL Queries
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    SQL Server Database                       │
│  • DeviceLogs Tables                                         │
│  • EmployeeDetails                                           │
│  • MonthlyLeaveUsage                                         │
│  • EmployeeLeaves                                            │
│  • Shifts                                                    │
│  • AttendanceRegularization                                  │
└──────────────────────────────────────────────────────────────┘
```

---

### Data Sources Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Sources                              │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 1. Biometric Devices                                │     │
│  │    └─→ SQL Server: DeviceLogs Tables              │     │
│  │         • Entry/Exit timestamps                    │     │
│  │         • Employee ID                              │     │
│  │         • Device ID                                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 2. Excel Files (Legacy)                            │     │
│  │    └─→ Salary Register Excel File                  │     │
│  │         • Base Salary                              │     │
│  │         • Employee Code                            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 3. EmployeeDetails Database                       │     │
│  │    └─→ SQL Server: EmployeeDetails Table          │     │
│  │         • Joining Date                            │     │
│  │         • Exit Date                                │     │
│  │         • Base Salary                              │     │
│  │         • Shift Assignment                         │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 4. Leave Management Database                       │     │
│  │    └─→ SQL Server: Leave Tables                   │     │
│  │         • Monthly Leave Approvals                  │     │
│  │         • Annual Leave Balance                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 5. Shift Configuration Database                    │     │
│  │    └─→ SQL Server: Shifts Table                   │     │
│  │         • Shift Timings                            │     │
│  │         • Work Hours                               │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 6. Regularization Database                          │     │
│  │    └─→ SQL Server: AttendanceRegularization       │     │
│  │         • Regularized Dates                        │     │
│  │         • Reasons                                  │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ All Data Combined
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Payroll Calculation Engine                      │
│  • Processes all data sources                                 │
│  • Applies business rules                                     │
│  • Calculates final salary                                    │
└───────────────────────────────────────────────────────────────┘
```

---

## 📊 Summary

### What We've Built

A complete, production-ready **Payroll & Attendance Management System** with:

1. **Real-time Attendance Tracking** from biometric devices
2. **Automated Salary Calculation** with complex business rules
3. **Leave Management** with persistent storage and balance tracking
4. **Shift Management** supporting multiple shift timings
5. **Attendance Regularization** for exception handling
6. **PDF Report Generation** with detailed breakdowns
7. **Batch Processing** for multiple employees
8. **Pro-rata & Final Settlement** for new joiners and exits

### Key Achievements

✅ **8 Major Features** implemented
✅ **MVC Architecture** for maintainability
✅ **Type Safety** with TypeScript
✅ **Security** with API keys and IP allowlisting
✅ **Database Integration** with SQL Server
✅ **Frontend Dashboard** with React
✅ **PDF Reports** with professional formatting
✅ **Business Rules** accurately implemented

### System Capabilities

- Handles complex salary cycles (26th to 25th)
- Supports multiple shifts with different timings
- Manages leave approvals with annual balance tracking
- Processes attendance regularization
- Calculates pro-rata for new joiners
- Handles final settlement for exits
- Generates detailed PDF reports
- Processes batch calculations for all employees

---

**Last Updated:** Based on current implementation  
**Version:** 1.0  
**Status:** ✅ Production Ready

