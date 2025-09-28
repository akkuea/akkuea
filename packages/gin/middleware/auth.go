package middleware

import (
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

var ValidRoles = []string{"Educator", "Student", "Designer"}

// Claims represents the JWT claims structure
type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

// ValidateRoleClaims checks if the JWT claims contain a valid role
func ValidateRoleClaims(tokenString string) (string, error) {
	claims := jwt.MapClaims{}
	_, _, err := new(jwt.Parser).ParseUnverified(tokenString, &claims)
	if err != nil {
		return "", fmt.Errorf("failed to parse JWT claims: %v", err)
	}

	roleInterface, exists := claims["role"]
	if !exists {
		return "", fmt.Errorf("role claim is missing from JWT")
	}

	role, ok := roleInterface.(string)
	if !ok {
		return "", fmt.Errorf("role claim is not a string")
	}

	if !slices.Contains(ValidRoles, role) {
		return "", fmt.Errorf("invalid role: %s. Allowed roles: %v", role, ValidRoles)
	}

	return role, nil
}

// AuthMiddleware validates JWT tokens and ensures role claims are valid
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header is required",
			})
			c.Abort()
			return
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header must start with 'Bearer '",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		role, err := ValidateRoleClaims(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": err.Error(),
			})
			c.Abort()
			return
		}

		c.Set("user_role", role)

		c.Next()
	}
}

// RequireRole creates a middleware that requires a specific role
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			c.Abort()
			return
		}

		if userRole != requiredRole {
			c.JSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Access denied. Required role: %s", requiredRole),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAnyRole creates a middleware that requires any of the specified roles
func RequireAnyRole(requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			c.Abort()
			return
		}

		if !slices.Contains(requiredRoles, userRole.(string)) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("Access denied. Required roles: %v", requiredRoles),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
