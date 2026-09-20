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

type StreamingHandler interface {
	InitConnectionData(c *gin.Context)
	EventsHandler(c *gin.Context)
	GetSessionByCampaignId(c *gin.Context)
}

type StreamingHandlerImpl struct {
	StreamingService services.StreamingService
}

func NewStreamingHandler(db *gorm.DB, redis *redis.Client) StreamingHandler {
	return &StreamingHandlerImpl{
		StreamingService: services.NewStreamingService(db, redis),
	}
}

// InitConnectionData external api handler
func (h *StreamingHandlerImpl) InitConnectionData(c *gin.Context) {
	var streamingDTO dto.InitConnectionStreamingDTO
	if err := c.ShouldBindJSON(&streamingDTO); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	streamingDTO.RemoteIpAddress = c.ClientIP()
	if err := h.StreamingService.InitConnectionDataInsert(streamingDTO); err != nil {
		log.Println(err.Error())
		c.JSON(200, gin.H{})
		return
	}

	c.JSON(201, gin.H{})
}

// EventsHandler external api handler
func (h *StreamingHandlerImpl) EventsHandler(c *gin.Context) {
	var dtos dto.EventArrayDTO
	if err := c.ShouldBindJSON(&dtos); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := h.StreamingService.EventStreamingInsert(dtos); err != nil {
		log.Println(err.Error())
		c.JSON(200, gin.H{})
		return
	}

	c.JSON(200, gin.H{})
}

func (h *StreamingHandlerImpl) GetSessionByCampaignId(c *gin.Context) {
	campaignIdStr := c.Param("campaignId")

	// Validate that campaignId parameter exists
	if campaignIdStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "campaignId is required"})
		return
	}

	// Convert string to UUID
	campaignId, err := uuid.Parse(campaignIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid campaignId format. Must be a valid UUID"})
		return
	}

	userId, err := helpers.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if data, err := h.StreamingService.GetSessionsByCampaignId(userId, campaignId); err != nil {
		log.Println(err.Error())
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	} else {
		// If data is nil, return empty array instead
		if data == nil {
			c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		} else {
			c.JSON(http.StatusOK, gin.H{"data": data})
		}
	}
}
