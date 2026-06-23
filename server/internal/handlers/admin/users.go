package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/services"
)

type UsersHandler struct {
	userSvc *services.UserService
	rbacSvc *services.RBACService
}

func NewUsersHandler(userSvc *services.UserService, rbacSvc *services.RBACService) *UsersHandler {
	return &UsersHandler{userSvc: userSvc, rbacSvc: rbacSvc}
}

func (h *UsersHandler) List(c *fiber.Ctx) error {
	users, err := h.userSvc.List()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

func (h *UsersHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	user, err := h.userSvc.GetByID(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(user)
}

func (h *UsersHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.userSvc.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *UsersHandler) AssignRole(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}
	var body struct {
		RoleID string  `json:"roleId"`
		AppID  *string `json:"appId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	roleID, err := uuid.Parse(body.RoleID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid role id"})
	}
	if err := h.rbacSvc.AssignRoleToUser(userID, roleID, body.AppID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *UsersHandler) RemoveRole(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}
	roleID, err := uuid.Parse(c.Params("roleId"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid role id"})
	}
	if err := h.rbacSvc.RemoveRoleFromUser(userID, roleID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *UsersHandler) AssignGroup(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}
	var body struct {
		GroupID string `json:"groupId"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	groupID, err := uuid.Parse(body.GroupID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid group id"})
	}
	if err := h.rbacSvc.AssignGroupToUser(userID, groupID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *UsersHandler) RemoveGroup(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}
	groupID, err := uuid.Parse(c.Params("groupId"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid group id"})
	}
	if err := h.rbacSvc.RemoveGroupFromUser(userID, groupID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
