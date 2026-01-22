# Admin Dashboard - Complete Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Backend API running on `http://localhost:3000`
- API key from backend

### Installation Steps

```bash
# 1. Navigate to the dashboard directory
cd admin-dashboard

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Edit .env and add your API key
# VITE_API_BASE_URL=http://localhost:3000/api
# VITE_API_KEY=your-api-key-here

# 5. Start development server
npm run dev

# 6. Open browser
# Visit http://localhost:5173
```

---

## 📁 Complete Project Structure

```
admin-dashboard/
│
├── public/                      # Static assets
│
├── src/
│   │
│   ├── components/              # Reusable React components
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   ├── Header.tsx       # Top header with user info
│   │   │   └── Layout.tsx       # Main layout wrapper
│   │   │
│   │   └── UI/                  # UI components library
│   │       ├── Card.tsx         # Card container
│   │       ├── StatCard.tsx     # Statistics card
│   │       ├── Badge.tsx        # Badge for status
│   │       ├── Table.tsx        # Table components
│   │       ├── Input.tsx        # Input field
│   │       ├── Select.tsx       # Dropdown select
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorMessage.tsx
│   │
│   ├── pages/                   # Page components
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── Employees.tsx        # Employee list
│   │   ├── EmployeeDetail.tsx   # Employee details
│   │   ├── Attendance.tsx       # Attendance view
│   │   └── Salary.tsx           # Salary calculation
│   │
│   ├── lib/
│   │   └── api.ts              # Axios API client
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   │
│   ├── utils/
│   │   ├── format.ts           # Formatting helpers
│   │   └── constants.ts        # App constants
│   │
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # Entry point
│   ├── index.css               # Global styles
│   └── vite-env.d.ts           # Vite types
│
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
└── .eslintrc.cjs               # ESLint config
```

---

## 🎨 Component Library

### Layout Components

#### **Sidebar**
```tsx
<Sidebar 
  isOpen={sidebarOpen} 
  onClose={() => setSidebarOpen(false)} 
/>
```
- Responsive navigation
- Auto-collapse on mobile
- Active route highlighting

#### **Header**
```tsx
<Header onMenuClick={() => setSidebarOpen(true)} />
```
- Mobile menu toggle
- User profile
- Reload data button

---

### UI Components

#### **StatCard** - Dashboard Statistics
```tsx
<StatCard
  title="Total Employees"
  value={totalEmployees}
  icon={Users}
  color="blue"
  trend={{ value: "+5%", isPositive: true }}
/>
```

**Props:**
- `title`: string - Card title
- `value`: string | number - Main value
- `icon`: LucideIcon - Icon component
- `color`: 'blue' | 'green' | 'purple' | 'orange'
- `trend`: { value: string, isPositive: boolean } (optional)

---

#### **Card** - Container Component
```tsx
<Card title="Employee List" action={<button>View All</button>}>
  {/* Content */}
</Card>
```

**Props:**
- `title`: string (optional)
- `action`: ReactNode (optional)
- `className`: string (optional)
- `children`: ReactNode

---

#### **Badge** - Status Indicator
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Inactive</Badge>
<Badge variant="info" size="sm">Info</Badge>
```

**Props:**
- `variant`: 'success' | 'warning' | 'danger' | 'info' | 'default'
- `size`: 'sm' | 'md'

---

#### **Table Components**
```tsx
<Table>
  <TableHead>
    <TableRow>
      <TableHeader>Name</TableHeader>
      <TableHeader>Email</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow onClick={() => handleClick()}>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

#### **Input Field**
```tsx
<Input
  label="Employee Name"
  type="text"
  placeholder="Enter name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={errors.name}
/>
```

---

#### **Select Dropdown**
```tsx
<Select
  label="Select Department"
  value={department}
  onChange={(e) => setDepartment(e.target.value)}
  options={[
    { value: '', label: 'Select...' },
    { value: 'IT', label: 'IT Department' },
    { value: 'HR', label: 'HR Department' },
  ]}
/>
```

---

#### **Loading Spinner**
```tsx
<LoadingSpinner />
<LoadingSpinner size="lg" />
<LoadingSpinner fullScreen />
```

---

#### **Error Message**
```tsx
<ErrorMessage 
  message="Failed to load data" 
  onRetry={() => fetchData()} 
/>
```

---

## 🔌 API Integration

### API Client Setup

Located in `src/lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// Example usage
const response = await api.employees.getAll();
const employees = response.data.data;
```

### Available Endpoints

#### **Employees API**
```typescript
// Get all employees
const employees = await api.employees.getAll();

// Get single employee
const employee = await api.employees.getByCode('1234');

// Search by name
const results = await api.employees.search('John');

// Filter by department
const deptEmployees = await api.employees.getByDepartment('IT');

// Reload Excel data
await api.employees.reload();
```

#### **Attendance API**
```typescript
// Get latest logs
const logs = await api.attendance.getLatest(50);

// Get logs by date
const dateLogs = await api.attendance.getByDate('2025-01-15');

// Get employee attendance
const empLogs = await api.attendance.getByEmployee(1234, '2025-01-01', '2025-01-31');

// Get attendance summary
const summary = await api.attendance.getSummary(1234, '2025-01');

// Get daily logs
const dailyLogs = await api.attendance.getDaily(1234, '2025-01-15');
```

#### **Salary API**
```typescript
// Calculate salary
const salary = await api.salary.calculate(1234, '2025-01');

// Get monthly hours
const hours = await api.salary.getMonthlyHours(1234, '2025-01');

// Get detailed breakdown
const breakdown = await api.salary.getBreakdown(1234, '2025-01');

// Batch calculation
const batch = await api.salary.batchCalculate(['1234', '5678'], '2025-01');
```

---

## 🛠️ Utility Functions

### Formatting Utilities (`src/utils/format.ts`)

```typescript
import { 
  formatCurrency, 
  formatDate, 
  formatTime, 
  formatHours,
  getCurrentMonth,
  getMonthName 
} from '@/utils/format';

// Currency formatting (INR)
formatCurrency(50000)           // ₹50,000.00

// Date formatting
formatDate('2024-01-15')        // 15 Jan 2024
formatDate('2024-01-15', 'dd/MM/yyyy')  // 15/01/2024

// Time formatting
formatTime('2024-01-15T09:30:00Z')  // 09:30:00

// Hours formatting
formatHours(9.5)                // 9h 30m

// Current month
getCurrentMonth()               // 2025-01

// Month name
getMonthName('2025-01')         // January 2025
```

### Constants (`src/utils/constants.ts`)

```typescript
import { 
  LATE_THRESHOLD, 
  LATE_GRACE_DAYS,
  WORKING_HOURS_PER_DAY,
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS 
} from '@/utils/constants';

console.log(LATE_THRESHOLD);         // "10:10 AM"
console.log(LATE_GRACE_DAYS);        // 3
console.log(WORKING_HOURS_PER_DAY);  // 9
```

---

## 📄 TypeScript Types

All types are defined in `src/types/index.ts`:

```typescript
import type { 
  Employee, 
  AttendanceLog, 
  AttendanceSummary,
  DailyAttendance,
  SalaryCalculation,
  SalaryBreakdown,
  AttendanceInfo,
  ApiResponse 
} from '@/types';
```

### Key Interfaces

**Employee**
```typescript
interface Employee {
  employeeNo: string;
  name: string;
  department: string;
  designation: string;
  fullBasic: number;
  monthlyCTC: number;
  annualCTC: number;
  joinDate: string;
  status: string;
  location: string;
}
```

**SalaryCalculation**
```typescript
interface SalaryCalculation {
  employeeCode: string;
  month: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  attendance: AttendanceInfo;
  breakdown: SalaryBreakdown;
}
```

---

## 🎯 Page Features

### 1. Dashboard (`/`)
- **Stats Cards**: Total employees, attendance, salary, work hours
- **Charts**: Attendance bar chart, salary line chart
- **Recent Employees Table**: Quick overview

### 2. Employees (`/employees`)
- **Employee List**: Sortable table with all employees
- **Search**: By name, employee number, or department
- **View Details**: Click to see full profile

### 3. Employee Detail (`/employees/:employeeNo`)
- **Personal Info**: Department, location, join date
- **Salary Info**: Basic, CTC, current month salary
- **Quick Actions**: View attendance, view salary

### 4. Attendance (`/attendance`)
- **Filter**: By employee and month
- **Summary Cards**: Full days, half days, absent, late, early exits
- **Daily Breakdown Table**: Detailed day-by-day view
- **Flags**: Late/Early badges

### 5. Salary (`/salary`)
- **Filter**: By employee and month
- **Summary Cards**: Base, gross, net salary
- **Attendance Info**: Days worked, hours, deductions
- **Breakdown**: Detailed salary components
- **Batch Calculate**: Process multiple employees

---

## 🎨 Styling Guide

### Colors

```typescript
// Primary colors (blue)
bg-primary-50  to  bg-primary-900
text-primary-50  to  text-primary-900

// Status colors
bg-green-100 text-green-800  // Success
bg-yellow-100 text-yellow-800  // Warning
bg-red-100 text-red-800  // Danger
bg-blue-100 text-blue-800  // Info
```

### Common Patterns

```tsx
// Card with padding
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  {/* Content */}
</div>

// Button
<button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
  Click me
</button>

// Input
<input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />

// Grid layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Items */}
</div>
```

---

## 🚀 Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production
```bash
npm run preview
```

### Linting
```bash
npm run lint
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_KEY=your-api-key-here
```

### Vite Proxy (Optional)

Already configured in `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

---

## 📱 Responsive Design

- **Mobile**: < 768px (collapsible sidebar)
- **Tablet**: 768px - 1024px (optimized grid)
- **Desktop**: > 1024px (full layout)

All components are fully responsive with Tailwind's breakpoint system.

---

## ⚡ Performance Tips

1. **Lazy Loading**: Use React.lazy() for route-based code splitting
2. **Memoization**: Use useMemo/useCallback for expensive operations
3. **Virtualization**: For large tables (>100 rows), consider react-window
4. **Image Optimization**: Use WebP format for images
5. **Bundle Analysis**: Run `npm run build -- --analyze`

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5173
npx kill-port 5173
```

### CORS Issues
Ensure backend has CORS enabled for `http://localhost:5173`

### API Connection Failed
- Check backend is running on port 3000
- Verify API_KEY in .env
- Check browser console for errors

### Type Errors
```bash
# Clear TypeScript cache
rm -rf node_modules/.vite
npm run dev
```

---

## 📚 Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [React Router](https://reactrouter.com)
- [Recharts Examples](https://recharts.org/en-US/examples)

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit for review

---

## 📞 Support

For questions or issues:
- Check README.md
- Review API documentation
- Contact development team

---

**Last Updated**: December 2025  
**Version**: 1.0.0

