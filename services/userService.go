package services

import (
	"LookInside/dto"
	"LookInside/repositories"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserService interface {
	GetValidUserByEmail(email string) (dto.UserResponseDto, error)
	GetUserByID(id uuid.UUID) (dto.UserResponseDto, error)
	CreateNewUser(user dto.UserResponseDto) (dto.UserResponseDto, error)
}

type UserServiceImpl struct {
	UserRepo repositories.UserRepository
}

func NewUserService(db *gorm.DB) UserService {
	return &UserServiceImpl{
		UserRepo: repositories.NewUserRepository(db),
	}
}

func (s *UserServiceImpl) GetValidUserByEmail(email string) (dto.UserResponseDto, error) {
	user, err := s.UserRepo.GetUserByEmail(email)
	if err != nil {
		return dto.UserResponseDto{}, err
	}

	if user.IsBlocked {
		return dto.UserResponseDto{}, errors.New("user is blocked")
	}

	userResponse := dto.FromUserModel(&user)
	return *userResponse, nil
}

func (s *UserServiceImpl) GetUserByID(id uuid.UUID) (dto.UserResponseDto, error) {
	user, err := s.UserRepo.GetUserByID(id)
	if err != nil {
		return dto.UserResponseDto{}, err
	}

	if user.IsBlocked {
		return dto.UserResponseDto{}, errors.New("user is blocked")
	}

	userResponse := dto.FromUserModel(&user)
	return *userResponse, nil
}

func (s *UserServiceImpl) CreateNewUser(user dto.UserResponseDto) (dto.UserResponseDto, error) {
	userModel := user.ToModel()
	created, err := s.UserRepo.CreateUSer(*userModel)
	if err != nil {
		return dto.UserResponseDto{}, err
	}
	resp := dto.FromUserModel(&created)
	return *resp, nil
}
