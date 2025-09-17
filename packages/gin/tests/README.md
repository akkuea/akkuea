# Akkuea Authentication Testing Suite

This directory contains comprehensive tests for the Akkuea backend authentication system, implementing all requirements from issue #165.

## 📋 Test Coverage

### Authentication Endpoints Tested

- ✅ `POST /auth/register` - User registration with validation
- ✅ `POST /auth/login` - User authentication
- ✅ `GET /protected` - Protected route access verification
- ✅ `GET /auth/me` - Current user information
- ✅ Role-based access control (Educator, Student, Designer)

### Test Scenarios Covered

- ✅ Valid user registration for all roles (Educator, Student, Designer)
- ✅ Invalid registration scenarios (duplicate email, invalid role, missing fields, short password)
- ✅ Valid login with correct credentials
- ✅ Invalid login scenarios (wrong password, non-existent user, invalid format)
- ✅ Protected route access with valid JWT token
- ✅ Protected route rejection without token
- ✅ Protected route rejection with invalid token
- ✅ JWT token validation and claims extraction
- ✅ Role-based access verification
- ✅ Edge cases (empty JSON, malformed requests, token format variations)

## 🧪 Test Suites

### 1. Automated Go Test Suite

**File:** `auth_test.go`

- Comprehensive unit and integration tests
- Uses testify framework for assertions
- Tests all endpoints with various scenarios
- Includes role-based access control testing

**Run the tests:**

```bash
cd packages/gin
go test ./tests/... -v
```

### 2. Manual cURL Test Scripts

**File:** `manual_test_scripts.sh`

- 24 comprehensive test cases
- Automated cURL-based testing
- Generates test results in JSON format
- Tests edge cases and error scenarios

**Run the manual tests:**

```bash
cd packages/gin
# Start the server first
go run main.go

# In another terminal
./tests/manual_test_scripts.sh
```

### 3. Postman Collection

**File:** `Akkuea_Auth_Tests.postman_collection.json`

- Ready-to-import Postman collection
- Automated test assertions
- Collection-level variables for token management
- Pre-request and post-request scripts

**Import and run:**

1. Open Postman
2. Import `Akkuea_Auth_Tests.postman_collection.json`
3. Set environment variable `base_url` to `http://localhost:8080`
4. Run the collection

## 🚀 Quick Start

### Prerequisites

- Go 1.24.2 or later
- PostgreSQL database running
- Environment variables configured (see `.env.example`)

### Setup

1. **Database Setup:**

   ```bash
   # Create test database
   createdb akkuea_test
   ```

2. **Environment Configuration:**

   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

3. **Install Dependencies:**
   ```bash
   go mod tidy
   ```

### Running Tests

#### Option 1: Go Test Suite (Recommended)

```bash
cd packages/gin
go test ./tests/... -v -count=1
```

#### Option 2: Manual cURL Scripts

```bash
# Terminal 1: Start server
cd packages/gin
go run main.go

# Terminal 2: Run tests
./tests/manual_test_scripts.sh
```

#### Option 3: Postman Collection

1. Start the server: `go run main.go`
2. Import the Postman collection
3. Run the collection with Postman Runner

## 📊 Test Results Format

### Go Test Output

```
=== RUN   TestAuthTestSuite
=== RUN   TestAuthTestSuite/TestRegisterUser_ValidCases
=== RUN   TestAuthTestSuite/TestRegisterUser_ValidCases/Valid_Educator_Registration
--- PASS: TestAuthTestSuite/TestRegisterUser_ValidCases/Valid_Educator_Registration (0.xx)
...
--- PASS: TestAuthTestSuite (x.xx)
PASS
```

### cURL Script Output

- Colored terminal output with pass/fail indicators
- JSON test results file with timestamp
- Individual test status and response validation
- Token extraction for subsequent requests

### Postman Collection Results

- Visual test results in Postman interface
- Automated assertions with detailed feedback
- Collection-level test summary
- Export capability for CI/CD integration

## 🔧 Configuration

### Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=secret
DB_NAME=akkuea_test
DB_PORT=5432

# JWT Configuration
JWT_SECRET=test-jwt-secret-key
JWT_EXPIRATION=24h

# Server Configuration
PORT=8080
LOG_LEVEL=info
```

### Test Data

The tests use the following user accounts:

- **Educator:** john.educator@akkuea.com / securepassword123
- **Student:** jane.student@akkuea.com / securepassword123
- **Designer:** bob.designer@akkuea.com / securepassword123

## 🛡️ Security Test Coverage

### Authentication Security

- ✅ Password hashing verification
- ✅ JWT token generation and validation
- ✅ Token expiration handling
- ✅ Authorization header validation
- ✅ Bearer token format enforcement

### Input Validation

- ✅ Email format validation
- ✅ Password strength requirements (minimum 6 characters)
- ✅ Required field validation
- ✅ Role validation against allowed values
- ✅ Duplicate email prevention

### Authorization

- ✅ Protected route access control
- ✅ JWT middleware functionality
- ✅ Role-based access verification
- ✅ Token claims extraction and validation

## 📁 File Structure

```
tests/
├── README.md                              # This documentation
├── auth_test.go                           # Go test suite
├── manual_test_scripts.sh                 # cURL test scripts
└── Akkuea_Auth_Tests.postman_collection.json  # Postman collection
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**

   ```
   Solution: Ensure PostgreSQL is running and credentials are correct
   Check: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env
   ```

2. **Tests Failing - User Already Exists**

   ```
   Solution: Clean the test database before running tests
   Command: psql -d akkuea_test -c "DELETE FROM users;"
   ```

3. **JWT Secret Not Found**

   ```
   Solution: Set JWT_SECRET environment variable
   Default: Uses fallback "your-secret-key-here"
   ```

4. **Port Already in Use**
   ```
   Solution: Change PORT in .env or stop existing server
   Check: lsof -i :8080
   ```

### Debug Mode

Enable detailed logging by setting:

```bash
export LOG_LEVEL=debug
```

## 📈 Performance Benchmarks

The test suite includes response time validation:

- **Registration:** < 2000ms
- **Login:** < 1000ms
- **Protected Routes:** < 500ms
- **Token Validation:** < 100ms

## 🤝 Contributing

When adding new authentication features:

1. Add corresponding tests to `auth_test.go`
2. Update manual test scripts if needed
3. Add Postman collection requests
4. Update this README with new test scenarios
5. Ensure all tests pass before committing

## 📋 Compliance

This test suite satisfies all requirements from issue #165:

- ✅ Tests POST /auth/register with valid and invalid inputs
- ✅ Tests POST /auth/login with correct and incorrect credentials
- ✅ Creates temporary protected route (GET /protected) with authentication middleware
- ✅ Verifies role-based access with users of different roles
- ✅ Documents test results and commits to Git repository
- ✅ Uses variety of test scenarios including edge cases
- ✅ Provides reproducible test cases and documentation

## 🔗 References

- [Gin Testing Documentation](https://gin-gonic.com/docs/testing/)
- [Testify Framework](https://github.com/stretchr/testify)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [Postman API Testing](https://learning.postman.com/docs/writing-scripts/test-scripts/)
- [cURL Documentation](https://curl.se/docs/manpage.html)
