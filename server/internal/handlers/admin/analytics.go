package admin

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/shadovxw/bastion/internal/services"
)

type AnalyticsHandler struct {
	svc *services.AnalyticsService
}

func NewAnalyticsHandler(svc *services.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{svc: svc}
}

func (h *AnalyticsHandler) Overview(c *fiber.Ctx) error {
	data, err := h.svc.GetOverview()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) UsersByProvider(c *fiber.Ctx) error {
	data, err := h.svc.GetUsersByProvider()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) UsersByRole(c *fiber.Ctx) error {
	data, err := h.svc.GetUsersByRole()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) UsersByGroup(c *fiber.Ctx) error {
	data, err := h.svc.GetUsersByGroup()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) UsersByApp(c *fiber.Ctx) error {
	data, err := h.svc.GetUsersByApp()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) UserGrowth(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}
	data, err := h.svc.GetUserGrowth(days)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) RolesByPermissionCount(c *fiber.Ctx) error {
	data, err := h.svc.GetRolesByPermissionCount()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

func (h *AnalyticsHandler) PermissionsByRoleCount(c *fiber.Ctx) error {
	data, err := h.svc.GetPermissionsByRoleCount()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}
