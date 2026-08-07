import type { AuthUser } from "@/features/auth/auth-types"

export function getUserHandle(user: AuthUser) {
  if (user.username?.trim()) return `@${user.username.trim().replace(/^@/, "")}`

  const emailPrefix = user.email.split("@")[0] ?? "developer"
  const fallback = emailPrefix
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `@${fallback || "developer"}`
}

export function getUserInitials(user: AuthUser) {
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim()
  return initials.toUpperCase() || user.email.charAt(0).toUpperCase()
}
