package main

import (
	"LookInside/config"
	"LookInside/routers"
	"fmt"
	"log"
	"time"

	"LookInside/models"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"net/url"
	"os/exec"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Periodic cleanup for expired refresh tokens
func startRefreshTokenJanitor(db *gorm.DB) {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()

		for {
			now := time.Now()
			if err := db.Where("expires_at <= ?", now).Delete(&models.RefreshToken{}).Error; err != nil {
				log.Printf("refresh-token cleanup error: %v", err)
			}
			<-ticker.C
		}
	}()
}

// Run database migrations using the migrate CLI without hardcoded credentials.
func runMigrations(cnf config.Config) error {
	dbURL := fmt.Sprintf(
		"postgresql://%s:%s@%s:%s/%s?sslmode=%s",
		url.QueryEscape(cnf.DBUser),
		url.QueryEscape(cnf.DBPassword),
		cnf.DBHost,
		cnf.DBPort,
		cnf.DBName,
		cnf.DBSslMode,
	)

	cmd := exec.Command("migrate",
		"-path", "migrations",
		"-database", dbURL,
		"-verbose", "up",
	)

	out, err := cmd.CombinedOutput()
	if len(out) > 0 {
		log.Printf("migrate output:\n%s", string(out))
	}
	if err != nil {
		return fmt.Errorf("migrate command failed: %w", err)
	}
	return nil
}

func main() {
	cnf, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	db, err := config.InitDB(cnf)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	// Run versioned SQL migrations at startup using environment-based credentials
	if err := runMigrations(cnf); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	rd, err := config.InitRedis(cnf)
	if err != nil {
		log.Fatal("Failed to initialize Redis:", err)
	}

	// Start background janitor for expired refresh tokens
	startRefreshTokenJanitor(db)

	gin.SetMode(cnf.ServerMode)
	router := gin.Default()

	// Enable CORS only for static content during local development
	if gin.Mode() != gin.ReleaseMode {
		staticCORS := cors.New(cors.Config{
			AllowOrigins: []string{
				"http://localhost:5173",
				"http://127.0.0.1:5173",
			},
			AllowMethods:     []string{"GET", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: false,
			MaxAge:           12 * time.Hour,
		})
		// Apply CORS only to /static
		staticGroup := router.Group("/", staticCORS)
		staticGroup.Static("/static", "./static")
	} else {
		// In non-dev modes, keep static without CORS
		router.Static("/static", "./static")
	}

	// Setup routes
	routers.SetUpAuthRouter(router, db)
	routers.SetUpStreamingRouters(router, db, rd)
	routers.SetUpReplayRouters(router, db, rd)
	routers.SetUpCampaignRouter(router, db, rd)

	// In production, serve the React build (adjust the path if your build directory differs).
	// Example assumes the Vite build lives in ./web/dist with assets under ./web/dist/assets.
	if gin.Mode() == gin.ReleaseMode {
		router.Static("/assets", "./web/dist/assets")
		router.StaticFile("/", "./web/dist/index.html")
		router.StaticFile("/favicon.ico", "./web/dist/favicon.ico")
		router.NoRoute(func(c *gin.Context) {
			// SPA fallback only for GET requests asking for HTML
			if c.Request.Method == http.MethodGet && strings.Contains(c.GetHeader("Accept"), "text/html") {
				c.File("./web/dist/index.html")
				return
			}
			c.Status(http.StatusNotFound)
		})
	}

	// Start server
	log.Println("Server starting on :" + cnf.ServerPort)
	addr := fmt.Sprintf("%s:%s", cnf.ServerHost, cnf.ServerPort)

	// In production (release mode), prefer HTTPS if cert and key are set in config:
	if gin.Mode() == gin.ReleaseMode && cnf.TLSCertFile != "" && cnf.TLSKeyFile != "" {
		log.Printf("Starting HTTPS server on %s (TLS enabled)", addr)
		if err := router.RunTLS(addr, cnf.TLSCertFile, cnf.TLSKeyFile); err != nil {
			log.Fatalf("Failed to run HTTPS server: %v", err)
		}
		return
	}

	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
