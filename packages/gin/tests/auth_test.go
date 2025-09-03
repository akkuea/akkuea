package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"gin/api"
	"gin/config"
	"gin/middleware"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"
)

// AuthTestSuite defines the test suite for authentication endpoints
type AuthTestSuite struct {
	suite.Suite
	router *gin.Engine
	db     *gorm.DB
}

// SetupSuite runs before all tests in the suite
func (suite *AuthTestSuite) SetupSuite() {
	// Set test environment variables
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_USER", "postgres")
	os.Setenv("DB_PASSWORD", "secret")
	os.Setenv("DB_NAME", "akkuea_test")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("JWT_SECRET", "test-jwt-secret-key")
	os.Setenv("PORT", "8080")

	// Initialize test database
	config.InitDB()
	suite.db = config.GetDB()

	// Set gin to test mode
	gin.SetMode(gin.TestMode)

	// Setup router
	suite.router = gin.New()
	suite.setupRoutes()
}

// TearDownSuite runs after all tests in the suite
func (suite *AuthTestSuite) TearDownSuite() {
	config.CloseDB()
}

// SetupTest runs before each test
func (suite *AuthTestSuite) SetupTest() {
	// Clean up the database before each test
	suite.db.Exec("DELETE FROM users")
}

// setupRoutes configures the test router with all authentication routes
func (suite *AuthTestSuite) setupRoutes() {
	// Public authentication endpoints
	suite.router.POST("/auth/register", api.RegisterUser)
	suite.router.POST("/auth/login", api.LoginUser)

	// Protected routes group
	protected := suite.router.Group("/")
	protected.Use(middleware.JWTAuthMiddleware())
	{
		protected.GET("/auth/me", api.GetCurrentUser)
		protected.GET("/users", api.GetAllUsers)
		protected.GET("/users/:id", api.GetUserByID)
		protected.POST("/users", api.CreateUser)

		// Temporary protected route for testing
		protected.GET("/protected", func(c *gin.Context) {
			userRole, exists := c.Get("user_role")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"message":   "Access granted to protected route",
				"role":      userRole,
				"timestamp": time.Now().Unix(),
			})
		})

		// Role-specific protected routes
		protected.GET("/educator-only", suite.roleProtectedHandler("Educator"))
		protected.GET("/student-only", suite.roleProtectedHandler("Student"))
		protected.GET("/designer-only", suite.roleProtectedHandler("Designer"))
	}
}

// roleProtectedHandler creates a handler that only allows specific roles
func (suite *AuthTestSuite) roleProtectedHandler(allowedRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
			return
		}

		if userRole.(string) != allowedRole {
			c.JSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Access denied. Required role: %s, your role: %s", allowedRole, userRole),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("Welcome to %s-only area", allowedRole),
			"role":    userRole,
		})
	}
}

// Test User Registration - Valid Cases
func (suite *AuthTestSuite) TestRegisterUser_ValidCases() {
	testCases := []struct {
		name string
		user map[string]interface{}
	}{
		{
			name: "Valid Educator Registration",
			user: map[string]interface{}{
				"name":     "John Educator",
				"email":    "john.educator@test.com",
				"password": "password123",
				"role":     "Educator",
			},
		},
		{
			name: "Valid Student Registration",
			user: map[string]interface{}{
				"name":     "Jane Student",
				"email":    "jane.student@test.com",
				"password": "password123",
				"role":     "Student",
			},
		},
		{
			name: "Valid Designer Registration",
			user: map[string]interface{}{
				"name":     "Bob Designer",
				"email":    "bob.designer@test.com",
				"password": "password123",
				"role":     "Designer",
			},
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			// Create request body
			jsonBody, _ := json.Marshal(tc.user)
			req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			// Create response recorder
			w := httptest.NewRecorder()

			// Perform request
			suite.router.ServeHTTP(w, req)

			// Assertions
			assert.Equal(suite.T(), http.StatusCreated, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(suite.T(), err)

			assert.Equal(suite.T(), "User registered successfully", response["message"])
			assert.Contains(suite.T(), response, "data")

			// Verify token is returned
			data := response["data"].(map[string]interface{})
			assert.Contains(suite.T(), data, "token")
			assert.Contains(suite.T(), data, "user")

			// Verify user data
			user := data["user"].(map[string]interface{})
			assert.Equal(suite.T(), tc.user["name"], user["name"])
			assert.Equal(suite.T(), tc.user["email"], user["email"])
			assert.Equal(suite.T(), tc.user["role"], user["role"])
			assert.NotContains(suite.T(), user, "password") // Password should not be returned
		})
	}
}

// Test User Registration - Invalid Cases
func (suite *AuthTestSuite) TestRegisterUser_InvalidCases() {
	testCases := []struct {
		name           string
		user           map[string]interface{}
		expectedStatus int
		errorCheck     string
	}{
		{
			name: "Missing Name",
			user: map[string]interface{}{
				"email":    "test@test.com",
				"password": "password123",
				"role":     "Student",
			},
			expectedStatus: http.StatusBadRequest,
			errorCheck:     "invalid_input",
		},
		{
			name: "Missing Email",
			user: map[string]interface{}{
				"name":     "Test User",
				"password": "password123",
				"role":     "Student",
			},
			expectedStatus: http.StatusBadRequest,
			errorCheck:     "invalid_input",
		},
		{
			name: "Invalid Email Format",
			user: map[string]interface{}{
				"name":     "Test User",
				"email":    "invalid-email",
				"password": "password123",
				"role":     "Student",
			},
			expectedStatus: http.StatusBadRequest,
			errorCheck:     "invalid_input",
		},
		{
			name: "Password Too Short",
			user: map[string]interface{}{
				"name":     "Test User",
				"email":    "test@test.com",
				"password": "123",
				"role":     "Student",
			},
			expectedStatus: http.StatusBadRequest,
			errorCheck:     "invalid_input",
		},
		{
			name: "Invalid Role",
			user: map[string]interface{}{
				"name":     "Test User",
				"email":    "test@test.com",
				"password": "password123",
				"role":     "InvalidRole",
			},
			expectedStatus: http.StatusBadRequest,
			errorCheck:     "registration_failed",
		},
		{
			name: "Missing Role",
			user: map[string]interface{}{
				"name":     "Test User",
				"email":    "test@test.com",
				"password": "password123",
			},
			expectedStatus: http.StatusBadRequest,
			errorCheck:     "invalid_input",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			jsonBody, _ := json.Marshal(tc.user)
			req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			suite.router.ServeHTTP(w, req)

			assert.Equal(suite.T(), tc.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(suite.T(), err)

			assert.Contains(suite.T(), response, "error")
			assert.Equal(suite.T(), tc.errorCheck, response["error"])
		})
	}
}

// Test Duplicate Email Registration
func (suite *AuthTestSuite) TestRegisterUser_DuplicateEmail() {
	// First registration
	user := map[string]interface{}{
		"name":     "First User",
		"email":    "duplicate@test.com",
		"password": "password123",
		"role":     "Student",
	}

	jsonBody, _ := json.Marshal(user)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	// Second registration with same email
	user["name"] = "Second User"
	jsonBody, _ = json.Marshal(user)
	req = httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)

	assert.Equal(suite.T(), "registration_failed", response["error"])
	assert.Contains(suite.T(), response["message"], "already exists")
}

// Test User Login - Valid Cases
func (suite *AuthTestSuite) TestLoginUser_ValidCredentials() {
	// First register a user
	user := map[string]interface{}{
		"name":     "Login Test User",
		"email":    "login@test.com",
		"password": "password123",
		"role":     "Student",
	}

	jsonBody, _ := json.Marshal(user)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	// Now test login
	loginData := map[string]interface{}{
		"email":    "login@test.com",
		"password": "password123",
	}

	jsonBody, _ = json.Marshal(loginData)
	req = httptest.NewRequest("POST", "/auth/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)

	assert.Equal(suite.T(), "Login successful", response["message"])
	assert.Contains(suite.T(), response, "data")

	data := response["data"].(map[string]interface{})
	assert.Contains(suite.T(), data, "token")
	assert.Contains(suite.T(), data, "user")

	// Verify token is valid JWT format (basic check)
	token := data["token"].(string)
	assert.NotEmpty(suite.T(), token)
	assert.Contains(suite.T(), token, ".")
}

// Test User Login - Invalid Cases
func (suite *AuthTestSuite) TestLoginUser_InvalidCredentials() {
	// Register a user first
	user := map[string]interface{}{
		"name":     "Login Test User",
		"email":    "logintest@test.com",
		"password": "password123",
		"role":     "Student",
	}

	jsonBody, _ := json.Marshal(user)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	testCases := []struct {
		name      string
		loginData map[string]interface{}
	}{
		{
			name: "Wrong Password",
			loginData: map[string]interface{}{
				"email":    "logintest@test.com",
				"password": "wrongpassword",
			},
		},
		{
			name: "Wrong Email",
			loginData: map[string]interface{}{
				"email":    "wrong@test.com",
				"password": "password123",
			},
		},
		{
			name: "Missing Email",
			loginData: map[string]interface{}{
				"password": "password123",
			},
		},
		{
			name: "Missing Password",
			loginData: map[string]interface{}{
				"email": "logintest@test.com",
			},
		},
		{
			name: "Invalid Email Format",
			loginData: map[string]interface{}{
				"email":    "invalid-email",
				"password": "password123",
			},
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			jsonBody, _ := json.Marshal(tc.loginData)
			req := httptest.NewRequest("POST", "/auth/login", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			suite.router.ServeHTTP(w, req)

			if tc.name == "Missing Email" || tc.name == "Missing Password" || tc.name == "Invalid Email Format" {
				assert.Equal(suite.T(), http.StatusBadRequest, w.Code)
			} else {
				assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
			}

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(suite.T(), err)
			assert.Contains(suite.T(), response, "error")
		})
	}
}

// Test Protected Route Access
func (suite *AuthTestSuite) TestProtectedRoute_WithValidToken() {
	// Register and login to get a token
	token := suite.registerAndLogin("Protected User", "protected@test.com", "password123", "Educator")

	// Test protected route access
	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)

	assert.Equal(suite.T(), "Access granted to protected route", response["message"])
	assert.Equal(suite.T(), "Educator", response["role"])
	assert.Contains(suite.T(), response, "timestamp")
}

// Test Protected Route Access Without Token
func (suite *AuthTestSuite) TestProtectedRoute_WithoutToken() {
	req := httptest.NewRequest("GET", "/protected", nil)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)

	assert.Contains(suite.T(), response, "error")
	assert.Equal(suite.T(), "Authorization header is required", response["error"])
}

// Test Protected Route Access With Invalid Token
func (suite *AuthTestSuite) TestProtectedRoute_WithInvalidToken() {
	testCases := []struct {
		name   string
		header string
	}{
		{
			name:   "Invalid Token Format",
			header: "Bearer invalid.token.here",
		},
		{
			name:   "Missing Bearer Prefix",
			header: "invalid-token-without-bearer",
		},
		{
			name:   "Expired Token",
			header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjIsInVzZXJfaWQiOjEsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInJvbGUiOiJTdHVkZW50In0.expired",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			req := httptest.NewRequest("GET", "/protected", nil)
			req.Header.Set("Authorization", tc.header)

			w := httptest.NewRecorder()
			suite.router.ServeHTTP(w, req)

			assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(suite.T(), err)
			assert.Contains(suite.T(), response, "error")
		})
	}
}

// Test Role-Based Access Control
func (suite *AuthTestSuite) TestRoleBasedAccess() {
	// Create users with different roles
	educatorToken := suite.registerAndLogin("Educator User", "educator@test.com", "password123", "Educator")
	studentToken := suite.registerAndLogin("Student User", "student@test.com", "password123", "Student")
	designerToken := suite.registerAndLogin("Designer User", "designer@test.com", "password123", "Designer")

	testCases := []struct {
		name         string
		endpoint     string
		token        string
		expectedCode int
		allowedRole  string
	}{
		// Educator access tests
		{"Educator accessing educator-only", "/educator-only", educatorToken, http.StatusOK, "Educator"},
		{"Educator accessing student-only", "/student-only", educatorToken, http.StatusForbidden, "Student"},
		{"Educator accessing designer-only", "/designer-only", educatorToken, http.StatusForbidden, "Designer"},

		// Student access tests
		{"Student accessing educator-only", "/educator-only", studentToken, http.StatusForbidden, "Educator"},
		{"Student accessing student-only", "/student-only", studentToken, http.StatusOK, "Student"},
		{"Student accessing designer-only", "/designer-only", studentToken, http.StatusForbidden, "Designer"},

		// Designer access tests
		{"Designer accessing educator-only", "/educator-only", designerToken, http.StatusForbidden, "Educator"},
		{"Designer accessing student-only", "/student-only", designerToken, http.StatusForbidden, "Student"},
		{"Designer accessing designer-only", "/designer-only", designerToken, http.StatusOK, "Designer"},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			req := httptest.NewRequest("GET", tc.endpoint, nil)
			req.Header.Set("Authorization", "Bearer "+tc.token)

			w := httptest.NewRecorder()
			suite.router.ServeHTTP(w, req)

			assert.Equal(suite.T(), tc.expectedCode, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(suite.T(), err)

			if tc.expectedCode == http.StatusOK {
				assert.Contains(suite.T(), response["message"], tc.allowedRole+"-only area")
			} else {
				assert.Contains(suite.T(), response, "error")
				if tc.expectedCode == http.StatusForbidden {
					assert.Contains(suite.T(), response["error"], "Access denied")
				}
			}
		})
	}
}

// Test Current User Endpoint
func (suite *AuthTestSuite) TestGetCurrentUser() {
	token := suite.registerAndLogin("Current User", "current@test.com", "password123", "Student")

	req := httptest.NewRequest("GET", "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(suite.T(), err)

	assert.Equal(suite.T(), "User information retrieved successfully", response["message"])
	assert.Contains(suite.T(), response, "data")

	user := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), "Current User", user["name"])
	assert.Equal(suite.T(), "current@test.com", user["email"])
	assert.Equal(suite.T(), "Student", user["role"])
	assert.NotContains(suite.T(), user, "password")
}

// Helper function to register and login a user, returning the JWT token
func (suite *AuthTestSuite) registerAndLogin(name, email, password, role string) string {
	// Register user
	user := map[string]interface{}{
		"name":     name,
		"email":    email,
		"password": password,
		"role":     role,
	}

	jsonBody, _ := json.Marshal(user)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		suite.T().Fatalf("Failed to register user: %s", w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	data := response["data"].(map[string]interface{})
	return data["token"].(string)
}

// TestAuthTestSuite runs the complete test suite
func TestAuthTestSuite(t *testing.T) {
	suite.Run(t, new(AuthTestSuite))
}
