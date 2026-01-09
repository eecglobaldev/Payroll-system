# Quick Start Guide

Get the Payroll & Attendance API running in 5 minutes!

**TypeScript + ES Modules Edition** 🚀

## 📋 Checklist

Before you start, ensure you have:
- [ ] Node.js v18+ installed
- [ ] SQL Server access (192.168.10.31:1433)
- [ ] Database credentials (username & password)
- [ ] Network access to SQL Server

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 min)

```bash
npm install
```

### Step 2: Create Environment File (2 min)

Create a `.env` file in the project root with these settings:

```env
# Server
PORT=3000
NODE_ENV=production

# Security - CHANGE THIS!
API_KEY=payroll-2025-secure-key-xyz123

# Database - UPDATE PASSWORD!
DB_HOST=192.168.10.31
DB_PORT=1433
DB_USER=essl
DB_PASS=YOUR_PASSWORD_HERE
DB_NAME=etimetracklite1

# Keep defaults for the rest
DB_CONNECTION_TIMEOUT=30000
DB_REQUEST_TIMEOUT=15000
DB_POOL_MAX=10
DB_POOL_MIN=2
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200
IP_ALLOWLIST=
CORS_ORIGINS=
DEFAULT_WORK_HOURS_PER_DAY=8
LATE_ENTRY_THRESHOLD_MINUTES=15
EARLY_EXIT_THRESHOLD_MINUTES=30
OVERTIME_RATE_MULTIPLIER=1.5
HALF_DAY_HOURS_THRESHOLD=4
```

**⚠️ Important:** 
- Replace `YOUR_PASSWORD_HERE` with your actual SQL Server password
- Change `API_KEY` to a secure random string

### Step 3: Start the API (30 seconds)

**Development mode (TypeScript with auto-reload, no build needed):**
```bash
npm run dev
```

**Production mode (build + PM2):**
```bash
npm install -g pm2
npm run build        # Compile TypeScript
npm run pm2:start    # Start with PM2
```

### Step 4: Test the API (30 seconds)

Open your browser or use curl:

**Health Check:**
```
http://localhost:3000/api/ping
```

**Test with API Key:**
```bash
curl -H "x-api-key: payroll-2025-secure-key-xyz123" http://localhost:3000/api/attendance/latest?limit=10
```

### Step 5: Access from Other Computers (30 seconds)

Find your server's IP address:
```bash
ipconfig
```

Access from another computer on the same network:
```
http://YOUR_SERVER_IP:3000/api/ping
```

Replace `YOUR_SERVER_IP` with your actual IP (e.g., `192.168.10.100`).

## ✅ Success Indicators

You should see:
```
[Server] ✓ Database connected
[Server] 🚀 Payroll & Attendance API is running
[Server] Port: 3000
```

## 🎯 Quick Test Commands

```bash
# Health check (no auth needed)
curl http://localhost:3000/api/ping

# Latest attendance (requires API key)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/api/attendance/latest?limit=10

# Attendance by date
curl -H "x-api-key: YOUR_API_KEY" "http://localhost:3000/api/attendance/by-date?date=2025-12-08"

# Calculate salary
curl -H "x-api-key: YOUR_API_KEY" "http://localhost:3000/api/salary/EMP001?month=2025-12"
```

## 🔧 Common Issues

### "Failed to connect to SQL Server"
- ✓ Check SQL Server is running
- ✓ Verify IP address and port
- ✓ Confirm database credentials
- ✓ Test with: `ping 192.168.10.31`

### "Port 3000 is already in use"
- Change `PORT=3001` in `.env` file
- Or stop the process using port 3000

### "Missing x-api-key header"
- Add header to your request: `-H "x-api-key: YOUR_API_KEY"`
- Verify API key matches the one in `.env`

### Cannot access from other computers
- Allow port 3000 through Windows Firewall
- Verify both computers are on the same network

## 📚 Next Steps

1. **Review API Endpoints:** See `API_EXAMPLES.md`
2. **Security Setup:** Configure IP allowlist in `.env`
3. **Production Deployment:** Follow `DEPLOYMENT.md`
4. **Detailed Setup:** See `SETUP.md`

## 🆘 Get Help

1. Check logs: `npm run pm2:logs` (if using PM2) or terminal output
2. Test database: `http://localhost:3000/api/health`
3. Review `.env` configuration
4. See full documentation in `README.md`

## 💡 Pro Tips

- Use PM2 for production: `npm run pm2:start`
- View logs: `npm run pm2:logs`
- Monitor: `pm2 monit`
- Restart: `npm run pm2:restart`

---

**You're all set! Start making API requests!** 🎉

