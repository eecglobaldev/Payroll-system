# Employee HR Portal - Backend Integration Summary

## ✅ Integration Complete

All mock data has been replaced with real backend API calls. The employee portal is now fully integrated with the existing payroll backend.

---

## 📋 What Was Changed

### 1. Environment Configuration ✅

**Created:** `src/config/env.ts`
- Centralized API base URL configuration
- Reads from `VITE_API_BASE_URL` environment variable
- Defaults to `http://localhost:3000/api` if not set

**Created:** `vite-env.d.ts`
- TypeScript definitions for Vite environment variables
- Fixes TypeScript errors for `import.meta.env`

**Required:** Create `.env` file in root directory:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

---

### 2. Authentication System ✅

**Updated:** `context/AuthContext.tsx`
- Replaced mock login with real API call: `POST /api/auth/employee/login`
- Stores JWT token in localStorage
- Validates token on app load by fetching profile
- Auto-logout on token expiry
- Stores: `token`, `employeeCode`, `role`, `user`

**Login Flow:**
1. User enters employeeCode and password
2. Calls `POST /api/auth/employee/login`
3. Receives JWT token + employeeCode + role
4. Stores token in localStorage
5. Fetches user profile using token
6. Redirects to dashboard

---

### 3. API Service Layer ✅

**Created:** `services/api.ts`
- Centralized API service with automatic JWT token attachment
- Auto-handles 401 responses → redirects to login
- All API calls include `Authorization: Bearer <token>` header

**API Methods:**
- `login(employeeCode, password)` - Employee login
- `getEmployeeProfile()` - Get current employee profile
- `updateEmployeeProfile(updates)` - Update profile (if API exists)
- `changePassword(currentPassword, newPassword)` - Change password
- `getCurrentSalary(month?)` - Get current month salary
- `getSalaryHistory()` - Get all salary records
- `downloadPayslip(month)` - Download PDF payslip
- `getAttendanceData(month?)` - Get attendance records

**Security Features:**
- Automatic token attachment to all requests
- 401 handling → auto logout
- Error handling with user-friendly messages

---

### 4. Dashboard Page ✅

**Updated:** `pages/Dashboard.tsx`
- Replaced mock data with `getCurrentSalary()` API call
- Shows current month salary
- Displays HOLD status banner if salary is on hold
- Calculates daily accrual from net salary
- Loading states and error handling

**Features:**
- Real-time salary data
- HOLD status detection
- Daily accrual calculation
- Month-to-date earnings

---

### 5. Salary History Page ✅

**Updated:** `pages/SalaryHistory.tsx`
- Replaced mock data with `getSalaryHistory()` API call
- Real salary records from backend
- PDF download functionality via `downloadPayslip(month)`
- Disables download button if salary is HOLD
- Loading states and error handling

**Features:**
- Complete salary history
- PDF download (disabled for HOLD salaries)
- Status badges (PAID/HOLD)
- Error handling

---

### 6. Attendance Page ✅

**Updated:** `pages/Attendance.tsx`
- Replaced mock data with `getAttendanceData(month)` API call
- Month selector for viewing different months
- Real attendance records from backend
- Calculates statistics (present, leaves, absents, avg check-in)
- Loading states and error handling

**Features:**
- Monthly attendance view
- Statistics calculation
- Status badges
- Entry/exit times
- Shift information

---

### 7. Profile Page ✅

**Updated:** `pages/Profile.tsx`
- Replaced mock data with `getEmployeeProfile()` API call
- Real employee profile from backend
- Password change functionality via `changePassword()`
- Profile update (if API exists)
- Loading states and error handling

**Features:**
- Employee profile display
- Password change form
- Validation and error handling
- Success/error messages

---

### 8. Route Protection ✅

**Existing:** `routes/ProtectedRoute.tsx`
- Already properly implemented
- Checks `isAuthenticated` from AuthContext
- Redirects to `/login` if not authenticated
- Shows loading spinner during auth check

---

## 🔌 Backend API Endpoints Required

The following endpoints must exist in the backend:

### Authentication
- `POST /api/auth/employee/login`
  - Request: `{ employeeCode: string, password: string }`
  - Response: `{ token: string, employeeCode: string, role: "EMPLOYEE" }`

### Employee Profile
- `GET /api/employee/me`
  - Headers: `Authorization: Bearer <token>`
  - Response: Employee profile (User object)

- `PATCH /api/employee/me` (optional)
  - Headers: `Authorization: Bearer <token>`
  - Request: Partial User object
  - Response: Updated User object

- `PATCH /api/employee/me/password` (optional)
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ currentPassword: string, newPassword: string }`
  - Response: Success message

### Salary
- `GET /api/employee/salary?month=YYYY-MM`
  - Headers: `Authorization: Bearer <token>`
  - Response: Current month salary data
  - Must include: `grossSalary`, `netSalary`, `isHeld`, `month`

- `GET /api/employee/salary/history`
  - Headers: `Authorization: Bearer <token>`
  - Response: Array of salary records
  - Each record must include: `month`, `grossSalary`, `netSalary`, `isHeld`, `paymentDate`

- `GET /api/employee/salary/pdf?month=YYYY-MM`
  - Headers: `Authorization: Bearer <token>`
  - Response: PDF file (binary)
  - Headers: `Content-Disposition: attachment; filename="payslip-YYYY-MM.pdf"`

### Attendance
- `GET /api/employee/attendance?month=YYYY-MM`
  - Headers: `Authorization: Bearer <token>`
  - Response: Attendance data with `dailyBreakdown` array
  - Each day must include: `date`, `status`, `firstEntry`, `lastExit`, `shift` or `shiftName`

---

## 🔒 Security Implementation

### JWT Token Handling
- Token stored in `localStorage` as `token`
- Automatically attached to all API requests via `Authorization: Bearer <token>` header
- Token validated on app load by fetching profile
- Auto-logout on 401 Unauthorized responses

### Employee-Only Access
- Backend must infer `employeeCode` from JWT token
- Frontend never sends `employeeCode` in API requests (except login)
- All employee endpoints use `/api/employee/*` prefix
- No admin endpoints exposed to frontend

### Route Protection
- All routes except `/login` require authentication
- `ProtectedRoute` component enforces authentication
- Redirects to `/login` if token missing or invalid

---

## 📝 Data Transformation

The API service layer transforms backend responses to match frontend types:

### Salary Record
```typescript
// Backend response → Frontend SalaryRecord
{
  month: "2025-11",
  grossSalary: 50000,
  netSalary: 45000,
  isHeld: false
}
→
{
  id: "2025-11",
  month: "November",
  year: 2025,
  grossSalary: 50000,
  netSalary: 45000,
  status: SalaryStatus.PAID
}
```

### Attendance Record
```typescript
// Backend response → Frontend AttendanceRecord
{
  date: "2025-11-15",
  status: "full-day",
  firstEntry: "2025-11-15T09:00:00Z",
  lastExit: "2025-11-15T18:00:00Z",
  shiftName: "Day Shift"
}
→
{
  date: "2025-11-15",
  status: AttendanceStatus.PRESENT,
  checkIn: "09:00 AM",
  checkOut: "06:00 PM",
  shift: "Day Shift"
}
```

---

## 🚀 Setup Instructions

### 1. Environment Configuration

Create `.env` file in `Employee_HR_Portal/` directory:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Replace `localhost:3000` with your actual backend URL.

### 2. Install Dependencies

```bash
cd Employee_HR_Portal
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

---

## ✅ Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should show error)
- [ ] View dashboard with real salary data
- [ ] View salary history
- [ ] Download PDF payslip (if not HOLD)
- [ ] View attendance for current month
- [ ] View attendance for different months
- [ ] View profile
- [ ] Change password (if API exists)
- [ ] Logout
- [ ] Token expiry handling (401 response)
- [ ] Protected route redirects to login when not authenticated

---

## 🐛 Troubleshooting

### API Calls Failing
- Check `VITE_API_BASE_URL` in `.env` file
- Verify backend is running
- Check browser console for CORS errors
- Verify JWT token is being sent in headers

### 401 Unauthorized Errors
- Token may be expired
- Backend may not be validating JWT correctly
- Check backend logs for authentication errors

### CORS Errors
- Backend must allow frontend origin
- Check backend CORS configuration
- Verify `Access-Control-Allow-Origin` header

### TypeScript Errors
- Run `npm install` to ensure all dependencies are installed
- Check `vite-env.d.ts` exists
- Restart TypeScript server in IDE

---

## 📚 Files Modified

1. `src/config/env.ts` - Created
2. `vite-env.d.ts` - Created
3. `services/api.ts` - Completely rewritten
4. `context/AuthContext.tsx` - Updated for real API
5. `pages/Dashboard.tsx` - Updated for real API
6. `pages/SalaryHistory.tsx` - Updated for real API
7. `pages/Attendance.tsx` - Updated for real API
8. `pages/Profile.tsx` - Updated for real API

---

## 🎯 Key Features

✅ **Real Backend Integration** - All mock data replaced  
✅ **JWT Authentication** - Secure token-based auth  
✅ **Auto-Logout** - Handles token expiry gracefully  
✅ **Error Handling** - User-friendly error messages  
✅ **Loading States** - Proper loading indicators  
✅ **Type Safety** - Full TypeScript support  
✅ **Security** - Employee-only access enforced  
✅ **PDF Download** - Real payslip downloads  
✅ **Month Selection** - View different months  

---

## ⚠️ Important Notes

1. **Backend Must Implement Employee Endpoints**
   - The frontend expects specific API endpoints
   - Backend must infer employeeCode from JWT token
   - Never send employeeCode in URL parameters

2. **No Salary Calculation Logic**
   - Frontend is READ-ONLY
   - No salary recalculation
   - All calculations done by backend

3. **No Admin Features**
   - Employee portal only
   - Cannot access other employees' data
   - Cannot modify salary or attendance

4. **Token Security**
   - Token stored in localStorage
   - Automatically cleared on logout
   - Validated on every app load

---

**Integration Status:** ✅ Complete  
**Ready for:** Backend API implementation and testing  
**Last Updated:** Based on current implementation

