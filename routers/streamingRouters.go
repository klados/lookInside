package routers

import (
	"LookInside/handlers"
	"LookInside/helpers"
	"LookInside/middleware"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func SetUpStreamingRouters(r *gin.Engine, db *gorm.DB, rd *redis.Client) {
	externalCorsConfig := cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		AllowCredentials: false, // Must be false when using "*"
		MaxAge:           12 * time.Hour,
	})

	streamingApiRouter := r.Group("/external/api/v1/streaming")
	streamingApiRouter.Use(externalCorsConfig)
	{
		// Ensure preflight requests match this group so CORS middleware runs
		streamingApiRouter.OPTIONS("/*path", func(c *gin.Context) {
			// gin-contrib/cors will add the headers; just return 204
			c.Status(204)
		})

		streamingHandlers := handlers.NewStreamingHandler(db, rd)
		streamingApiRouter.POST("/init", middleware.LimitStreamingMiddleware(db, rd), streamingHandlers.InitConnectionData)
		streamingApiRouter.POST("/events", middleware.LimitStreamingMiddleware(db, rd), streamingHandlers.EventsHandler)
	}

	streamingRouter := r.Group("/api/v1/streaming")
	streamingRouter.Use(helpers.GenericCors())
	helpers.ApplyCorsAndOptions(streamingRouter)
	{
		streamingHandlers := handlers.NewStreamingHandler(db, rd)
		streamingRouter.GET("/sessions/:campaignId/", middleware.AuthMiddleware(), streamingHandlers.GetSessionByCampaignId)
	}
}
