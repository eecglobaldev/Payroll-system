# JWT Authentication Fix Summary

## Issues Fixed

1. **Phone Number Mapping**: Fixed `EmployeeDetailsModel.mapToEmployeeDetails()` to handle both lowercase (PostgreSQL) and PascalCase column names
2. **JWT Implementation**: Updated to use `jsonwebtoken` library instead of custom implementation
3. **Trust Proxy**: Added `app.set('trust proxy', 1)` to fix rate limiting warnings
4. **Debug Logging**: Added comprehensive logging for JWT token verification

## Changes Made

### 1. `src/models/EmployeeDetailsModel.ts`
- Updated `mapToEmployeeDetails()` to check both `row.phonenumber` and `row.PhoneNumber`
- This fixes the "Phone number not registered" error

### 2. `src/utils/jwt.ts`
- Replaced custom JWT implementation with `jsonwebtoken` library
- Added proper error handling and logging
- Uses `jwt.sign()` and `jwt.verify()` from jsonwebtoken library

### 3. `src/middleware/jwtAuth.ts`
- Added detailed logging for token verification
- Better error messages

### 4. `src/index.ts`
- Added `app.set('trust proxy', 1)` to fix rate limiting warnings

## Deployment Steps

1. **Rebuild the backend:**
   ```bash
   cd Payroll-system
   npm run build
   ```

2. **Deploy to DigitalOcean:**
   - Commit and push changes (if using Git)
   - Or manually update files on DigitalOcean
   - App will auto-redeploy

3. **Verify Environment Variables on DigitalOcean:**
   - `JWT_SECRET` - Must match the secret used for token generation
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SSL`
   - `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`

4. **Test:**
   - Try OTP login with employee code `9999`
   - Check DigitalOcean logs for JWT verification messages
   - Should see: `[JWT] Token verified successfully for: 9999`

## Expected Log Output

After deployment, you should see in DigitalOcean logs:
```
[JWT] Verifying token, secret configured: true Token length: ...
[JWT] Token verified successfully: { employeeCode: '9999', role: 'EMPLOYEE', userId: ... }
[JWT Auth] Token verified successfully for: 9999
```

## Troubleshooting

If still getting 401 errors:

1. **Check JWT_SECRET**: Ensure it's set correctly on DigitalOcean
2. **Check Token Format**: Verify token is being sent in `Authorization: Bearer <token>` header
3. **Check Logs**: Look for JWT verification errors in DigitalOcean logs
4. **Token Expiry**: Tokens expire after 24 hours, try logging in again

## Testing

Test the endpoint directly:
```bash
# 1. Get OTP
curl -X POST https://hr-backend-q76cs.ondigitalocean.app/api/auth/employee/send-otp \
  -H "Content-Type: application/json" \
  -d '{"employeeCode":"9999"}'

# 2. Verify OTP (use OTP from SMS or devOTP from response)
curl -X POST https://hr-backend-q76cs.ondigitalocean.app/api/auth/employee/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"employeeCode":"9999","otp":"123456"}'

# 3. Use token to get profile
curl -X GET https://hr-backend-q76cs.ondigitalocean.app/api/employee/me \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_2>"
```
