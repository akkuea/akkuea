package api

import (
	"gin/common"
	"gin/config"
	"gin/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HealthHandler(c *gin.Context) {
	db := config.GetDB()
	
	sqlDB, err := db.DB()
	if err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Failed to get database instance")
		return
	}

	if err := sqlDB.Ping(); err != nil {
		common.JSONError(c, http.StatusInternalServerError, "database_error", "Database ping failed")
		return	
	}

	// Check migration status directly here instead of calling external function
	migrations := map[string]bool{
		"users":                 db.Migrator().HasTable(&models.User{}),
		"resources":             db.Migrator().HasTable(&models.Resource{}),
		"rewards":               db.Migrator().HasTable(&models.Reward{}),
		"marketplace_requests":  db.Migrator().HasTable(&models.MarketplaceRequest{}),
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

	common.JSONSuccess(c, http.StatusOK, gin.H{
		"status":     status,
		"database":   "connected",
		"message":    message,
		"migrations": migrations,
	}, message)
}