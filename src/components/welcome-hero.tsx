import { ArrowRight } from "lucide-react"
import { memo } from "react"
import { Link } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const stack = ["shadcn/ui", "Redux Toolkit", "RTK Query", "React Router"]

export const WelcomeHero = memo(function WelcomeHero() {
  const user = useAppSelector((state) => state.auth.user)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {stack.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
      <div className="space-y-4">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {user ? `Welcome back, ${user.firstName}.` : "Your frontend stack is ready."}
        </h1>
      </div>
      <Button asChild size="lg">
        <Link to={user ? "/account/profile" : "/register"}>
          {user ? "View your account" : "Create your account"}
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </section>
  )
})
