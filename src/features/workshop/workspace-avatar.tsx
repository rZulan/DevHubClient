import type {ReactNode} from "react"
import {Building2} from "lucide-react"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import "./workspace-avatar.css"

export function WorkspaceAvatar({name, avatarUrl, fallback, className = "", tone, kind}: {name: string; avatarUrl?: string | null; fallback?: ReactNode; className?: string; tone?: number; kind?: "organization" | "team"}) {
    const initials = name.trim().split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase() || "?"
    return <Avatar className={`workspace-avatar rounded-lg after:rounded-[inherit] ${className}`} data-tone={tone}>
        {avatarUrl && <AvatarImage className="rounded-[inherit]" src={avatarUrl} alt={`${name} icon`}/>}
        <AvatarFallback className="rounded-[inherit]" style={{background: "transparent"}}>{fallback ?? (kind === "organization" ? <Building2 className="size-5" aria-hidden="true"/> : initials)}</AvatarFallback>
    </Avatar>
}
