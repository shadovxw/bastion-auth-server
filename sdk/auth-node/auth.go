package auth

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const userKey = "bastion_user"

// Client is the SDK entry point. Create one per app at startup.
type Client struct {
	cfg   Config
	jwks  *jwksCache
	Admin *AdminClient
}

// New creates a Bastion client. Call once at startup and reuse.
func New(cfg Config) *Client {
	c := &Client{
		cfg:  cfg,
		jwks: newJWKSCache(cfg.AuthServer),
	}
	c.Admin = &AdminClient{cfg: cfg}
	return c
}

// Middleware validates the auth_session cookie (or Authorization: Bearer header)
// and attaches the User to Fiber locals. Returns 401 if missing or invalid.
func (c *Client) Middleware() fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		user, err := c.extractUser(ctx)
		if err != nil {
			return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		ctx.Locals(userKey, user)
		return ctx.Next()
	}
}

// GetUser returns the authenticated user from the Fiber context.
// Must be called after Middleware(). Never returns nil inside a protected route.
func GetUser(ctx *fiber.Ctx) *User {
	u, _ := ctx.Locals(userKey).(*User)
	return u
}

// Require returns a middleware that enforces a single permission.
func (c *Client) Require(permission string) fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		user := GetUser(ctx)
		if user == nil {
			return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		if !user.HasPermission(permission) {
			return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": fmt.Sprintf("missing permission: %s", permission),
			})
		}
		return ctx.Next()
	}
}

// RequireRole returns a middleware that enforces a single role.
func (c *Client) RequireRole(role string) fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		user := GetUser(ctx)
		if user == nil {
			return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		if !user.HasRole(role) {
			return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": fmt.Sprintf("missing role: %s", role),
			})
		}
		return ctx.Next()
	}
}

// RequireAll returns a middleware that enforces ALL given permissions.
func (c *Client) RequireAll(permissions ...string) fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		user := GetUser(ctx)
		if user == nil {
			return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		for _, p := range permissions {
			if !user.HasPermission(p) {
				return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": fmt.Sprintf("missing permission: %s", p),
				})
			}
		}
		return ctx.Next()
	}
}

// RequireAny returns a middleware that enforces AT LEAST ONE of the given permissions.
func (c *Client) RequireAny(permissions ...string) fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		user := GetUser(ctx)
		if user == nil {
			return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		for _, p := range permissions {
			if user.HasPermission(p) {
				return ctx.Next()
			}
		}
		return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": fmt.Sprintf("missing one of: %s", strings.Join(permissions, ", ")),
		})
	}
}

// extractUser reads and verifies the JWT from the cookie or Authorization header.
func (c *Client) extractUser(ctx *fiber.Ctx) (*User, error) {
	tokenStr := ctx.Cookies("auth_session")
	if tokenStr == "" {
		if h := ctx.Get("Authorization"); len(h) > 7 && h[:7] == "Bearer " {
			tokenStr = h[7:]
		}
	}
	if tokenStr == "" {
		return nil, fmt.Errorf("no token")
	}
	return c.verifyToken(tokenStr)
}

// verifyToken validates an RS256 JWT against the cached JWKS.
func (c *Client) verifyToken(tokenStr string) (*User, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		kid, _ := token.Header["kid"].(string)
		return c.jwks.getKey(kid)
	}, jwt.WithValidMethods([]string{"RS256"}))
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	return claimsToUser(claims), nil
}

func claimsToUser(c jwt.MapClaims) *User {
	u := &User{
		ID:          stringClaim(c, "sub"),
		Email:       stringClaim(c, "email"),
		DisplayName: stringClaim(c, "displayName"),
		Avatar:      stringClaim(c, "avatar"),
		Provider:    stringClaim(c, "provider"),
		App:         stringClaim(c, "app"),
	}
	if exp, ok := c["exp"].(float64); ok {
		u.ExpiresAt = int64(exp)
	}
	u.Roles = stringSliceClaim(c, "roles")
	u.Permissions = stringSliceClaim(c, "permissions")
	return u
}

func stringClaim(c jwt.MapClaims, key string) string {
	v, _ := c[key].(string)
	return v
}

func stringSliceClaim(c jwt.MapClaims, key string) []string {
	raw, ok := c[key].([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
