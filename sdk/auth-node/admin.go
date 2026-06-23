package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// AdminClient wraps all Bastion admin API endpoints.
// Calls are authenticated with the caller's JWT (Authorization: Bearer).
type AdminClient struct {
	cfg Config
}

// — Users —

type AdminUser struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Avatar      string `json:"avatar"`
	Provider    string `json:"provider"`
	CreatedAt   string `json:"createdAt"`
}

func (a *AdminClient) GetUsers(ctx context.Context, token string) ([]AdminUser, error) {
	var out []AdminUser
	return out, a.get(ctx, token, "/admin/users", &out)
}

func (a *AdminClient) GetUser(ctx context.Context, token, userID string) (*AdminUser, error) {
	var out AdminUser
	return &out, a.get(ctx, token, "/admin/users/"+userID, &out)
}

func (a *AdminClient) DeleteUser(ctx context.Context, token, userID string) error {
	return a.delete(ctx, token, "/admin/users/"+userID)
}

func (a *AdminClient) AssignRole(ctx context.Context, token, userID, roleID string, appID *string) error {
	return a.post(ctx, token, "/admin/users/"+userID+"/roles",
		map[string]interface{}{"roleId": roleID, "appId": appID}, nil)
}

func (a *AdminClient) RemoveRole(ctx context.Context, token, userID, roleID string) error {
	return a.delete(ctx, token, "/admin/users/"+userID+"/roles/"+roleID)
}

func (a *AdminClient) AssignGroup(ctx context.Context, token, userID, groupID string) error {
	return a.post(ctx, token, "/admin/users/"+userID+"/groups",
		map[string]interface{}{"groupId": groupID}, nil)
}

func (a *AdminClient) RemoveGroup(ctx context.Context, token, userID, groupID string) error {
	return a.delete(ctx, token, "/admin/users/"+userID+"/groups/"+groupID)
}

// — Roles —

type Role struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	AppID *string `json:"appId"`
}

func (a *AdminClient) GetRoles(ctx context.Context, token string) ([]Role, error) {
	var out []Role
	return out, a.get(ctx, token, "/admin/roles", &out)
}

func (a *AdminClient) CreateRole(ctx context.Context, token, name string, appID *string) (*Role, error) {
	var out Role
	return &out, a.post(ctx, token, "/admin/roles",
		map[string]interface{}{"name": name, "appId": appID}, &out)
}

func (a *AdminClient) DeleteRole(ctx context.Context, token, roleID string) error {
	return a.delete(ctx, token, "/admin/roles/"+roleID)
}

func (a *AdminClient) AddPermissionsToRole(ctx context.Context, token, roleID string, permissionIDs []string) error {
	return a.post(ctx, token, "/admin/roles/"+roleID+"/permissions",
		map[string]interface{}{"permissionIds": permissionIDs}, nil)
}

func (a *AdminClient) RemovePermissionFromRole(ctx context.Context, token, roleID, permID string) error {
	return a.delete(ctx, token, "/admin/roles/"+roleID+"/permissions/"+permID)
}

// — Permissions —

type Permission struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	AppID *string `json:"appId"`
}

func (a *AdminClient) GetPermissions(ctx context.Context, token string) ([]Permission, error) {
	var out []Permission
	return out, a.get(ctx, token, "/admin/permissions", &out)
}

func (a *AdminClient) CreatePermission(ctx context.Context, token, name string, appID *string) (*Permission, error) {
	var out Permission
	return &out, a.post(ctx, token, "/admin/permissions",
		map[string]interface{}{"name": name, "appId": appID}, &out)
}

func (a *AdminClient) DeletePermission(ctx context.Context, token, permID string) error {
	return a.delete(ctx, token, "/admin/permissions/"+permID)
}

// — Groups —

type Group struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (a *AdminClient) GetGroups(ctx context.Context, token string) ([]Group, error) {
	var out []Group
	return out, a.get(ctx, token, "/admin/groups", &out)
}

func (a *AdminClient) CreateGroup(ctx context.Context, token, name string) (*Group, error) {
	var out Group
	return &out, a.post(ctx, token, "/admin/groups",
		map[string]interface{}{"name": name}, &out)
}

func (a *AdminClient) DeleteGroup(ctx context.Context, token, groupID string) error {
	return a.delete(ctx, token, "/admin/groups/"+groupID)
}

func (a *AdminClient) AddRolesToGroup(ctx context.Context, token, groupID string, roleIDs []string) error {
	return a.post(ctx, token, "/admin/groups/"+groupID+"/roles",
		map[string]interface{}{"roleIds": roleIDs}, nil)
}

func (a *AdminClient) RemoveRoleFromGroup(ctx context.Context, token, groupID, roleID string) error {
	return a.delete(ctx, token, "/admin/groups/"+groupID+"/roles/"+roleID)
}

// — HTTP helpers —

func (a *AdminClient) get(ctx context.Context, token, path string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.cfg.AuthServer+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return a.do(req, out)
}

func (a *AdminClient) post(ctx context.Context, token, path string, body, out interface{}) error {
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.cfg.AuthServer+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return a.do(req, out)
}

func (a *AdminClient) delete(ctx context.Context, token, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, a.cfg.AuthServer+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return a.do(req, nil)
}

func (a *AdminClient) do(req *http.Request, out interface{}) error {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bastion admin %s %s: %d %s", req.Method, req.URL.Path, resp.StatusCode, body)
	}

	if out != nil && resp.StatusCode != http.StatusNoContent {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
