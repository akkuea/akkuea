package api

import (
	"net/http"
	"strconv"
	"strings"

	"gin/common"
	"gin/config"
	"gin/middleware"
	"gin/models"
	"gin/services"

	"github.com/gin-gonic/gin"
)

type ResourceRequest struct {
    Title    string `json:"title" binding:"required"`
    Content  string `json:"content" binding:"required"`
    Theme    string `json:"theme"`
    Level    string `json:"level"`
    Language string `json:"language"`
    Format   string `json:"format"`
}

type ResourcesResponse struct {
	Data    []models.Resource `json:"data"`
	Count   int64             `json:"count"`
	Limit   int               `json:"limit"`
	Offset  int               `json:"offset"`
	Message string            `json:"message"`
}

// GET /resources?status=Approved|Pending|Rejected
func ListResources(c *gin.Context) {
    db := config.GetDB()

    // Validate allowed query params to catch invalid filters
    allowed := map[string]bool{
        "status":  true,
        "limit":   true,
        "offset":  true,
        "theme":   true,
        "level":   true,
        "language": true,
        "format":  true,
    }
    for key := range c.Request.URL.Query() {
        if !allowed[key] {
            common.JSONError(c, http.StatusBadRequest, "invalid_query_parameter", "Unsupported query parameter: "+key)
            return
        }
    }

    // Extract filters (case-insensitive)
    status := strings.TrimSpace(c.Query("status"))
    theme := strings.TrimSpace(c.Query("theme"))
    level := strings.TrimSpace(c.Query("level"))
    language := strings.TrimSpace(c.Query("language"))
    format := strings.TrimSpace(c.Query("format"))

    // Validate non-empty for named filters if provided
    if c.Query("theme") != "" && theme == "" {
        common.JSONError(c, http.StatusBadRequest, "invalid_filter", "theme cannot be empty")
        return
    }
    if c.Query("level") != "" && level == "" {
        common.JSONError(c, http.StatusBadRequest, "invalid_filter", "level cannot be empty")
        return
    }
    if c.Query("language") != "" && language == "" {
        common.JSONError(c, http.StatusBadRequest, "invalid_filter", "language cannot be empty")
        return
    }
    if c.Query("format") != "" && format == "" {
        common.JSONError(c, http.StatusBadRequest, "invalid_filter", "format cannot be empty")
        return
    }

    // pagination params
    limit := 50
    offset := 0
    if v := c.Query("limit"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
            limit = n
        } else {
            common.JSONError(c, http.StatusBadRequest, "invalid_pagination", "limit must be between 1 and 200")
            return
        }
    }
    if v := c.Query("offset"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n >= 0 {
            offset = n
        } else {
            common.JSONError(c, http.StatusBadRequest, "invalid_pagination", "offset must be 0 or greater")
            return
        }
    }

    var resources []models.Resource
    tx := db.Model(&models.Resource{})
    if status != "" {
        tx = tx.Where("status = ?", status)
    }
    if theme != "" {
        tx = tx.Where("LOWER(theme) = LOWER(?)", theme)
    }
    if level != "" {
        tx = tx.Where("LOWER(level) = LOWER(?)", level)
    }
    if language != "" {
        tx = tx.Where("LOWER(language) = LOWER(?)", language)
    }
    if format != "" {
        tx = tx.Where("LOWER(format) = LOWER(?)", format)
    }

    // total count
    var total int64
    if err := tx.Count(&total).Error; err != nil {
        common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to count resources")
        return
    }
    // page
    if err := tx.Order("created_at DESC").Limit(limit).Offset(offset).Find(&resources).Error; err != nil {
        common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to list resources")
        return
    }

    common.JSONSuccess(c, http.StatusOK, ResourcesResponse{
        Data:   resources,
        Count:  total,
        Limit:  limit,
        Offset: offset,
    }, "Resources retrieved successfully")
}

// GET /resources/:id
func GetResource(c *gin.Context) {
	db := config.GetDB()
	id := c.Param("id")
	var resource models.Resource
	if err := db.First(&resource, id).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "not_found", "Resource not found")
		return
	}
	common.JSONSuccess(c, http.StatusOK, resource, "Resource retrieved successfully")
}

// DELETE /resources/:id (only creator can delete)
func DeleteResource(c *gin.Context) {
	db := config.GetDB()
	id := c.Param("id")

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	var resource models.Resource
	if err := db.First(&resource, id).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "not_found", "Resource not found")
		return
	}
	if resource.CreatorID != userID {
		common.JSONError(c, http.StatusForbidden, "forbidden", "You cannot delete this resource")
		return
	}
	if err := db.Delete(&resource).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to delete resource")
		return
	}
	c.Status(http.StatusNoContent)
}

// POST /resources
func CreateResource(c *gin.Context) {
	db := config.GetDB()

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	var req ResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource payload")
		return
	}

	cur := services.NewCurationService()
	result := cur.CurateContent(req.Title, req.Content, req.Language, req.Format)

	resource := models.Resource{
		Title:     req.Title,
		Content:   req.Content,
		Language:  req.Language,
		Format:    req.Format,
		CreatorID: userID,
		Status:    string(result.Status),
	}

	if err := db.Create(&resource).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to create resource")
		return
	}

	common.JSONSuccess(c, http.StatusCreated, gin.H{"resource": resource, "curation": result}, "Resource created")
}

// PUT /resources/:id
func UpdateResource(c *gin.Context) {
	db := config.GetDB()

	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		common.JSONError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	id := c.Param("id")
	var resource models.Resource
	if err := db.First(&resource, id).Error; err != nil {
		common.JSONError(c, http.StatusNotFound, "not_found", "Resource not found")
		return
	}

	// Optional: only creator can update
	if resource.CreatorID != userID {
		common.JSONError(c, http.StatusForbidden, "forbidden", "You cannot update this resource")
		return
	}

	var req ResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.JSONError(c, http.StatusBadRequest, "invalid_input", "Invalid resource payload")
		return
	}

	cur := services.NewCurationService()
	result := cur.CurateContent(req.Title, req.Content, req.Language, req.Format)

	updates := map[string]interface{}{
		"title":    req.Title,
		"content":  req.Content,
		"language": req.Language,
		"format":   req.Format,
		"status":   string(result.Status),
	}

	if err := db.Model(&resource).Updates(updates).Error; err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to update resource")
		return
	}

	// Reload updated resource
	// Reload updated resource (ignore error; if it vanished concurrently we'll still return prior state)
	_ = db.First(&resource, id).Error

	common.JSONSuccess(c, http.StatusOK, gin.H{"resource": resource, "curation": result}, "Resource updated")
}
