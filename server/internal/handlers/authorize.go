package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/services"
)

type AuthorizeHandler struct {
	sessionSvc   *services.SessionService
	tokenSvc     *services.TokenService
	userSvc      *services.UserService
	rbacSvc      *services.RBACService
	cookieDomain string
	cookieSecure bool
	accessTTL    int
}

func NewAuthorizeHandler(
	sessionSvc *services.SessionService,
	tokenSvc *services.TokenService,
	userSvc *services.UserService,
	rbacSvc *services.RBACService,
	cookieDomain string,
	cookieSecure bool,
	accessTTL int,
) *AuthorizeHandler {
	return &AuthorizeHandler{
		sessionSvc:   sessionSvc,
		tokenSvc:     tokenSvc,
		userSvc:      userSvc,
		rbacSvc:      rbacSvc,
		cookieDomain: cookieDomain,
		cookieSecure: cookieSecure,
		accessTTL:    accessTTL,
	}
}

// GET /authorize?client_id=app1&return_to=https://app1.shadovx.me
func (h *AuthorizeHandler) Handle(c *fiber.Ctx) error {
	clientID := c.Query("client_id")
	returnTo := c.Query("return_to")

	if clientID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "client_id required"})
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

	// No valid SSO session — redirect to login page
	loginURL := fmt.Sprintf("/login?client_id=%s", clientID)
	if returnTo != "" {
		loginURL += fmt.Sprintf("&return_to=%s", returnTo)
	}
	return c.Redirect(loginURL)
}
