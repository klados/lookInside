package repositories

import (
	"LookInside/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository interface {
	GetUserByEmail(email string) (models.User, error)
	GetUserByID(id uuid.UUID) (models.User, error)
	CreateUSer(user models.User) (models.User, error)
}

type userRepositoryImpl struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepositoryImpl{
		db: db,
	}
}

func (u *userRepositoryImpl) GetUserByEmail(email string) (models.User, error) {
	var user models.User
	err := u.db.Where("email = ?", email).First(&user).Error
	return user, err
}

func (u *userRepositoryImpl) GetUserByID(id uuid.UUID) (models.User, error) {
	var user models.User
	err := u.db.Where("id = ?", id).First(&user).Error
	return user, err
}

func (u *userRepositoryImpl) CreateUSer(user models.User) (models.User, error) {
	err := u.db.Create(&user).Error
	return user, err
}
