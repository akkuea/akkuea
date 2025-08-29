#!/bin/bash

# Manual Authentication Testing Scripts for Akkuea Backend
# This script tests all authentication endpoints using cURL
# Make sure the server is running on localhost:8080 before executing

set -e

echo "🧪 Akkuea Authentication Endpoint Testing"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SERVER_URL="http://localhost:8080"
TEST_RESULTS_FILE="test_results_$(date +%Y%m%d_%H%M%S).json"

# Function to print test results
print_test_result() {
    local test_name="$1"
    local expected_status="$2"
    local actual_status="$3"
    local response="$4"
    
    echo -e "${BLUE}Test: $test_name${NC}"
    echo "Expected Status: $expected_status"
    echo "Actual Status: $actual_status"
    
    if [ "$actual_status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
    else
        echo -e "${RED}❌ FAILED${NC}"
    fi
    
    echo "Response: $response"
    echo "---"
    echo ""
}

# Function to make HTTP request and extract status code
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local headers="$4"
    
    if [ -n "$headers" ]; then
        if [ -n "$data" ]; then
            curl -s -w "\n%{http_code}" -X "$method" "$SERVER_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "$headers" \
                -d "$data"
        else
            curl -s -w "\n%{http_code}" -X "$method" "$SERVER_URL$endpoint" \
                -H "$headers"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -w "\n%{http_code}" -X "$method" "$SERVER_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -w "\n%{http_code}" -X "$method" "$SERVER_URL$endpoint"
        fi
    fi
}

# Start test results JSON
echo "{" > $TEST_RESULTS_FILE
echo '  "test_session": {' >> $TEST_RESULTS_FILE
echo "    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"," >> $TEST_RESULTS_FILE
echo "    \"server_url\": \"$SERVER_URL\"," >> $TEST_RESULTS_FILE
echo '    "tests": [' >> $TEST_RESULTS_FILE

echo -e "${YELLOW}📋 Starting Authentication Tests...${NC}"
echo ""

# Test 1: Health Check (baseline)
echo -e "${BLUE}🔍 Test 1: Health Check${NC}"
response=$(make_request "GET" "/health" "" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Health Check" "200" "$status" "$body"

# Test 2: Valid User Registration - Educator
echo -e "${BLUE}🔍 Test 2: Valid User Registration (Educator)${NC}"
educator_data='{
    "name": "John Educator",
    "email": "john.educator@akkuea.com",
    "password": "securepassword123",
    "role": "Educator"
}'
response=$(make_request "POST" "/auth/register" "$educator_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Register Educator" "201" "$status" "$body"

# Extract educator token for later use
educator_token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test 3: Valid User Registration - Student
echo -e "${BLUE}🔍 Test 3: Valid User Registration (Student)${NC}"
student_data='{
    "name": "Jane Student",
    "email": "jane.student@akkuea.com",
    "password": "securepassword123",
    "role": "Student"
}'
response=$(make_request "POST" "/auth/register" "$student_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Register Student" "201" "$status" "$body"

# Extract student token for later use
student_token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test 4: Valid User Registration - Designer
echo -e "${BLUE}🔍 Test 4: Valid User Registration (Designer)${NC}"
designer_data='{
    "name": "Bob Designer",
    "email": "bob.designer@akkuea.com",
    "password": "securepassword123",
    "role": "Designer"
}'
response=$(make_request "POST" "/auth/register" "$designer_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Register Designer" "201" "$status" "$body"

# Extract designer token for later use
designer_token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test 5: Invalid Registration - Duplicate Email
echo -e "${BLUE}🔍 Test 5: Invalid Registration (Duplicate Email)${NC}"
duplicate_data='{
    "name": "Another John",
    "email": "john.educator@akkuea.com",
    "password": "anotherpassword123",
    "role": "Student"
}'
response=$(make_request "POST" "/auth/register" "$duplicate_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Duplicate Email Registration" "400" "$status" "$body"

# Test 6: Invalid Registration - Invalid Role
echo -e "${BLUE}🔍 Test 6: Invalid Registration (Invalid Role)${NC}"
invalid_role_data='{
    "name": "Invalid Role User",
    "email": "invalid@akkuea.com",
    "password": "password123",
    "role": "Administrator"
}'
response=$(make_request "POST" "/auth/register" "$invalid_role_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Invalid Role Registration" "400" "$status" "$body"

# Test 7: Invalid Registration - Missing Fields
echo -e "${BLUE}🔍 Test 7: Invalid Registration (Missing Email)${NC}"
missing_email_data='{
    "name": "Missing Email User",
    "password": "password123",
    "role": "Student"
}'
response=$(make_request "POST" "/auth/register" "$missing_email_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Missing Email Registration" "400" "$status" "$body"

# Test 8: Invalid Registration - Short Password
echo -e "${BLUE}🔍 Test 8: Invalid Registration (Short Password)${NC}"
short_password_data='{
    "name": "Short Password User",
    "email": "short@akkuea.com",
    "password": "123",
    "role": "Student"
}'
response=$(make_request "POST" "/auth/register" "$short_password_data" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Short Password Registration" "400" "$status" "$body"

# Test 9: Valid Login - Educator
echo -e "${BLUE}🔍 Test 9: Valid Login (Educator)${NC}"
educator_login='{
    "email": "john.educator@akkuea.com",
    "password": "securepassword123"
}'
response=$(make_request "POST" "/auth/login" "$educator_login" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Educator Login" "200" "$status" "$body"

# Update educator token from login
educator_token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test 10: Valid Login - Student
echo -e "${BLUE}🔍 Test 10: Valid Login (Student)${NC}"
student_login='{
    "email": "jane.student@akkuea.com",
    "password": "securepassword123"
}'
response=$(make_request "POST" "/auth/login" "$student_login" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Student Login" "200" "$status" "$body"

# Update student token from login
student_token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test 11: Invalid Login - Wrong Password
echo -e "${BLUE}🔍 Test 11: Invalid Login (Wrong Password)${NC}"
wrong_password_login='{
    "email": "john.educator@akkuea.com",
    "password": "wrongpassword"
}'
response=$(make_request "POST" "/auth/login" "$wrong_password_login" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Wrong Password Login" "401" "$status" "$body"

# Test 12: Invalid Login - Non-existent User
echo -e "${BLUE}🔍 Test 12: Invalid Login (Non-existent User)${NC}"
nonexistent_login='{
    "email": "nonexistent@akkuea.com",
    "password": "password123"
}'
response=$(make_request "POST" "/auth/login" "$nonexistent_login" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Non-existent User Login" "401" "$status" "$body"

# Test 13: Protected Route Access - With Valid Token
echo -e "${BLUE}🔍 Test 13: Protected Route Access (Valid Token)${NC}"
response=$(make_request "GET" "/protected" "" "Authorization: Bearer $educator_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Protected Route with Valid Token" "200" "$status" "$body"

# Test 14: Protected Route Access - Without Token
echo -e "${BLUE}🔍 Test 14: Protected Route Access (No Token)${NC}"
response=$(make_request "GET" "/protected" "" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Protected Route without Token" "401" "$status" "$body"

# Test 15: Protected Route Access - Invalid Token
echo -e "${BLUE}🔍 Test 15: Protected Route Access (Invalid Token)${NC}"
response=$(make_request "GET" "/protected" "" "Authorization: Bearer invalid.token.here")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Protected Route with Invalid Token" "401" "$status" "$body"

# Test 16: Get Current User - Educator
echo -e "${BLUE}🔍 Test 16: Get Current User (Educator)${NC}"
response=$(make_request "GET" "/auth/me" "" "Authorization: Bearer $educator_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Get Current User (Educator)" "200" "$status" "$body"

# Test 17: Get Current User - Student
echo -e "${BLUE}🔍 Test 17: Get Current User (Student)${NC}"
response=$(make_request "GET" "/auth/me" "" "Authorization: Bearer $student_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Get Current User (Student)" "200" "$status" "$body"

# Test 18: Get Current User - Without Token
echo -e "${BLUE}🔍 Test 18: Get Current User (No Token)${NC}"
response=$(make_request "GET" "/auth/me" "" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Get Current User without Token" "401" "$status" "$body"

# Test 19: Role-based Access Test (Educator accessing protected)
echo -e "${BLUE}🔍 Test 19: Role-based Access (Educator)${NC}"
response=$(make_request "GET" "/protected" "" "Authorization: Bearer $educator_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Educator Role Access" "200" "$status" "$body"

# Test 20: Role-based Access Test (Student accessing protected)
echo -e "${BLUE}🔍 Test 20: Role-based Access (Student)${NC}"
response=$(make_request "GET" "/protected" "" "Authorization: Bearer $student_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Student Role Access" "200" "$status" "$body"

# Test 21: Role-based Access Test (Designer accessing protected)
echo -e "${BLUE}🔍 Test 21: Role-based Access (Designer)${NC}"
response=$(make_request "GET" "/protected" "" "Authorization: Bearer $designer_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Designer Role Access" "200" "$status" "$body"

# Test 22: Edge Case - Empty JSON
echo -e "${BLUE}🔍 Test 22: Edge Case (Empty JSON)${NC}"
response=$(make_request "POST" "/auth/register" "{}" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Empty JSON Registration" "400" "$status" "$body"

# Test 23: Edge Case - Invalid JSON
echo -e "${BLUE}🔍 Test 23: Edge Case (Invalid JSON)${NC}"
response=$(make_request "POST" "/auth/register" "invalid json" "")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Invalid JSON Registration" "400" "$status" "$body"

# Test 24: Edge Case - Token without Bearer prefix
echo -e "${BLUE}🔍 Test 24: Edge Case (Token without Bearer)${NC}"
response=$(make_request "GET" "/protected" "" "Authorization: $educator_token")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)
print_test_result "Token without Bearer prefix" "401" "$status" "$body"

# Finish test results JSON
echo '    ]' >> $TEST_RESULTS_FILE
echo '  }' >> $TEST_RESULTS_FILE
echo '}' >> $TEST_RESULTS_FILE

echo ""
echo -e "${GREEN}🎉 All tests completed!${NC}"
echo -e "${YELLOW}📄 Test results saved to: $TEST_RESULTS_FILE${NC}"
echo ""
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "- Total tests executed: 24"
echo "- Server URL: $SERVER_URL"
echo "- Test timestamp: $(date)"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "1. Review the test results file"
echo "2. Check server logs for any errors"
echo "3. Run the Go test suite: 'go test ./tests/...'"
echo "4. Commit test results to Git repository"
echo ""

# Display tokens for manual testing
echo -e "${BLUE}🔑 Generated Tokens for Manual Testing:${NC}"
echo "Educator Token: $educator_token"
echo "Student Token: $student_token"
echo "Designer Token: $designer_token"
echo ""
echo -e "${YELLOW}📝 Use these tokens to test protected endpoints manually:${NC}"
echo "curl -H \"Authorization: Bearer \$educator_token\" $SERVER_URL/protected"
echo ""
