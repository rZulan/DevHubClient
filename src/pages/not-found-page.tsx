import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <Button asChild>
        <Link to="/">Return home</Link>
      </Button>
    </div>
  )
}
