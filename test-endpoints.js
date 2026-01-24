#!/usr/bin/env node

/**
 * Comprehensive Endpoint Testing Script
 * Tests all API endpoints to verify they're working correctly
 */

const BASE_URL = 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key-123'; // Default from test-api.http

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

// Helper function to make HTTP requests
async function makeRequest(method, url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { text: await response.text() };
    }
    
    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
    };
  }
}

// Test function
async function testEndpoint(name, method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = options.requiresApiKey ? { 'x-api-key': API_KEY } : {};
  
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const result = await makeRequest(method, url, {
    headers,
    body: options.body,
  });

  const status = result.ok ? '✓' : '✗';
  const color = result.ok ? colors.green : colors.red;
  
  console.log(`${color}${status}${colors.reset} ${name}`);
  console.log(`   ${method} ${path} → ${result.status}`);

  if (!result.ok) {
    results.failed++;
    results.errors.push({
      name,
      path,
      status: result.status,
      error: result.error || result.data,
    });
    if (options.verbose) {
      console.log(`   Error:`, result.error || JSON.stringify(result.data, null, 2));
    }
  } else {
    results.passed++;
  }

  return result;
}

// Main test function
async function runTests() {
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Testing All API Endpoints${colors.reset}`);
  console.log(`${colors.cyan}  Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}  API Key: ${API_KEY.substring(0, 10)}...${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

  // Test public endpoints (no API key required)
  console.log(`${colors.blue}📋 PUBLIC ENDPOINTS${colors.reset}`);
  await testEndpoint('Root endpoint', 'GET', '/');
  await testEndpoint('Ping endpoint', 'GET', '/api/ping');
  await testEndpoint('Health check', 'GET', '/api/health');
  console.log('');

  // Test auth endpoints (public)
  console.log(`${colors.blue}🔐 AUTH ENDPOINTS${colors.reset}`);
  await testEndpoint('Send OTP (test)', 'POST', '/api/auth/employee/send-otp', {
    body: { employeeCode: 'TEST001' },
    verbose: false,
  });
  await testEndpoint('Verify OTP (test)', 'POST', '/api/auth/employee/verify-otp', {
    body: { employeeCode: 'TEST001', otp: '123456' },
    verbose: false,
  });
  await testEndpoint('Resend OTP (test)', 'POST', '/api/auth/employee/resend-otp', {
    body: { employeeCode: 'TEST001' },
    verbose: false,
  });
  console.log('');

  // Test attendance endpoints
  console.log(`${colors.blue}📅 ATTENDANCE ENDPOINTS${colors.reset}`);
  await testEndpoint('Get latest attendance', 'GET', '/api/attendance/latest?limit=10', {
    requiresApiKey: true,
  });
  await testEndpoint('Get attendance by date', 'GET', '/api/attendance/by-date?date=2026-01-24', {
    requiresApiKey: true,
  });
  await testEndpoint('Get employee attendance', 'GET', '/api/attendance/employee/1464?start=2026-01-01&end=2026-01-31', {
    requiresApiKey: true,
  });
  await testEndpoint('Get attendance summary', 'GET', '/api/attendance/summary/1464?start=2026-01-01&end=2026-01-31', {
    requiresApiKey: true,
  });
  await testEndpoint('Get daily attendance', 'GET', '/api/attendance/daily/1464/2026-01-24', {
    requiresApiKey: true,
  });
  await testEndpoint('Get attendance logs', 'GET', '/api/attendance/logs/1464/2026-01-24', {
    requiresApiKey: true,
  });
  await testEndpoint('Get regularizations', 'GET', '/api/attendance/regularization/TEST001', {
    requiresApiKey: true,
  });
  console.log('');

  // Test salary endpoints
  console.log(`${colors.blue}💰 SALARY ENDPOINTS${colors.reset}`);
  await testEndpoint('Get salary summary', 'GET', '/api/salary/summary?month=2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Calculate salary', 'GET', '/api/salary/1464?month=2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Get monthly hours', 'GET', '/api/salary/1464/hours?month=2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Get daily breakdown', 'GET', '/api/salary/1464/breakdown/2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Get recent attendance', 'GET', '/api/salary/1464/recent-attendance', {
    requiresApiKey: true,
  });
  await testEndpoint('Get salary status', 'GET', '/api/salary/1464/status?month=2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Get salary adjustments', 'GET', '/api/salary/adjustments/TEST001?month=2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Get salary hold', 'GET', '/api/salary/hold/TEST001?month=2026-01', {
    requiresApiKey: true,
  });
  console.log('');

  // Test employee endpoints
  console.log(`${colors.blue}👥 EMPLOYEE ENDPOINTS${colors.reset}`);
  await testEndpoint('Get all employees', 'GET', '/api/employees', {
    requiresApiKey: true,
  });
  await testEndpoint('Search employees', 'GET', '/api/employees/search?name=test', {
    requiresApiKey: true,
  });
  await testEndpoint('Get employee by number', 'GET', '/api/employees/1', {
    requiresApiKey: true,
  });
  await testEndpoint('Get employees by department', 'GET', '/api/employees/department/IT', {
    requiresApiKey: true,
  });
  console.log('');

  // Test employee details endpoints
  console.log(`${colors.blue}📝 EMPLOYEE DETAILS ENDPOINTS${colors.reset}`);
  await testEndpoint('Get all employee details', 'GET', '/api/employee-details', {
    requiresApiKey: true,
  });
  await testEndpoint('Get employee details by code', 'GET', '/api/employee-details/TEST001', {
    requiresApiKey: true,
  });
  await testEndpoint('Get employees by department', 'GET', '/api/employee-details/department/IT', {
    requiresApiKey: true,
  });
  await testEndpoint('Get salary info', 'GET', '/api/employee-details/TEST001/salary-info', {
    requiresApiKey: true,
  });
  console.log('');

  // Test leave endpoints
  console.log(`${colors.blue}🏖️  LEAVE ENDPOINTS${colors.reset}`);
  await testEndpoint('Get leave balance', 'GET', '/api/leave/TEST001/balance?year=2026', {
    requiresApiKey: true,
  });
  await testEndpoint('Get monthly leave usage', 'GET', '/api/leave/TEST001/monthly/2026-01', {
    requiresApiKey: true,
  });
  console.log('');

  // Test shift endpoints
  console.log(`${colors.blue}⏰ SHIFT ENDPOINTS${colors.reset}`);
  await testEndpoint('Get all shifts', 'GET', '/api/shifts', {
    requiresApiKey: true,
  });
  await testEndpoint('Get shift by name', 'GET', '/api/shifts/Morning', {
    requiresApiKey: true,
  });
  console.log('');

  // Test overtime endpoints
  console.log(`${colors.blue}⏱️  OVERTIME ENDPOINTS${colors.reset}`);
  await testEndpoint('Get overtime status', 'GET', '/api/overtime/TEST001/2026-01', {
    requiresApiKey: true,
  });
  await testEndpoint('Get batch overtime status', 'GET', '/api/overtime/batch/2026-01?employeeCodes=TEST001,TEST002', {
    requiresApiKey: true,
  });
  console.log('');

  // Test employee shift assignment endpoints
  console.log(`${colors.blue}📋 EMPLOYEE SHIFT ASSIGNMENT ENDPOINTS${colors.reset}`);
  await testEndpoint('Get shift assignments', 'GET', '/api/employee-shifts/TEST001', {
    requiresApiKey: true,
  });
  console.log('');

  // Test employee self-service endpoints (JWT protected - will fail without token)
  console.log(`${colors.blue}🔒 EMPLOYEE SELF-SERVICE ENDPOINTS (JWT Protected)${colors.reset}`);
  const selfServiceResult = await testEndpoint('Get employee profile (no token)', 'GET', '/api/employee/me', {
    verbose: false,
  });
  if (!selfServiceResult.ok) {
    console.log(`   ${colors.yellow}⚠ Expected to fail without JWT token${colors.reset}`);
    results.skipped++;
    results.passed--; // Don't count as passed
  }
  console.log('');

  // Test error cases
  console.log(`${colors.blue}❌ ERROR HANDLING TESTS${colors.reset}`);
  const noApiKeyResult = await testEndpoint('Missing API key (should fail)', 'GET', '/api/attendance/latest', {
    verbose: false,
  });
  if (noApiKeyResult.status === 401) {
    console.log(`   ${colors.green}✓ Correctly rejected request without API key${colors.reset}`);
    results.passed++;
    results.failed--; // Adjust counts
  }

  const invalidApiKeyResult = await testEndpoint('Invalid API key (should fail)', 'GET', '/api/attendance/latest', {
    headers: { 'x-api-key': 'invalid-key' },
    verbose: false,
  });
  if (invalidApiKeyResult.status === 401) {
    console.log(`   ${colors.green}✓ Correctly rejected request with invalid API key${colors.reset}`);
    results.passed++;
    results.failed--; // Adjust counts
  }

  const notFoundResult = await testEndpoint('404 Not Found', 'GET', '/api/nonexistent', {
    requiresApiKey: true,
    verbose: false,
  });
  if (notFoundResult.status === 404) {
    console.log(`   ${colors.green}✓ Correctly returned 404 for non-existent route${colors.reset}`);
    results.passed++;
    results.failed--; // Adjust counts
  }
  console.log('');

  // Print summary
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✓ Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}⊘ Skipped: ${results.skipped}${colors.reset}`);
  console.log('');

  if (results.errors.length > 0) {
    console.log(`${colors.red}ERRORS:${colors.reset}`);
    results.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.name}`);
      console.log(`   Path: ${error.path}`);
      console.log(`   Status: ${error.status}`);
      if (error.error) {
        console.log(`   Error: ${JSON.stringify(error.error, null, 2)}`);
      }
    });
  }

  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
