#!/bin/bash

# Verify all API endpoints in Payroll-system
# Usage: ./verify-endpoints.sh [base_url]

BASE_URL="${1:-http://localhost:3000}"
API_KEY="${API_KEY:-test-api-key-123}"

echo "=========================================="
echo "API Endpoints Verification"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "API Key: $API_KEY"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local requires_auth=${4:-false}
    local data=${5:-""}
    
    local url="${BASE_URL}${endpoint}"
    local headers=""
    
    if [ "$requires_auth" = "true" ]; then
        headers="-H \"X-API-Key: $API_KEY\""
    fi
    
    echo -n "Testing: $method $endpoint ... "
    
    local temp_file=$(mktemp)
    
    if [ "$method" = "GET" ]; then
        if [ -n "$data" ]; then
            eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X GET "$url?$data" $headers -o "$temp_file" 2>&1
        else
            eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X GET "$url" $headers -o "$temp_file" 2>&1
        fi
    elif [ "$method" = "POST" ]; then
        if [ -n "$data" ]; then
            eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "'$data'" $headers -o "$temp_file" 2>&1
        else
            eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$url" -H "Content-Type: application/json" $headers -o "$temp_file" 2>&1
        fi
    elif [ "$method" = "PUT" ]; then
        eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X PUT "$url" -H "Content-Type: application/json" -d "'$data'" $headers -o "$temp_file" 2>&1
    elif [ "$method" = "DELETE" ]; then
        eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X DELETE "$url" $headers -o "$temp_file" 2>&1
    else
        eval curl -s -w "\nHTTPSTATUS:%{http_code}" -X "$method" "$url" $headers -o "$temp_file" 2>&1
    fi
    
    http_code=$(grep "HTTPSTATUS:" "$temp_file" | cut -d: -f2 | tr -d '\n')
    body=$(grep -v "HTTPSTATUS:" "$temp_file")
    rm -f "$temp_file"
    
    # Check if curl failed
    if echo "$response" | grep -q "curl:"; then
        echo -e "${RED}FAILED${NC} - Connection error"
        FAILED=$((FAILED + 1))
        return 1
    fi
    
    # Check HTTP status code
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    elif [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
        echo -e "${YELLOW}AUTH REQUIRED${NC} (HTTP $http_code) - Expected for protected endpoints"
        SKIPPED=$((SKIPPED + 1))
        return 0
    elif [ "$http_code" -eq 404 ]; then
        echo -e "${RED}NOT FOUND${NC} (HTTP $http_code)"
        FAILED=$((FAILED + 1))
        return 1
    elif [ "$http_code" -eq 400 ]; then
        echo -e "${YELLOW}BAD REQUEST${NC} (HTTP $http_code) - May need valid parameters"
        SKIPPED=$((SKIPPED + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC} (HTTP $http_code)"
        echo "  Response: $(echo "$body" | head -c 100)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "=========================================="
echo "Public Endpoints (No Auth Required)"
echo "=========================================="

test_endpoint "GET" "/" "Root endpoint"
test_endpoint "GET" "/api/ping" "Ping endpoint"
test_endpoint "GET" "/api/health" "Health check endpoint"

echo ""
echo "=========================================="
echo "Authentication Endpoints"
echo "=========================================="

# Test auth endpoints (may need valid credentials)
test_endpoint "POST" "/api/auth/login" "Login endpoint" false '{"employeeCode":"1","password":"test"}'
test_endpoint "POST" "/api/auth/register" "Register endpoint" false '{"employeeCode":"1","password":"test"}'
test_endpoint "POST" "/api/auth/verify-otp" "Verify OTP endpoint" false '{"employeeCode":"1","otp":"123456"}'

echo ""
echo "=========================================="
echo "Employee Self-Service Endpoints (JWT)"
echo "=========================================="

# These require JWT token, will likely return 401
test_endpoint "GET" "/api/employee/me" "Get profile" false
test_endpoint "GET" "/api/employee/salary" "Get salary" false
test_endpoint "GET" "/api/employee/salary/history" "Get salary history" false
test_endpoint "GET" "/api/employee/attendance" "Get attendance" false

echo ""
echo "=========================================="
echo "Protected Endpoints (API Key Required)"
echo "=========================================="

echo "Testing with API Key: $API_KEY"
echo ""

# Attendance endpoints
test_endpoint "GET" "/api/attendance/latest" "Get latest attendance" true "limit=10"
test_endpoint "GET" "/api/attendance/by-date" "Get attendance by date" true "date=2024-01-15"
test_endpoint "GET" "/api/attendance/employee/1" "Get employee attendance" true "start=2024-01-01&end=2024-01-31"

# Employee endpoints
test_endpoint "GET" "/api/employees" "Get all employees" true
test_endpoint "GET" "/api/employees/search" "Search employees" true "name=test"
test_endpoint "GET" "/api/employees/1" "Get employee by ID" true

# Employee Details endpoints
test_endpoint "GET" "/api/employee-details" "Get all employee details" true
test_endpoint "GET" "/api/employee-details/1" "Get employee details by code" true

# Salary endpoints
test_endpoint "GET" "/api/salary/summary" "Get salary summary" true
test_endpoint "GET" "/api/salary/1/2024-01" "Get salary for employee/month" true

# Leave endpoints
test_endpoint "GET" "/api/leave/1" "Get leave for employee" true
test_endpoint "GET" "/api/leave/1/2024-01" "Get leave for employee/month" true

# Shift endpoints
test_endpoint "GET" "/api/shifts" "Get all shifts" true
test_endpoint "GET" "/api/shifts/Morning" "Get shift by name" true

# Overtime endpoints
test_endpoint "GET" "/api/overtime/1/2024-01" "Get overtime status" true

# Employee Shift Assignment endpoints
test_endpoint "GET" "/api/employee-shifts/1" "Get shift assignments" true

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${YELLOW}Skipped (Auth/Params needed): $SKIPPED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All endpoint tests completed!${NC}"
    echo ""
    echo "Note: Some endpoints may show 'AUTH REQUIRED' or 'BAD REQUEST' which is expected"
    echo "if they need valid JWT tokens or specific parameters."
    exit 0
else
    echo -e "${RED}❌ Some endpoints failed. Check the errors above.${NC}"
    exit 1
fi
