# TypeScript + ES Modules Guide

This project has been fully converted to TypeScript with ES module syntax for improved type safety and modern JavaScript features.

## 🎯 What's New

### TypeScript Benefits
- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: IntelliSense and autocomplete
- **Modern Syntax**: ES2022 features
- **Easier Refactoring**: Safer code changes
- **Better Documentation**: Types serve as inline documentation

### ES Modules
- `import/export` instead of `require/module.exports`
- Better tree-shaking and optimization
- Native browser support
- Cleaner async/await usage
- Top-level await support

## 📁 Project Structure

```
src/
├── index.ts                 # Main server (TypeScript + ES modules)
├── types/
│   └── index.ts            # Shared TypeScript types & interfaces
├── db/
│   └── pool.ts             # Database connection with types
├── routes/
│   ├── attendance.ts       # Attendance endpoints with types
│   └── salary.ts           # Salary endpoints with types
├── services/
│   └── payroll.ts          # Payroll service with types
├── middleware/
│   ├── apiKey.ts           # API key middleware
│   └── ipAllowlist.ts      # IP allowlist middleware
└── utils/
    ├── date.ts             # Date utilities
    ├── ipRange.ts          # IP range utilities
    └── validation.ts       # Validation utilities
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

This installs all required packages including TypeScript and type definitions:
- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@types/express` - Express type definitions
- `@types/cors` - CORS type definitions
- `@types/mssql` - MSSQL type definitions
- `tsx` - TypeScript execution engine (for development)

### 2. Development Mode

Run with hot-reload (no compilation needed):

```bash
npm run dev
```

This uses `tsx` which runs TypeScript directly without building.

### 3. Build for Production

Compile TypeScript to JavaScript:

```bash
npm run build
```

This creates a `dist/` folder with compiled JavaScript files.

### 4. Run Production Build

```bash
npm start
```

This runs the compiled JavaScript from the `dist/` folder.

### 5. Type Checking

Check for type errors without building:

```bash
npm run type-check
```

## 📝 TypeScript Configuration

### tsconfig.json

Main TypeScript configuration:

```json
{
  "compilerOptions": {
    "target": "ES2022",           // Modern JavaScript
    "module": "ES2022",           // ES modules
    "moduleResolution": "node",   // Node.js module resolution
    "outDir": "./dist",           // Output directory
    "rootDir": "./src",           // Source directory
    "strict": true,               // Strict type checking
    "esModuleInterop": true,      // Better CommonJS interop
    "skipLibCheck": true,         // Faster compilation
    "resolveJsonModule": true     // Import JSON files
  }
}
```

### tsconfig.prod.json

Production build configuration (no source maps):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "sourceMap": false,
    "removeComments": true
  }
}
```

## 🔧 Key TypeScript Features Used

### 1. Type Definitions

All types are defined in `src/types/index.ts`:

```typescript
export interface AttendanceLog {
  id: number;
  EmployeeCode: string;
  SubmittedAt: Date;
  DeviceId?: string;
  Status?: string;
  LogType?: 'IN' | 'OUT';
}

export interface SalaryCalculation {
  employeeCode: string;
  month: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  attendance: AttendanceStats;
  breakdown: SalaryBreakdown;
}
```

### 2. Typed Functions

```typescript
export async function calculateSalary(
  employeeCode: string,
  month: string
): Promise<SalaryCalculation> {
  // Implementation with full type safety
}
```

### 3. Express Types

```typescript
import { Request, Response, NextFunction } from 'express';

router.get('/latest', async (req: Request, res: Response): Promise<void> => {
  // Fully typed request and response
});
```

### 4. Generic Database Queries

```typescript
const result = await query<AttendanceLog>(sqlQuery, params);
// result.recordset is typed as AttendanceLog[]
```

## 📦 ES Module Syntax

### Imports

```typescript
// Named imports
import { query, connect } from './db/pool.js';

// Default imports
import express from 'express';

// Namespace imports
import * as payroll from './services/payroll.js';

// Type-only imports
import type { AttendanceLog } from './types/index.js';
```

**Important**: Always include the `.js` extension in relative imports (even though the source file is `.ts`)!

### Exports

```typescript
// Named exports
export function calculateSalary(...) { }
export const config = { };

// Default export
export default router;

// Re-exports
export { query, connect } from './db/pool.js';
export * from './types/index.js';
```

## 🛠️ Development Workflow

### Hot Reload Development

```bash
npm run dev
```

- Uses `tsx` to run TypeScript directly
- Auto-reloads on file changes
- No build step needed
- Instant feedback

### Production Deployment

```bash
# 1. Build TypeScript
npm run build

# 2. Start with PM2
npm run pm2:start

# Or manually
pm2 start dist/index.js --name payroll-api
```

### Type Checking in CI/CD

```bash
# Check types without building
npm run type-check

# Build (this also checks types)
npm run build
```

## 🐛 Common TypeScript Issues

### Issue: Cannot find module

**Error**: `Cannot find module './utils/date.js'`

**Solution**: Always include `.js` extension in imports (not `.ts`):

```typescript
// ✅ Correct
import { formatDate } from './utils/date.js';

// ❌ Wrong
import { formatDate } from './utils/date';
import { formatDate } from './utils/date.ts';
```

### Issue: Type errors with Express

**Error**: `Property 'body' does not exist on type 'Request'`

**Solution**: Make sure you have `@types/express` installed and properly import types:

```typescript
import { Request, Response } from 'express';
app.use(express.json()); // Enable body parser
```

### Issue: Implicit any type

**Error**: `Parameter 'x' implicitly has an 'any' type`

**Solution**: Add explicit type annotations:

```typescript
// ✅ Correct
function process(data: string): void { }

// ❌ Wrong
function process(data) { }
```

### Issue: Strict null checks

**Error**: `Object is possibly 'null' or 'undefined'`

**Solution**: Use optional chaining or null checks:

```typescript
// ✅ Correct
const value = data?.field ?? 'default';

if (data !== null) {
  // Use data here
}

// ❌ Wrong (if data can be null)
const value = data.field;
```

## 📚 Type Definitions Reference

### Database Types

```typescript
interface DatabaseConfig { /* ... */ }
interface AttendanceLog { /* ... */ }
interface Employee { /* ... */ }
```

### API Types

```typescript
interface ApiResponse<T> { /* ... */ }
interface PaginationQuery { /* ... */ }
interface DateRangeQuery { /* ... */ }
```

### Payroll Types

```typescript
interface SalaryCalculation { /* ... */ }
interface MonthlyAttendance { /* ... */ }
interface DayHours { /* ... */ }
```

See `src/types/index.ts` for all type definitions.

## 🔍 IDE Setup

### VS Code (Recommended)

Install extensions:
- **TypeScript Vue Plugin** (by Vue)
- **ESLint** (optional, for linting)
- **Prettier** (optional, for formatting)

Settings:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.suggest.autoImports": true
}
```

### IntelliJ IDEA / WebStorm

TypeScript support is built-in. Just open the project and it will auto-configure.

## 📈 Performance

### Compilation Speed

- **Development**: Instant with `tsx` (no build step)
- **Production**: ~5-10 seconds for full build

### Runtime Performance

- **Same as JavaScript**: TypeScript compiles to plain JavaScript
- **No runtime overhead**: Types are removed during compilation
- **Better optimization**: ES modules enable better tree-shaking

## 🔄 Migration from JavaScript

If you have existing JavaScript code:

1. **Rename files**: `.js` → `.ts`
2. **Add type annotations**: Start with function parameters and return types
3. **Fix type errors**: Run `npm run type-check` and fix issues
4. **Add `.js` extensions**: Update all relative imports
5. **Update imports**: Change `require()` to `import`
6. **Update exports**: Change `module.exports` to `export`

## 📖 Learning Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [ES Modules in Node.js](https://nodejs.org/api/esm.html)
- [Express with TypeScript](https://expressjs.com/en/advanced/best-practice-performance.html)

## 🎓 Best Practices

1. **Define types first**: Create interfaces before implementation
2. **Use strict mode**: Keep `"strict": true` in tsconfig.json
3. **Avoid `any`**: Use specific types or `unknown`
4. **Export types**: Share types between modules
5. **Type database results**: Use generics with query functions
6. **Document with JSDoc**: Add comments for complex types
7. **Use type guards**: Check types at runtime when needed

## 🆘 Troubleshooting

### Build fails

```bash
# Clean build
npm run clean
npm run build
```

### Types not recognized

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### PM2 won't start

Make sure you build first:
```bash
npm run build
npm run pm2:start
```

---

**You now have a fully-typed, modern TypeScript + ES Modules API!** 🎉

