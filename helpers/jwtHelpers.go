package helpers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type CookieOpts struct {
	Domain   string
	Secure   bool
	SameSite http.SameSite
	Path     string
}

type TokenClaims struct {
	UserID  string `json:"user_id"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	Type    string `json:"type"`
	jwt.RegisteredClaims
}

// GenerateJWT creates a signed JWT with the given subject, custom claims, and TTL.
func GenerateJWT(subject string, customClaims map[string]any, ttl time.Duration) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET environment variable is not set")
	}

	now := time.Now().UTC()
	claims := jwt.MapClaims{
		"sub": subject,
		"iat": now.Unix(),
		"exp": now.Add(ttl).Unix(),
	}

	for k, v := range customClaims {
		claims[k] = v
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateAccessToken generates a short-lived access token
func GenerateAccessToken(userID, name, picture string) (string, error) {
	accessTTL := 15 * time.Minute
	return GenerateJWT(userID, map[string]any{
		"user_id": userID,
		"name":    name,
		"picture": picture,
		"type":    "access",
	}, accessTTL)
}

// GenerateRefreshToken generates a random refresh token string
func GenerateRefreshToken() (string, error) {
	// Generate 32 random bytes and convert to hex string
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %v", err)
	}
	return hex.EncodeToString(bytes), nil
}

// ParseAndValidate verifies signature, algorithm and expiration, and returns claims.
func ParseAndValidate(tokenStr string) (jwt.MapClaims, bool, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, false, fmt.Errorf("JWT_SECRET environment variable is not set")
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, false, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, false, fmt.Errorf("invalid token")
	}

	// Check expiration manually since jwt.MapClaims doesn't have VerifyExpiresAt
	if exp, ok := claims["exp"].(float64); ok {
		if time.Unix(int64(exp), 0).Before(time.Now().UTC()) {
			return claims, false, fmt.Errorf("token expired")
		}
	} else {
		return claims, false, fmt.Errorf("missing expiration claim")
	}

	return claims, true, nil
}

// ValidateAccessToken validates an access token and returns user info
func ValidateAccessToken(tokenStr string) (*TokenClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is not set")
	}

	token, err := jwt.ParseWithClaims(tokenStr, &TokenClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*TokenClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	// Verify it's an access token
	if claims.Type != "access" {
		return nil, fmt.Errorf("invalid token type")
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token and returns user ID
func ValidateRefreshToken(tokenStr string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET environment variable is not set")
	}

	token, err := jwt.ParseWithClaims(tokenStr, &TokenClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return "", fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(*TokenClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	// Verify it's a refresh token
	if claims.Type != "refresh" {
		return "", fmt.Errorf("invalid token type")
	}

	return claims.UserID, nil
}

// SetAuthCookie sets a secure, httpOnly cookie with standard attributes.
func SetAuthCookie(c *gin.Context, name, value string, maxAge time.Duration, opts CookieOpts) {
	path := opts.Path
	if path == "" {
		path = "/"
	}

	// Respect the provided opts.Secure instead of recomputing from ENVIRONMENT.
	secure := opts.Secure

	// Enforce browser requirement: SameSite=None must be Secure
	if opts.SameSite == http.SameSiteNoneMode && !secure {
		secure = true
	}

	cookie := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		Domain:   opts.Domain,
		MaxAge:   int(maxAge / time.Second),
		Expires:  time.Now().UTC().Add(maxAge),
		Secure:   secure,
		HttpOnly: true,
		SameSite: opts.SameSite,
	}
	http.SetCookie(c.Writer, cookie)
}

// ClearAuthCookie clears a cookie by setting an expired value.
func ClearAuthCookie(c *gin.Context, name string, opts CookieOpts) {
	path := opts.Path
	if path == "" {
		path = "/"
	}

	// Respect the provided opts.Secure instead of recomputing from ENVIRONMENT.
	secure := opts.Secure

	// Enforce browser requirement for consistency (not strictly necessary on delete, but safe)
	if opts.SameSite == http.SameSiteNoneMode && !secure {
		secure = true
	}

	cookie := &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     path,
		Domain:   opts.Domain,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		Secure:   secure,
		HttpOnly: true,
		SameSite: opts.SameSite,
	}
	http.SetCookie(c.Writer, cookie)
}

// ParseUUID parses a string UUID and returns a UUID object
func ParseUUID(uuidStr string) uuid.UUID {
	parsed, err := uuid.Parse(uuidStr)
	if err != nil {
		// Return a zero UUID if parsing fails
		return uuid.Nil
	}
	return parsed
}
