package routers

import (
	"LookInside/handlers"
	"LookInside/helpers"
	"LookInside/middleware"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func SetUpReplayRouters(r *gin.Engine, db *gorm.DB, rd *redis.Client) {
	replayRouter := r.Group("/api/v1/replay")
	replayRouter.Use(helpers.GenericCors())
	helpers.ApplyCorsAndOptions(replayRouter)
	{
		replayHandlers := handlers.NewReplayHandler(db, rd)
		replayRouter.GET("/retrieve/:projectId/:sessionId", middleware.AuthMiddleware(), replayHandlers.ReplaySession)
		replayRouter.GET("/retrieve/demo", replayHandlers.ReplayDemo)
	}
}
