"use client"

import { use, useState } from "react"
import {
  useListRolesQuery,
  useListPermissionsQuery,
  useAddPermissionsToRoleMutation,
  useRemovePermissionFromRoleMutation,
} from "@/lib/api-slice"
import { Role, Permission } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { XIcon } from "lucide-react"

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [selectedPerm, setSelectedPerm] = useState("")

  const { data: role, isLoading } = useListRolesQuery(undefined, {
    selectFromResult: ({ data, isLoading }) => ({
      data: data?.find((r: Role) => r.id === id) as (Role & { permissions?: Permission[] }) | undefined,
      isLoading,
    }),
  })
  const { data: allPerms } = useListPermissionsQuery()

  const [addPermissions, { isLoading: isAdding }] = useAddPermissionsToRoleMutation()
  const [removePermission] = useRemovePermissionFromRoleMutation()

  const handleAdd = async () => {
    try {
      await addPermissions({ roleId: id, permissionIds: [selectedPerm] }).unwrap()
      setSelectedPerm("")
      toast.success("Permission added")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  const handleRemove = async (permId: string) => {
    try {
      await removePermission({ roleId: id, permId }).unwrap()
      toast.success("Permission removed")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!role) return <p className="text-muted-foreground">Role not found</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{role.name}</h1>
          <Badge variant={role.appId ? "secondary" : "outline"}>{role.appId ?? "platform"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{role.id}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 min-h-6">
            {!role.permissions?.length && (
              <span className="text-sm text-muted-foreground">No permissions assigned</span>
            )}
            {role.permissions?.map((p) => (
              <Badge key={p.id} variant="outline" className="gap-1 font-mono text-xs">
                {p.name}
                <button onClick={() => handleRemove(p.id)} className="ml-1 hover:text-destructive">
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={selectedPerm} onValueChange={setSelectedPerm}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select permission" />
              </SelectTrigger>
              <SelectContent>
                {allPerms?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-mono text-sm">{p.name}</span>
                    {p.appId && <span className="ml-2 text-muted-foreground text-xs">({p.appId})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedPerm || isAdding} variant="outline">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
