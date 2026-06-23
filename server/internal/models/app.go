package models

import (
	"time"

	"github.com/lib/pq"
)

type App struct {
	ID           string         `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	ClientSecret string         `gorm:"not null" json:"-"`
	RedirectURIs pq.StringArray `gorm:"type:text[]" json:"redirectUris"`
	CreatedAt    time.Time      `json:"createdAt"`
}
