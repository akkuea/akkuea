package api

import (
	"errors"
	"net/http"
	"strconv"

	"gin/common"
	"gin/config"
	"gin/middleware"
	"gin/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UpdateResourceInput struct {
	Title    *string `json:"title"`
	Content  *string `json:"content"`
	Language *string `json:"language"`
	Format   *string `json:"format"`
}

// UpdateResource handles updating an existing resource by its ID.
func UpdateResource(c *gin.Context) {
	db := config.GetDB()

	resourceIDParam := c.Param("id")
	if resourceIDParam == "" {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Resource ID is required")
		return
	}

	resourceID, err := strconv.ParseUint(resourceIDParam, 10, 64)
	if err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Resource ID must be a valid number")
		return
	}

	var input UpdateResourceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource data provided")
		return
	}

	updates := make(map[string]interface{})
	if input.Title != nil {
		updates["title"] = *input.Title
	}
	if input.Content != nil {
		updates["content"] = *input.Content
	}
	if input.Language != nil {
		updates["language"] = *input.Language
	}
	if input.Format != nil {
		updates["format"] = *input.Format
	}

	if len(updates) == 0 {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "At least one field must be provided for update")
		return
	}

	var resource models.Resource
	if err := db.First(&resource, resourceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.JSONError(c, http.StatusNotFound, "resource_not_found", "Resource not found")
			return
		}

		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to retrieve resource")
		return
	}

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	if resource.CreatorID != userID {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "You are not allowed to update this resource")
		return
	}

	if err := db.Model(&resource).Updates(updates).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to update resource")
		return
	}

	if err := db.First(&resource, resource.ID).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to retrieve updated resource")
		return
	}

	common.JSONSuccess(c, http.StatusOK, resource, "Resource updated successfully")
}
