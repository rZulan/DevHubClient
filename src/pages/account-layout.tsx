import { CircleUserRound, CreditCard, Palette, ShieldCheck } from "lucide-react"
import { memo } from "react"
import { shallowEqual } from "react-redux"
import { NavLink, Outlet, useLocation } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import type { RootState } from "@/app/store"
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

const accountSubpageHeaders: Record<string, { title: string; description: string }> = {
  "/account/profile": {
    title: "Profile",
    description: "Your public identity across DevHub.",
  },
  "/account/account": {
    title: "Account",
    description: "Manage authentication, identity, and connected providers.",
  },
  "/account/display": {
    title: "Display",
    description: "Choose how DevHub looks on this device.",
  },
  "/account/billing": {
    title: "Billing",
    description: "Plans, invoices, and payment methods will live here.",
  },
}

export const AccountLayout = memo(function AccountLayout() {
  return (
    <div className="space-y-8">
      <AccountHeader />

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <AccountNavigation />

        <AccountRouteContent />
      </div>
    </div>
  )
})

const AccountHeader = memo(function AccountHeader() {
  const user = useAppSelector(selectAccountHeaderUser, shallowEqual)

  if (!user) return null

  return (
    <header className="flex items-center gap-4">
      <UserAvatar className="size-14 text-base" user={user} />
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="truncate text-muted-foreground">{getUserHandle(user)}</p>
      </div>
    </header>
  )
})

function AccountNavigation() {
  return (
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
  )
}

function AccountRouteContent() {
  const { pathname } = useLocation()
  const pageHeader = accountSubpageHeaders[pathname]

  return (
    <div className="min-w-0 space-y-6">
      {pageHeader && (
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">{pageHeader.title}</h2>
          <p className="text-sm text-muted-foreground">{pageHeader.description}</p>
        </header>
      )}
      <Outlet />
    </div>
  )
}

function selectAccountHeaderUser(state: RootState): AuthUser | null {
  const user = state.auth.user

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: user.avatarUrl,
  }
}
