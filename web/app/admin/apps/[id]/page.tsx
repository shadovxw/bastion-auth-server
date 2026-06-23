"use client"

import { use } from "react"
import Link from "next/link"
import {
  useListAppsQuery,
  useListRolesQuery,
  useListPermissionsQuery,
  useGetUsersByAppQuery,
} from "@/lib/api-slice"
import type { App, Role, Permission } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ShieldIcon, KeyIcon, UsersIcon, ArrowRightIcon } from "lucide-react"

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  loading,
}: {
  title: string
  value?: number
  icon: React.ElementType
  href: string
  loading?: boolean
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer hover:bg-accent transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-3xl font-bold">{value?.toLocaleString() ?? "—"}</div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default function AppDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: app, isLoading: appLoading } = useListAppsQuery(undefined, {
    selectFromResult: ({ data, isLoading }) => ({
      data: data?.find((a: App) => a.id === id),
      isLoading,
    }),
  })

  const { data: allRoles, isLoading: rolesLoading } = useListRolesQuery()
  const { data: allPerms, isLoading: permsLoading } = useListPermissionsQuery()
  const { data: usersByApp } = useGetUsersByAppQuery()

  const appRoles = allRoles?.filter((r: Role) => r.appId === id) ?? []
  const appPerms = allPerms?.filter((p: Permission) => p.appId === id) ?? []
  const appUsers = usersByApp?.find((entry) => entry.label === app?.name)?.count ?? 0

  if (appLoading) return <Skeleton className="h-64 w-full" />
  if (!app) return <p className="text-muted-foreground">App not found</p>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{app.name}</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">{app.id}</p>
        </div>
        <Link href={`/admin/apps/${id}/settings`}>
          <Button variant="outline" size="sm">Settings</Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Users (app-scoped)"
          value={appUsers}
          icon={UsersIcon}
          href={`/admin/apps/${id}/users`}
        />
        <StatCard
          title="Roles"
          value={rolesLoading ? undefined : appRoles.length}
          icon={ShieldIcon}
          href={`/admin/apps/${id}/roles`}
          loading={rolesLoading}
        />
        <StatCard
          title="Permissions"
          value={permsLoading ? undefined : appPerms.length}
          icon={KeyIcon}
          href={`/admin/apps/${id}/permissions`}
          loading={permsLoading}
        />
      </div>

      {/* Roles overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Roles</CardTitle>
              <Link href={`/admin/apps/${id}/roles`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRightIcon className="size-3" />
              </Link>
            </div>
            <CardDescription>Roles scoped to {app.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : appRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles for this app yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {appRoles.slice(0, 12).map((r) => (
                  <Link key={r.id} href={`/admin/apps/${id}/roles`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">{r.name}</Badge>
                  </Link>
                ))}
                {appRoles.length > 12 && (
                  <Badge variant="outline">+{appRoles.length - 12} more</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Permissions</CardTitle>
              <Link href={`/admin/apps/${id}/permissions`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRightIcon className="size-3" />
              </Link>
            </div>
            <CardDescription>Permissions scoped to {app.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {permsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : appPerms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions for this app yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {appPerms.slice(0, 12).map((p) => (
                  <Link key={p.id} href={`/admin/apps/${id}/permissions`}>
                    <Badge variant="outline" className="font-mono text-xs cursor-pointer hover:bg-accent">{p.name}</Badge>
                  </Link>
                ))}
                {appPerms.length > 12 && (
                  <Badge variant="outline">+{appPerms.length - 12} more</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* App details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">App ID</span>
            <span className="font-mono">{app.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Registered</span>
            <span>{new Date(app.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Redirect URIs</span>
            <div className="flex flex-wrap gap-1.5">
              {app.redirectUris?.map((uri) => (
                <Badge key={uri} variant="secondary" className="font-mono text-xs">{uri}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
