package dto

import "LookInside/models"

type EventStreamingReportDto struct {
	UserEmail    string `json:"user_email"`
	CampaignName string `json:"campaign_name"`
	EventCount   int64  `json:"event_count"`
}

func ToEventStreamingReport(model []models.EventStreamingReport) []EventStreamingReportDto {
	out := make([]EventStreamingReportDto, 0, len(model))
	for i := range model {
		dto := EventStreamingReportDto{
			UserEmail:    model[i].UserEmail,
			CampaignName: model[i].CampaignName,
			EventCount:   model[i].EventCount,
		}
		out = append(out, dto)
	}
	return out
}
