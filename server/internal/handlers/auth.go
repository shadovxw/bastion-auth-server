package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
)

type AuthHandler struct {
	tokenSvc     *services.TokenService
	cookieDomain string
	cookieSecure bool
	accessTTL    int
}

func NewAuthHandler(
	tokenSvc *services.TokenService,
	cookieDomain string,
	cookieSecure bool,
	accessTTL int,
) *AuthHandler {
	return &AuthHandler{
		tokenSvc:     tokenSvc,
		cookieDomain: cookieDomain,
		cookieSecure: cookieSecure,
		accessTTL:    accessTTL,
	}
}

// POST /auth/login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	if body.Email != "admin@gmail.com" || body.Password != "password123" {
		return c.Status(401).JSON(fiber.Map{"error": "invalid credentials"})
	}

	token, err := h.tokenSvc.SignAccessToken(
		"00000000-0000-0000-0000-000000000001",
		"admin@bastion.local",
		"Admin",
		"",
		"local",
		"bastion-web",
		[]string{"admin"},
		[]string{"auth:admin"},
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token sign failed"})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "auth_session",
		Value:    token,
		Domain:   h.cookieDomain,
		Path:     "/",
		HTTPOnly: true,
		Secure:   h.cookieSecure,
		SameSite: "Lax",
		MaxAge:   h.accessTTL,
	})

	return c.JSON(fiber.Map{"ok": true})
}
