"use client"

import { useState } from "react"
import {
  useListGroupsQuery,
  useCreateGroupMutation,
  useDeleteGroupMutation,
} from "@/lib/api-slice"
import { Group } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { PlusIcon, TrashIcon } from "lucide-react"

export default function GroupsPage() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  const { data: groups, isLoading } = useListGroupsQuery()
  const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation()
  const [deleteGroup] = useDeleteGroupMutation()

  const handleCreate = async () => {
    try {
      await createGroup(name).unwrap()
      toast.success("Group created")
      setOpen(false); setName("")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Create failed")
    }
  }

  const handleDelete = async (group: Group) => {
    try {
      await deleteGroup(group.id).unwrap()
      toast.success("Group deleted")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Delete failed")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">Batch-assign roles to multiple users</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusIcon className="size-4 mr-1" />New Group</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create group</DialogTitle></DialogHeader>
            <div className="space-y-1.5 py-2">
              <Label>Name</Label>
              <Input placeholder="editors" value={name} onChange={(e) => setName(e.target.value)} />
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
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : groups?.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Link href={`/admin/groups/${group.id}`} className="font-medium hover:underline">
                        {group.name}
                      </Link>
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
                            <AlertDialogTitle>Delete group?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove &quot;{group.name}&quot; and all its role assignments.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(group)}
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
