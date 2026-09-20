package middleware

import (
	"LookInside/services"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type RequestBody struct {
	CampaignId string `json:"campaignId"`
	SessionId  string `json:"sessionId"`
}

func LimitStreamingMiddleware(db *gorm.DB, rd *redis.Client) gin.HandlerFunc {
	campaignService := services.NewCampaignService(db, rd)
	steamingService := services.NewStreamingService(db, rd)

	return func(c *gin.Context) {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
			c.Abort()
			return
		}

		// Restore the body for the next handler to read
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		var requestBody RequestBody
		if err := json.Unmarshal(bodyBytes, &requestBody); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
			c.Abort()
			return
		}

		campaignIdStr := requestBody.CampaignId
		if campaignIdStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "campaignId is required"})
			c.Abort()
			return
		}

		campaignId, err := uuid.Parse(campaignIdStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid campaignId format. Must be a valid UUID"})
			c.Abort()
			return
		}

		campaign, err := campaignService.GetCampaignById(campaignId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
			c.Abort()
			return
		}

		// check if the campaign is active
		nowUtc := time.Now().UTC()
		nowMillis := nowUtc.UnixMilli()

		if nowMillis < campaign.StartDateTime || nowMillis > campaign.EndDateTime {
			c.JSON(http.StatusNotFound, gin.H{"error": "campaign is not active"})
			c.Abort()
			return
		}

		// check if the client is allowed to access the campaign
		// Get client IP (respects X-Forwarded-For / X-Real-IP if Gin is configured)
		clientIP := c.ClientIP()

		clientAllowed := false
		for _, allowedEntry := range strings.Split(campaign.Domains, ",") {
			trimmed := strings.TrimSpace(allowedEntry)
			if trimmed == "" {
				continue
			}

			// If entry is an IP, compare with client IP
			if net.ParseIP(trimmed) != nil {
				if clientIP == trimmed {
					clientAllowed = true
					break
				}
				continue
			}
		}

		if !clientAllowed {
			c.JSON(
				http.StatusNotFound,
				gin.H{"error": fmt.Sprintf("client not allowed: ip=%s", clientIP)},
			)
			c.Abort()
			return
		}

		// check if the client has reached the limit for the campaign
		isUnderRateLimit, err := steamingService.CheckAndUpdateSessionRateLimit(campaignId, requestBody.SessionId, campaign.Limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error checking rate limit"})
			c.Abort()
			return
		}

		if !isUnderRateLimit {
			c.JSON(http.StatusForbidden, gin.H{"error": "You have reached the limit for this campaign"})
			c.Abort()
			return
		}
		c.Next()
	}
}
