package models

type EventStreamingReport struct {
	UserEmail    string `json:"user_email"`
	CampaignName string `json:"campaign_name"`
	EventCount   int64  `json:"event_count"`
}
