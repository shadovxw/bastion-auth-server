export interface User {
  id: string
  email: string
  displayName: string
  avatar: string
  provider: "google" | "github"
  createdAt: string
}

export interface App {
  id: string
  name: string
  redirectUris: string[]
  createdAt: string
}

export interface Role {
  id: string
  name: string
  appId: string | null
}

export interface Permission {
  id: string
  name: string
  appId: string | null
}

export interface Group {
  id: string
  name: string
}

export interface AnalyticsOverview {
  totalUsers: number
  totalRoles: number
  totalPermissions: number
  totalGroups: number
  totalApps: number
  newUsersLast7d: number
  newUsersLast30d: number
}

export interface LabelCount {
  label: string
  count: number
}

export interface DayCount {
  date: string
  count: number
}
