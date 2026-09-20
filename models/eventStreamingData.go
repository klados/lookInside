package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type EventType int

type EventStreaming struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	CampaignID uuid.UUID `gorm:"type:uuid;not null;index" json:"campaign_id"`
	SessionId  string    `gorm:"type:varchar(255);not null;index" json:"session_id"`

	Timestamp int64           `gorm:"not null" json:"timestamp" validate:"required" binding:"required"`
	Type      EventType       `gorm:"not null" json:"type" validate:"required" binding:"required"`
	Data      json.RawMessage `gorm:"type:jsonb;not null" json:"data" validate:"required" binding:"required"`
}

func (EventStreaming) TableName() string {
	return "event_streaming"
}
