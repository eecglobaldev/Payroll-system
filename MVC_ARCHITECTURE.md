# MVC Architecture Guide

The project now follows the **Model-View-Controller (MVC)** pattern for better code organization and maintainability.

## 📁 New Project Structure

```
src/
├── index.ts                 # Main server entry point
├── types/
│   └── index.ts            # TypeScript type definitions
├── models/                  # 🆕 Database layer
│   ├── AttendanceModel.ts  # Attendance database operations
│   ├── EmployeeModel.ts    # Employee database operations
│   └── index.ts            # Models barrel export
├── controllers/             # 🆕 Business logic layer
│   ├── AttendanceController.ts  # Attendance business logic
│   ├── SalaryController.ts      # Salary business logic
│   └── index.ts            # Controllers barrel export
├── routes/                  # Route definitions (thin layer)
│   ├── attendance.ts       # Attendance routes
│   └── salary.ts           # Salary routes
├── services/
│   └── payroll.ts          # Payroll calculation service
├── middleware/
│   ├── apiKey.ts           # Authentication middleware
│   └── ipAllowlist.ts      # IP filtering middleware
├── db/
│   └── pool.ts             # Database connection pool
└── utils/
    ├── date.ts             # Date utilities
    ├── ipRange.ts          # IP range utilities
    └── validation.ts       # Input validation
```

## 🎯 Separation of Concerns

### **Models** (`src/models/`)
**Responsibility**: Database interactions only
- Execute SQL queries
- Return raw data
- No business logic
- No HTTP/response handling

```typescript
// Example: AttendanceModel.ts
export class AttendanceModel {
  static async getLatest(limit: number): Promise<AttendanceLog[]> {
    const sqlQuery = `SELECT TOP (@limit) * FROM dbo.AttendanceLogs ORDER BY id DESC`;
    const result = await query<AttendanceLog>(sqlQuery, { limit });
    return result.recordset;
  }
}
```

### **Controllers** (`src/controllers/`)
**Responsibility**: Business logic and request/response handling
- Process requests
- Call models to fetch data
- Apply business logic
- Format responses
- Handle errors

```typescript
// Example: AttendanceController.ts
export class AttendanceController {
  static async getLatest(req: Request, res: Response): Promise<void> {
    try {
      const limit = (req.query.limit as number) || 100;
      const logs = await AttendanceModel.getLatest(limit);
      
      res.json({
        success: true,
        count: logs.length,
        data: logs,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve attendance logs',
      });
    }
  }
}
```

### **Routes** (`src/routes/`)
**Responsibility**: Route definitions only (thin layer)
- Define endpoints
- Apply middleware
- Delegate to controllers

```typescript
// Example: attendance.ts
router.get(
  '/latest',
  validateRequest(Joi.object({ limit: schemas.limit })),
  AttendanceController.getLatest
);
```

## 📊 Data Flow

```
Client Request
     ↓
  Routes (Define endpoint + middleware)
     ↓
Controllers (Business logic)
     ↓
  Models (Database queries)
     ↓
  Database
     ↓
  Models (Return data)
     ↓
Controllers (Format response)
     ↓
Client Response
```

## 🔧 Models API

### **AttendanceModel**

```typescript
// Get latest attendance logs
AttendanceModel.getLatest(limit: number): Promise<AttendanceLog[]>

// Get attendance by date
AttendanceModel.getByDate(date: string): Promise<AttendanceLog[]>

// Get employee attendance in date range
AttendanceModel.getByEmployeeAndDateRange(
  employeeCode: string,
  start: string,
  end: string
): Promise<AttendanceLog[]>

// Get attendance summary
AttendanceModel.getSummaryByEmployeeAndDateRange(
  employeeCode: string,
  start: string,
  end: string
): Promise<AttendanceSummary | null>

// Get daily attendance
AttendanceModel.getDailyByEmployeeAndDate(
  employeeCode: string,
  date: string
): Promise<AttendanceLog[]>
```

### **EmployeeModel**

```typescript
// Get employee by code
EmployeeModel.getByCode(employeeCode: string): Promise<Employee | null>

// Get salary information
EmployeeModel.getSalaryInfo(employeeCode: string): Promise<BaseSalaryInfo>

// Get all active employees
EmployeeModel.getAllActive(): Promise<Employee[]>

// Get employees by department
EmployeeModel.getByDepartment(department: string): Promise<Employee[]>

// Check if employee exists
EmployeeModel.exists(employeeCode: string): Promise<boolean>

// Create new employee
EmployeeModel.create(employee: Omit<Employee, 'CreatedAt' | 'UpdatedAt'>): Promise<void>

// Update employee
EmployeeModel.update(employeeCode: string, updates: Partial<Employee>): Promise<void>

// Deactivate employee
EmployeeModel.deactivate(employeeCode: string): Promise<void>
```

## 🎮 Controllers API

### **AttendanceController**

```typescript
// Get latest attendance logs
AttendanceController.getLatest(req: Request, res: Response): Promise<void>

// Get attendance by date
AttendanceController.getByDate(req: Request, res: Response): Promise<void>

// Get employee attendance
AttendanceController.getByEmployee(req: Request, res: Response): Promise<void>

// Get attendance summary
AttendanceController.getSummary(req: Request, res: Response): Promise<void>

// Get daily attendance
AttendanceController.getDailyAttendance(req: Request, res: Response): Promise<void>
```

### **SalaryController**

```typescript
// Calculate salary
SalaryController.calculateSalary(req: Request, res: Response): Promise<void>

// Get monthly hours
SalaryController.getMonthlyHours(req: Request, res: Response): Promise<void>

// Get daily breakdown
SalaryController.getDailyBreakdown(req: Request, res: Response): Promise<void>

// Batch calculate salary
SalaryController.batchCalculateSalary(req: Request, res: Response): Promise<void>
```

## 🆕 Adding New Features

### 1. Add a New Model Method

```typescript
// src/models/AttendanceModel.ts
export class AttendanceModel {
  static async getByMonth(month: string): Promise<AttendanceLog[]> {
    const sqlQuery = `
      SELECT *
      FROM dbo.AttendanceLogs
      WHERE FORMAT(SubmittedAt, 'yyyy-MM') = @month
      ORDER BY SubmittedAt
    `;
    const result = await query<AttendanceLog>(sqlQuery, { month });
    return result.recordset;
  }
}
```

### 2. Add a New Controller Method

```typescript
// src/controllers/AttendanceController.ts
export class AttendanceController {
  static async getByMonth(req: Request, res: Response): Promise<void> {
    try {
      const { month } = req.query as { month: string };
      const logs = await AttendanceModel.getByMonth(month);
      
      res.json({
        success: true,
        month,
        count: logs.length,
        data: logs,
      });
    } catch (err) {
      const error = err as Error;
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve attendance logs',
      });
    }
  }
}
```

### 3. Add a New Route

```typescript
// src/routes/attendance.ts
router.get(
  '/by-month',
  validateRequest(Joi.object({ month: schemas.month })),
  AttendanceController.getByMonth
);
```

## 🧪 Testing Benefits

With MVC, you can easily test each layer independently:

```typescript
// Test Model (database operations)
const logs = await AttendanceModel.getLatest(10);
expect(logs.length).toBeLessThanOrEqual(10);

// Test Controller (business logic)
const req = { query: { limit: 5 } } as Request;
const res = mockResponse();
await AttendanceController.getLatest(req, res);
expect(res.json).toHaveBeenCalled();

// Test Route (integration)
const response = await request(app)
  .get('/api/attendance/latest?limit=5')
  .set('x-api-key', 'test-key');
expect(response.status).toBe(200);
```

## 📈 Benefits of MVC

### ✅ **Separation of Concerns**
- Each layer has a single responsibility
- Easier to understand and maintain
- Changes in one layer don't affect others

### ✅ **Reusability**
- Models can be reused across controllers
- Controllers can be reused in different routes
- Business logic is centralized

### ✅ **Testability**
- Test models independently (database)
- Test controllers independently (business logic)
- Test routes independently (integration)

### ✅ **Maintainability**
- Easy to locate and fix bugs
- Clear structure for new developers
- Scalable architecture

### ✅ **Type Safety**
- Full TypeScript support
- Type checking across all layers
- IntelliSense support

## 🔄 Migration Notes

### What Changed

**Before (routes with logic):**
```typescript
router.get('/latest', async (req, res) => {
  const sqlQuery = `SELECT * FROM dbo.AttendanceLogs`;
  const result = await query(sqlQuery);
  res.json({ data: result.recordset });
});
```

**After (MVC pattern):**
```typescript
// Model
AttendanceModel.getLatest(limit) { /* SQL query */ }

// Controller
AttendanceController.getLatest(req, res) { /* business logic */ }

// Route
router.get('/latest', AttendanceController.getLatest);
```

### What Stayed the Same

- ✅ API endpoints (same URLs)
- ✅ Request/response formats
- ✅ Authentication & authorization
- ✅ Validation & middleware
- ✅ Database queries (moved to models)
- ✅ 100% backward compatible

## 📚 Best Practices

### Models
1. ✅ Only database operations
2. ✅ Return plain data (no formatting)
3. ✅ Use static methods
4. ✅ Handle database errors
5. ❌ No HTTP/response handling
6. ❌ No business logic

### Controllers
1. ✅ Handle requests/responses
2. ✅ Call models for data
3. ✅ Apply business logic
4. ✅ Format responses
5. ✅ Handle errors with proper HTTP codes
6. ❌ No direct SQL queries

### Routes
1. ✅ Define endpoints
2. ✅ Apply middleware
3. ✅ Delegate to controllers
4. ❌ No business logic
5. ❌ No database queries

## 🎓 Learning Resources

- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [MVC Pattern](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)

---

**Your API now follows industry-standard MVC architecture!** 🎉

