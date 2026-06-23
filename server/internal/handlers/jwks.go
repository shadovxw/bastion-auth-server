package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
)

type JWKSHandler struct {
	tokenSvc *services.TokenService
}

func NewJWKSHandler(tokenSvc *services.TokenService) *JWKSHandler {
	return &JWKSHandler{tokenSvc: tokenSvc}
}

func (h *JWKSHandler) Handle(c *fiber.Ctx) error {
	jwks := h.tokenSvc.JWKS()
	return c.JSON(jwks)
}
