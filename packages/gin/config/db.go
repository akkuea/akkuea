package config

import (
	"fmt"
	"log"
	"os"

	"gin/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	var err error

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		getEnvWithDefault("DB_HOST", "localhost"),
		getEnvWithDefault("DB_USER", "postgres"),
		getEnvWithDefault("DB_PASSWORD", "secret"),
		getEnvWithDefault("DB_NAME", "akkuea"),
		getEnvWithDefault("DB_PORT", "5432"),
	)

	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	DB, err = gorm.Open(postgres.Open(dsn), config)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get database instance: %v", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	log.Println("Successfully connected to PostgreSQL database")

	runMigrations()
}

func runMigrations() {
	log.Println("Starting automatic database migrations...")

	modelsToMigrate := []interface{}{
		&models.User{},
		&models.Resource{},
		&models.Reward{},
		&models.MarketplaceRequest{},
	}

	// run AutoMigrate for each model
	for _, model := range modelsToMigrate {
		modelName := fmt.Sprintf("%T", model)
		log.Printf("Migrating model: %s", modelName)

		if err := DB.AutoMigrate(model); err != nil {
			log.Fatalf("Failed to migrate model %s: %v", modelName, err)
		}

		log.Printf("Successfully migrated: %s", modelName)
	}

	log.Println("All database migrations completed successfully")

	verifyForeignKeys()

}

// if foreign key constraints are properly created
func verifyForeignKeys() {
	log.Println("Verifying foreign key constraints...")

	// Check if tables exist
	tables := []interface{}{
		&models.User{},
		&models.Resource{},
		&models.Reward{},
		&models.MarketplaceRequest{},
	}

	for _, table := range tables {
		tableName := fmt.Sprintf("%T", table)
		if DB.Migrator().HasTable(table) {
			log.Printf("✓ Table exists: %s", tableName)
		} else {
			log.Printf("✗ Table missing: %s", tableName)
		}
	}

	// Verify specific foreign key columns exist
	if DB.Migrator().HasColumn(&models.Resource{}, "creator_id") {
		log.Println("Resource.creator_id foreign key column exists")
	} else {
		log.Println("Resource.creator_id foreign key column missing")
	}

	if DB.Migrator().HasColumn(&models.Reward{}, "user_id") {
		log.Println("Reward.user_id foreign key column exists")
	} else {
		log.Println("Reward.user_id foreign key column missing")
	}

	if DB.Migrator().HasColumn(&models.MarketplaceRequest{}, "requester_id") {
		log.Println("MarketplaceRequest.requester_id foreign key column exists")
	} else {
		log.Println("MarketplaceRequest.requester_id foreign key column missing")
	}

	if DB.Migrator().HasColumn(&models.MarketplaceRequest{}, "designer_id") {
		log.Println("MarketplaceRequest.designer_id foreign key column exists")
	} else {
		log.Println("MarketplaceRequest.designer_id foreign key column missing")
	}

	log.Println("Foreign key verification completed")
}

func GetDB() *gorm.DB {
	return DB
}

func CloseDB() {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			log.Printf("Error getting database instance: %v", err)
			return
		}
		if err := sqlDB.Close(); err != nil {
			log.Printf("Error closing database: %v", err)
		} else {
			log.Println("Database connection closed")
		}
	}
}

func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
