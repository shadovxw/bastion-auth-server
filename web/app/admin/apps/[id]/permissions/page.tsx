"use client"

import { use, useState } from "react"
import {
  useListPermissionsQuery,
  useListAppsQuery,
  useCreatePermissionMutation,
  useDeletePermissionMutation,
} from "@/lib/api-slice"
import type { App, Permission } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { toast } from "sonner"
import { PlusIcon, TrashIcon } from "lucide-react"

export default function AppPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  const { data: app } = useListAppsQuery(undefined, {
    selectFromResult: ({ data }) => ({ data: data?.find((a: App) => a.id === id) }),
  })
  const { data: allPerms, isLoading } = useListPermissionsQuery()
  const [createPermission, { isLoading: isCreating }] = useCreatePermissionMutation()
  const [deletePermission] = useDeletePermissionMutation()

  const appPerms = allPerms?.filter((p: Permission) => p.appId === id) ?? []

  const handleCreate = async () => {
    try {
      await createPermission({ name, appId: id }).unwrap()
      toast.success("Permission created")
      setOpen(false); setName("")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Create failed")
    }
  }

  const handleDelete = async (perm: Permission) => {
    try {
      await deletePermission(perm.id).unwrap()
      toast.success("Permission deleted")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Delete failed")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Permissions scoped to {app?.name ?? id}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusIcon className="size-4 mr-1" />New Permission</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create permission for {app?.name ?? id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  placeholder="posts:write"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scope</Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                  <Badge variant="secondary">{id}</Badge>
                  <span className="text-muted-foreground">App-scoped</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name || isCreating}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : appPerms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      No permissions for this app yet
                    </TableCell>
                  </TableRow>
                )
              : appPerms.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell className="font-mono text-sm">{perm.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{perm.appId}</Badge>
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
                            <AlertDialogTitle>Delete permission?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove &quot;{perm.name}&quot; from all roles.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(perm)}
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
