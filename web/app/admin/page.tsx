"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  useGetAnalyticsOverviewQuery,
  useListAppsQuery,
  useCreateAppMutation,
} from "@/lib/api-slice"
import type { AnalyticsOverview } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  UsersIcon, ShieldIcon, KeyIcon, GroupIcon, AppWindowIcon,
  TrendingUpIcon, CalendarIcon, PlusIcon, CopyIcon, ArrowRightIcon,
} from "lucide-react"
import { toast } from "sonner"

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  value?: number
  icon: React.ElementType
  loading?: boolean
}) {
  return (
    <Card>
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
  )
}

function CreateAppDialog() {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState("")
  const [name, setName] = useState("")
  const [redirectUris, setRedirectUris] = useState("")
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)

  const [createApp, { isLoading: isCreating }] = useCreateAppMutation()

  const handleCreate = async () => {
    try {
      const result = await createApp({
        id,
        name,
        redirectUris: redirectUris.split("\n").map((u) => u.trim()).filter(Boolean),
      }).unwrap()
      setCreatedSecret(result.clientSecret)
      setId(""); setName(""); setRedirectUris("")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Create failed")
    }
  }

  const handleClose = () => {
    setOpen(false)
    setCreatedSecret(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusIcon className="size-4 mr-1" />New App</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdSecret ? "App created" : "Register app"}</DialogTitle>
        </DialogHeader>
        {createdSecret ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Save this client secret — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm break-all">
              <span className="flex-1">{createdSecret}</span>
              <Button
                variant="ghost" size="icon"
                onClick={() => { navigator.clipboard.writeText(createdSecret); toast.success("Copied") }}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>App ID</Label>
              <Input placeholder="app1" value={id} onChange={(e) => setId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="My App" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Redirect URIs <span className="text-muted-foreground">(one per line)</span></Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="http://localhost:3000/api/auth/callback"
                value={redirectUris}
                onChange={(e) => setRedirectUris(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {createdSecret ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!id || !name || isCreating}>Create</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: overview, isLoading: overviewLoading } = useGetAnalyticsOverviewQuery()
  const { data: apps, isLoading: appsLoading } = useListAppsQuery()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bastion identity and access management</p>
      </div>

      {/* Platform stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={overview?.totalUsers} icon={UsersIcon} loading={overviewLoading} />
        <StatCard title="New (7 days)" value={overview?.newUsersLast7d} icon={TrendingUpIcon} loading={overviewLoading} />
        <StatCard title="New (30 days)" value={overview?.newUsersLast30d} icon={CalendarIcon} loading={overviewLoading} />
        <StatCard title="Roles" value={overview?.totalRoles} icon={ShieldIcon} loading={overviewLoading} />
        <StatCard title="Permissions" value={overview?.totalPermissions} icon={KeyIcon} loading={overviewLoading} />
        <StatCard title="Groups" value={overview?.totalGroups} icon={GroupIcon} loading={overviewLoading} />
        <StatCard title="Apps" value={overview?.totalApps} icon={AppWindowIcon} loading={overviewLoading} />
      </div>

      {/* Apps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Applications</h2>
            <p className="text-sm text-muted-foreground">Click an app to manage its users, roles, and permissions</p>
          </div>
          <CreateAppDialog />
        </div>

        {appsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : !apps?.length ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <AppWindowIcon className="mx-auto size-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No apps registered</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first app to get started</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card
                key={app.id}
                className="cursor-pointer transition-colors hover:bg-accent group"
                onClick={() => router.push(`/admin/apps/${app.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground text-xs font-bold">
                        {app.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-medium leading-none">{app.name}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{app.id}</p>
                      </div>
                    </div>
                    <ArrowRightIcon className="size-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{app.redirectUris?.length ?? 0} redirect URI{app.redirectUris?.length !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>Registered {new Date(app.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
