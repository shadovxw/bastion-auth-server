package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type SessionService struct {
	redis *redis.Client
	ttl   time.Duration
}

type SSOSession struct {
	UserID    string `json:"userId"`
	CreatedAt int64  `json:"createdAt"`
}

func NewSessionService(r *redis.Client, ttlHours int) *SessionService {
	return &SessionService{
		redis: r,
		ttl:   time.Duration(ttlHours) * time.Hour,
	}
}

func (s *SessionService) Create(ctx context.Context, userID string) (string, error) {
	sessionID := uuid.NewString()
	data, _ := json.Marshal(SSOSession{
		UserID:    userID,
		CreatedAt: time.Now().Unix(),
	})
	key := fmt.Sprintf("sso:%s", sessionID)
	if err := s.redis.Set(ctx, key, data, s.ttl).Err(); err != nil {
		return "", err
	}
	return sessionID, nil
}

func (s *SessionService) Get(ctx context.Context, sessionID string) (*SSOSession, error) {
	key := fmt.Sprintf("sso:%s", sessionID)
	val, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var sess SSOSession
	if err := json.Unmarshal([]byte(val), &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

func (s *SessionService) Delete(ctx context.Context, sessionID string) error {
	key := fmt.Sprintf("sso:%s", sessionID)
	return s.redis.Del(ctx, key).Err()
}
