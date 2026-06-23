const BASE = process.env.NEXT_PUBLIC_AUTH_SERVER ?? "http://localhost:3001"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? "Request failed")
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  analytics: {
    overview: () => request("/admin/analytics/overview"),
    usersByProvider: () => request("/admin/analytics/users/by-provider"),
    usersByRole: () => request("/admin/analytics/users/by-role"),
    usersByGroup: () => request("/admin/analytics/users/by-group"),
    usersByApp: () => request("/admin/analytics/users/by-app"),
    userGrowth: (days = 30) => request(`/admin/analytics/users/growth?days=${days}`),
    rolesByPermissionCount: () => request("/admin/analytics/roles/by-permission-count"),
    permissionsByRoleCount: () => request("/admin/analytics/permissions/by-role-count"),
  },
  apps: {
    list: () => request("/admin/apps"),
    create: (body: { id: string; name: string; redirectUris: string[] }) =>
      request("/admin/apps", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; redirectUris: string[] }) =>
      request(`/admin/apps/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request(`/admin/apps/${id}`, { method: "DELETE" }),
  },
  users: {
    list: () => request("/admin/users"),
    get: (id: string) => request(`/admin/users/${id}`),
    delete: (id: string) => request(`/admin/users/${id}`, { method: "DELETE" }),
    assignRole: (userId: string, roleId: string, appId?: string) =>
      request(`/admin/users/${userId}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleId, appId: appId ?? null }),
      }),
    removeRole: (userId: string, roleId: string) =>
      request(`/admin/users/${userId}/roles/${roleId}`, { method: "DELETE" }),
    assignGroup: (userId: string, groupId: string) =>
      request(`/admin/users/${userId}/groups`, {
        method: "POST",
        body: JSON.stringify({ groupId }),
      }),
    removeGroup: (userId: string, groupId: string) =>
      request(`/admin/users/${userId}/groups/${groupId}`, { method: "DELETE" }),
  },
  roles: {
    list: () => request("/admin/roles"),
    create: (body: { name: string; appId?: string | null }) =>
      request("/admin/roles", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, name: string) =>
      request(`/admin/roles/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    delete: (id: string) => request(`/admin/roles/${id}`, { method: "DELETE" }),
    addPermissions: (roleId: string, permissionIds: string[]) =>
      request(`/admin/roles/${roleId}/permissions`, {
        method: "POST",
        body: JSON.stringify({ permissionIds }),
      }),
    removePermission: (roleId: string, permId: string) =>
      request(`/admin/roles/${roleId}/permissions/${permId}`, { method: "DELETE" }),
  },
  permissions: {
    list: () => request("/admin/permissions"),
    create: (body: { name: string; appId?: string | null }) =>
      request("/admin/permissions", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/admin/permissions/${id}`, { method: "DELETE" }),
  },
  groups: {
    list: () => request("/admin/groups"),
    create: (name: string) =>
      request("/admin/groups", { method: "POST", body: JSON.stringify({ name }) }),
    update: (id: string, name: string) =>
      request(`/admin/groups/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    delete: (id: string) => request(`/admin/groups/${id}`, { method: "DELETE" }),
    addRoles: (groupId: string, roleIds: string[]) =>
      request(`/admin/groups/${groupId}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleIds }),
      }),
    removeRole: (groupId: string, roleId: string) =>
      request(`/admin/groups/${groupId}/roles/${roleId}`, { method: "DELETE" }),
  },
}
