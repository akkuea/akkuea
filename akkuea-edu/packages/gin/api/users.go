package api

import (
	"net/http"

	"gin/common"
	"gin/config"
	"gin/models"

	"github.com/gin-gonic/gin"
)

func GetAllUsers(c *gin.Context) {
	db := config.GetDB()

	var users []models.User

	if err := db.Find(&users).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to retrieve users from database")
		return
	}

	common.JSONSuccess(c, http.StatusOK, gin.H{
		"data":  users,
		"count": len(users),
	}, "Users retrieved successfully")
}

// GetUserByID retrieves a specific user by ID (protected endpoint)
func GetUserByID(c *gin.Context) {
	db := config.GetDB()

	userID := c.Param("id")
	if userID == "" {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "User ID is required")
		return
	}

	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "user_not_found", "User not found")
		return
	}

	common.JSONSuccess(c, http.StatusOK, user, "User retrieved successfully")
}

func CreateUser(c *gin.Context) {
	db := config.GetDB()

	var user models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid user data provided")
		return
	}

	if err := db.Create(&user).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to create user in database")
		return
	}

	common.JSONSuccess(c, http.StatusCreated, user, "User created successfully")
}
