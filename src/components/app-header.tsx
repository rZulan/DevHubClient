import { Code2 } from "lucide-react"
import { memo } from "react"
import { Link, NavLink } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Home", to: "/" },
  { label: "Discovery", to: "/discovery" },
]

export const AppHeader = memo(function AppHeader() {
  const user = useAppSelector((state) => state.auth.user)

  return (
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link className="flex items-center gap-2 font-semibold" to="/">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="size-4" />
          </span>
          Dev Hub
        </Link>
        <div className="flex items-center gap-2">
          <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Button asChild key={item.to} size="sm" variant="ghost">
                <NavLink
                  className={({ isActive }) =>
                    cn(isActive && "bg-muted text-foreground")
                  }
                  end={item.to === "/"}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              </Button>
            ))}
          </nav>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <ThemeToggle />
              <Button asChild size="sm" variant="ghost">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
})
