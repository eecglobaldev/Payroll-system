# DigitalOcean App Platform Deployment Guide

This guide will help you deploy your Attendance & Payroll System to DigitalOcean App Platform.

## Prerequisites

1. **DigitalOcean Account**: Sign up at [digitalocean.com](https://www.digitalocean.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Database Access**: Ensure your SQL Server database is accessible from the internet (or use a VPN/Database connection service)

## Important Considerations

### Database Connectivity

⚠️ **Your current setup uses a LAN-based SQL Server** (`192.168.10.31`). For DigitalOcean App Platform to connect:

1. **Option A: Public Database Access** (Not Recommended for Production)
   - Expose your SQL Server to the internet
   - Configure firewall rules to allow DigitalOcean IPs
   - Use strong passwords and encryption

2. **Option B: VPN Connection** (Recommended)
   - Set up a VPN between DigitalOcean and your network
   - Use DigitalOcean's VPC or a managed VPN service
   - Keep database on private network

3. **Option C: Managed Database** (Best for Production)
   - Migrate to DigitalOcean Managed Database (PostgreSQL/MySQL)
   - Or use Azure SQL Database / AWS RDS
   - Update connection strings accordingly

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for DigitalOcean deployment"
   git push origin main
   ```

2. **Update `app.yaml`** with your actual values:
   - Replace `your-username/Attendance_project` with your GitHub username/repo
   - Update all environment variable placeholders
   - Update database connection details

### Step 2: Create App on DigitalOcean

#### Option A: Using App Platform Dashboard (Recommended for First Time)

1. **Log in to DigitalOcean** and navigate to **App Platform**
2. **Click "Create App"**
3. **Connect your GitHub account** (if not already connected)
4. **Select your repository**: `Attendance_project`
5. **Choose "Deploy from GitHub"**
6. **Select branch**: `main`
7. **Configure Auto-Deploy**: Enable to deploy on every push

#### Option B: Using app.yaml (Recommended for CI/CD)

1. **Log in to DigitalOcean** and navigate to **App Platform**
2. **Click "Create App"**
3. **Select "Upload a Config File"**
4. **Upload your `app.yaml`** file
5. **Review the configuration** and click "Next"

### Step 3: Configure Services

The `app.yaml` defines two components:

#### Backend API Service
- **Name**: `api`
- **Build Command**: `npm install && npm run build`
- **Run Command**: `npm start`
- **Port**: `3000`
- **Health Check**: `/api/ping`

#### Frontend Static Site
- **Name**: `admin-dashboard`
- **Build Command**: `npm install && npm run build`
- **Output Directory**: `dist`

### Step 4: Set Environment Variables

In the DigitalOcean dashboard, configure these environment variables:

#### Backend API Environment Variables:

**Required:**
- `NODE_ENV` = `production`
- `PORT` = `3000`
- `DB_HOST` = Your SQL Server hostname/IP
- `DB_PORT` = `1433` (or your custom port)
- `DB_NAME` = Your database name
- `DB_USER` = Your database username
- `DB_PASS` = Your database password
- `API_KEY` = Your API key for authentication
- `JWT_SECRET` = Your JWT secret key

**Optional:**
- `CORS_ORIGINS` = Comma-separated list of allowed origins
- `RATE_LIMIT_WINDOW_MS` = `60000`
- `RATE_LIMIT_MAX_REQUESTS` = `200`
- `DB_CONNECTION_TIMEOUT` = `30000`
- `DB_REQUEST_TIMEOUT` = `15000`
- `DB_POOL_MAX` = `10`
- `DB_POOL_MIN` = `2`

#### Frontend Build Environment Variables:

**Required:**
- `VITE_API_BASE_URL` = Your backend API URL (e.g., `https://api-your-app-name.ondigitalocean.app/api`)
- `VITE_API_KEY` = Your API key (same as backend)

**Note**: Frontend env vars are set at **BUILD TIME**, so you'll need to rebuild after changing them.

### Step 5: Configure Database Connection

Since you're using SQL Server, ensure:

1. **Firewall Rules**: Allow DigitalOcean App Platform IPs to connect
   - You can find your app's outbound IPs in the App Platform dashboard
   - Add these IPs to your SQL Server firewall rules

2. **Connection String**: Update `DB_HOST` in environment variables
   - If using a public IP, use that IP
   - If using a hostname, ensure DNS is configured

3. **SSL/TLS**: Your current config has `encrypt: false`
   - For production, consider enabling encryption
   - Update `src/db/pool.ts` if needed

### Step 6: Deploy

1. **Review all settings** in the DigitalOcean dashboard
2. **Click "Create Resources"** or "Deploy"
3. **Wait for build to complete** (5-10 minutes for first deployment)
4. **Check build logs** for any errors

### Step 7: Verify Deployment

1. **Backend Health Check**:
   ```bash
   curl https://api-your-app-name.ondigitalocean.app/api/ping
   ```
   Should return: `{"ok":true,"time":"...","service":"Payroll & Attendance API","version":"1.0.0"}`

2. **Database Connection**:
   ```bash
   curl https://api-your-app-name.ondigitalocean.app/api/health
   ```
   Should return: `{"ok":true,"database":"connected","time":"..."}`

3. **Frontend**: Visit your frontend URL in a browser

### Step 8: Update Frontend API URL

After deployment, you'll get URLs like:
- Backend: `https://api-your-app-name.ondigitalocean.app`
- Frontend: `https://admin-dashboard-your-app-name.ondigitalocean.app`

1. **Update `VITE_API_BASE_URL`** in frontend environment variables:
   - Set to: `https://api-your-app-name.ondigitalocean.app/api`
2. **Redeploy the frontend** (trigger a new build)

## Post-Deployment Configuration

### Custom Domains

1. In DigitalOcean dashboard, go to your app
2. Navigate to **Settings** → **Domains**
3. Add your custom domain
4. Update DNS records as instructed

### SSL Certificates

- DigitalOcean automatically provides SSL certificates via Let's Encrypt
- Certificates are automatically renewed

### Monitoring & Logs

1. **View Logs**: App Platform → Your App → Runtime Logs
2. **Metrics**: App Platform → Your App → Metrics
3. **Alerts**: Configure in App Platform settings

## Troubleshooting

### Build Failures

1. **Check build logs** in DigitalOcean dashboard
2. **Common issues**:
   - Missing dependencies in `package.json`
   - TypeScript compilation errors
   - Environment variables not set

### Database Connection Issues

1. **Check firewall rules** allow DigitalOcean IPs
2. **Verify credentials** in environment variables
3. **Test connection** from a DigitalOcean Droplet (if available)
4. **Check SQL Server logs** for connection attempts

### Frontend Not Connecting to Backend

1. **Verify `VITE_API_BASE_URL`** is correct
2. **Check CORS settings** in backend
3. **Rebuild frontend** after changing env vars
4. **Check browser console** for errors

### API Key Issues

1. **Ensure `API_KEY`** matches in both backend and frontend
2. **Check request headers** include `x-api-key`
3. **Verify middleware** is working correctly

## Cost Estimation

- **Basic Plan**: ~$5/month per service
- **Backend API**: 1 service = ~$5/month
- **Frontend Static Site**: Free tier available, or ~$3/month
- **Total**: ~$5-8/month for basic setup

You can scale up as needed.

## Security Best Practices

1. **Use Secrets** for sensitive environment variables
2. **Enable CORS** with specific origins (not `*`)
3. **Use HTTPS** (automatic with DigitalOcean)
4. **Rotate API keys** regularly
5. **Monitor logs** for suspicious activity
6. **Keep dependencies updated**

## Continuous Deployment

Once configured, every push to your `main` branch will automatically:
1. Trigger a new build
2. Deploy the updated code
3. Restart services if needed

You can disable auto-deploy in settings if needed.

## Rollback

If something goes wrong:
1. Go to **Deployments** tab in DigitalOcean dashboard
2. Find a previous successful deployment
3. Click **"Rollback"** to revert

## Additional Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Node.js on App Platform](https://docs.digitalocean.com/products/app-platform/how-to/use-nodejs/)
- [Static Sites on App Platform](https://docs.digitalocean.com/products/app-platform/how-to/use-static-sites/)

## Support

If you encounter issues:
1. Check DigitalOcean status page
2. Review application logs
3. Check DigitalOcean community forums
4. Contact DigitalOcean support (if on paid plan)
