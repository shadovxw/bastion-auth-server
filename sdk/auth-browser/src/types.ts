export interface User {
  id: string
  email: string
  displayName: string
  avatar: string | null
  provider: 'google' | 'github'
  roles: string[]
  permissions: string[]
  app: string
  exp: number
}

export interface AuthConfig {
  /** Base URL of your Bastion API server. Example: "https://api.auth.shadovxw.me" */
  authServer: string
  /** App ID registered in Bastion. Example: "app1" */
  clientId: string
  /** Paths that don't require auth. Example: ['/about', '/public'] */
  publicPaths?: string[]
}
