/**
 * Main Express Application
 * Internal Payroll & Attendance System API
 * LAN-based SQL Server Integration
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction, Application } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import rateLimit from 'express-rate-limit';
import * as db from './db/pool.js';
import validateApiKey from './middleware/apiKey.js';
import ipAllowlist from './middleware/ipAllowlist.js';

// Import routes
import attendanceRoutes from './routes/attendance.js';
import salaryRoutes from './routes/salary.js';
import employeeRoutes from './routes/employee.js';
import employeeDetailsRoutes from './routes/employeeDetails.js';
import leaveRoutes from './routes/leave.js';
import shiftRoutes from './routes/shift.js';
import overtimeRoutes from './routes/overtime.js';
import employeeShiftAssignmentRoutes from './routes/employeeShiftAssignment.js';
import authRoutes from './routes/auth.js';

// Initialize Express app
const app: Application = express();

// Trust proxy for rate limiting behind reverse proxy (DigitalOcean, Cloudflare, etc.)
app.set('trust proxy', 1);

const PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Security Middleware
 */

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable if serving API only
  crossOriginEmbedderPolicy: false,
}));

// Remove X-Powered-By header
app.disable('x-powered-by');

// CORS Configuration
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS;
    
    // If no CORS_ORIGINS specified, allow all origins (internal network only)
    if (!allowedOrigins || allowedOrigins.trim() === '') {
      return callback(null, true);
    }

    const allowList = allowedOrigins.split(',').map(o => o.trim());
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10), // 200 requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IP Allowlist (if configured)
app.use(ipAllowlist);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

/**
 * Root Route
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'Payroll & Attendance API',
    version: '1.0.0',
    status: 'running',
    database: 'PostgreSQL',
    endpoints: {
      health: '/api/health',
      ping: '/api/ping',
      auth: '/api/auth',
      employee: '/api/employee',
      attendance: '/api/attendance (API key required)',
      salary: '/api/salary (API key required)',
      employees: '/api/employees (API key required)',
      employeeDetails: '/api/employee-details (API key required)',
      leave: '/api/leave (API key required)',
      shifts: '/api/shifts (API key required)',
      overtime: '/api/overtime (API key required)',
      employeeShifts: '/api/employee-shifts (API key required)',
    },
    documentation: 'See README.md for API documentation',
  });
});

// Health check endpoint
app.get('/api/ping', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    service: 'Payroll & Attendance API',
    version: '1.0.0',
  });
});

// Database health check
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const pool = db.getPool();

    if (!pool) {
      await db.connect();
    } else {
      // Test connection with a simple query
      await pool.query('SELECT 1');
    }

    res.json({
      ok: true,
      database: 'connected',
      time: new Date().toISOString(),
    });
  } catch (err) {
    const error = err as Error;
    res.status(503).json({
      ok: false,
      database: 'disconnected',
      error: error.message,
      time: new Date().toISOString(),
    });
  }
});

// Authentication routes (public - no API key required)
app.use('/api/auth', authRoutes);

// Employee self-service routes (JWT protected - no API key required)
import employeeSelfServiceRoutes from './routes/employeeSelfService.js';
app.use('/api/employee', employeeSelfServiceRoutes);

/**
 * Protected Routes (require API key)
 */

// Apply API key authentication to all /api/* routes except public ones
app.use('/api/attendance', validateApiKey, attendanceRoutes);
app.use('/api/salary', validateApiKey, salaryRoutes);
app.use('/api/employees', validateApiKey, employeeRoutes);
app.use('/api/employee-details', validateApiKey, employeeDetailsRoutes);
app.use('/api/leave', validateApiKey, leaveRoutes);
app.use('/api/shifts', validateApiKey, shiftRoutes);
app.use('/api/overtime', validateApiKey, overtimeRoutes);
app.use('/api/employee-shifts', validateApiKey, employeeShiftAssignmentRoutes);

/**
 * Error Handling
 */

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err);

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed',
    });
    return;
  }

  res.status(500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

/**
 * Server Startup
 */

async function startServer(): Promise<void> {
  try {
    // Start HTTP server first (non-blocking)
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(60));
      console.log(`[Server] 🚀 Payroll & Attendance API is running`);
      console.log(`[Server] Port: ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Database: ${process.env.DB_HOST || 'not configured'}:${process.env.DB_PORT || '25060'} (PostgreSQL)`);
      console.log(`[Server] Time: ${new Date().toISOString()}`);
      console.log('='.repeat(60));
      console.log(`[Server] Health check: http://localhost:${PORT}/api/ping`);
      console.log('='.repeat(60));
    });

    // Connect to database asynchronously (non-blocking)
    // This allows the server to start even if DB connection fails initially
    console.log('[Server] Initializing database connection...');
    db.connect().then(() => {
      console.log('[Server] ✓ Database connected');
    }).catch((err: Error) => {
      console.error('[Server] ⚠ Database connection failed:', err.message);
      console.log('[Server] Server is running but database-dependent endpoints may fail');
      console.log('[Server] Database connection will be retried on first database request');
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Server] ✗ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 */

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[Server] ${signal} received, shutting down gracefully...`);

  try {
    await db.closePool();
    console.log('[Server] Database connection closed');
    process.exit(0);
  } catch (err) {
    const error = err as Error;
    console.error('[Server] Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('[Server] Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

export default app;

