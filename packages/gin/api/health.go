package api

import (
	"gin/config"
	"gin/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status     string          `json:"status"`
	Database   string          `json:"database"`
	Message    string          `json:"message"`
	Migrations map[string]bool `json:"migrations,omitempty"`
}

func HealthHandler(c *gin.Context) {
	db := config.GetDB()

	sqlDB, err := db.DB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, HealthResponse{
			Status:   "error",
			Database: "disconnected",
			Message:  "Failed to get database instance",
		})
		return
	}

	if err := sqlDB.Ping(); err != nil {
		c.JSON(http.StatusInternalServerError, HealthResponse{
			Status:   "error",
			Database: "disconnected",
			Message:  "Database ping failed",
		})
		return
	}

	// Check migration status directly here instead of calling external function
	migrations := map[string]bool{
		"users":                db.Migrator().HasTable(&models.User{}),
		"resources":            db.Migrator().HasTable(&models.Resource{}),
		"rewards":              db.Migrator().HasTable(&models.Reward{}),
		"marketplace_requests": db.Migrator().HasTable(&models.MarketplaceRequest{}),
	}

	// Check if all tables are migrated
	allMigrated := true
	for _, migrated := range migrations {
		if !migrated {
			allMigrated = false
			break
		}
	}

	status := "healthy"
	message := "All systems operational"
	if !allMigrated {
		status = "warning"
		message = "Some database tables are not migrated"
	}

	c.JSON(http.StatusOK, HealthResponse{
		Status:     status,
		Database:   "connected",
		Message:    message,
		Migrations: migrations,
	})
}
