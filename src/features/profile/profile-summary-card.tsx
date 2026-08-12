import { memo } from "react"

import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AuthUser } from "@/features/auth/auth-types"
import { getUserHandle } from "@/features/auth/user-display"

export const ProfileSummaryCard = memo(function ProfileSummaryCard({
  user,
}: {
  user: AuthUser
}) {
  const fullName = `${user.firstName} ${user.lastName}`.trim()

  return (
    <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
      <CardContent className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-center">
        <UserAvatar className="size-20 text-xl" user={user} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-semibold">{fullName}</h3>
            <Badge variant="secondary">Developer</Badge>
          </div>
          <p className="font-medium text-muted-foreground">{getUserHandle(user)}</p>
          {!user.username && (
            <p className="pt-1 text-xs text-muted-foreground">
              Temporary handle generated from your email until you choose a username.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
