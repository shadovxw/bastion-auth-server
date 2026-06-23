'use client'

import { useState, useEffect } from 'react'
import type { User } from './types'

// Module-level cache so multiple hooks on the same page share one fetch.
let _promise: Promise<User | null> | null = null

function fetchCurrentUser(): Promise<User | null> {
  if (!_promise) {
    _promise = fetch('/api/auth/me')
      .then(res => (res.ok ? (res.json() as Promise<User>) : null))
      .catch(() => null)
  }
  return _promise
}

/**
 * Returns the authenticated user or null.
 * Calls GET /api/auth/me — add that route handler to your app once:
 *
 *   // app/api/auth/me/route.ts
 *   import { getUser } from '@shadovxw/auth-browser/server'
 *   export async function GET() {
 *     const user = await getUser()
 *     return Response.json(user ?? null, { status: user ? 200 : 401 })
 *   }
 */
export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetchCurrentUser().then(setUser)
  }, [])

  return user
}

export function useHasPermission(permission: string): boolean {
  const user = useUser()
  return user?.permissions.includes(permission) ?? false
}

export function useHasRole(role: string): boolean {
  const user = useUser()
  return user?.roles.includes(role) ?? false
}
