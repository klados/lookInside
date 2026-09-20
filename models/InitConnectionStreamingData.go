package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InitConnectionStreaming struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	CampaignId uuid.UUID `gorm:"type:uuid;not null;index" json:"campaign_id"`
	SessionId  string    `gorm:"type:varchar(255);not null;index" json:"session_id"`

	RemoteIpAddress     string `gorm:"type:varchar(50)" json:"remote_ip_address"`
	UserAgent           string `gorm:"type:varchar(512)" json:"user_agent"`
	Language            string `gorm:"type:varchar(100)" json:"language"`
	HardwareConcurrency string `gorm:"type:varchar(50)" json:"hardware_concurrency"`
	DeviceMemory        string `gorm:"type:varchar(50)" json:"device_memory"`
	MaxTouchPoints      string `gorm:"type:varchar(50)" json:"max_touch_points"`
	NetworkType         string `gorm:"type:varchar(100)" json:"network_type"`
	Geolocation         string `gorm:"type:text" json:"geolocation"`
	CookiesEnabled      bool   `gorm:"default:false" json:"cookies_enabled"`
	Webdriver           bool   `gorm:"default:false" json:"webdriver"`
	FullScreenEnabled   bool   `gorm:"default:false" json:"full_screen_enabled"`
	HasFocus            bool   `gorm:"default:false" json:"has_focus"`
	StorageEstimate     string `gorm:"type:text" json:"storage_estimate"`
	Timezone            string `gorm:"type:varchar(100)" json:"timezone"`
	LocaleTime          string `gorm:"type:varchar(100)" json:"locale_time"`
}
