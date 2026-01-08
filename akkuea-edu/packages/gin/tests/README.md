# Authentication Endpoint Tests

This directory contains manual testing scripts for the authentication endpoints as requested in Task #165.

## Test Script

- `test_auth.sh` - Simple cURL script to test authentication endpoints

## Test Coverage

### ✅ POST /auth/register

- Valid registration with all required fields
- Invalid registration with missing fields

### ✅ POST /auth/login

- Valid login with correct credentials
- Invalid login with wrong credentials

### ✅ Protected Routes

- Access without token (401 Unauthorized)
- Access with invalid token (401 Unauthorized)

## Running Tests

1. Start the Go server:

   ```bash
   cd packages/gin
   go run main.go
   ```

2. Run the test script:
   ```bash
   ./tests/test_auth.sh
   ```

## Expected Results

- Registration with valid data: 201 Created
- Registration with invalid data: 400 Bad Request
- Login with correct credentials: 200 OK (returns JWT token)
- Login with incorrect credentials: 401 Unauthorized
- Protected route without token: 401 Unauthorized
- Protected route with invalid token: 401 Unauthorized

## Manual Testing with Valid Token

To test protected routes with a valid token:

1. Run the login test and copy the JWT token from the response
2. Use the token in Authorization header:
   ```bash
   curl -X GET "http://localhost:8080/protected" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
   ```

## Role-Based Access Testing

To test different roles, modify the registration data in the script:

- `"role": "Educator"`
- `"role": "Student"`
- `"role": "Designer"`

Each role should be able to access protected routes with a valid JWT token.
