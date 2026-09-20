package handlers

import (
	"LookInside/dto"
	"LookInside/repositories"
	"LookInside/services"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"LookInside/helpers"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler interface {
	LogOut(c *gin.Context)
	RefreshToken(c *gin.Context)
	GoogleCallback(c *gin.Context)
	GetCurrentUser(c *gin.Context)
}

type AuthHandlerImpl struct {
	userService       services.UserService
	refreshTokenRepo  repositories.RefreshTokenRepository
	accessCookieName  string
	refreshCookieName string
	cookieSameSite    http.SameSite
	cookieDomain      string
	cookieSecure      bool
}

type TokenResponse struct {
	User    dto.UserResponseDto `json:"user"`
	Message string              `json:"message"`
}

func NewAuthHandler(db *gorm.DB) AuthHandler {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET environment variable is not set")
	}

	env := os.Getenv("ENVIRONMENT")
	secure := env != "local" && env != "dev" && env != "development"
	sameSite := http.SameSiteLaxMode

	// For development, use SameSiteNoneMode to allow cross-origin cookies
	if env == "local" || env == "dev" || env == "development" {
		sameSite = http.SameSiteNoneMode
	}

	// If SameSite=None, browsers require Secure=true
	if sameSite == http.SameSiteNoneMode && !secure {
		secure = true
	}

	// For production, set your actual domain
	domain := os.Getenv("COOKIE_DOMAIN")
	log.Printf("Cookie settings - Domain: '%s', Secure: %v, SameSite: %v, Environment: %s",
		domain, secure, sameSite, env)

	return &AuthHandlerImpl{
		userService:       services.NewUserService(db),
		refreshTokenRepo:  repositories.NewRefreshTokenRepository(db),
		cookieDomain:      domain,
		cookieSecure:      secure,
		cookieSameSite:    sameSite,
		accessCookieName:  "access_token",
		refreshCookieName: "refresh_token",
	}
}

func (a *AuthHandlerImpl) LogOut(c *gin.Context) {
	// Get refresh token from cookie to revoke it
	refreshToken, err := c.Cookie(a.refreshCookieName)
	if err == nil && refreshToken != "" {
		// Revoke the refresh token in database
		if revokeErr := a.refreshTokenRepo.RevokeToken(refreshToken); revokeErr != nil {
			log.Printf("Failed to revoke refresh token: %v", revokeErr)
		}
	}

	// Clear HTTP-only cookies
	opts := helpers.CookieOpts{Domain: a.cookieDomain, Secure: a.cookieSecure, SameSite: a.cookieSameSite, Path: "/"}
	helpers.ClearAuthCookie(c, a.accessCookieName, opts)
	helpers.ClearAuthCookie(c, a.refreshCookieName, opts)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (a *AuthHandlerImpl) RefreshToken(c *gin.Context) {
	// Get refresh token from HTTP-only cookie
	refreshToken, err := c.Cookie(a.refreshCookieName)
	if err != nil || refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token not found"})
		return
	}

	// Find and validate refresh token in database
	tokenRecord, err := a.refreshTokenRepo.FindByToken(refreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	// Check if token is expired
	if time.Now().After(tokenRecord.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token expired"})
		return
	}

	// Get user information
	user, err := a.userService.GetUserByID(tokenRecord.UserID)
	if err != nil {
		// If we can't get user info, return error
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user information"})
		return
	}

	// Generate new access token
	accessToken, err := helpers.GenerateAccessToken(user.ID.String(), user.Name, user.Picture)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	// Generate new random refresh token
	newRefreshToken, err := helpers.GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Revoke old refresh token
	if err := a.refreshTokenRepo.RevokeToken(refreshToken); err != nil {
		log.Printf("Failed to revoke old refresh token: %v", err)
	}

	// Create new refresh token record
	refreshTokenExpiry := time.Now().Add(30 * 24 * time.Hour) // 30 days
	_, err = a.refreshTokenRepo.CreateRefreshToken(
		user.ID,
		newRefreshToken,
		refreshTokenExpiry,
		c.GetHeader("User-Agent"),
		c.ClientIP(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create refresh token"})
		return
	}

	// Set new tokens as HTTP-only cookies
	opts := helpers.CookieOpts{Domain: a.cookieDomain, Secure: a.cookieSecure, SameSite: a.cookieSameSite, Path: "/"}
	helpers.SetAuthCookie(c, a.accessCookieName, accessToken, 15*time.Minute, opts)       // 15 minutes
	helpers.SetAuthCookie(c, a.refreshCookieName, newRefreshToken, 30*24*time.Hour, opts) // 30 days

	// Return success response
	response := TokenResponse{
		User:    user,
		Message: "Tokens refreshed successfully",
	}

	c.JSON(http.StatusOK, response)
}

func (a *AuthHandlerImpl) GoogleCallback(c *gin.Context) {
	// Try to get code from query parameter first (GET request from Google redirect)
	code := c.Query("code")

	// If not in query, try to get from POST body
	if code == "" {
		var requestBody struct {
			Code string `json:"code"`
		}
		if err := c.ShouldBindJSON(&requestBody); err == nil {
			code = requestBody.Code
		}
	}

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing authorization code"})
		return
	}

	// Check for error in the callback
	if errorParam := c.Query("error"); errorParam != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization failed: " + errorParam})
		return
	}

	// Exchange authorization code for access token
	tokenResponse, err := a.exchangeCodeForToken(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code for token"})
		return
	}

	// Get user information from Google
	userInfo, err := a.getGoogleUserInfo(tokenResponse.AccessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user information"})
		return
	}

	log.Printf("Google callback: user info: %+v", userInfo)

	savedUser, err := a.userService.GetValidUserByEmail(userInfo.Email)
	if err != nil {
		savedUser, err = a.userService.CreateNewUser(dto.UserResponseDto{
			Email:     userInfo.Email,
			Name:      userInfo.Name,
			Picture:   userInfo.Picture,
			Role:      "user",
			IsBlocked: false,
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new user"})
			return
		}
		helpers.SendDiscordNewUserMessage(savedUser.Email, savedUser.Name)
	} else {
		if savedUser.IsBlocked {
			c.JSON(http.StatusForbidden, gin.H{"error": "User is blocked"})
			return
		}
	}

	// Generate JWT access token
	accessToken, err := helpers.GenerateAccessToken(savedUser.ID.String(), savedUser.Name, savedUser.Picture)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	// Generate random refresh token
	refreshToken, err := helpers.GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Store refresh token in database
	refreshTokenExpiry := time.Now().Add(30 * 24 * time.Hour) // 30 days
	_, err = a.refreshTokenRepo.CreateRefreshToken(
		savedUser.ID,
		refreshToken,
		refreshTokenExpiry,
		c.GetHeader("User-Agent"),
		c.ClientIP(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create refresh token"})
		return
	}

	// Set tokens as HTTP-only cookies
	opts := helpers.CookieOpts{Domain: a.cookieDomain, Secure: a.cookieSecure, SameSite: a.cookieSameSite, Path: "/"}
	helpers.SetAuthCookie(c, a.accessCookieName, accessToken, 15*time.Minute, opts)    // 15 minutes
	helpers.SetAuthCookie(c, a.refreshCookieName, refreshToken, 30*24*time.Hour, opts) // 30 days

	// Return user data in response
	_ = TokenResponse{
		User:    savedUser,
		Message: "Authentication successful",
	}

	if os.Getenv("ENVIRONMENT") == "dev" {
		c.Redirect(http.StatusFound, "http://localhost:5173/")
		return
	}

	c.Redirect(http.StatusFound, "/")
}

func (a *AuthHandlerImpl) GetCurrentUser(c *gin.Context) {
	// Get user ID from context (set by middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse user ID and get user from database
	userUUID := helpers.ParseUUID(userID.(string))
	if userUUID == uuid.Nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := a.userService.GetUserByID(userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user information"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (a *AuthHandlerImpl) exchangeCodeForToken(code string) (*dto.GoogleTokenResponse, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURI := os.Getenv("GOOGLE_REDIRECT_URL")

	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")
	data.Set("redirect_uri", redirectURI)

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", data)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResponse dto.GoogleTokenResponse
	if err := json.Unmarshal(body, &tokenResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token response: %v", err)
	}

	return &tokenResponse, nil
}

func (a *AuthHandlerImpl) getGoogleUserInfo(accessToken string) (*dto.GoogleUserInfo, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get user info with status %d: %s", resp.StatusCode, string(body))
	}

	var userInfo dto.GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user info: %v", err)
	}

	return &userInfo, nil
}
