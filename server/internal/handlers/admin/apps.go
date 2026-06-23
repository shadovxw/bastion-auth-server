package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
)

type AppsHandler struct {
	appSvc *services.AppService
}

func NewAppsHandler(appSvc *services.AppService) *AppsHandler {
	return &AppsHandler{appSvc: appSvc}
}

func (h *AppsHandler) List(c *fiber.Ctx) error {
	apps, err := h.appSvc.List()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(apps)
}

func (h *AppsHandler) Create(c *fiber.Ctx) error {
	var body struct {
		ID           string   `json:"id"`
		Name         string   `json:"name"`
		RedirectURIs []string `json:"redirectUris"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	app, secret, err := h.appSvc.Create(body.ID, body.Name, body.RedirectURIs)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"app": app, "clientSecret": secret})
}

func (h *AppsHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		Name         string   `json:"name"`
		RedirectURIs []string `json:"redirectUris"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	app, err := h.appSvc.Update(id, body.Name, body.RedirectURIs)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(app)
}

func (h *AppsHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.appSvc.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
