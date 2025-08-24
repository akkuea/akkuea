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

		// Current user endpoint
		protected.GET("/auth/me", api.GetCurrentUser)
	}

	// Get port from config (env), default to 8080
	port := config.GetPort()
	log.Printf("Starting server on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("could not start server: %v", err)
	}
}
