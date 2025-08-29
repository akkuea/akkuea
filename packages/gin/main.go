package main

import (
	"log"
	"net/http"
	"time"

	"gin/api"
	"gin/config"
	"gin/middleware"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env
	_ = godotenv.Load()

	// Initialize database connection
	config.InitDB()
	defer config.CloseDB()

	router := gin.Default()
	router.Use(middleware.Logger())

	// Health and status endpoints
	router.GET("/ping", api.PingHandler)
	router.GET("/health", api.HealthHandler)

	// Authentication endpoints (public)
	router.POST("/auth/register", api.RegisterUser)
	router.POST("/auth/login", api.LoginUser)

	// Protected routes group
	protected := router.Group("/")
	protected.Use(middleware.JWTAuthMiddleware())
	{
		// User endpoints (protected)
		protected.GET("/users", api.GetAllUsers)
		protected.GET("/users/:id", api.GetUserByID)
		protected.POST("/users", api.CreateUser)

		// Current user endpoint
		protected.GET("/auth/me", api.GetCurrentUser)

		// Temporary protected route for testing authentication
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
				"timestamp": time.Now().Unix(),
				"server":    "Akkuea Auth Test Server",
			})
		})
	}

	// Get port from config (env), default to 8080
	port := config.GetPort()
	log.Printf("Starting server on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("could not start server: %v", err)
	}
}
