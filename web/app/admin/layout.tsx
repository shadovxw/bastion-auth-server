import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"

function decodeJWT(token: string) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    )
    if (payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_session")?.value

  if (!token) redirect("/login?return_to=/admin")

  const user = decodeJWT(token)
  if (!user) redirect("/login?return_to=/admin")

  if (!user.permissions?.includes("auth:admin")) {
    redirect("/login?return_to=/admin")
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: user.displayName ?? user.email,
          email: user.email,
          avatar: user.avatar ?? "",
        }}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
