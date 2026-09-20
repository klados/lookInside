package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRole string

const (
	UserRoleUser  UserRole = "user"
	UserRoleAdmin UserRole = "admin"
)

type User struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email     string         `json:"email" gorm:"uniqueIndex;not null;size:255" validate:"required,email"`
	Name      string         `json:"name" gorm:"not null;size:100" validate:"required,min=1,max=100"`
	Picture   string         `json:"picture" gorm:"size:500" validate:"omitempty,url"`
	IsBlocked bool           `json:"is_blocked" gorm:"default:false;index"`
	Role      UserRole       `json:"role" gorm:"type:varchar(50);default:'user';index" validate:"oneof=user admin"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

type UserResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Picture   string    `json:"picture"`
	Role      UserRole  `json:"role"`
	IsBlocked bool      `json:"is_blocked"`
}
