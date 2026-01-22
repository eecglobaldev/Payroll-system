# Payroll Admin Dashboard

A modern, responsive admin dashboard for managing payroll and attendance data.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **TanStack Table** - Advanced tables
- **Lucide React** - Icons
- **date-fns** - Date utilities

## Features

### 📊 Dashboard
- Total employees count
- Today's attendance
- Monthly salary summary
- Interactive charts (attendance & salary)
- Recent employees list

### 👥 Employees
- List all employees
- Search by name, employee number, or department
- View detailed employee profiles
- Quick access to attendance and salary

### 📅 Attendance
- Daily attendance view
- Filter by date and employee
- In-time, out-time, total hours
- Late/early flags
- Monthly summary with charts

### 💰 Salary
- Monthly salary calculation
- Detailed breakdown (deductions, bonuses, etc.)
- Batch salary calculation
- Attendance impact visualization

## Project Structure

```
admin-dashboard/
├── public/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Layout.tsx
│   │   └── UI/
│   │       ├── Card.tsx
│   │       ├── StatCard.tsx
│   │       ├── Badge.tsx
│   │       ├── Table.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorMessage.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Employees.tsx
│   │   ├── EmployeeDetail.tsx
│   │   ├── Attendance.tsx
│   │   └── Salary.tsx
│   ├── lib/
│   │   └── api.ts               # Axios API client
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── utils/
│   │   ├── format.ts            # Formatting utilities
│   │   └── constants.ts         # App constants
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd admin-dashboard
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_KEY=your-api-key-here
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

## API Integration

### Base Configuration

The API client is configured in `src/lib/api.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_KEY = import.meta.env.VITE_API_KEY;
```

### Available API Methods

#### Employees
- `api.employees.getAll()` - Get all employees
- `api.employees.getByCode(employeeNo)` - Get employee by code
- `api.employees.search(name)` - Search employees by name
- `api.employees.getByDepartment(dept)` - Filter by department
- `api.employees.reload()` - Reload Excel data

#### Attendance
- `api.attendance.getLatest(limit)` - Get latest logs
- `api.attendance.getByDate(date)` - Get logs by date
- `api.attendance.getByEmployee(userId, start, end)` - Employee logs
- `api.attendance.getSummary(userId, month)` - Attendance summary
- `api.attendance.getDaily(userId, date)` - Daily logs

#### Salary
- `api.salary.calculate(userId, month)` - Calculate salary
- `api.salary.getMonthlyHours(userId, month)` - Monthly hours
- `api.salary.getBreakdown(userId, month)` - Detailed breakdown
- `api.salary.batchCalculate(employeeCodes, month)` - Batch calculation

## Component Usage

### StatCard

```tsx
<StatCard
  title="Total Employees"
  value={100}
  icon={Users}
  color="blue"
  trend={{ value: "+5%", isPositive: true }}
/>
```

### Badge

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Inactive</Badge>
```

### Table

```tsx
<Table>
  <TableHead>
    <TableRow>
      <TableHeader>Name</TableHeader>
      <TableHeader>Email</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Utility Functions

### Formatting

```typescript
import { formatCurrency, formatDate, formatTime, formatHours } from '@/utils/format';

formatCurrency(50000)           // ₹50,000.00
formatDate('2024-01-15')        // 15 Jan 2024
formatTime('2024-01-15T09:30')  // 09:30:00
formatHours(9.5)                // 9h 30m
```

### Constants

```typescript
import { LATE_THRESHOLD, LATE_GRACE_DAYS, WORKING_HOURS_PER_DAY } from '@/utils/constants';
```

## Features & Highlights

✅ **Responsive Design** - Works on mobile, tablet, and desktop
✅ **TypeScript** - Full type safety
✅ **Error Handling** - Comprehensive error states
✅ **Loading States** - User-friendly loading indicators
✅ **Reusable Components** - DRY principle
✅ **Clean Architecture** - Separation of concerns
✅ **Professional UI** - Modern, clean design
✅ **Data Visualization** - Charts and graphs
✅ **Search & Filter** - Easy data navigation
✅ **Batch Operations** - Process multiple records

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - Internal Use Only

## Support

For issues or questions, contact the development team.

