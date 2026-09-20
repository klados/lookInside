package repositories

import (
	"LookInside/models"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type CampaignRepository interface {
	GetCampaignById(id uuid.UUID) (*models.Campaign, error)
	CreateCampaign(data *models.Campaign) (uuid.UUID, error)
	GetAllUsersCampaign(id uuid.UUID) ([]models.Campaign, error)
	DeleteCampaignById(campaignId uuid.UUID) error
	CheckIfUserHasCampaign(userID uuid.UUID, campaignId uuid.UUID) (bool, error)
	GeNumberOfCampaignsForUser(id uuid.UUID) (int, error)
	GetCampaignsCreatedSpecificDateRange(from time.Time, to time.Time) ([]models.CampaignWithUserEmail, error)
}

type CampaignRepositoryImpl struct {
	db *gorm.DB
	rd *redis.Client
}

func NewCampaignRepository(db *gorm.DB, rd *redis.Client) CampaignRepository {
	return &CampaignRepositoryImpl{
		db: db,
		rd: rd,
	}
}

func (r *CampaignRepositoryImpl) GetCampaignById(id uuid.UUID) (*models.Campaign, error) {
	ctx := context.Background()
	key := fmt.Sprintf("campaigns:%s", id.String())

	// Try Redis first
	if cached, err := r.rd.Get(ctx, key).Bytes(); err == nil && len(cached) > 0 {
		var campaign models.Campaign
		if unmarshalErr := json.Unmarshal(cached, &campaign); unmarshalErr == nil {
			return &campaign, nil
		}
		// If unmarshal fails, fall through to DB and refresh the cache
	}

	// Fallback to DB
	var campaign models.Campaign
	result := r.db.Where("id = ?", id).First(&campaign)
	if result.Error != nil {
		return nil, result.Error
	}

	// Populate Redis with 1-hour TTL
	if r.rd != nil {
		if payload, err := json.Marshal(&campaign); err == nil {
			_ = r.rd.Set(ctx, key, payload, time.Hour).Err()
		}
	}

	return &campaign, nil
}

func (r *CampaignRepositoryImpl) CreateCampaign(data *models.Campaign) (uuid.UUID, error) {
	result := r.db.Create(data)
	return data.ID, result.Error
}

func (r *CampaignRepositoryImpl) GetAllUsersCampaign(id uuid.UUID) ([]models.Campaign, error) {
	var data []models.Campaign
	result := r.db.Where("user_id = ?", id).Find(&data)
	return data, result.Error
}

func (r *CampaignRepositoryImpl) DeleteCampaignById(campaignId uuid.UUID) error {
	result := r.db.Where("id = ?", campaignId).Delete(&models.Campaign{})
	return result.Error
}

func (r *CampaignRepositoryImpl) CheckIfUserHasCampaign(userID uuid.UUID, campaignId uuid.UUID) (bool, error) {
	var count int64
	result := r.db.Model(&models.Campaign{}).Where("user_id = ? AND id = ?", userID, campaignId).Count(&count)
	if result.Error != nil {
		return false, result.Error
	}
	return count > 0, nil
}

func (r *CampaignRepositoryImpl) GeNumberOfCampaignsForUser(id uuid.UUID) (int, error) {
	var count int64
	result := r.db.Model(&models.Campaign{}).Where("user_id = ?", id).Count(&count)
	if result.Error != nil {
		return 0, result.Error
	}
	return int(count), nil
}

func (r *CampaignRepositoryImpl) GetCampaignsCreatedSpecificDateRange(from time.Time, to time.Time) ([]models.CampaignWithUserEmail, error) {

	var results []models.CampaignWithUserEmail
	dbRes := r.db.
		Model(&models.Campaign{}).
		Select("campaigns.name, users.email AS user_email, campaigns.created_at").
		Joins("JOIN users ON users.id = campaigns.user_id").
		Where("campaigns.created_at >= ? AND campaigns.created_at <= ?", from, to).
		Find(&results)

	return results, dbRes.Error
}
