package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/shadovxw/bastion/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AppService struct {
	db *gorm.DB
}

func NewAppService(db *gorm.DB) *AppService {
	return &AppService{db: db}
}

func (s *AppService) Create(id, name string, redirectURIs []string) (*models.App, string, error) {
	secret, err := generateSecret()
	if err != nil {
		return nil, "", err
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(secret), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", err
	}
	app := models.App{
		ID:           id,
		Name:         name,
		ClientSecret: string(hashed),
		RedirectURIs: redirectURIs,
	}
	if err := s.db.Create(&app).Error; err != nil {
		return nil, "", fmt.Errorf("create app: %w", err)
	}
	return &app, secret, nil
}

func (s *AppService) List() ([]models.App, error) {
	var apps []models.App
	err := s.db.Find(&apps).Error
	return apps, err
}

func (s *AppService) Update(id, name string, redirectURIs []string) (*models.App, error) {
	var app models.App
	if err := s.db.First(&app, "id = ?", id).Error; err != nil {
		return nil, err
	}
	app.Name = name
	app.RedirectURIs = redirectURIs
	s.db.Save(&app)
	return &app, nil
}

func (s *AppService) Delete(id string) error {
	return s.db.Delete(&models.App{}, "id = ?", id).Error
}

func (s *AppService) GetByID(id string) (*models.App, error) {
	var app models.App
	if err := s.db.First(&app, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &app, nil
}

func generateSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
