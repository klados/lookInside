package models

import (
	"time"

	"github.com/google/uuid"
)

type Campaign struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name          string    `gorm:"type:varchar(255);not null" json:"name"`
	Domains       string    `gorm:"type:varchar(1000);not null" json:"domain"`
	Limit         int       `gorm:"not null" json:"limit"`
	StartDateTime int64     `gorm:"not null" json:"start_date_time"`
	EndDateTime   int64     `gorm:"not null" json:"end_date_time"`

	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

type CampaignWithUserEmail struct {
	Name      string    `gorm:"type:varchar(255);not null" json:"name"`
	UserEmail string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}
