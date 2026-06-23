"use client"

import { use, useState } from "react"
import {
  useListAppsQuery,
  useUpdateAppMutation,
  useDeleteAppMutation,
} from "@/lib/api-slice"
import { App } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function AppSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState("")
  const [redirectUris, setRedirectUris] = useState("")
  const [editing, setEditing] = useState(false)

  const { data: app, isLoading } = useListAppsQuery(undefined, {
    selectFromResult: ({ data, isLoading }) => ({
      data: data?.find((a: App) => a.id === id),
      isLoading,
    }),
  })

  const [updateApp, { isLoading: isUpdating }] = useUpdateAppMutation()
  const [deleteApp, { isLoading: isDeleting }] = useDeleteAppMutation()

  const startEdit = () => {
    setName(app?.name ?? "")
    setRedirectUris(app?.redirectUris.join("\n") ?? "")
    setEditing(true)
  }

  const handleUpdate = async () => {
    try {
      await updateApp({
        id,
        name,
        redirectUris: redirectUris.split("\n").map((u) => u.trim()).filter(Boolean),
      }).unwrap()
      setEditing(false)
      toast.success("App updated")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Update failed")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteApp(id).unwrap()
      toast.success("App deleted")
      router.push("/admin")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Delete failed")
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!app) return <p className="text-muted-foreground">App not found</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage {app.name} configuration</p>
      </div>

      <Separator />

      {editing ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Edit app</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Redirect URIs <span className="text-muted-foreground">(one per line)</span></Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none h-28 focus:outline-none focus:ring-1 focus:ring-ring"
                value={redirectUris}
                onChange={(e) => setRedirectUris(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdate} disabled={isUpdating}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Redirect URIs</CardTitle>
                <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
              </div>
            </CardHeader>
            <CardContent>
              {app.redirectUris?.length ? (
                <div className="flex flex-wrap gap-2">
                  {app.redirectUris.map((uri) => (
                    <Badge key={uri} variant="secondary" className="font-mono text-xs">{uri}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No redirect URIs configured</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">App ID</span>
                <span className="font-mono">{app.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered</span>
                <span>{new Date(app.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete this app</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Removes {app.name} and all its scoped roles and permissions.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>Delete app</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{app.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the app and all its scoped roles, permissions, and assignments. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
