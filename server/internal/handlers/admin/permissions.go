package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/services"
)

type PermissionsHandler struct {
	rbacSvc *services.RBACService
}

func NewPermissionsHandler(rbacSvc *services.RBACService) *PermissionsHandler {
	return &PermissionsHandler{rbacSvc: rbacSvc}
}

func (h *PermissionsHandler) List(c *fiber.Ctx) error {
	perms, err := h.rbacSvc.ListPermissions()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(perms)
}

func (h *PermissionsHandler) Create(c *fiber.Ctx) error {
	var body struct {
		Name  string  `json:"name"`
		AppID *string `json:"appId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	perm, err := h.rbacSvc.CreatePermission(body.Name, body.AppID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(perm)
}

func (h *PermissionsHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.rbacSvc.DeletePermission(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
