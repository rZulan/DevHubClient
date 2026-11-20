import {Building2, Link2, Palette, ShieldCheck, Users} from "lucide-react"
import {useId, useLayoutEffect, useRef} from "react"
import {NavLink, Outlet, useLocation, useOutletContext} from "react-router-dom"

import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {cn} from "@/lib/utils"
import {WorkspaceAvatar} from "@/features/workshop/workspace-avatar"

const groups = [
    {
        label: "Organization",
        links: [
            {path: "general", label: "General", icon: Building2},
            {path: "members", label: "Members", icon: Users},
            {path: "invites", label: "Invitations", icon: Link2},
            {path: "roles", label: "Roles & access", icon: ShieldCheck},
        ],
    },
    {
        label: "Personal",
        links: [{path: "appearance", label: "Appearance", icon: Palette}],
    },
]

export function WorkshopSettingsLayout() {
    const context = useOutletContext<WorkshopOutletContext>()
    const {organization} = context
    const {pathname} = useLocation()
    const navigationId = useId()
    const navigation = useRef<HTMLElement>(null)
    useLayoutEffect(() => {
        const active = navigation.current?.querySelector<HTMLElement>('[aria-current="page"]')
        const links = active?.closest<HTMLElement>(".workshop-settings-links")
        if (!active || !links) return
        const revealActiveLink = () => {
            if (links.scrollWidth <= links.clientWidth) return
            const offset = active.getBoundingClientRect().left - links.getBoundingClientRect().left
            links.scrollLeft += offset - (links.clientWidth - active.clientWidth) / 2
        }
        revealActiveLink()
        const observer = new ResizeObserver(revealActiveLink)
        observer.observe(links)
        for (const link of links.children) observer.observe(link)
        return () => observer.disconnect()
    }, [pathname])

    return (
        <div className="workshop-settings">
            <aside className="workshop-settings-sidebar">
                <header>
                    <WorkspaceAvatar className="workshop-org-mark" name={organization.name} avatarUrl={organization.avatarUrl} kind="organization"/>
                    <span><strong>{organization.name}</strong><small>{organization.members.length} member{organization.members.length === 1 ? "" : "s"}</small></span>
                </header>
                <nav ref={navigation} aria-label="Settings">
                    {groups.map(({label, links}) => (
                        <div aria-labelledby={`${navigationId}-${label}`} key={label} role="group">
                            <div className="workshop-settings-group-label" id={`${navigationId}-${label}`}>{label}</div>
                            <div className="workshop-settings-links">
                                {links.map(({icon: Icon, label, path}) => (
                                    <NavLink className={({isActive}) => cn("workshop-settings-link", isActive && "active")}
                                             key={path} to={path}>
                                        <Icon aria-hidden="true"/>
                                        <span>{label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>
            <div className="workshop-settings-content">
                <Outlet key={organization.id} context={context}/>
            </div>
        </div>
    )
}
