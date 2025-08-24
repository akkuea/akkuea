package services

import (
	"errors"
	"os"
	"time"

	"gin/config"
	"gin/models"

	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService handles authentication operations
type AuthService struct {
	db *gorm.DB
}

// RegisterRequest represents the user registration request
type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required"`
}

// LoginRequest represents the user login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}


// NewAuthService creates a new authentication service
func NewAuthService() *AuthService {
	return &AuthService{
		db: config.GetDB(),
	}
}

// RegisterUser handles user registration
func (s *AuthService) RegisterUser(req RegisterRequest) (*AuthResponse, error) {
	// Check if user already exists
	var existingUser models.User
	if err := s.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Validate role
	validRoles := []string{"Educator", "Student", "Designer"}
	roleValid := false
	for _, role := range validRoles {
		if req.Role == role {
			roleValid = true
			break
		}
	}
	if !roleValid {
		return nil, errors.New("invalid role. Must be one of: Educator, Student, Designer")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user := models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashedPassword), // We need to add this field to the User model
		Role:     req.Role,
		Tokens:   0, // Default tokens
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}

	// Generate JWT token
	token, err := s.generateJWT(user)
	if err != nil {
		return nil, err
	}

	// Don't return the password in the response
	user.Password = ""

	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// LoginUser handles user login
func (s *AuthService) LoginUser(req LoginRequest) (*AuthResponse, error) {
	// Find user by email
	var user models.User
	if err := s.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid email or password")
		}
		return nil, err
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Generate JWT token
	token, err := s.generateJWT(user)
	if err != nil {
		return nil, err
	}

	// Don't return the password in the response
	user.Password = ""

	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// generateJWT creates a JWT token for the user
func (s *AuthService) generateJWT(user models.User) (string, error) {
	// Get JWT secret from environment
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key-here" // Default fallback
	}

	// Create claims
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(), // 24 hours
		"iat":     time.Now().Unix(),
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (jwt.MapClaims, error) {
	// Get JWT secret from environment
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key-here" // Default fallback
	}

	// Parse token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	// Check if token is valid
	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	// Extract claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}
	user.Password = "" // Don't return password
	return &user, nil
}
