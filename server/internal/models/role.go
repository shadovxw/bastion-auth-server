package models

import "github.com/google/uuid"

type Role struct {
	ID    uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name  string    `gorm:"not null" json:"name"`
	AppID *string   `json:"appId"`
	App   *App      `gorm:"foreignKey:AppID" json:"app,omitempty"`
}
