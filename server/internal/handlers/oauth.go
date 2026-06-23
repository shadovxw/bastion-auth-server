package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
	"github.com/shadovxw/bastion/internal/services/oauth"
)

type OAuthHandler struct {
	google         *oauth.GoogleProvider
	github         *oauth.GitHubProvider
	userSvc        *services.UserService
	rbacSvc        *services.RBACService
	sessionSvc     *services.SessionService
	tokenSvc       *services.TokenService
	cookieDomain   string
	cookieSecure   bool
	accessTTL      int
	refreshTTL     int
}

func NewOAuthHandler(
	google *oauth.GoogleProvider,
	github *oauth.GitHubProvider,
	userSvc *services.UserService,
	rbacSvc *services.RBACService,
	sessionSvc *services.SessionService,
	tokenSvc *services.TokenService,
	cookieDomain string,
	cookieSecure bool,
	accessTTL int,
	refreshTTLDays int,
) *OAuthHandler {
	return &OAuthHandler{
		google:       google,
		github:       github,
		userSvc:      userSvc,
		rbacSvc:      rbacSvc,
		sessionSvc:   sessionSvc,
		tokenSvc:     tokenSvc,
		cookieDomain: cookieDomain,
		cookieSecure: cookieSecure,
		accessTTL:    accessTTL,
		refreshTTL:   refreshTTLDays * 86400,
	}
}

// GET /oauth/start/:provider?client_id=app1&return_to=...
func (h *OAuthHandler) Start(c *fiber.Ctx) error {
	provider := c.Params("provider")
	clientID := c.Query("client_id", "")
	returnTo := c.Query("return_to", "")

	state := fmt.Sprintf("%s|%s|%s", provider, clientID, returnTo)

	var authURL string
	switch provider {
	case "google":
		authURL = h.google.AuthURL(state)
	case "github":
		authURL = h.github.AuthURL(state)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unknown provider"})
	}
	return c.Redirect(authURL)
}

// GET /oauth/callback/:provider?code=...&state=...
func (h *OAuthHandler) Callback(c *fiber.Ctx) error {
	provider := c.Params("provider")
	code := c.Query("code")
	state := c.Query("state")

	// Parse state: provider|clientID|returnTo
	var parsedProvider, clientID, returnTo string
	fmt.Sscanf(state, "%s", &parsedProvider)
	// Simple state parse
	parts := splitState(state)
	if len(parts) >= 3 {
		clientID = parts[1]
		returnTo = parts[2]
	}

	var (
		email       string
		displayName string
		avatar      string
		providerID  string
	)

	switch provider {
	case "google":
		u, err := h.google.Exchange(c.Context(), code)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "google exchange failed"})
		}
		email, displayName, avatar, providerID = u.Email, u.Name, u.Picture, u.Sub
	case "github":
		u, err := h.github.Exchange(c.Context(), code)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "github exchange failed"})
		}
		email, displayName, avatar, providerID = u.Email, u.Name, u.AvatarURL, fmt.Sprintf("%d", u.ID)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unknown provider"})
	}

	user, err := h.userSvc.UpsertUser(provider, providerID, email, displayName, avatar)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "user upsert failed"})
	}

	rbac, err := h.rbacSvc.Resolve(user.ID, clientID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "rbac resolution failed"})
	}

	accessToken, err := h.tokenSvc.SignAccessToken(
		user.ID.String(), user.Email, user.DisplayName,
		user.Avatar, user.Provider, clientID,
		rbac.Roles, rbac.Permissions,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "token sign failed"})
	}

	refreshToken, err := h.tokenSvc.SignRefreshToken(user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "refresh token sign failed"})
	}

	// Create SSO session
	sessionID, err := h.sessionSvc.Create(c.Context(), user.ID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "session create failed"})
	}

	// Set SSO session cookie
	c.Cookie(&fiber.Cookie{
		Name:     "sso_session",
		Value:    sessionID,
		Domain:   h.cookieDomain,
		Path:     "/",
		HTTPOnly: true,
		Secure:   h.cookieSecure,
		SameSite: "Lax",
		MaxAge:   86400 * 30,
	})

	// Set access token cookie
	c.Cookie(&fiber.Cookie{
		Name:     "auth_session",
		Value:    accessToken,
		Domain:   h.cookieDomain,
		Path:     "/",
		HTTPOnly: true,
		Secure:   h.cookieSecure,
		SameSite: "Lax",
		MaxAge:   h.accessTTL,
	})

	// Set refresh token cookie
	c.Cookie(&fiber.Cookie{
		Name:     "auth_refresh",
		Value:    refreshToken,
		Domain:   h.cookieDomain,
		Path:     "/",
		HTTPOnly: true,
		Secure:   h.cookieSecure,
		SameSite: "Lax",
		MaxAge:   h.refreshTTL,
	})

	if returnTo != "" {
		return c.Redirect(returnTo)
	}
	return c.Redirect("/")
}

func splitState(state string) []string {
	// state format: "provider|clientID|returnTo"
	parts := make([]string, 0, 3)
	cur := ""
	for _, ch := range state {
		if ch == '|' {
			parts = append(parts, cur)
			cur = ""
		} else {
			cur += string(ch)
		}
	}
	parts = append(parts, cur)
	return parts
}
