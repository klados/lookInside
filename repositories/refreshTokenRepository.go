package repositories

import (
	"LookInside/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RefreshTokenRepository interface {
	CreateRefreshToken(userID uuid.UUID, token string, expiresAt time.Time, userAgent, ipAddress string) (*models.RefreshToken, error)
	FindByToken(token string) (*models.RefreshToken, error)
	RevokeToken(token string) error
	RevokeAllUserTokens(userID uuid.UUID) error
	CleanExpiredTokens() error
	GetUserTokens(userID uuid.UUID) ([]models.RefreshToken, error)
}

type RefreshTokenRepositoryImpl struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) RefreshTokenRepository {
	return &RefreshTokenRepositoryImpl{db: db}
}

func (r *RefreshTokenRepositoryImpl) CreateRefreshToken(userID uuid.UUID, token string, expiresAt time.Time, userAgent, ipAddress string) (*models.RefreshToken, error) {
	refreshToken := &models.RefreshToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: expiresAt,
		UserAgent: userAgent,
		IPAddress: ipAddress,
	}

	if err := r.db.Create(refreshToken).Error; err != nil {
		return nil, err
	}

	return refreshToken, nil
}

func (r *RefreshTokenRepositoryImpl) FindByToken(token string) (*models.RefreshToken, error) {
	var refreshToken models.RefreshToken
	err := r.db.Where("token = ? AND is_revoked = ? AND expires_at > ?", token, false, time.Now()).First(&refreshToken).Error
	if err != nil {
		return nil, err
	}

	return &refreshToken, nil
}

func (r *RefreshTokenRepositoryImpl) RevokeToken(token string) error {
	return r.db.Model(&models.RefreshToken{}).Where("token = ?", token).Update("is_revoked", true).Error
}

func (r *RefreshTokenRepositoryImpl) RevokeAllUserTokens(userID uuid.UUID) error {
	return r.db.Model(&models.RefreshToken{}).Where("user_id = ?", userID).Update("is_revoked", true).Error
}

func (r *RefreshTokenRepositoryImpl) CleanExpiredTokens() error {
	return r.db.Where("expires_at < ?", time.Now()).Delete(&models.RefreshToken{}).Error
}

func (r *RefreshTokenRepositoryImpl) GetUserTokens(userID uuid.UUID) ([]models.RefreshToken, error) {
	var tokens []models.RefreshToken
	err := r.db.Where("user_id = ? AND is_revoked = ?", userID, false).Find(&tokens).Error
	return tokens, err
}
