import { AtSign, CalendarDays, Mail, UserRound } from "lucide-react"
import { useRouteLoaderData } from "react-router-dom"

import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AuthUser } from "@/features/auth/auth-types"
import { getUserHandle } from "@/features/auth/user-display"

export function ProfilePage() {
  const user = useRouteLoaderData("account") as AuthUser
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  const handle = getUserHandle(user)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your public identity across DevHub.
        </p>
      </div>

      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardContent className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-center">
          <UserAvatar className="size-20 text-xl" user={user} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-semibold">{fullName}</h3>
              <Badge variant="secondary">Developer</Badge>
            </div>
            <p className="font-medium text-muted-foreground">{handle}</p>
            {!user.username && (
              <p className="pt-1 text-xs text-muted-foreground">
                Temporary handle generated from your email until profile editing is
                available from the API.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <ProfileDetail icon={<UserRound />} label="Full name" value={fullName} />
          <ProfileDetail icon={<AtSign />} label="Username" value={handle} />
          <ProfileDetail icon={<Mail />} label="Email" value={user.email} />
          <ProfileDetail
            icon={<CalendarDays />}
            label="Member since"
            value={
              user.createdAtUtc
                ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
                    new Date(user.createdAtUtc),
                  )
                : "Unavailable"
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border bg-background/50 p-4">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium" title={value}>{value}</p>
      </div>
    </div>
  )
}
