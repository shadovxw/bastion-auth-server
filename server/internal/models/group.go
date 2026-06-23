package models

import "github.com/google/uuid"

type Group struct {
	ID   uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name string    `gorm:"uniqueIndex;not null" json:"name"`
}

// Join tables

type RolePermission struct {
	RoleID       uuid.UUID `gorm:"primaryKey;type:uuid"`
	PermissionID uuid.UUID `gorm:"primaryKey;type:uuid"`
}

type GroupRole struct {
	GroupID uuid.UUID `gorm:"primaryKey;type:uuid"`
	RoleID  uuid.UUID `gorm:"primaryKey;type:uuid"`
}

type UserRole struct {
	UserID uuid.UUID `gorm:"primaryKey;type:uuid"`
	RoleID uuid.UUID `gorm:"primaryKey;type:uuid"`
	AppID  *string
}

type UserGroup struct {
	UserID  uuid.UUID `gorm:"primaryKey;type:uuid"`
	GroupID uuid.UUID `gorm:"primaryKey;type:uuid"`
}
