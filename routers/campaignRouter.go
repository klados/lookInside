package routers

import (
	"LookInside/handlers"
	"LookInside/helpers"
	"LookInside/middleware"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func SetUpCampaignRouter(r *gin.Engine, db *gorm.DB, rd *redis.Client) {
	campaignRouter := r.Group("/api/v1/campaign")
	campaignRouter.Use(helpers.GenericCors())
	helpers.ApplyCorsAndOptions(campaignRouter)
	{
		campaignHandlers := handlers.NewCampaignHandler(db, rd)
		campaignRouter.POST("/create", middleware.AuthMiddleware(), campaignHandlers.CreateCampaignHandler)
		campaignRouter.GET("/getAll", middleware.AuthMiddleware(), campaignHandlers.GetUsersCampaignsHandler)
		campaignRouter.DELETE("/delete/:campaignId", middleware.AuthMiddleware(), campaignHandlers.DeleteCampaignByCampaignIdHandler)
	}
}
