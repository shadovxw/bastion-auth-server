import { LoginForm } from "@/components/login-form"
import { ShieldIcon } from "lucide-react"

interface Props {
  searchParams: Promise<{ return_to?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2 font-medium">
          <div className="flex size-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldIcon className="size-3.5" />
          </div>
          Bastion
        </div>
        <LoginForm returnTo={params.return_to} />
      </div>
    </div>
  )
}
