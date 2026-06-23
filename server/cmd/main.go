package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/shadovxw/bastion/internal/config"
	"github.com/shadovxw/bastion/internal/db"
	"github.com/shadovxw/bastion/internal/handlers"
	"github.com/shadovxw/bastion/internal/handlers/admin"
	"github.com/shadovxw/bastion/internal/middleware"
	"github.com/shadovxw/bastion/internal/services"
	"github.com/shadovxw/bastion/internal/services/oauth"
)

func main() {
	cfg := config.Load()

	database := db.NewPostgres(cfg.DatabaseURL)
	redisClient := db.NewRedis(cfg.RedisURL)

	tokenSvc, err := services.NewTokenService(
		cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath,
		cfg.JWTAccessTTL, cfg.JWTRefreshTTLDays,
	)
	if err != nil {
		log.Fatalf("token service init: %v", err)
	}

	userSvc := services.NewUserService(database)
	rbacSvc := services.NewRBACService(database)
	appSvc := services.NewAppService(database)
	analyticsSvc := services.NewAnalyticsService(database)
	sessionSvc := services.NewSessionService(redisClient, cfg.SessionTTLHours)

	googleProvider := oauth.NewGoogleProvider(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
	githubProvider := oauth.NewGitHubProvider(cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.GitHubRedirectURI)

	oauthHandler := handlers.NewOAuthHandler(
		googleProvider, githubProvider,
		userSvc, rbacSvc, sessionSvc, tokenSvc,
		cfg.CookieDomain, cfg.CookieSecure,
		cfg.JWTAccessTTL, cfg.JWTRefreshTTLDays,
		cfg.AllowedEmails,
	)
	authorizeHandler := handlers.NewAuthorizeHandler(
		sessionSvc, tokenSvc, userSvc, rbacSvc, appSvc,
		cfg.CookieDomain, cfg.CookieSecure, cfg.JWTAccessTTL, cfg.WebURL,
	)
	authHandler := handlers.NewAuthHandler(
		tokenSvc, cfg.CookieDomain, cfg.CookieSecure, cfg.JWTAccessTTL,
	)
	jwksHandler := handlers.NewJWKSHandler(tokenSvc)

	adminApps := admin.NewAppsHandler(appSvc)
	adminUsers := admin.NewUsersHandler(userSvc, rbacSvc)
	adminRoles := admin.NewRolesHandler(rbacSvc)
	adminPerms := admin.NewPermissionsHandler(rbacSvc)
	adminGroups := admin.NewGroupsHandler(rbacSvc)
	adminAnalytics := admin.NewAnalyticsHandler(analyticsSvc)

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(middleware.CORS())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	app.Get("/.well-known/jwks.json", jwksHandler.Handle)

	// SSO entry point — apps redirect here
	app.Get("/authorize", authorizeHandler.Handle)

	// OAuth flows
	app.Get("/oauth/start/:provider", oauthHandler.Start)
	app.Get("/oauth/callback/:provider", oauthHandler.Callback)

	// Local auth (kept for internal tooling)
	app.Post("/auth/login", authHandler.Login)

	// Session
	app.Post("/session/logout", func(c *fiber.Ctx) error {
		for _, name := range []string{"auth_session", "auth_refresh", "sso_session"} {
			c.Cookie(&fiber.Cookie{
				Name: name, Value: "",
				Domain: cfg.CookieDomain, Path: "/",
				HTTPOnly: true, Secure: cfg.CookieSecure,
				SameSite: "Lax", MaxAge: -1,
			})
		}
		return c.JSON(fiber.Map{"status": "logged out"})
	})

	// Admin routes — require valid JWT + auth:admin permission
	adminGroup := app.Group("/admin",
		middleware.Auth(tokenSvc),
		middleware.RequirePermission(cfg.AdminPermission),
	)

	adminGroup.Get("/apps", adminApps.List)
	adminGroup.Post("/apps", adminApps.Create)
	adminGroup.Put("/apps/:id", adminApps.Update)
	adminGroup.Delete("/apps/:id", adminApps.Delete)

	adminGroup.Get("/users", adminUsers.List)
	adminGroup.Get("/users/:id", adminUsers.Get)
	adminGroup.Delete("/users/:id", adminUsers.Delete)
	adminGroup.Post("/users/:id/roles", adminUsers.AssignRole)
	adminGroup.Delete("/users/:id/roles/:roleId", adminUsers.RemoveRole)
	adminGroup.Post("/users/:id/groups", adminUsers.AssignGroup)
	adminGroup.Delete("/users/:id/groups/:groupId", adminUsers.RemoveGroup)

	adminGroup.Get("/roles", adminRoles.List)
	adminGroup.Post("/roles", adminRoles.Create)
	adminGroup.Put("/roles/:id", adminRoles.Update)
	adminGroup.Delete("/roles/:id", adminRoles.Delete)
	adminGroup.Post("/roles/:id/permissions", adminRoles.AddPermissions)
	adminGroup.Delete("/roles/:id/permissions/:permId", adminRoles.RemovePermission)

	adminGroup.Get("/permissions", adminPerms.List)
	adminGroup.Post("/permissions", adminPerms.Create)
	adminGroup.Delete("/permissions/:id", adminPerms.Delete)

	adminGroup.Get("/groups", adminGroups.List)
	adminGroup.Post("/groups", adminGroups.Create)
	adminGroup.Put("/groups/:id", adminGroups.Update)
	adminGroup.Delete("/groups/:id", adminGroups.Delete)
	adminGroup.Post("/groups/:id/roles", adminGroups.AddRoles)
	adminGroup.Delete("/groups/:id/roles/:roleId", adminGroups.RemoveRole)

	adminGroup.Get("/analytics/overview", adminAnalytics.Overview)
	adminGroup.Get("/analytics/users/by-provider", adminAnalytics.UsersByProvider)
	adminGroup.Get("/analytics/users/by-role", adminAnalytics.UsersByRole)
	adminGroup.Get("/analytics/users/by-group", adminAnalytics.UsersByGroup)
	adminGroup.Get("/analytics/users/by-app", adminAnalytics.UsersByApp)
	adminGroup.Get("/analytics/users/growth", adminAnalytics.UserGrowth)
	adminGroup.Get("/analytics/roles/by-permission-count", adminAnalytics.RolesByPermissionCount)
	adminGroup.Get("/analytics/permissions/by-role-count", adminAnalytics.PermissionsByRoleCount)

	log.Printf("Bastion server starting on :%s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
