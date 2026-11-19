import type {AuthUser} from "@/features/auth/auth-types"
import {createUsernameFallback} from "@/features/auth/username-policy"

export function getUserHandle(user: AuthUser) {
    if (user.username?.trim()) return `@${user.username.trim().replace(/^@/, "")}`

    const emailPrefix = user.email.split("@")[0] ?? "developer"
    return `@${createUsernameFallback(emailPrefix.toLowerCase())}`
}

export type UserAvatarIdentity = Pick<AuthUser, "firstName" | "lastName" | "username"> & {
    avatarUrl?: string | null
    email?: string
}

export function getUserInitials(user: UserAvatarIdentity) {
    const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim()
    return (initials || (user.email || user.username || "").charAt(0)).toUpperCase()
}
