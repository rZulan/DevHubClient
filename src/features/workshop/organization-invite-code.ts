function normalizeCode(value: string) {
    const code = value.trim()
    if (/^[A-HJ-NP-Z2-9]{12}$/i.test(code)) return code.toUpperCase()
    if (/^[a-f0-9]{64}$/i.test(code)) return code.toLowerCase()
    return null
}

/** Accept a code or an invite URL; keep only the code in the join field. */
export function extractInviteToken(value: string): string | null {
    const trimmed = value.trim(), code = normalizeCode(trimmed)
    if (code) return code
    try {
        const url = new URL(trimmed, "https://invite.invalid/")
        if (!["http:", "https:"].includes(url.protocol)) return null
        const queryCode = normalizeCode(url.searchParams.get("invite") ?? "")
        if (queryCode) return queryCode
        const segments = url.pathname.split("/").filter(Boolean)
        const inviteIndex = segments.findIndex(segment => segment === "invite" || segment === "invites")
        return inviteIndex >= 0 && segments[inviteIndex + 1] ? normalizeCode(decodeURIComponent(segments[inviteIndex + 1])) : null
    } catch {return null}
}
