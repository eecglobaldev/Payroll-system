# Quick Start: DigitalOcean Deployment

## ✅ Pre-Deployment Checklist

- [ ] Code is pushed to GitHub
- [ ] SQL Server is accessible from internet (or VPN configured)
- [ ] Updated `app.yaml` with your GitHub repo and credentials
- [ ] Have DigitalOcean account ready

## 🚀 Quick Deployment Steps

### 1. Update app.yaml
Edit `app.yaml` and replace:
- Repository is already set to: `eecglobaldev/Payroll-system`
- `your-db-host` → Your SQL Server hostname/IP
- `your-database-name` → Your database name
- `your-db-user` → Your database username
- `your-db-password` → Your database password
- `your-api-key` → Your API key
- `your-jwt-secret` → Your JWT secret
- `https://api-your-app-name.ondigitalocean.app/api` → Will be set after first deployment

### 2. Deploy to DigitalOcean

**Option A: Via Dashboard (Easiest)**
1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect GitHub and select your repo
4. DigitalOcean will auto-detect `app.yaml`
5. Review configuration
6. Click "Create Resources"

**Option B: Via CLI**
```bash
# Install doctl (DigitalOcean CLI)
# Then:
doctl apps create --spec app.yaml
```

### 3. Set Environment Variables

After deployment, go to each service and set environment variables:

**Backend (api service):**
- All database credentials
- API_KEY, JWT_SECRET
- CORS_ORIGINS (set to your frontend URL after deployment)

**Frontend (admin-dashboard):**
- VITE_API_BASE_URL (set to your backend URL)
- VITE_API_KEY

### 4. Update Frontend API URL

After first deployment:
1. Note your backend URL (e.g., `https://api-xyz.ondigitalocean.app`)
2. Update `VITE_API_BASE_URL` in frontend env vars to: `https://api-xyz.ondigitalocean.app/api`
3. Trigger a rebuild (push a commit or manually rebuild)

## 🔍 Verify Deployment

```bash
# Test backend
curl https://your-backend-url.ondigitalocean.app/api/ping

# Test database connection
curl https://your-backend-url.ondigitalocean.app/api/health

# Visit frontend
open https://your-frontend-url.ondigitalocean.app
```

## ⚠️ Important Notes

1. **Database Access**: Your SQL Server must be accessible from DigitalOcean. Options:
   - Public IP with firewall rules
   - VPN connection
   - Managed database service

2. **Environment Variables**: Frontend env vars are set at BUILD TIME. You must rebuild after changing them.

3. **CORS**: Update `CORS_ORIGINS` to include your frontend URL.

4. **First Deployment**: Takes 5-10 minutes. Subsequent deployments are faster.

## 📚 Full Documentation

See [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md) for detailed instructions.

## 🆘 Troubleshooting

**Build fails?**
- Check logs in DigitalOcean dashboard
- Verify all dependencies in package.json
- Check TypeScript compilation errors

**Database connection fails?**
- Verify firewall allows DigitalOcean IPs
- Check credentials in environment variables
- Test connection from a different location

**Frontend can't reach backend?**
- Verify VITE_API_BASE_URL is correct
- Check CORS settings
- Rebuild frontend after changing env vars
