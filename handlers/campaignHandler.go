package handlers

import (
	"LookInside/dto"
	"LookInside/helpers"
	"LookInside/services"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const MaxCampaignPerUser = 5

type CampaignHandler interface {
	CreateCampaignHandler(c *gin.Context)
	GetUsersCampaignsHandler(c *gin.Context)
	DeleteCampaignByCampaignIdHandler(c *gin.Context)
}

type CampaignHandlerImpl struct {
	CampaignService services.CampaignService
}

func NewCampaignHandler(db *gorm.DB, rd *redis.Client) CampaignHandler {
	return &CampaignHandlerImpl{
		CampaignService: services.NewCampaignService(db, rd),
	}
}

func (a *CampaignHandlerImpl) CreateCampaignHandler(c *gin.Context) {
	var dtoCampaign dto.CampaignDTO
	if err := c.ShouldBindJSON(&dtoCampaign); err != nil {
		log.Printf("CreateCampaignHandler: invalid payload: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	userId, err := helpers.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// toDo check if user has the pro or the free plan and adjust the max campaigns
	num, err := a.CampaignService.GeNumberOfCampaignsForUser(userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if num >= MaxCampaignPerUser {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("You have reached the maximum number of campaigns (%d). You can delete old campaigns to create new ones.", MaxCampaignPerUser)})
		return
	}

	var campaignId uuid.UUID
	if campaignId, err = a.CampaignService.CreateCampaign(userId, dtoCampaign); err != nil {
		log.Printf("CreateCampaignHandler: create campaign failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create campaign"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"campaignId": campaignId})
}

func (a *CampaignHandlerImpl) GetUsersCampaignsHandler(c *gin.Context) {
	userId, err := helpers.GetUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var campaigns []dto.CampaignDTO
	if campaigns, err = a.CampaignService.GetAllUsersCampaign(userId); err != nil {
		log.Printf("GetUsersCampaignsHandler: fetch campaigns failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not fetch campaigns"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": campaigns})
}

func (a *CampaignHandlerImpl) DeleteCampaignByCampaignIdHandler(c *gin.Context) {

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

	if err := a.CampaignService.DeleteCampaignById(userId, campaignId); err != nil {
		log.Printf("DeleteCampaignByCampaignIdHandler: delete campaign failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete campaign"})
		return
	}
	c.JSON(http.StatusOK, gin.H{})
}
