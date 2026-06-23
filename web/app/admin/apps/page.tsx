"use client"

import { useState } from "react"
import {
  useListAppsQuery,
  useCreateAppMutation,
  useDeleteAppMutation,
} from "@/lib/api-slice"
import { App } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { toast } from "sonner"
import { PlusIcon, TrashIcon, CopyIcon } from "lucide-react"

export default function AppsPage() {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState("")
  const [name, setName] = useState("")
  const [redirectUris, setRedirectUris] = useState("")
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)

  const { data: apps, isLoading } = useListAppsQuery()
  const [createApp, { isLoading: isCreating }] = useCreateAppMutation()
  const [deleteApp] = useDeleteAppMutation()

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

  const handleDelete = async (app: App) => {
    try {
      await deleteApp(app.id).unwrap()
      toast.success("App deleted")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Delete failed")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
          <p className="text-sm text-muted-foreground">Registered client applications</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreatedSecret(null) }}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusIcon className="size-4 mr-1" />New App</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{createdSecret ? "App created" : "Register app"}</DialogTitle></DialogHeader>
            {createdSecret ? (
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">Save this client secret — it won&apos;t be shown again.</p>
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
                    placeholder={"http://localhost:3000/api/auth/callback"}
                    value={redirectUris}
                    onChange={(e) => setRedirectUris(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              {createdSecret ? (
                <Button onClick={() => { setOpen(false); setCreatedSecret(null) }}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={!id || !name || isCreating}>Create</Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Redirect URIs</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : apps?.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link href={`/admin/apps/${app.id}`} className="font-mono text-sm hover:underline">
                        {app.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {app.redirectUris?.map((uri) => (
                          <Badge key={uri} variant="secondary" className="font-mono text-xs">{uri}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <TrashIcon className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete app?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove &quot;{app.name}&quot; and all its scoped roles/permissions.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(app)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
