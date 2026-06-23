package handlers

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/services"
)

type AuthorizeHandler struct {
	sessionSvc   *services.SessionService
	tokenSvc     *services.TokenService
	userSvc      *services.UserService
	rbacSvc      *services.RBACService
	appSvc       *services.AppService
	cookieDomain string
	cookieSecure bool
	accessTTL    int
	webURL       string
}

func NewAuthorizeHandler(
	sessionSvc *services.SessionService,
	tokenSvc *services.TokenService,
	userSvc *services.UserService,
	rbacSvc *services.RBACService,
	appSvc *services.AppService,
	cookieDomain string,
	cookieSecure bool,
	accessTTL int,
	webURL string,
) *AuthorizeHandler {
	return &AuthorizeHandler{
		sessionSvc:   sessionSvc,
		tokenSvc:     tokenSvc,
		userSvc:      userSvc,
		rbacSvc:      rbacSvc,
		appSvc:       appSvc,
		cookieDomain: cookieDomain,
		cookieSecure: cookieSecure,
		accessTTL:    accessTTL,
		webURL:       webURL,
	}
}

// GET /authorize?client_id=app1&return_to=https://app1.shadovx.me
func (h *AuthorizeHandler) Handle(c *fiber.Ctx) error {
	clientID := c.Query("client_id")
	returnTo := c.Query("return_to")

	if clientID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "client_id required"})
	}

	// Validate app exists and return_to is an allowed redirect URI
	app, err := h.appSvc.GetByID(clientID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unknown client_id"})
	}
	if returnTo != "" && !allowedRedirect(returnTo, app.RedirectURIs) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "redirect_uri not allowed"})
	}

	// Check for existing SSO session
	ssoSessionID := c.Cookies("sso_session")
	if ssoSessionID != "" {
		sess, err := h.sessionSvc.Get(c.Context(), ssoSessionID)
		if err == nil && sess != nil {
			// Valid SSO session — issue app token and redirect
			userID, err := uuid.Parse(sess.UserID)
			if err == nil {
				user, err := h.userSvc.GetByID(userID)
				if err == nil {
					rbac, err := h.rbacSvc.Resolve(userID, clientID)
					if err == nil {
						token, err := h.tokenSvc.SignAccessToken(
							user.ID.String(), user.Email, user.DisplayName,
							user.Avatar, user.Provider, clientID,
							rbac.Roles, rbac.Permissions,
						)
						if err == nil {
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
							if returnTo != "" {
								return c.Redirect(returnTo)
							}
							return c.JSON(fiber.Map{"status": "ok"})
						}
					}
				}
			}
		}
	}

	// No valid SSO session — redirect to the Next.js login page
	loginURL := fmt.Sprintf("%s/login?client_id=%s", h.webURL, clientID)
	if returnTo != "" {
		loginURL += fmt.Sprintf("&return_to=%s", returnTo)
	}
	return c.Redirect(loginURL)
}

// allowedRedirect returns true if returnTo starts with any registered redirect URI.
func allowedRedirect(returnTo string, allowed []string) bool {
	for _, uri := range allowed {
		if strings.HasPrefix(returnTo, uri) {
			return true
		}
	}
	return false
}
