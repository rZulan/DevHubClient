import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AuthUser } from "@/features/auth/auth-types"
import { getUserInitials } from "@/features/auth/user-display"
import { cn } from "@/lib/utils"

export function UserAvatar({
  className,
  user,
}: {
  className?: string
  user: AuthUser
}) {
  const fullName = `${user.firstName} ${user.lastName}`.trim()

  return (
    <Avatar className={cn("size-8", className)}>
      {user.avatarUrl && <AvatarImage alt={fullName} src={user.avatarUrl} />}
      <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
    </Avatar>
  )
}
