import { LoaderCircle } from "lucide-react"

export function RouterFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Restoring your session</span>
    </div>
  )
}
