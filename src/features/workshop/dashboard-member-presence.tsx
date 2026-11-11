import {Users} from "lucide-react"
import {Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage} from "@/components/ui/avatar"
import type {WorkshopMember} from "./workshop-types"

type PresenceMember = Pick<WorkshopMember, "id" | "name" | "initials" | "avatarUrl" | "online" | "presenceStatus">

const avatarLimit = 4
const activeStatusLabels = {online: "Online", away: "Away", dnd: "Do not disturb"} as const

export function DashboardMemberPresence({members, memberCount}: {members: PresenceMember[]; memberCount?: number}) {
    const online = members.filter(member => member.online && member.presenceStatus !== "offline" && member.presenceStatus !== "invisible")
    const total = Math.max(memberCount ?? members.length, online.length)
    const visibleMembers = online.slice(0, avatarLimit)
    const overflow = online.length - visibleMembers.length

    return <div className="dashboard-widget-face dashboard-member-presence">
        <header className="dashboard-presence-header">
            <span><Users aria-hidden="true"/></span>
            <h3>Member presence</h3>
        </header>
        <div className="dashboard-presence-totals">
            <div><strong>{online.length}</strong><span>Online now</span></div>
            <span>{total} total</span>
        </div>
        <div className="dashboard-presence-meter" role="meter" aria-label="Members online" aria-valuemin={0} aria-valuemax={Math.max(total, 1)}
            aria-valuenow={online.length} aria-valuetext={`${online.length} of ${total} members online`}>
            <span style={{width: `${total ? online.length / total * 100 : 0}%`}}/>
        </div>
        <div className="dashboard-presence-footer">
            {visibleMembers.length ? <div className="dashboard-presence-people"><AvatarGroup aria-label="Online members">
                {visibleMembers.map(member => {
                    const status = member.presenceStatus === "away" || member.presenceStatus === "dnd" ? member.presenceStatus : "online"
                    const label = `${member.name} · ${activeStatusLabels[status]}`
                    return <Avatar key={member.id} size="sm" role="img" aria-label={label} title={label}>
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt=""/>}
                        <AvatarFallback>{member.initials}</AvatarFallback>
                        <AvatarBadge className={`presence-${status}`} aria-hidden="true"/>
                    </Avatar>
                })}
                {overflow > 0 && <AvatarGroupCount title={`${overflow} more online`}>+{overflow}</AvatarGroupCount>}
            </AvatarGroup>{online.length === 1 && <span className="dashboard-presence-name" title={online[0].name}>{online[0].name}</span>}</div>
                : <span className="dashboard-presence-empty">Nobody online right now</span>}
            <span className="dashboard-presence-live"><i aria-hidden="true"/>Live</span>
        </div>
    </div>
}
