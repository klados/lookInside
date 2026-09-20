package services

import (
	"LookInside/dto"
	"LookInside/repositories"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const DesktopDemoSessionId = "sess_1758361252295_uoaokv4oe7"
const DesktopDemoCampaignId = "a0769f92-0894-4f49-8f07-1570f24ea6a0"
const MobileDemoCampaignId = "a0769f92-0894-4f49-8f07-1570f24ea6a0"
const MobileDemoSessionId = "sess_1758436411254_0tltopx6y7dc"

type StreamingService interface {
	InitConnectionDataInsert(data dto.InitConnectionStreamingDTO) error
	EventStreamingInsert(dtoData dto.EventArrayDTO) error
	GetEventsOfSession(userId uuid.UUID, projectId uuid.UUID, sessionId string) (dto.InitConnectionStreamingDTO, []dto.EventStreamingDTO, error)
	GetSessionsForTheDemo(isMobile bool) ([]dto.EventStreamingDTO, error)
	GetSessionsByCampaignId(userId uuid.UUID, campaignId uuid.UUID) ([]dto.InitConnectionStreamingDTO, error)
	CheckAndUpdateSessionRateLimit(campaignId uuid.UUID, sessionId string, campaignLimit int) (bool, error)
}

type StreamingServiceImpl struct {
	StreamingRepo repositories.StreamingRepository
	CampaignRepo  repositories.CampaignRepository
}

func NewStreamingService(db *gorm.DB, rd *redis.Client) StreamingService {
	return &StreamingServiceImpl{
		StreamingRepo: repositories.NewStreamingRepository(db, rd),
		CampaignRepo:  repositories.NewCampaignRepository(db, rd),
	}
}

func (s *StreamingServiceImpl) InitConnectionDataInsert(dtoData dto.InitConnectionStreamingDTO) error {
	data := dtoData.ToModel()
	data.CreatedAt = time.Now().UTC()
	return s.StreamingRepo.InitConnectionDataInsert(data)
}

func (s *StreamingServiceImpl) EventStreamingInsert(dtoData dto.EventArrayDTO) error {

	for _, event := range dtoData.Events {
		data := event.ToModel()
		data.CampaignID = dtoData.CampaignId
		data.SessionId = dtoData.SessionId
		data.CreatedAt = time.Now().UTC()
		err := s.StreamingRepo.EventStreamingInsert(data)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *StreamingServiceImpl) GetEventsOfSession(userId uuid.UUID, campaignId uuid.UUID, sessionId string) (dto.InitConnectionStreamingDTO, []dto.EventStreamingDTO, error) {
	userOwnsCampaign, err := s.CampaignRepo.CheckIfUserHasCampaign(userId, campaignId)

	if err != nil {
		return dto.InitConnectionStreamingDTO{}, nil, err
	}

	if !userOwnsCampaign {
		return dto.InitConnectionStreamingDTO{}, nil, errors.New("user does not own the campaign")
	}

	initData, err1 := s.StreamingRepo.GetInitConnectionData(campaignId, sessionId)
	if err1 != nil {
		return dto.InitConnectionStreamingDTO{}, nil, err1
	}

	events, err2 := s.StreamingRepo.GetEventStreamingData(campaignId, sessionId)
	if err2 != nil {
		return dto.InitConnectionStreamingDTO{}, nil, err2
	}

	initDataDTO := dto.FromInitConnectionStreamingModel(initData)

	var eventsDTO []dto.EventStreamingDTO
	for _, event := range events {
		eventsDTO = append(eventsDTO, *dto.FromEventStreamingModel(&event))
	}

	return *initDataDTO, eventsDTO, nil
}

// GetSessionsForTheDemo Use this function to display a demo at the landing page
func (s *StreamingServiceImpl) GetSessionsForTheDemo(isMobile bool) ([]dto.EventStreamingDTO, error) {
	var campaignId uuid.UUID
	var sessionId string

	if isMobile {
		campaignId = uuid.MustParse(MobileDemoCampaignId)
		sessionId = MobileDemoSessionId
	} else {
		campaignId = uuid.MustParse(DesktopDemoCampaignId)
		sessionId = DesktopDemoSessionId
	}
	events, err2 := s.StreamingRepo.GetEventStreamingData(campaignId, sessionId)
	if err2 != nil {
		return nil, err2
	}

	var eventsDTO []dto.EventStreamingDTO
	for _, event := range events {
		eventsDTO = append(eventsDTO, *dto.FromEventStreamingModel(&event))
	}

	return eventsDTO, nil
}

func (s *StreamingServiceImpl) GetSessionsByCampaignId(userId uuid.UUID, campaignId uuid.UUID) ([]dto.InitConnectionStreamingDTO, error) {
	userOwnsCampaign, err := s.CampaignRepo.CheckIfUserHasCampaign(userId, campaignId)

	if err != nil {
		return nil, err
	}

	if !userOwnsCampaign {
		return nil, errors.New("user does not own the campaign")
	}

	data, err := s.StreamingRepo.GetSessionsByCampaignId(campaignId)

	if err != nil {
		return nil, err
	}

	var dtoData []dto.InitConnectionStreamingDTO
	for _, initData := range data {
		dtoData = append(dtoData, *dto.FromInitConnectionStreamingModel(&initData))
	}

	return dtoData, nil
}

func (s *StreamingServiceImpl) CheckAndUpdateSessionRateLimit(campaignId uuid.UUID, sessionId string, campaignLimit int) (bool, error) {

	sessionIdsOfCampaign, err := s.StreamingRepo.GetDistinctSessionsForCampaign(campaignId)
	if err != nil {
		return false, err
	}

	for _, id := range sessionIdsOfCampaign {
		if id == sessionId {
			return true, nil
		}
	}

	if len(sessionIdsOfCampaign) >= campaignLimit {
		return false, nil
	}

	err = s.StreamingRepo.InsertSessionToCampaignRedis(campaignId, sessionId)
	if err != nil {
		return true, err
	}
	return true, nil
}
