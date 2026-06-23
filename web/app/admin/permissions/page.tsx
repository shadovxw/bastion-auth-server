"use client"

import { useState } from "react"
import {
  useListPermissionsQuery,
  useCreatePermissionMutation,
  useDeletePermissionMutation,
} from "@/lib/api-slice"
import { Permission } from "@/lib/types"
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
import { toast } from "sonner"
import { PlusIcon, TrashIcon } from "lucide-react"

export default function PermissionsPage() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [appId, setAppId] = useState("")

  const { data: perms, isLoading } = useListPermissionsQuery()
  const [createPermission, { isLoading: isCreating }] = useCreatePermissionMutation()
  const [deletePermission] = useDeletePermissionMutation()

  const handleCreate = async () => {
    try {
      await createPermission({ name, appId: appId || null }).unwrap()
      toast.success("Permission created")
      setOpen(false); setName(""); setAppId("")
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
          <p className="text-sm text-muted-foreground">Named capabilities assigned to roles</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusIcon className="size-4 mr-1" />New Permission</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create permission</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="posts:write" value={name} onChange={(e) => setName(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>App ID <span className="text-muted-foreground">(leave blank for platform-wide)</span></Label>
                <Input placeholder="app1" value={appId} onChange={(e) => setAppId(e.target.value)} />
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
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : perms?.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell className="font-mono text-sm">{perm.name}</TableCell>
                    <TableCell>
                      <Badge variant={perm.appId ? "secondary" : "outline"}>
                        {perm.appId ?? "platform"}
                      </Badge>
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
