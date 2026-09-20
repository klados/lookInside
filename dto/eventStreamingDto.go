package dto

import (
	"LookInside/models"
	"encoding/json"

	"github.com/google/uuid"
)

type EventType int

type EventStreamingDTO struct {
	Timestamp int64           `json:"timestamp" validate:"required" binding:"required"`
	Type      EventType       `json:"type" validate:"required" binding:"required"`
	Data      json.RawMessage `json:"data" validate:"required" binding:"required"`
}

type EventArrayDTO struct {
	CampaignId uuid.UUID           `json:"campaignId" validate:"required,uuid4" binding:"required"`
	SessionId  string              `json:"sessionId" validate:"required,min=1,max=255" binding:"required"`
	Events     []EventStreamingDTO `json:"events" validate:"required" binding:"required"`
}

func (dto *EventStreamingDTO) ToModel() *models.EventStreaming {
	return &models.EventStreaming{
		Type:      models.EventType(dto.Type),
		Data:      dto.Data,
		Timestamp: dto.Timestamp,
	}
}

func FromEventStreamingModel(model *models.EventStreaming) *EventStreamingDTO {
	return &EventStreamingDTO{
		Timestamp: model.Timestamp,
		Type:      EventType(model.Type),
		Data:      model.Data,
	}
}
