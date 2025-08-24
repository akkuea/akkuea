package api

import (
	"net/http"

	"gin/services"

	"github.com/gin-gonic/gin"
)

// RegisterUser handles user registration
func RegisterUser(c *gin.Context) {
	var req services.RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_input",
			Message: "Invalid registration data provided",
		})
		return
	}

	authService := services.NewAuthService()
	response, err := authService.RegisterUser(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "registration_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    response,
		"message": "User registered successfully",
	})
}

// LoginUser handles user login
func LoginUser(c *gin.Context) {
	var req services.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_input",
			Message: "Invalid login data provided",
		})
		return
	}

	authService := services.NewAuthService()
	response, err := authService.LoginUser(req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "login_failed",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    response,
		"message": "Login successful",
	})
}

// GetCurrentUser returns the current authenticated user's information
func GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
		})
		return
	}

	authService := services.NewAuthService()
	user, err := authService.GetUserByID(userID.(uint))
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "user_not_found",
			Message: "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    user,
		"message": "User information retrieved successfully",
	})
}
