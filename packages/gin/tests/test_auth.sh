#!/bin/bash

# Simple cURL tests for authentication endpoints
# Task #165: Test Authentication Endpoints [Golang]

BASE_URL="http://localhost:8080"

echo "🧪 Testing Authentication Endpoints"
echo "=================================="

# Test 1: Register a user with valid data
echo "1. Testing POST /auth/register with valid data..."
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "Student"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 2: Register with invalid data (missing fields)
echo "2. Testing POST /auth/register with invalid data..."
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 3: Login with correct credentials
echo "3. Testing POST /auth/login with correct credentials..."
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 4: Login with incorrect credentials
echo "4. Testing POST /auth/login with incorrect credentials..."
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 5: Access protected route without token
echo "5. Testing GET /protected without token..."
curl -X GET "$BASE_URL/protected" \
  -w "\nStatus: %{http_code}\n\n"

# Test 6: Access protected route with invalid token
echo "6. Testing GET /protected with invalid token..."
curl -X GET "$BASE_URL/protected" \
  -H "Authorization: Bearer invalid-token" \
  -w "\nStatus: %{http_code}\n\n"

echo "✅ Manual testing complete!"
echo "Note: To test with valid token, first run the login test and copy the token from the response."
