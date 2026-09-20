package handlers

import (
	"LookInside/dto"
	"LookInside/helpers"
	"LookInside/services"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type ReplayHandler interface {
	ReplaySession(c *gin.Context)
	ReplayDemo(c *gin.Context)
}

type ReplayHandlerImpl struct {
	StreamingService services.StreamingService
}

func NewReplayHandler(db *gorm.DB, rd *redis.Client) ReplayHandler {
	return &ReplayHandlerImpl{
		StreamingService: services.NewStreamingService(db, rd),
	}
}

func (r *ReplayHandlerImpl) ReplaySession(c *gin.Context) {
	projectIdStr := c.Param("projectId")
	sessionId := c.Param("sessionId")

	// Validate parameters
	if projectIdStr == "" || sessionId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing projectId or sessionId"})
		return
	}

	projectId, err := uuid.Parse(projectIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid projectId format, must be a valid UUID"})
		return
	}

	userId, err := helpers.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var init dto.InitConnectionStreamingDTO
	var events []dto.EventStreamingDTO

	if init, events, err = r.StreamingService.GetEventsOfSession(userId, projectId, sessionId); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not fetch events"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"init": init, "events": events})
}

func (r *ReplayHandlerImpl) ReplayDemo(c *gin.Context) {
	isMobileStr := c.Query("isMobile")
	isMobile := isMobileStr == "true"

	if data, err := r.StreamingService.GetSessionsForTheDemo(isMobile); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not fetch sessions for the demo"})
		return
	} else {
		c.JSON(http.StatusOK, gin.H{"data": data})
	}
}
