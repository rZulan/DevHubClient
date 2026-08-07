import { CircleUserRound, CreditCard, Palette, ShieldCheck } from "lucide-react"
import { NavLink, Outlet, useRouteLoaderData } from "react-router-dom"

import { UserAvatar } from "@/components/user-avatar"
import type { AuthUser } from "@/features/auth/auth-types"
import { getUserHandle } from "@/features/auth/user-display"
import { cn } from "@/lib/utils"

const settingsNavigation = [
  { label: "Profile", to: "/account/profile", Icon: CircleUserRound },
  { label: "Account", to: "/account/account", Icon: ShieldCheck },
  { label: "Display", to: "/account/display", Icon: Palette },
  { label: "Billing", to: "/account/billing", Icon: CreditCard },
]

export function AccountLayout() {
  const user = useRouteLoaderData("account") as AuthUser

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <UserAvatar className="size-14 text-base" user={user} />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="truncate text-muted-foreground">{getUserHandle(user)}</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside>
          <nav
            aria-label="Account settings"
            className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {settingsNavigation.map(({ label, to, Icon }) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActive && "bg-muted text-foreground",
                  )
                }
                key={to}
                to={to}
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
