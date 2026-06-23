package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
)

func Auth(tokenSvc *services.TokenService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies("auth_session")
		if token == "" {
			// Fall back to Authorization: Bearer <token>
			if h := c.Get("Authorization"); len(h) > 7 && h[:7] == "Bearer " {
				token = h[7:]
			}
		}
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		claims, err := tokenSvc.Verify(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}
		c.Locals("claims", claims)
		return c.Next()
	}
}

func RequirePermission(permission string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		claims, ok := c.Locals("claims").(*services.Claims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		for _, p := range claims.Permissions {
			if p == permission {
				return c.Next()
			}
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
}
