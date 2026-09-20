package dto

import (
	"LookInside/models"

	"github.com/google/uuid"
)

type InitConnectionStreamingDTO struct {
	ID uint `json:"id,omitempty"`

	CampaignId uuid.UUID `json:"campaignId" validate:"required,uuid4" binding:"required"`
	SessionId  string    `json:"sessionId" validate:"required,min=1,max=255" binding:"required"`

	RemoteIpAddress     string `json:"remoteIpAddress,omitempty" validate:"max=50"`
	UserAgent           string `json:"userAgent,omitempty" validate:"max=512"`
	Language            string `json:"language,omitempty" validate:"max=10"`
	HardwareConcurrency string `json:"hardwareConcurrency,omitempty" validate:"max=5"`
	DeviceMemory        string `json:"deviceMemory,omitempty" validate:"max=5"`
	MaxTouchPoints      string `json:"maxTouchPoints,omitempty" validate:"max=5"`
	NetworkType         string `json:"networkType,omitempty" validate:"max=50"`
	Geolocation         string `json:"geolocation,omitempty"`
	CookiesEnabled      bool   `json:"cookiesEnabled"`
	Webdriver           bool   `json:"webdriver,omitempty"`
	FullScreenEnabled   bool   `json:"fullScreenEnabled"`
	HasFocus            bool   `json:"hasFocus"`
	StorageEstimate     string `json:"storageEstimate,omitempty" validate:"max=10"`
	Timezone            string `json:"timezone,omitempty" validate:"max=100"`
	LocaleTime          string `json:"localeTime,omitempty" validate:"max=50"`
}

// ToModel converts DTO to domain model
func (dto *InitConnectionStreamingDTO) ToModel() *models.InitConnectionStreaming {
	return &models.InitConnectionStreaming{
		ID:                  dto.ID,
		CampaignId:          dto.CampaignId,
		SessionId:           dto.SessionId,
		RemoteIpAddress:     dto.RemoteIpAddress,
		UserAgent:           dto.UserAgent,
		Language:            dto.Language,
		HardwareConcurrency: dto.HardwareConcurrency,
		DeviceMemory:        dto.DeviceMemory,
		MaxTouchPoints:      dto.MaxTouchPoints,
		NetworkType:         dto.NetworkType,
		Geolocation:         dto.Geolocation,
		CookiesEnabled:      dto.CookiesEnabled,
		Webdriver:           dto.Webdriver,
		FullScreenEnabled:   dto.FullScreenEnabled,
		HasFocus:            dto.HasFocus,
		StorageEstimate:     dto.StorageEstimate,
		Timezone:            dto.Timezone,
		LocaleTime:          dto.LocaleTime,
	}
}

// FromInitConnectionStreamingModel converts domain model to DTO
func FromInitConnectionStreamingModel(model *models.InitConnectionStreaming) *InitConnectionStreamingDTO {
	return &InitConnectionStreamingDTO{
		ID:                  model.ID,
		CampaignId:          model.CampaignId,
		SessionId:           model.SessionId,
		RemoteIpAddress:     model.RemoteIpAddress,
		UserAgent:           model.UserAgent,
		Language:            model.Language,
		HardwareConcurrency: model.HardwareConcurrency,
		DeviceMemory:        model.DeviceMemory,
		MaxTouchPoints:      model.MaxTouchPoints,
		NetworkType:         model.NetworkType,
		Geolocation:         model.Geolocation,
		CookiesEnabled:      model.CookiesEnabled,
		Webdriver:           model.Webdriver,
		FullScreenEnabled:   model.FullScreenEnabled,
		HasFocus:            model.HasFocus,
		StorageEstimate:     model.StorageEstimate,
		Timezone:            model.Timezone,
		LocaleTime:          model.LocaleTime,
	}
}
