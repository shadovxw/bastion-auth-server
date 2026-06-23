import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type {
  User, App, Role, Permission, Group,
  AnalyticsOverview, LabelCount, DayCount,
} from "./types"

export const bastionApi = createApi({
  reducerPath: "bastionApi",
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_AUTH_SERVER ?? "http://localhost:3001",
    credentials: "include",
    prepareHeaders: (headers) => {
      headers.set("Content-Type", "application/json")
      return headers
    },
  }),
  tagTypes: ["User", "App", "Role", "Permission", "Group"],
  endpoints: (builder) => ({
    // --- Apps ---
    listApps: builder.query<App[], void>({
      query: () => "/admin/apps",
      providesTags: ["App"],
    }),
    createApp: builder.mutation<{ app: App; clientSecret: string }, { id: string; name: string; redirectUris: string[] }>({
      query: (body) => ({ url: "/admin/apps", method: "POST", body }),
      invalidatesTags: ["App"],
    }),
    updateApp: builder.mutation<App, { id: string; name: string; redirectUris: string[] }>({
      query: ({ id, ...body }) => ({ url: `/admin/apps/${id}`, method: "PUT", body }),
      invalidatesTags: ["App"],
    }),
    deleteApp: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/apps/${id}`, method: "DELETE" }),
      invalidatesTags: ["App"],
    }),

    // --- Users ---
    listUsers: builder.query<User[], void>({
      query: () => "/admin/users",
      providesTags: ["User"],
    }),
    getUser: builder.query<User, string>({
      query: (id) => `/admin/users/${id}`,
      providesTags: (_, __, id) => [{ type: "User", id }],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
    assignRoleToUser: builder.mutation<void, { userId: string; roleId: string; appId?: string | null }>({
      query: ({ userId, roleId, appId }) => ({
        url: `/admin/users/${userId}/roles`,
        method: "POST",
        body: { roleId, appId: appId ?? null },
      }),
      invalidatesTags: (_, __, { userId }) => [{ type: "User", id: userId }],
    }),
    removeRoleFromUser: builder.mutation<void, { userId: string; roleId: string }>({
      query: ({ userId, roleId }) => ({ url: `/admin/users/${userId}/roles/${roleId}`, method: "DELETE" }),
      invalidatesTags: (_, __, { userId }) => [{ type: "User", id: userId }],
    }),
    assignGroupToUser: builder.mutation<void, { userId: string; groupId: string }>({
      query: ({ userId, groupId }) => ({
        url: `/admin/users/${userId}/groups`,
        method: "POST",
        body: { groupId },
      }),
      invalidatesTags: (_, __, { userId }) => [{ type: "User", id: userId }],
    }),
    removeGroupFromUser: builder.mutation<void, { userId: string; groupId: string }>({
      query: ({ userId, groupId }) => ({ url: `/admin/users/${userId}/groups/${groupId}`, method: "DELETE" }),
      invalidatesTags: (_, __, { userId }) => [{ type: "User", id: userId }],
    }),

    // --- Roles ---
    listRoles: builder.query<Role[], void>({
      query: () => "/admin/roles",
      providesTags: ["Role"],
    }),
    createRole: builder.mutation<Role, { name: string; appId?: string | null }>({
      query: (body) => ({ url: "/admin/roles", method: "POST", body }),
      invalidatesTags: ["Role"],
    }),
    updateRole: builder.mutation<Role, { id: string; name: string }>({
      query: ({ id, name }) => ({ url: `/admin/roles/${id}`, method: "PUT", body: { name } }),
      invalidatesTags: ["Role"],
    }),
    deleteRole: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/roles/${id}`, method: "DELETE" }),
      invalidatesTags: ["Role"],
    }),
    addPermissionsToRole: builder.mutation<void, { roleId: string; permissionIds: string[] }>({
      query: ({ roleId, permissionIds }) => ({
        url: `/admin/roles/${roleId}/permissions`,
        method: "POST",
        body: { permissionIds },
      }),
      invalidatesTags: ["Role"],
    }),
    removePermissionFromRole: builder.mutation<void, { roleId: string; permId: string }>({
      query: ({ roleId, permId }) => ({ url: `/admin/roles/${roleId}/permissions/${permId}`, method: "DELETE" }),
      invalidatesTags: ["Role"],
    }),

    // --- Permissions ---
    listPermissions: builder.query<Permission[], void>({
      query: () => "/admin/permissions",
      providesTags: ["Permission"],
    }),
    createPermission: builder.mutation<Permission, { name: string; appId?: string | null }>({
      query: (body) => ({ url: "/admin/permissions", method: "POST", body }),
      invalidatesTags: ["Permission"],
    }),
    deletePermission: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/permissions/${id}`, method: "DELETE" }),
      invalidatesTags: ["Permission"],
    }),

    // --- Groups ---
    listGroups: builder.query<Group[], void>({
      query: () => "/admin/groups",
      providesTags: ["Group"],
    }),
    createGroup: builder.mutation<Group, string>({
      query: (name) => ({ url: "/admin/groups", method: "POST", body: { name } }),
      invalidatesTags: ["Group"],
    }),
    updateGroup: builder.mutation<Group, { id: string; name: string }>({
      query: ({ id, name }) => ({ url: `/admin/groups/${id}`, method: "PUT", body: { name } }),
      invalidatesTags: ["Group"],
    }),
    deleteGroup: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/groups/${id}`, method: "DELETE" }),
      invalidatesTags: ["Group"],
    }),
    addRolesToGroup: builder.mutation<void, { groupId: string; roleIds: string[] }>({
      query: ({ groupId, roleIds }) => ({
        url: `/admin/groups/${groupId}/roles`,
        method: "POST",
        body: { roleIds },
      }),
      invalidatesTags: ["Group"],
    }),
    removeRoleFromGroup: builder.mutation<void, { groupId: string; roleId: string }>({
      query: ({ groupId, roleId }) => ({ url: `/admin/groups/${groupId}/roles/${roleId}`, method: "DELETE" }),
      invalidatesTags: ["Group"],
    }),

    // --- Analytics ---
    getAnalyticsOverview: builder.query<AnalyticsOverview, void>({
      query: () => "/admin/analytics/overview",
    }),
    getUsersByProvider: builder.query<LabelCount[], void>({
      query: () => "/admin/analytics/users/by-provider",
    }),
    getUsersByRole: builder.query<LabelCount[], void>({
      query: () => "/admin/analytics/users/by-role",
    }),
    getUsersByGroup: builder.query<LabelCount[], void>({
      query: () => "/admin/analytics/users/by-group",
    }),
    getUsersByApp: builder.query<LabelCount[], void>({
      query: () => "/admin/analytics/users/by-app",
    }),
    getUserGrowth: builder.query<DayCount[], number>({
      query: (days) => `/admin/analytics/users/growth?days=${days}`,
    }),
    getRolesByPermissionCount: builder.query<LabelCount[], void>({
      query: () => "/admin/analytics/roles/by-permission-count",
    }),
    getPermissionsByRoleCount: builder.query<LabelCount[], void>({
      query: () => "/admin/analytics/permissions/by-role-count",
    }),
  }),
})

export const {
  useListAppsQuery,
  useCreateAppMutation,
  useUpdateAppMutation,
  useDeleteAppMutation,
  useListUsersQuery,
  useGetUserQuery,
  useDeleteUserMutation,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAssignGroupToUserMutation,
  useRemoveGroupFromUserMutation,
  useListRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useAddPermissionsToRoleMutation,
  useRemovePermissionFromRoleMutation,
  useListPermissionsQuery,
  useCreatePermissionMutation,
  useDeletePermissionMutation,
  useListGroupsQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useAddRolesToGroupMutation,
  useRemoveRoleFromGroupMutation,
  useGetAnalyticsOverviewQuery,
  useGetUsersByProviderQuery,
  useGetUsersByRoleQuery,
  useGetUsersByGroupQuery,
  useGetUsersByAppQuery,
  useGetUserGrowthQuery,
  useGetRolesByPermissionCountQuery,
  useGetPermissionsByRoleCountQuery,
} = bastionApi
