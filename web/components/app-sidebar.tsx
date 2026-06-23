"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  UsersIcon,
  ShieldIcon,
  KeyIcon,
  GroupIcon,
  SettingsIcon,
  LogOutIcon,
  ArrowLeftIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronsUpDownIcon } from "lucide-react"
import { useListAppsQuery } from "@/lib/api-slice"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: { name: string; email: string; avatar: string }
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const params = useParams()
  const appId = params?.id as string | undefined

  const { data: apps } = useListAppsQuery()
  const currentApp = appId ? apps?.find((a) => a.id === appId) : undefined

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/session/logout`, {
      method: "POST",
      credentials: "include",
    })
    window.location.href = "/login"
  }

  const globalNavItems = [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboardIcon, exact: true },
  ]

  const appNavItems = appId
    ? [
        { title: "Dashboard", href: `/admin/apps/${appId}`, icon: LayoutDashboardIcon, exact: true },
        { title: "Users", href: `/admin/apps/${appId}/users`, icon: UsersIcon, exact: false },
        { title: "Roles", href: `/admin/apps/${appId}/roles`, icon: ShieldIcon, exact: false },
        { title: "Permissions", href: `/admin/apps/${appId}/permissions`, icon: KeyIcon, exact: false },
        { title: "Groups", href: `/admin/apps/${appId}/groups`, icon: GroupIcon, exact: false },
        { title: "Settings", href: `/admin/apps/${appId}/settings`, icon: SettingsIcon, exact: false },
      ]
    : []

  const navItems = appId ? appNavItems : globalNavItems

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={appId ? `/admin/apps/${appId}` : "/admin"}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground text-xs font-bold select-none">
                  {appId && currentApp
                    ? currentApp.name.slice(0, 2).toUpperCase()
                    : <ShieldIcon className="size-4" />
                  }
                </div>
                <div className="flex flex-col gap-0.5 leading-none min-w-0">
                  <span className="font-semibold truncate">
                    {appId && currentApp ? currentApp.name : "Bastion"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate font-mono">
                    {appId ?? "Admin"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {appId && (
          <>
            <SidebarGroup className="py-1">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="All Apps" className="text-muted-foreground">
                    <Link href="/admin">
                      <ArrowLeftIcon className="size-4" />
                      <span>All Apps</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarSeparator />
          </>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>
            {appId ? (currentApp?.name ?? appId) : "Management"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-sm">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="rounded-sm">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-52">
                  <div className="px-2 py-1.5 text-sm font-medium">{user.name}</div>
                  <div className="px-2 pb-1.5 text-xs text-muted-foreground">{user.email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOutIcon className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
