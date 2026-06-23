package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/services"
)

type GroupsHandler struct {
	rbacSvc *services.RBACService
}

func NewGroupsHandler(rbacSvc *services.RBACService) *GroupsHandler {
	return &GroupsHandler{rbacSvc: rbacSvc}
}

func (h *GroupsHandler) List(c *fiber.Ctx) error {
	groups, err := h.rbacSvc.ListGroups()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(groups)
}

func (h *GroupsHandler) Create(c *fiber.Ctx) error {
	var body struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	group, err := h.rbacSvc.CreateGroup(body.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(group)
}

func (h *GroupsHandler) Update(c *fiber.Ctx) error {
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
	group, err := h.rbacSvc.UpdateGroup(id, body.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(group)
}

func (h *GroupsHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.rbacSvc.DeleteGroup(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *GroupsHandler) AddRoles(c *fiber.Ctx) error {
	groupID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	var body struct {
		RoleIDs []string `json:"roleIds"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	roleIDs := make([]uuid.UUID, 0, len(body.RoleIDs))
	for _, rid := range body.RoleIDs {
		id, err := uuid.Parse(rid)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid role id: " + rid})
		}
		roleIDs = append(roleIDs, id)
	}
	if err := h.rbacSvc.AddRolesToGroup(groupID, roleIDs); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *GroupsHandler) RemoveRole(c *fiber.Ctx) error {
	groupID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid group id"})
	}
	roleID, err := uuid.Parse(c.Params("roleId"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid role id"})
	}
	if err := h.rbacSvc.RemoveRoleFromGroup(groupID, roleID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
