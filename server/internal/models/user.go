package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	DisplayName  string    `gorm:"not null" json:"displayName"`
	Avatar       string    `json:"avatar"`
	Provider     string    `gorm:"not null;default:'local'" json:"provider"`
	ProviderID   string    `gorm:"not null;default:''" json:"providerId"`
	PasswordHash *string   `gorm:"column:password_hash" json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}
