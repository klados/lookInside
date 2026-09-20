package dto

import (
	"LookInside/models"

	"github.com/google/uuid"
)

type UserRole string

type UserResponseDto struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Picture   string    `json:"picture"`
	Role      UserRole  `json:"role"`
	IsBlocked bool      `json:"is_blocked"`
}

func (dto *UserResponseDto) ToModel() *models.User {
	return &models.User{
		Name:    dto.Name,
		Email:   dto.Email,
		Picture: dto.Picture,
		Role:    models.UserRole(dto.Role),
	}
}

func FromUserModel(model *models.User) *UserResponseDto {
	return &UserResponseDto{
		ID:        model.ID,
		Email:     model.Email,
		Name:      model.Name,
		Picture:   model.Picture,
		Role:      UserRole(model.Role),
		IsBlocked: model.IsBlocked,
	}
}
