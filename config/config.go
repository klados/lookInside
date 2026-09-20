package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Config struct {
	ServerHost string
	ServerPort string
	ServerMode string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSslMode  string

	// OAuth Configuration
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// JWT Configuration
	JWTSecret         string
	JWTExpiration     time.Duration
	RefreshExpiration time.Duration

	// TLS Configuration
	TLSCertFile string
	TLSKeyFile  string

	// Redis Configuration
	RedisAddr     string
	RedisPassword string
	RedisDB       int
}

var DB *gorm.DB
var Redis *redis.Client

func LoadConfig() (Config, error) {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found; continuing with environment variables")
		// Do not return error here; allow env vars passed by the runtime (e.g., Docker) to be used
	}

	dbUser, err := getEnvWithError("DB_USER")
	if err != nil {
		return Config{}, err
	}

	dbPassword, err := getEnvWithError("DB_PASSWORD")
	if err != nil {
		return Config{}, err
	}

	googleClientID, err := getEnvWithError("GOOGLE_CLIENT_ID")
	if err != nil {
		return Config{}, err
	}

	googleClientSecret, err := getEnvWithError("GOOGLE_CLIENT_SECRET")
	if err != nil {
		return Config{}, err
	}

	jwtSecret, err := getEnvWithError("JWT_SECRET")
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		ServerHost: getEnv("SERVER_HOST", "localhost"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
		ServerMode: getEnv("GIN_MODE", "debug"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     dbUser,
		DBPassword: dbPassword,
		DBName:     getEnv("DB_NAME", "look_inside"),
		DBSslMode:  getEnv("DB_SSLMODE", "disable"),

		GoogleClientID:     googleClientID,
		GoogleClientSecret: googleClientSecret,
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/auth/google/callback"),

		JWTSecret:         jwtSecret,
		JWTExpiration:     time.Hour * 24,     // 24 hours
		RefreshExpiration: time.Hour * 24 * 7, // 7 days

		// TLS (optional; used in production)
		TLSCertFile: getEnv("TLS_CERT_FILE", ""),
		TLSKeyFile:  getEnv("TLS_KEY_FILE", ""),

		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisDB:       0,
	}

	return cfg, nil
}

// InitDB initializes a connection to TimeScaleDB
func InitDB(cfg Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSslMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	sqlDB.SetMaxIdleConns(10)           // Maximum idle connections
	sqlDB.SetMaxOpenConns(100)          // Maximum open connections
	sqlDB.SetConnMaxLifetime(time.Hour) // Connection max lifetime

	return db, nil
}

// InitRedis Initialize Redis client and verify connectivity with PING
func InitRedis(cfg Config) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("failed to connect to Redis at %s: %w", cfg.RedisAddr, err)
	}

	Redis = rdb
	return rdb, nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvWithError(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable: %s", key)
	}
	return value, nil
}
