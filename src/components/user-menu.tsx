import {
  ChevronDown,
  CircleUserRound,
  CreditCard,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
} from "lucide-react"
import { Link } from "react-router-dom"

import { useTheme, type Theme } from "@/components/theme-provider"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AuthUser } from "@/features/auth/auth-types"
import { getUserHandle } from "@/features/auth/user-display"
import { useSignOut } from "@/features/auth/use-sign-out"

const themeChoices = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
] satisfies Array<{
  id: Theme
  label: string
  Icon: typeof Sun
}>

export function UserMenu({ user }: { user: AuthUser }) {
  const { theme, setTheme } = useTheme()
  const { isSigningOut, signOut } = useSignOut()
  const handle = getUserHandle(user)
  const fullName = `${user.firstName} ${user.lastName}`.trim()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Open user menu for ${handle}`}
          className="flex h-9 items-center gap-2 rounded-lg border bg-background/70 pr-2 pl-1 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          type="button"
        >
          <UserAvatar className="size-7 text-xs" user={user} />
          <span className="hidden max-w-28 truncate sm:inline">{handle}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-2" sideOffset={8}>
        <div className="flex items-center gap-3 p-2">
          <UserAvatar className="size-12 text-base" user={user} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{handle}</p>
            <p className="truncate text-xs text-muted-foreground">{fullName}</p>
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="py-2">
          <Link to="/account/profile">
            <CircleUserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="py-2">
          <Link to="/account/account">
            <ShieldCheck />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="py-2">
          <Link to="/account/display">
            <Palette />
            Display
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="py-2">
          <Link to="/account/billing">
            <CreditCard />
            Billing
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Change theme</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {themeChoices.map(({ id, label, Icon }) => (
            <Button
              aria-label={`Use ${label.toLowerCase()} theme`}
              aria-pressed={theme === id}
              className="h-auto flex-col gap-1 py-2 text-xs"
              key={id}
              size="sm"
              title={label}
              type="button"
              variant={theme === id ? "secondary" : "ghost"}
              onClick={() => setTheme(id)}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          variant="destructive"
          className="py-2"
          onSelect={() => void signOut()}
        >
          <LogOut />
          {isSigningOut ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
