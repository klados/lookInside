package helpers

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func GenericCors() gin.HandlerFunc {
	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173" // Default for local dev
	}
	log.Printf("CORS allowed origins: %s", allowedOrigins)

	origins := strings.Split(allowedOrigins, ",")

	// This is a good base configuration for many scenarios
	config := cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	return cors.New(config)
}

func ApplyCorsAndOptions(group *gin.RouterGroup) {
	group.Use(GenericCors())
	group.OPTIONS("/*path", func(c *gin.Context) {
		c.Status(204)
	})
}
