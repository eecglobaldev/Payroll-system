# Admin Dashboard - Quick Reference

## 🚀 Getting Started (2 Minutes)

```bash
cd admin-dashboard
npm install
echo 'VITE_API_BASE_URL=http://localhost:3000/api\nVITE_API_KEY=your-api-key' > .env
npm run dev
```

Visit: `http://localhost:5173`

---

## 📂 Project Layout

```
src/
├── components/Layout/    → Sidebar, Header, Layout
├── components/UI/        → Card, Badge, Table, Input, etc.
├── pages/                → Dashboard, Employees, Attendance, Salary
├── lib/api.ts            → API client
├── types/index.ts        → TypeScript types
└── utils/                → Helpers and constants
```

---

## 🔌 API Quick Reference

```typescript
import { api } from '@/lib/api';

// Employees
await api.employees.getAll();
await api.employees.getByCode('1234');
await api.employees.search('John');

// Attendance
await api.attendance.getSummary(1234, '2025-01');
await api.attendance.getByDate('2025-01-15');

// Salary
await api.salary.calculate(1234, '2025-01');
await api.salary.batchCalculate(['1234', '5678'], '2025-01');
```

---

## 🎨 Component Cheat Sheet

### StatCard
```tsx
<StatCard title="Employees" value={100} icon={Users} color="blue" />
```

### Card
```tsx
<Card title="Title" action={<button>Action</button>}>Content</Card>
```

### Badge
```tsx
<Badge variant="success">Active</Badge>
```

### Table
```tsx
<Table>
  <TableHead><TableRow><TableHeader>Name</TableHeader></TableRow></TableHead>
  <TableBody><TableRow><TableCell>John</TableCell></TableRow></TableBody>
</Table>
```

### Input & Select
```tsx
<Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
<Select label="Dept" options={[{value: 'IT', label: 'IT'}]} />
```

---

## 🛠️ Common Patterns

### Fetch Data Pattern
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.employees.getAll();
      setData(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
```

### Page Layout Pattern
```tsx
<div className="space-y-6">
  <div>
    <h1 className="text-2xl font-bold">Page Title</h1>
    <p className="text-sm text-gray-600">Description</p>
  </div>
  
  <Card>{/* Content */}</Card>
</div>
```

---

## 📊 Formatting Utilities

```typescript
import { formatCurrency, formatDate, formatTime, formatHours } from '@/utils/format';

formatCurrency(50000)           // ₹50,000.00
formatDate('2024-01-15')        // 15 Jan 2024
formatTime('2024-01-15T09:30')  // 09:30:00
formatHours(9.5)                // 9h 30m
```

---

## 🎨 Tailwind Classes Cheat Sheet

### Layout
```
container mx-auto           // Center container
grid grid-cols-3 gap-4      // 3-column grid
flex items-center justify-between
space-y-4                   // Vertical spacing
```

### Colors
```
bg-primary-600 text-white   // Primary button
bg-green-100 text-green-800 // Success badge
bg-red-100 text-red-800     // Danger badge
```

### Sizes
```
w-full h-full              // 100% width/height
p-4 px-6 py-3              // Padding
m-4 mx-auto my-2           // Margin
text-sm text-lg text-2xl   // Text size
```

### Effects
```
rounded-lg                 // Rounded corners
shadow-sm shadow-lg        // Shadow
hover:bg-gray-100          // Hover effect
transition-colors          // Smooth transition
```

---

## 🔍 Page Routes

```
/                          → Dashboard
/employees                 → Employee List
/employees/:employeeNo     → Employee Detail
/attendance                → Attendance View
/salary                    → Salary Calculation
```

---

## 🚨 Error Handling

```typescript
try {
  const res = await api.employees.getAll();
} catch (err: any) {
  const message = err.response?.data?.message || 'Failed to load';
  setError(message);
}
```

---

## ⌨️ TypeScript Types

```typescript
import type { 
  Employee, 
  SalaryCalculation, 
  AttendanceSummary 
} from '@/types';

const [employee, setEmployee] = useState<Employee | null>(null);
```

---

## 🎯 Build Commands

```bash
npm run dev      # Development (http://localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Check for errors
```

---

## 🔧 Environment Variables

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_KEY=your-secret-key
```

---

## 🐛 Quick Fixes

**Port in use:**
```bash
npx kill-port 5173
```

**Clear cache:**
```bash
rm -rf node_modules/.vite
npm run dev
```

**Module not found:**
```bash
npm install
```

---

## 📱 Responsive Breakpoints

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

Example:
```tsx
<div className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
```

---

## 🎨 Status Colors

```typescript
// Attendance status
'full-day'  → green (bg-green-100 text-green-800)
'half-day'  → yellow (bg-yellow-100 text-yellow-800)
'absent'    → red (bg-red-100 text-red-800)

// Badge variants
'success'   → green
'warning'   → yellow
'danger'    → red
'info'      → blue
```

---

## 📞 Need Help?

1. Check `README.md` for full documentation
2. Check `SETUP_GUIDE.md` for detailed setup
3. Review component examples in pages
4. Check browser console for errors
5. Verify backend is running

---

**Happy Coding! 🚀**

