import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { User, AuthConfig } from './types'

export type { User, AuthConfig }

// Decodes JWT payload without signature verification.
// The Go backend is the trust boundary — this is only for reading claims
// to make redirect decisions in Next.js middleware.
function decodeJWT(token: string): User | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null
    return payload as User
  } catch {
    return null
  }
}

/**
 * Read the authenticated user from the auth_session cookie.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Returns null if the cookie is missing or expired.
 */
export async function getUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_session')?.value
  if (!token) return null
  return decodeJWT(token)
}

export function hasPermission(user: User | null, permission: string): boolean {
  return user?.permissions.includes(permission) ?? false
}

export function hasRole(user: User | null, role: string): boolean {
  return user?.roles.includes(role) ?? false
}

/**
 * Next.js middleware that enforces authentication on all routes.
 * Redirects unauthenticated requests to Bastion's /authorize endpoint.
 *
 * Usage in middleware.ts:
 *   export default authMiddleware({ authServer: '...', clientId: 'app1' })
 *   export const config = { matcher: ['/((?!_next|favicon).*)'] }
 */
export function authMiddleware(config: AuthConfig) {
  return (request: NextRequest): NextResponse => {
    const { pathname } = request.nextUrl

    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      config.publicPaths?.some(p => pathname === p || pathname.startsWith(p + '/'))
    ) {
      return NextResponse.next()
    }

    const token = request.cookies.get('auth_session')?.value
    const user = token ? decodeJWT(token) : null

    if (!user) {
      const returnTo = request.nextUrl.toString()
      const loginUrl = new URL(
        `/authorize?client_id=${encodeURIComponent(config.clientId)}&return_to=${encodeURIComponent(returnTo)}`,
        config.authServer
      )
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }
}
