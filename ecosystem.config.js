/**
 * PM2 Configuration File
 * For production deployment of the Payroll & Attendance API
 * TypeScript + ES Modules version
 */

export default {
  apps: [
    {
      name: 'payroll-api',
      script: './dist/index.js',
      instances: 1, // Single instance for LAN application
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Memory management
      max_memory_restart: '500M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Watch for file changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', 'src', '*.ts'],
      
      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: '0 3 * * *',
      
      // Time before forced reload
      shutdown_with_message: true,
    },
  ],
};

