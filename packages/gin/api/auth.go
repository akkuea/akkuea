package api

import (
	"net/http"

	"gin/common"
	"gin/services"

	"github.com/gin-gonic/gin"
)

// RegisterUser handles user registration
func RegisterUser(c *gin.Context) {
	var req services.RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid registration data provided")
		return
	}

	authService := services.NewAuthService()
	response, err := authService.RegisterUser(req)
	if err != nil {
		common.JSONError(c, http.StatusBadRequest, "registration_failed", err.Error())
		return
	}

	common.JSONSuccess(c, http.StatusCreated, response, "User registered successfully")
}

// LoginUser handles user login
func LoginUser(c *gin.Context) {
	var req services.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid login data provided")
		return
	}

	authService := services.NewAuthService()
	response, err := authService.LoginUser(req)
	if err != nil {
		common.JSONError(c, http.StatusUnauthorized, "login_failed", err.Error())
		return
	}

	common.JSONSuccess(c, http.StatusOK, response, "Login successful")
}

// GetCurrentUser returns the current authenticated user's information
func GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	authService := services.NewAuthService()
	user, err := authService.GetUserByID(userID.(uint))
	if err != nil {
		common.JSONError(c, http.StatusNotFound, "user_not_found", "User not found")
		return
	}

	common.JSONSuccess(c, http.StatusOK, user, "User information retrieved successfully")
}
