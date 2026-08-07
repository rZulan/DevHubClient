import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  isOAuthEnabled,
  oauthApiBaseUrl,
  oauthProviders,
} from "@/features/auth/oauth-providers"

export function OAuthProviderButtons({ intent }: { intent: "login" | "register" }) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Separator />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
          Or continue with
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {oauthProviders.map(({ id, label, Icon }) => {
          const href = `${oauthApiBaseUrl}/auth/external/${id}?intent=${intent}&returnUrl=${encodeURIComponent("/account/profile")}`

          return isOAuthEnabled ? (
            <Button asChild key={id} variant="outline">
              <a href={href}>
                <Icon />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </a>
            </Button>
          ) : (
            <Button
              disabled
              key={id}
              title={`${label} authentication requires backend configuration`}
              type="button"
              variant="outline"
            >
              <Icon />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </Button>
          )
        })}
      </div>
      {!isOAuthEnabled && (
        <p className="text-center text-xs text-muted-foreground">
          Social sign-in will activate after the backend providers are configured.
        </p>
      )}
    </div>
  )
}
