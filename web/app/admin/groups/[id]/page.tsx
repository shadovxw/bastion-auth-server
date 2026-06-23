"use client"

import { use, useState } from "react"
import {
  useListGroupsQuery,
  useListRolesQuery,
  useAddRolesToGroupMutation,
  useRemoveRoleFromGroupMutation,
} from "@/lib/api-slice"
import { Group, Role } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { XIcon } from "lucide-react"

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [selectedRole, setSelectedRole] = useState("")

  const { data: group, isLoading } = useListGroupsQuery(undefined, {
    selectFromResult: ({ data, isLoading }) => ({
      data: data?.find((g: Group) => g.id === id) as (Group & { roles?: Role[] }) | undefined,
      isLoading,
    }),
  })
  const { data: allRoles } = useListRolesQuery()

  const [addRoles, { isLoading: isAdding }] = useAddRolesToGroupMutation()
  const [removeRole] = useRemoveRoleFromGroupMutation()

  const handleAdd = async () => {
    try {
      await addRoles({ groupId: id, roleIds: [selectedRole] }).unwrap()
      setSelectedRole("")
      toast.success("Role added")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  const handleRemove = async (roleId: string) => {
    try {
      await removeRole({ groupId: id, roleId }).unwrap()
      toast.success("Role removed")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!group) return <p className="text-muted-foreground">Group not found</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{group.id}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roles in this group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 min-h-6">
            {!group.roles?.length && (
              <span className="text-sm text-muted-foreground">No roles assigned</span>
            )}
            {group.roles?.map((r) => (
              <Badge key={r.id} variant="outline" className="gap-1">
                {r.name}
                {r.appId && <span className="text-muted-foreground">({r.appId})</span>}
                <button onClick={() => handleRemove(r.id)} className="ml-1 hover:text-destructive">
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {allRoles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} {r.appId ? `(${r.appId})` : "(platform)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedRole || isAdding} variant="outline">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
