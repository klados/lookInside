package dto

import (
	"LookInside/models"
	"time"

	"github.com/google/uuid"
)

type CampaignDTO struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name" validate:"required,min=1,max=255" binding:"required"`
	Domains       string    `json:"domains" validate:"required,min=1,max=1000" binding:"required"`
	Limit         int       `json:"limit" binding:"required,min=1,max=20"`
	StartDateTime int64     `json:"start_date_time" validate:"required" binding:"required"`
	EndDateTime   int64     `json:"end_date_time" validate:"required" binding:"required"`
}

type CampaignWithUserEmailDTO struct {
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

func (dto *CampaignDTO) ToModel() *models.Campaign {
	return &models.Campaign{
		Name:          dto.Name,
		Domains:       dto.Domains,
		Limit:         dto.Limit,
		StartDateTime: dto.StartDateTime,
		EndDateTime:   dto.EndDateTime,
	}
}

func FromCampaignModel(model *models.Campaign) *CampaignDTO {
	return &CampaignDTO{
		ID:            model.ID,
		Name:          model.Name,
		Domains:       model.Domains,
		Limit:         model.Limit,
		StartDateTime: model.StartDateTime,
		EndDateTime:   model.EndDateTime,
	}
}

func FromCampaignWithUserEmailModel(model *models.CampaignWithUserEmail) *CampaignWithUserEmailDTO {
	return &CampaignWithUserEmailDTO{
		Name:      model.Name,
		Email:     model.UserEmail,
		CreatedAt: model.CreatedAt,
	}
}

func ToCampaignWithUserEmailDTOs(modelsSlice []models.CampaignWithUserEmail) []CampaignWithUserEmailDTO {
	out := make([]CampaignWithUserEmailDTO, 0, len(modelsSlice))
	for i := range modelsSlice {
		dto := FromCampaignWithUserEmailModel(&modelsSlice[i])
		out = append(out, *dto)
	}
	return out
}
