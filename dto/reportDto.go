package dto

type ReportDTO struct {
	Campaigns             []CampaignWithUserEmailDTO `json:"campaigns"`
	EventStreamingReports []EventStreamingReportDto  `json:"event_streaming_reports"`
}
