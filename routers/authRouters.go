package routers

import (
	"LookInside/handlers"
	"LookInside/helpers"
	"LookInside/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetUpAuthRouter(r *gin.Engine, db *gorm.DB) {
	authRouter := r.Group("/api/v1/auth")
	authRouter.Use(helpers.GenericCors())
	helpers.ApplyCorsAndOptions(authRouter)
	{
		authHandlers := handlers.NewAuthHandler(db)
		authRouter.POST("/refresh", authHandlers.RefreshToken)
		authRouter.POST("/logout", authHandlers.LogOut)
		authRouter.GET("/google/callback", authHandlers.GoogleCallback)
		//authRouter.POST("/google/callback", authHandlers.GoogleCallback)
		authRouter.GET("/me", middleware.AuthMiddleware(), authHandlers.GetCurrentUser)
	}
}
