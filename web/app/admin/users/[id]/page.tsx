"use client"

import { use, useState } from "react"
import {
  useGetUserQuery,
  useListRolesQuery,
  useListGroupsQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAssignGroupToUserMutation,
  useRemoveGroupFromUserMutation,
} from "@/lib/api-slice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { XIcon } from "lucide-react"

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [selectedRole, setSelectedRole] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")

  const { data: user, isLoading } = useGetUserQuery(id)
  const { data: allRoles } = useListRolesQuery()
  const { data: allGroups } = useListGroupsQuery()

  const [assignRole, { isLoading: isAssigningRole }] = useAssignRoleToUserMutation()
  const [removeRole] = useRemoveRoleFromUserMutation()
  const [assignGroup, { isLoading: isAssigningGroup }] = useAssignGroupToUserMutation()
  const [removeGroup] = useRemoveGroupFromUserMutation()

  const handleAssignRole = async () => {
    try {
      await assignRole({ userId: id, roleId: selectedRole }).unwrap()
      setSelectedRole("")
      toast.success("Role assigned")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    try {
      await removeRole({ userId: id, roleId }).unwrap()
      toast.success("Role removed")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  const handleAssignGroup = async () => {
    try {
      await assignGroup({ userId: id, groupId: selectedGroup }).unwrap()
      setSelectedGroup("")
      toast.success("Group assigned")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  const handleRemoveGroup = async (groupId: string) => {
    try {
      await removeGroup({ userId: id, groupId }).unwrap()
      toast.success("Group removed")
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed")
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!user) return <p className="text-muted-foreground">User not found</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar className="size-12 rounded-sm">
          <AvatarImage src={user.avatar} alt={user.displayName} />
          <AvatarFallback className="rounded-sm">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold">{user.displayName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{user.provider}</Badge>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 min-h-6">
            {(user as any).roles?.length === 0 && (
              <span className="text-sm text-muted-foreground">No roles assigned</span>
            )}
            {(user as any).roles?.map((r: any) => (
              <Badge key={r.id ?? r} variant="outline" className="gap-1">
                {r.name ?? r}
                <button onClick={() => handleRemoveRole(r.id ?? r)} className="ml-1 hover:text-destructive">
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
            <Button onClick={handleAssignRole} disabled={!selectedRole || isAssigningRole} variant="outline">
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 min-h-6">
            {(user as any).groups?.length === 0 && (
              <span className="text-sm text-muted-foreground">No groups assigned</span>
            )}
            {(user as any).groups?.map((g: any) => (
              <Badge key={g.id ?? g} variant="outline" className="gap-1">
                {g.name ?? g}
                <button onClick={() => handleRemoveGroup(g.id ?? g)} className="ml-1 hover:text-destructive">
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {allGroups?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignGroup} disabled={!selectedGroup || isAssigningGroup} variant="outline">
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
