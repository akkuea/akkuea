package api

import (
	"net/http"
	"strconv"

	"gin/common"
	"gin/config"
	"gin/middleware"
	"gin/models"

	"github.com/gin-gonic/gin"
)

// ResourceCreateRequest defines the expected payload for creating a resource
type ResourceCreateRequest struct {
	Title    string `json:"title" binding:"required,min=1,max=200"`
	Content  string `json:"content" binding:"required,min=1"`
	Language string `json:"language" binding:"required,min=2,max=10"`
	Format   string `json:"format" binding:"required,min=2,max=50"`
	Theme    string `json:"theme"`
	Level    string `json:"level"`
}

// CreateResource handles educator-only creation of resources
func CreateResource(c *gin.Context) {
	// Role check: only Educator can create resources
	role, ok := middleware.GetUserRoleFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}
	if role != "Educator" {
		common.JSONError(c, http.StatusForbidden, "forbidden", "Only Educators can create resources")
		return
	}

	var req ResourceCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource data provided")
		return
	}

	// Get authenticated user id
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User ID not found in context")
		return
	}

	db := config.GetDB()

	resource := models.Resource{
		Title:     req.Title,
		Content:   req.Content,
		Language:  req.Language,
		Format:    req.Format,
		Theme:     req.Theme,
		Level:     req.Level,
		Status:    "Pending",
		CreatorID: userID,
	}

	if err := db.Create(&resource).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to create resource in database")
		return
	}

	common.JSONSuccess(c, http.StatusCreated, resource, "Resource created successfully")
}

// ListResources returns all resources
func ListResources(c *gin.Context) {
	db := config.GetDB()

	var resources []models.Resource
	// Optional status filter
	status := c.Query("status")
	q := db.Preload("Creator")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Find(&resources).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to fetch resources")
		return
	}

	common.JSONSuccess(c, http.StatusOK, resources, "Resources retrieved successfully")
}

// GetResourceByID retrieves a single resource by its ID
func GetResourceByID(c *gin.Context) {
	// Parse resource ID from path
	idParam := c.Param("id")
	if idParam == "" {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Resource ID is required")
		return
	}

	rid, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource ID")
		return
	}

	db := config.GetDB()

	var resource models.Resource
	// Preload Creator relationship to include creator details
	if err := db.Preload("Creator").First(&resource, rid).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "not_found", "Resource not found")
		return
	}

	common.JSONSuccess(c, http.StatusOK, resource, "Resource retrieved successfully")
}

// ResourceUpdateRequest defines fields allowed for resource updates (all optional)
type ResourceUpdateRequest struct {
	Title    *string `json:"title"`
	Content  *string `json:"content"`
	Language *string `json:"language"`
	Format   *string `json:"format"`
	Theme    *string `json:"theme"`
	Level    *string `json:"level"`
}

func DeleteResource(c *gin.Context) {
	role, ok := middleware.GetUserRoleFromContext(c)

	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authorized")
		return
	}

	if role != "Educator" {
		common.JSONError(c, http.StatusForbidden, "forbidden", "Only Educators can update resources")
		return
	}

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User ID not found in context")
		return
	}

	idParam := c.Param("id")

	if idParam == "" {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Resource ID is required")
		return
	}

	rid, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource ID")
		return
	}

	db := config.GetDB()

	var resource models.Resource

	if err := db.First(&resource, rid).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "not_found", "Resource not found")
		return
	}

	if resource.CreatorID != userID {
		common.JSONError(c, http.StatusForbidden, "forbidden", "You are not the creator of this resource")
		return
	}

	if err := db.Delete(&resource).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to delete resource in database")
		return
	}

	common.JSONSuccess(c, http.StatusNoContent, resource, "Resource deleted successfully")
}

// UpdateResource handles educator-only updates to an existing resource they created
func UpdateResource(c *gin.Context) {
	// Role check: only Educator can update resources
	role, ok := middleware.GetUserRoleFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}
	if role != "Educator" {
		common.JSONError(c, http.StatusForbidden, "forbidden", "Only Educators can update resources")
		return
	}

	// Get authenticated user id
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User ID not found in context")
		return
	}

	// Parse resource ID from path
	idParam := c.Param("id")
	if idParam == "" {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Resource ID is required")
		return
	}
	rid, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource ID")
		return
	}

	db := config.GetDB()

	var resource models.Resource
	if err := db.First(&resource, rid).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "not_found", "Resource not found")
		return
	}

	// Ensure only the creator can update their resource
	if resource.CreatorID != userID {
		common.JSONError(c, http.StatusForbidden, "forbidden", "You are not the creator of this resource")
		return
	}

	var req ResourceUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource data provided")
		return
	}

	if req.Title != nil {
		resource.Title = *req.Title
	}
	if req.Content != nil {
		resource.Content = *req.Content
	}
	if req.Language != nil {
		resource.Language = *req.Language
	}
	if req.Format != nil {
		resource.Format = *req.Format
	}
	if req.Theme != nil {
		resource.Theme = *req.Theme
	}
	if req.Level != nil {
		resource.Level = *req.Level
	}

	if err := db.Save(&resource).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to update resource in database")
		return
	}

	common.JSONSuccess(c, http.StatusOK, resource, "Resource updated successfully")
}
