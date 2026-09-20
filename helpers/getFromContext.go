package helpers

import (
	"errors"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetUserIDFromContext(c *gin.Context) (uuid.UUID, error) {
	userIdRaw, exists := c.Get("user_id")

	if !exists {
		return uuid.Nil, errors.New("user ID not found")
	}

	// Ensure the user ID is of type string
	userIdStr, ok := userIdRaw.(string)
	if !ok {
		log.Printf("getUserIDFromContext: user_id is not a string (got %T)", userIdRaw)
		return uuid.Nil, errors.New("Invalid user ID")
	}

	userID := uuid.MustParse(userIdStr)
	return userID, nil
}
