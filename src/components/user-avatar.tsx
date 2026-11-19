import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {getUserInitials, type UserAvatarIdentity} from "@/features/auth/user-display"
import {cn} from "@/lib/utils"

export function UserAvatar({
                               className,
                               draggable,
                               user,
                           }: {
    className?: string
    draggable?: boolean
    user: UserAvatarIdentity
}) {
    const fullName = `${user.firstName} ${user.lastName}`.trim()

    return (
        <Avatar className={cn("size-8", className)}>
            {user.avatarUrl && <AvatarImage alt={fullName} draggable={draggable} src={user.avatarUrl}/>}
            <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
        </Avatar>
    )
}
