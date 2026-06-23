package services

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/models"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// UpsertUser finds or creates a user by (provider, providerID).
// If the email exists under a different provider, it links them (merge).
func (s *UserService) UpsertUser(provider, providerID, email, displayName, avatar string) (*models.User, error) {
	var user models.User

	// First try by (provider, providerID)
	err := s.db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&user).Error
	if err == nil {
		// Update mutable fields in case they changed
		s.db.Model(&user).Updates(map[string]interface{}{
			"display_name": displayName,
			"avatar":       avatar,
		})
		return &user, nil
	}

	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("lookup user: %w", err)
	}

	// Try by email (different provider — merge)
	err = s.db.Where("email = ?", email).First(&user).Error
	if err == nil {
		// Link this provider to the existing account
		s.db.Model(&user).Updates(map[string]interface{}{
			"provider":     provider,
			"provider_id":  providerID,
			"display_name": displayName,
			"avatar":       avatar,
		})
		return &user, nil
	}

	// New user
	user = models.User{
		ID:          uuid.New(),
		Email:       email,
		DisplayName: displayName,
		Avatar:      avatar,
		Provider:    provider,
		ProviderID:  providerID,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &user, nil
}

func (s *UserService) GetByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) List() ([]models.User, error) {
	var users []models.User
	if err := s.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (s *UserService) Delete(id uuid.UUID) error {
	return s.db.Delete(&models.User{}, "id = ?", id).Error
}
