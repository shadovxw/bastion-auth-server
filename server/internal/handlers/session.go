package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
)

type SessionHandler struct {
	sessionSvc   *services.SessionService
	cookieDomain string
	cookieSecure bool
}

func NewSessionHandler(sessionSvc *services.SessionService, cookieDomain string, cookieSecure bool) *SessionHandler {
	return &SessionHandler{sessionSvc: sessionSvc, cookieDomain: cookieDomain, cookieSecure: cookieSecure}
}

// POST /session/logout
func (h *SessionHandler) Logout(c *fiber.Ctx) error {
	ssoSessionID := c.Cookies("sso_session")
	if ssoSessionID != "" {
		_ = h.sessionSvc.Delete(c.Context(), ssoSessionID)
	}

	clearCookie := func(name string) {
		c.Cookie(&fiber.Cookie{
			Name:     name,
			Value:    "",
			Domain:   h.cookieDomain,
			Path:     "/",
			HTTPOnly: true,
			Secure:   h.cookieSecure,
			SameSite: "Lax",
			MaxAge:   -1,
		})
	}

	clearCookie("auth_session")
	clearCookie("auth_refresh")
	clearCookie("sso_session")

	return c.JSON(fiber.Map{"status": "logged out"})
}
