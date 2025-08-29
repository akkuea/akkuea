package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"gin/api"
	"gin/config"
	"gin/middleware"

	"github.com/gin-gonic/gin"
)

func TestMain(m *testing.M) {
	// Set test environment variables
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_USER", "postgres")
	os.Setenv("DB_PASSWORD", "secret")
	os.Setenv("DB_NAME", "akkuea_test")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("JWT_SECRET", "test-jwt-secret-key")
	os.Setenv("PORT", "8080")

	// Set gin to test mode
	gin.SetMode(gin.TestMode)

	// Run tests
	code := m.Run()
	os.Exit(code)
}

func setupTestRouter() *gin.Engine {
	router := gin.New()

	// Public authentication endpoints
	router.POST("/auth/register", api.RegisterUser)
	router.POST("/auth/login", api.LoginUser)

	// Protected routes group
	protected := router.Group("/")
	protected.Use(middleware.JWTAuthMiddleware())
	{
		protected.GET("/auth/me", api.GetCurrentUser)
		protected.GET("/protected", func(c *gin.Context) {
			userRole, exists := c.Get("user_role")
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
				return
			}

			userEmail, _ := c.Get("user_email")
			userID, _ := c.Get("user_id")

			c.JSON(http.StatusOK, gin.H{
				"message":   "Access granted to protected route",
				"user_id":   userID,
				"email":     userEmail,
				"role":      userRole,
				"timestamp": 1756477866,
				"server":    "Akkuea Auth Test Server",
			})
		})
	}

	return router
}

func TestRegisterUser_Valid(t *testing.T) {
	// Skip if database is not available
	if !isDatabaseAvailable() {
		t.Skip("Database not available, skipping test")
	}

	router := setupTestRouter()

	// Test valid educator registration
	userData := map[string]interface{}{
		"name":     "John Educator",
		"email":    "john.educator@test.com",
		"password": "password123",
		"role":     "Educator",
	}

	jsonBody, _ := json.Marshal(userData)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, w.Code)
	}

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if response["message"] != "User registered successfully" {
		t.Errorf("Expected success message, got %v", response["message"])
	}

	// Check if response contains required fields
	if _, exists := response["data"]; !exists {
		t.Error("Response should contain 'data' field")
	}
}

func TestRegisterUser_DuplicateEmail(t *testing.T) {
	// Skip if database is not available
	if !isDatabaseAvailable() {
		t.Skip("Database not available, skipping test")
	}

	router := setupTestRouter()

	// First registration
	userData := map[string]interface{}{
		"name":     "First User",
		"email":    "duplicate@test.com",
		"password": "password123",
		"role":     "Student",
	}

	jsonBody, _ := json.Marshal(userData)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Second registration with same email
	userData["name"] = "Second User"
	jsonBody, _ = json.Marshal(userData)
	req = httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d for duplicate email, got %d", http.StatusBadRequest, w.Code)
	}

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if response["error"] != "registration_failed" {
		t.Errorf("Expected registration_failed error, got %v", response["error"])
	}
}

func TestRegisterUser_InvalidRole(t *testing.T) {
	router := setupTestRouter()

	userData := map[string]interface{}{
		"name":     "Invalid Role User",
		"email":    "invalid@test.com",
		"password": "password123",
		"role":     "Administrator", // Invalid role
	}

	jsonBody, _ := json.Marshal(userData)
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d for invalid role, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestProtectedRoute_WithoutToken(t *testing.T) {
	router := setupTestRouter()

	req := httptest.NewRequest("GET", "/protected", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d without token, got %d", http.StatusUnauthorized, w.Code)
	}

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if response["error"] != "Authorization header is required" {
		t.Errorf("Expected authorization error, got %v", response["error"])
	}
}

// Helper function to check if database is available
func isDatabaseAvailable() bool {
	// Try to initialize database connection
	defer func() {
		if r := recover(); r != nil {
			// Database connection failed
		}
	}()

	config.InitDB()
	db := config.GetDB()
	if db == nil {
		return false
	}

	// Test a simple query
	var count int64
	result := db.Raw("SELECT 1").Scan(&count)
	return result.Error == nil
}
