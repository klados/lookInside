package services

import (
	"LookInside/dto"
	"LookInside/repositories"
	"errors"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type CampaignService interface {
	GetCampaignById(campaignId uuid.UUID) (*dto.CampaignDTO, error)
	CreateCampaign(userID uuid.UUID, dtoData dto.CampaignDTO) (uuid.UUID, error)
	GetAllUsersCampaign(userId uuid.UUID) ([]dto.CampaignDTO, error)
	DeleteCampaignById(userId uuid.UUID, id uuid.UUID) error
	GeNumberOfCampaignsForUser(id uuid.UUID) (int, error)
	CreateReportWithNewCampaignsAndSessions(from time.Time, to time.Time) (dto.ReportDTO, error)
}

type CampaignServiceImpl struct {
	CampaignRepo  repositories.CampaignRepository
	StreamingRepo repositories.StreamingRepository
	db            *gorm.DB
}

func NewCampaignService(db *gorm.DB, rd *redis.Client) CampaignService {
	return &CampaignServiceImpl{
		CampaignRepo:  repositories.NewCampaignRepository(db, rd),
		StreamingRepo: repositories.NewStreamingRepository(db, rd),
		db:            db,
	}
}

func (c *CampaignServiceImpl) GetCampaignById(campaignId uuid.UUID) (*dto.CampaignDTO, error) {
	campaign, err := c.CampaignRepo.GetCampaignById(campaignId)

	return dto.FromCampaignModel(campaign), err
}

func (c *CampaignServiceImpl) CreateCampaign(userID uuid.UUID, dtoData dto.CampaignDTO) (uuid.UUID, error) {
	data := dtoData.ToModel()
	data.UserID = userID
	data.CreatedAt = time.Now().UTC()
	return c.CampaignRepo.CreateCampaign(data)
}

func (c *CampaignServiceImpl) GetAllUsersCampaign(userId uuid.UUID) ([]dto.CampaignDTO, error) {
	campaigns, err := c.CampaignRepo.GetAllUsersCampaign(userId)
	if err != nil {
		return nil, err
	}

	var campaignDTOs []dto.CampaignDTO
	for _, campaign := range campaigns {
		campaignDTO := dto.FromCampaignModel(&campaign)
		campaignDTOs = append(campaignDTOs, *campaignDTO)
	}

	return campaignDTOs, nil
}

func (c *CampaignServiceImpl) DeleteCampaignById(userId uuid.UUID, campaignId uuid.UUID) error {
	// Start a database transaction
	tx := c.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	// Defer rollback in case of error
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// check if user owns the campaign
	if userOwnCampaign, err := c.CampaignRepo.CheckIfUserHasCampaign(userId, campaignId); err != nil {
		tx.Rollback()
		return err
	} else if !userOwnCampaign {
		return errors.New("user does not own the campaign")
	}

	// Delete streaming data first (due to foreign key constraints)
	if err := c.StreamingRepo.DeleteEventStreamingByCampaignId(campaignId); err != nil {
		tx.Rollback()
		return err
	}

	if err := c.StreamingRepo.DeleteInitConnectionByCampaignId(campaignId); err != nil {
		tx.Rollback()
		return err
	}

	// Delete the campaign
	if err := c.CampaignRepo.DeleteCampaignById(campaignId); err != nil {
		tx.Rollback()
		return err
	}

	// Commit the transaction
	return tx.Commit().Error
}

func (c *CampaignServiceImpl) GeNumberOfCampaignsForUser(id uuid.UUID) (int, error) {
	num, err := c.CampaignRepo.GeNumberOfCampaignsForUser(id)
	if err != nil {
		log.Printf("GetNumberOfCampaignsForUser error for user %s: %v", id, err)
		return 0, errors.New("error while getting number of campaigns")
	}
	return num, nil
}

func (c *CampaignServiceImpl) CreateReportWithNewCampaignsAndSessions(from time.Time, to time.Time) (dto.ReportDTO, error) {
	// Ensure valid order: from <= to
	if to.Before(from) {
		from, to = to, from
	}

	campaigns, err := c.CampaignRepo.GetCampaignsCreatedSpecificDateRange(from, to)
	if err != nil {
		return dto.ReportDTO{}, err
	}

	streamingData, err := c.StreamingRepo.GetEventSteamsForSpecificDateRange(from, to)
	if err != nil {
		return dto.ReportDTO{}, err
	}

	return dto.ReportDTO{
		Campaigns:             dto.ToCampaignWithUserEmailDTOs(campaigns),
		EventStreamingReports: dto.ToEventStreamingReport(streamingData),
	}, nil
}
