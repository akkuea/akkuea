package common

import (
	"github.com/gin-gonic/gin"
)

// ErrorResponse represents a standardized error response format
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// JSONError sends a standardized error JSON response
func JSONError(c *gin.Context, statusCode int, errType, message string) {
	c.JSON(statusCode, ErrorResponse{
		Error:   errType,
		Message: message,
	})
}

// JSONSuccess sends a standardized success JSON response
func JSONSuccess(c *gin.Context, statusCode int, data interface{}, message string) {
	c.JSON(statusCode, gin.H{
		"data":    data,
		"message": message,
	})
}

// JSONMessage sends a standardized success JSON response with only a message
func JSONMessage(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, gin.H{
		"message": message,
	})
}
