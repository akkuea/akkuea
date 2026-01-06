package main

import (
	"log"

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

		// Resource endpoints
		protected.POST("/resources", middleware.RequireRole("Educator"), api.CreateResource)
		protected.GET("/resources", api.ListResources)
		protected.GET("/resources/:id", api.GetResourceByID)
		protected.PUT("/resources/:id", middleware.RequireRole("Educator"), api.UpdateResource)

		// Current user endpoint
		protected.GET("/auth/me", api.GetCurrentUser)
		
		// Temporary protected route for testing (Task #165)
		protected.GET("/protected", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "Protected route accessed successfully",
				"user_id": c.GetString("user_id"),
				"role":    c.GetString("user_role"),
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