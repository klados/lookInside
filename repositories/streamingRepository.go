package repositories

import (
	"LookInside/models"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type StreamingRepository interface {
	InitConnectionDataInsert(data *models.InitConnectionStreaming) error
	EventStreamingInsert(data *models.EventStreaming) error
	GetInitConnectionData(projectId uuid.UUID, sessionId string) (*models.InitConnectionStreaming, error)
	GetEventStreamingData(projectId uuid.UUID, sessionId string) ([]models.EventStreaming, error)
	GetSessionsByCampaignId(campaignId uuid.UUID) ([]models.InitConnectionStreaming, error)
	DeleteInitConnectionByCampaignId(campaignId uuid.UUID) error
	DeleteEventStreamingByCampaignId(campaignId uuid.UUID) error
	GetDistinctSessionsForCampaign(campaignId uuid.UUID) ([]string, error)
	InsertSessionToCampaignRedis(campaignId uuid.UUID, sessionId string) error
	GetEventSteamsForSpecificDateRange(from time.Time, to time.Time) ([]models.EventStreamingReport, error)
}

type StreamingRepositoryImpl struct {
	db *gorm.DB
	rd *redis.Client
}

func NewStreamingRepository(db *gorm.DB, rd *redis.Client) StreamingRepository {
	return &StreamingRepositoryImpl{
		db: db,
		rd: rd,
	}
}

func (r *StreamingRepositoryImpl) InitConnectionDataInsert(data *models.InitConnectionStreaming) error {
	result := r.db.Create(data)
	return result.Error
}

func (r *StreamingRepositoryImpl) EventStreamingInsert(data *models.EventStreaming) error {
	result := r.db.Create(data)
	return result.Error
}

func (r *StreamingRepositoryImpl) GetInitConnectionData(campaignId uuid.UUID, sessionId string) (*models.InitConnectionStreaming, error) {
	var data models.InitConnectionStreaming
	result := r.db.Where("campaign_id = ? AND session_id = ?", campaignId, sessionId).First(&data)
	return &data, result.Error
}

func (r *StreamingRepositoryImpl) GetEventStreamingData(campaignId uuid.UUID, sessionId string) ([]models.EventStreaming, error) {
	var data []models.EventStreaming
	result := r.db.Where("campaign_id = ? AND session_id = ?", campaignId, sessionId).Find(&data)
	return data, result.Error
}

func (r *StreamingRepositoryImpl) GetSessionsByCampaignId(campaignId uuid.UUID) ([]models.InitConnectionStreaming, error) {
	var data []models.InitConnectionStreaming
	result := r.db.Where("campaign_id = ?", campaignId).Find(&data)
	return data, result.Error
}

func (r *StreamingRepositoryImpl) DeleteInitConnectionByCampaignId(campaignId uuid.UUID) error {
	result := r.db.Where("campaign_id = ?", campaignId).Delete(&models.InitConnectionStreaming{})
	return result.Error
}

func (r *StreamingRepositoryImpl) DeleteEventStreamingByCampaignId(campaignId uuid.UUID) error {
	result := r.db.Where("campaign_id = ?", campaignId).Delete(&models.EventStreaming{})
	return result.Error
}

func (r *StreamingRepositoryImpl) GetDistinctSessionsForCampaign(campaignId uuid.UUID) ([]string, error) {
	ctx := context.Background()
	redisKey := fmt.Sprintf("campaign:sessions:%s", campaignId.String())

	// 1) Try Redis Set first (distinct by nature)
	members, err := r.rd.SMembers(ctx, redisKey).Result()
	if err == nil && len(members) > 0 {
		out := make([]string, 0, len(members))
		for _, m := range members {
			out = append(out, m)
		}
		if len(out) > 0 {
			return out, nil
		}
	}

	// 2) Fallback to DB and seed Redis
	var sessionIds []string
	result := r.db.Model(&models.InitConnectionStreaming{}).
		Where("campaign_id = ?", campaignId).
		Distinct("session_id").
		Pluck("session_id", &sessionIds)
	if result.Error != nil {
		return nil, result.Error
	}

	if len(sessionIds) > 0 {
		values := make([]interface{}, 0, len(sessionIds))
		for _, id := range sessionIds {
			values = append(values, id)
		}
		if _, err := r.rd.SAdd(ctx, redisKey, values...).Result(); err == nil {
			_ = r.rd.Expire(ctx, redisKey, time.Hour).Err()
		}
	}

	return sessionIds, nil
}

func (r *StreamingRepositoryImpl) InsertSessionToCampaignRedis(campaignId uuid.UUID, sessionId string) error {
	ctx := context.Background()
	redisKey := fmt.Sprintf("campaign:sessions:%s", campaignId.String())

	// SAdd ensures distinctness automatically
	if _, err := r.rd.SAdd(ctx, redisKey, sessionId).Result(); err != nil {
		return err
	}

	_ = r.rd.Expire(ctx, redisKey, time.Hour).Err()
	return nil
}

func (r *StreamingRepositoryImpl) GetEventSteamsForSpecificDateRange(from time.Time, to time.Time) ([]models.EventStreamingReport, error) {
	var rows []models.EventStreamingReport

	db := r.db.Table("event_streaming AS es").
		Select("u.email AS user_email, c.name AS campaign_name, COUNT(DISTINCT(es.campaign_id)) AS event_count").
		Joins("JOIN campaigns AS c ON c.id = es.campaign_id").
		Joins("JOIN users AS u ON u.id = c.user_id").
		Where("es.created_at >= ? AND es.created_at <= ?", from, to).
		Group("u.email, c.name")

	if err := db.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}
