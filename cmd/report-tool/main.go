package main

import (
	"LookInside/config"
	"LookInside/helpers"
	"LookInside/services"
	"log"
	"time"
)

func main() {
	cnf, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	db, err := config.InitDB(cnf)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	rd, err := config.InitRedis(cnf)
	if err != nil {
		log.Fatal("Failed to initialize Redis:", err)
	}

	campaignService := services.NewCampaignService(db, rd)

	log.Println("Starting report tool")

	// Determine the reporting timezone (default: UTC) and calculate previous day's range.
	loc := time.UTC
	now := time.Now().In(loc)
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	from := startOfToday.Add(-24 * time.Hour) // previous day 00:00:00
	to := startOfToday.Add(-time.Nanosecond)  // previous day 23:59:59.999999999

	report, err := campaignService.CreateReportWithNewCampaignsAndSessions(from, to)
	if err != nil {
		helpers.SendDiscordReportErrorMessage("Failed to create report", err)
		log.Fatalf("Failed to create report: %v", err)
	}

	helpers.SendDiscordReport(report)
}
