package services

import (
	"github.com/google/uuid"
	"github.com/shadovxw/bastion/internal/models"
	"gorm.io/gorm"
)

type RBACService struct {
	db *gorm.DB
}

func NewRBACService(db *gorm.DB) *RBACService {
	return &RBACService{db: db}
}

type ResolvedRBAC struct {
	Roles       []string
	Permissions []string
}

// Resolve returns all roles and permissions for a user in the context of an app.
// Includes platform-wide (app_id IS NULL) + app-scoped roles.
// Also resolves roles inherited via groups.
func (s *RBACService) Resolve(userID uuid.UUID, appID string) (*ResolvedRBAC, error) {
	roleIDs := map[uuid.UUID]bool{}

	// Direct user_roles: platform-wide OR app-scoped
	var directRoles []models.UserRole
	s.db.Where("user_id = ? AND (app_id IS NULL OR app_id = ?)", userID, appID).Find(&directRoles)
	for _, ur := range directRoles {
		roleIDs[ur.RoleID] = true
	}

	// Group-inherited roles
	var userGroups []models.UserGroup
	s.db.Where("user_id = ?", userID).Find(&userGroups)
	for _, ug := range userGroups {
		var groupRoles []models.GroupRole
		s.db.Where("group_id = ?", ug.GroupID).Find(&groupRoles)
		for _, gr := range groupRoles {
			roleIDs[gr.RoleID] = true
		}
	}

	if len(roleIDs) == 0 {
		return &ResolvedRBAC{Roles: []string{}, Permissions: []string{}}, nil
	}

	ids := make([]uuid.UUID, 0, len(roleIDs))
	for id := range roleIDs {
		ids = append(ids, id)
	}

	// Fetch role names
	var roles []models.Role
	s.db.Where("id IN ?", ids).Find(&roles)
	roleNames := make([]string, 0, len(roles))
	for _, r := range roles {
		roleNames = append(roleNames, r.Name)
	}

	// Fetch permissions via role_permissions
	var rps []models.RolePermission
	s.db.Where("role_id IN ?", ids).Find(&rps)
	permIDs := make([]uuid.UUID, 0, len(rps))
	for _, rp := range rps {
		permIDs = append(permIDs, rp.PermissionID)
	}

	permNames := []string{}
	if len(permIDs) > 0 {
		var perms []models.Permission
		s.db.Where("id IN ?", permIDs).Find(&perms)
		seen := map[string]bool{}
		for _, p := range perms {
			if !seen[p.Name] {
				permNames = append(permNames, p.Name)
				seen[p.Name] = true
			}
		}
	}

	return &ResolvedRBAC{Roles: roleNames, Permissions: permNames}, nil
}

// --- Role CRUD ---

func (s *RBACService) CreateRole(name string, appID *string) (*models.Role, error) {
	role := models.Role{ID: uuid.New(), Name: name, AppID: appID}
	if err := s.db.Create(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (s *RBACService) ListRoles() ([]models.Role, error) {
	var roles []models.Role
	err := s.db.Find(&roles).Error
	return roles, err
}

func (s *RBACService) UpdateRole(id uuid.UUID, name string) (*models.Role, error) {
	var role models.Role
	if err := s.db.First(&role, "id = ?", id).Error; err != nil {
		return nil, err
	}
	role.Name = name
	s.db.Save(&role)
	return &role, nil
}

func (s *RBACService) DeleteRole(id uuid.UUID) error {
	return s.db.Delete(&models.Role{}, "id = ?", id).Error
}

func (s *RBACService) AddPermissionsToRole(roleID uuid.UUID, permIDs []uuid.UUID) error {
	for _, pid := range permIDs {
		rp := models.RolePermission{RoleID: roleID, PermissionID: pid}
		s.db.FirstOrCreate(&rp, rp)
	}
	return nil
}

func (s *RBACService) RemovePermissionFromRole(roleID, permID uuid.UUID) error {
	return s.db.Delete(&models.RolePermission{}, "role_id = ? AND permission_id = ?", roleID, permID).Error
}

// --- Permission CRUD ---

func (s *RBACService) CreatePermission(name string, appID *string) (*models.Permission, error) {
	perm := models.Permission{ID: uuid.New(), Name: name, AppID: appID}
	if err := s.db.Create(&perm).Error; err != nil {
		return nil, err
	}
	return &perm, nil
}

func (s *RBACService) ListPermissions() ([]models.Permission, error) {
	var perms []models.Permission
	err := s.db.Find(&perms).Error
	return perms, err
}

func (s *RBACService) DeletePermission(id uuid.UUID) error {
	return s.db.Delete(&models.Permission{}, "id = ?", id).Error
}

// --- Group CRUD ---

func (s *RBACService) CreateGroup(name string) (*models.Group, error) {
	g := models.Group{ID: uuid.New(), Name: name}
	if err := s.db.Create(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *RBACService) ListGroups() ([]models.Group, error) {
	var groups []models.Group
	err := s.db.Find(&groups).Error
	return groups, err
}

func (s *RBACService) UpdateGroup(id uuid.UUID, name string) (*models.Group, error) {
	var g models.Group
	if err := s.db.First(&g, "id = ?", id).Error; err != nil {
		return nil, err
	}
	g.Name = name
	s.db.Save(&g)
	return &g, nil
}

func (s *RBACService) DeleteGroup(id uuid.UUID) error {
	return s.db.Delete(&models.Group{}, "id = ?", id).Error
}

func (s *RBACService) AddRolesToGroup(groupID uuid.UUID, roleIDs []uuid.UUID) error {
	for _, rid := range roleIDs {
		gr := models.GroupRole{GroupID: groupID, RoleID: rid}
		s.db.FirstOrCreate(&gr, gr)
	}
	return nil
}

func (s *RBACService) RemoveRoleFromGroup(groupID, roleID uuid.UUID) error {
	return s.db.Delete(&models.GroupRole{}, "group_id = ? AND role_id = ?", groupID, roleID).Error
}

// --- User assignments ---

func (s *RBACService) AssignRoleToUser(userID, roleID uuid.UUID, appID *string) error {
	ur := models.UserRole{UserID: userID, RoleID: roleID, AppID: appID}
	return s.db.FirstOrCreate(&ur, ur).Error
}

func (s *RBACService) RemoveRoleFromUser(userID, roleID uuid.UUID) error {
	return s.db.Delete(&models.UserRole{}, "user_id = ? AND role_id = ?", userID, roleID).Error
}

func (s *RBACService) AssignGroupToUser(userID, groupID uuid.UUID) error {
	ug := models.UserGroup{UserID: userID, GroupID: groupID}
	return s.db.FirstOrCreate(&ug, ug).Error
}

func (s *RBACService) RemoveGroupFromUser(userID, groupID uuid.UUID) error {
	return s.db.Delete(&models.UserGroup{}, "user_id = ? AND group_id = ?", userID, groupID).Error
}
