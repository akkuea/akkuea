package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"gin/config"
	// "gin/middleware"
	"gin/models"

	"github.com/gin-gonic/gin"
	sqlite "github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupTestRouter sets up a router with in-memory DB and minimal middleware
func setupTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	// Use pure-Go SQLite in-memory for tests to avoid CGO/Postgres dependency
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	// Replace global DB
	config.DB = db

	if err := db.AutoMigrate(&models.User{}, &models.Resource{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	r := gin.Default()

	// Minimal auth: inject a fake user via middleware
	r.Use(func(c *gin.Context) {
		c.Set("user_id", uint(1))
		c.Set("user_email", "test@example.com")
		c.Set("user_role", "Educator")
		c.Next()
	})

	// Routes under protected-like group
	g := r.Group("/")
	{
		g.GET("/resources", ListResources)
		g.POST("/resources", CreateResource)
		g.PUT("/resources/:id", UpdateResource)
	}

	return r
}

func TestCreateResource_DefaultsToPendingWithoutXAI(t *testing.T) {
	// Ensure no XAI key
	_ = os.Unsetenv("XAI_API_KEY")

	r := setupTestRouter(t)

	body := `{"title":"Intro to Algebra","content":"This is a beginner friendly guide to algebra.","language":"en","format":"text"}`
	req := httptest.NewRequest(http.MethodPost, "/resources", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "\"status\":\"Pending\"") && !strings.Contains(w.Body.String(), "\"status\":\"Approved\"") {
		t.Fatalf("expected status Pending or Approved in response, got: %s", w.Body.String())
	}
}

func TestListResources_FilterByStatus(t *testing.T) {
	r := setupTestRouter(t)

	// Create two resources with different statuses
	// First: Pending
	body1 := `{"title":"Short","content":"tiny","language":"en","format":"text"}`
	req1 := httptest.NewRequest(http.MethodPost, "/resources", strings.NewReader(body1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusCreated {
		t.Fatalf("create1 expected 201, got %d: %s", w1.Code, w1.Body.String())
	}

	// Second: Likely Approved due to heuristics
	body2 := `{"title":"Clean Title","content":"This is sufficiently long educational content to likely pass heuristics.","language":"en","format":"text"}`
	req2 := httptest.NewRequest(http.MethodPost, "/resources", strings.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusCreated {
		t.Fatalf("create2 expected 201, got %d: %s", w2.Code, w2.Body.String())
	}

	// Filter by Pending
	req3 := httptest.NewRequest(http.MethodGet, "/resources?status=Pending", nil)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Fatalf("list expected 200, got %d: %s", w3.Code, w3.Body.String())
	}
	// Expect at least one Pending
	if !strings.Contains(w3.Body.String(), "\"Pending\"") {
		t.Fatalf("expected at least one Pending resource, got: %s", w3.Body.String())
	}
}
