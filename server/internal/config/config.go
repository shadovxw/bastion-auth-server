package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port string

	DatabaseURL string
	RedisURL    string

	JWTPrivateKeyPath string
	JWTPublicKeyPath  string
	JWTAccessTTL      int // seconds
	JWTRefreshTTLDays int

	CookieDomain   string
	CookieSecure   bool   // false on localhost, true in prod
	SessionTTLHours int

	GoogleClientID      string
	GoogleClientSecret  string
	GoogleRedirectURI   string

	GitHubClientID     string
	GitHubClientSecret string
	GitHubRedirectURI  string

	AdminPermission string
	AllowedEmails   []string // empty = open to everyone
}

func Load() *Config {
	_ = godotenv.Load()

	c := &Config{
		Port:              getEnv("PORT", "3001"),
		DatabaseURL:       mustEnv("DATABASE_URL"),
		RedisURL:          mustEnv("REDIS_URL"),
		JWTPrivateKeyPath: getEnv("JWT_PRIVATE_KEY_PATH", "./keys/private.pem"),
		JWTPublicKeyPath:  getEnv("JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
		JWTAccessTTL:      getEnvInt("JWT_ACCESS_TTL_SECONDS", 3600),
		JWTRefreshTTLDays: getEnvInt("JWT_REFRESH_TTL_DAYS", 30),
		CookieDomain:      getEnv("COOKIE_DOMAIN", ""),
		CookieSecure:      getEnv("COOKIE_SECURE", "false") == "true",
		SessionTTLHours:   getEnvInt("SESSION_TTL_HOURS", 24),
		GoogleClientID:     mustEnv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: mustEnv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURI:  mustEnv("GOOGLE_REDIRECT_URI"),
		GitHubClientID:     mustEnv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: mustEnv("GITHUB_CLIENT_SECRET"),
		GitHubRedirectURI:  mustEnv("GITHUB_REDIRECT_URI"),
		AdminPermission: getEnv("ADMIN_PERMISSION", "auth:admin"),
		AllowedEmails:   parseCSV(os.Getenv("ALLOWED_EMAILS")),
	}
	return c
}

func parseCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, strings.ToLower(t))
		}
	}
	return out
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return fallback
}
