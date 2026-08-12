import { useState } from "react"
import { Eye, EyeOff, KeyRound, Link2 } from "lucide-react"

import { useAppSelector } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ConnectedAccount } from "@/features/auth/auth-types"
import {
  isOAuthEnabled,
  oauthApiBaseUrl,
  oauthProviders,
} from "@/features/auth/oauth-providers"
import { useSignOut } from "@/features/auth/use-sign-out"
import { useDisconnectExternalAccountMutation } from "@/services/api"

export function AccountPage() {
  const user = useAppSelector((state) => state.auth.user)
  const { isSigningOut, signOut } = useSignOut()

  if (!user) return null

  return (
    <div className="space-y-6">
      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Account details</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Details associated with your current session.
            </p>
          </div>
          <Button
            disabled={isSigningOut}
            variant="outline"
            onClick={() => void signOut()}
          >
            {isSigningOut ? "Signing out…" : "Log out"}
          </Button>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-6 pt-2 sm:grid-cols-2">
          <ProfileField label="Email" value={user.email} />
          <SensitiveProfileField label="User ID" value={user.id} />
          <ProfileField label="Session" value="Cookie + bearer JWT" />
          <ProfileField label="Refresh" value="Automatic token rotation" />
        </CardContent>
      </Card>

      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="size-4" />
            <CardTitle>Connected accounts</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Link providers for faster sign-in and account recovery.
          </p>
        </CardHeader>
        <CardContent className="divide-y rounded-lg border p-0">
          {oauthProviders.map((provider) => (
            <ConnectedAccountRow
              connectedAccount={
                user.connectedAccounts?.find(
                  (account) => account.provider === provider.id,
                )
              }
              key={provider.id}
              provider={provider}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardContent className="flex items-center gap-4 pt-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <KeyRound className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              Password changes require a backend endpoint.
            </p>
          </div>
          <Button disabled variant="outline">Change</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ConnectedAccountRow({
  connectedAccount,
  provider,
}: {
  connectedAccount?: ConnectedAccount
  provider: (typeof oauthProviders)[number]
}) {
  const { Icon, id, label } = provider
  const isConnected = connectedAccount !== undefined
  const [disconnect, { isLoading: isDisconnecting }] =
    useDisconnectExternalAccountMutation()
  const href = `${oauthApiBaseUrl}/users/me/connections/${id}?returnUrl=${encodeURIComponent("/account/account")}`

  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{label}</p>
          {isConnected && <Badge variant="secondary">Connected</Badge>}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {connectedAccount?.providerUsername ?? (isConnected ? "Connected" : "Not connected")}
        </p>
      </div>
      {isConnected ? (
        <Button
          disabled={isDisconnecting}
          size="sm"
          variant="outline"
          onClick={() => void disconnect(id)}
        >
          {isDisconnecting ? "Disconnectingâ€¦" : "Disconnect"}
        </Button>
      ) : isOAuthEnabled ? (
        <Button asChild size="sm" variant="outline">
          <a href={href}>Connect</a>
        </Button>
      ) : (
        <Button
          disabled
          size="sm"
          title={`${label} linking requires backend configuration`}
          variant="outline"
        >
          Connect
        </Button>
      )}
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="truncate font-medium" title={value}>{value}</p>
    </div>
  )
}

function SensitiveProfileField({ label, value }: { label: string; value: string }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden={!isVisible}
          className={`truncate font-medium transition-[filter,opacity] duration-200 ${
            isVisible ? "" : "pointer-events-none select-none blur-[5px] opacity-70"
          }`}
          title={isVisible ? value : undefined}
        >
          {value}
        </span>
        {!isVisible && <span className="sr-only">{label} hidden</span>}
        <Button
          aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={isVisible}
          className="shrink-0"
          size="icon-xs"
          title={isVisible ? `Hide ${label}` : `Show ${label}`}
          type="button"
          variant="ghost"
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
  )
}
