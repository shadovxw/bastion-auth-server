package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/services"
)

type RolesHandler struct {
	rbacSvc *services.RBACService
}

func NewRolesHandler(rbacSvc *services.RBACService) *RolesHandler {
	return &RolesHandler{rbacSvc: rbacSvc}
}

func (h *RolesHandler) List(c *fiber.Ctx) error {
	roles, err := h.rbacSvc.ListRoles()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(roles)
}

func (h *RolesHandler) Create(c *fiber.Ctx) error {
	var body struct {
		Name  string  `json:"name"`
		AppID *string `json:"appId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	role, err := h.rbacSvc.CreateRole(body.Name, body.AppID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(role)
}

func (h *RolesHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	role, err := h.rbacSvc.UpdateRole(id, body.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(role)
}

func (h *RolesHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.rbacSvc.DeleteRole(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *RolesHandler) AddPermissions(c *fiber.Ctx) error {
	roleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	var body struct {
		PermissionIDs []string `json:"permissionIds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	permIDs := make([]uuid.UUID, 0, len(body.PermissionIDs))
	for _, pid := range body.PermissionIDs {
		id, err := uuid.Parse(pid)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid permission id: " + pid})
		}
		permIDs = append(permIDs, id)
	}
	if err := h.rbacSvc.AddPermissionsToRole(roleID, permIDs); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *RolesHandler) RemovePermission(c *fiber.Ctx) error {
	roleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid role id"})
	}
	permID, err := uuid.Parse(c.Params("permId"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid permission id"})
	}
	if err := h.rbacSvc.RemovePermissionFromRole(roleID, permID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
