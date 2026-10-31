import {Building2, Link2, Palette, ShieldCheck, Users} from "lucide-react"
import {useLayoutEffect, useRef} from "react"
import {NavLink, Outlet, useLocation, useOutletContext} from "react-router-dom"

import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {cn} from "@/lib/utils"
import {WorkspaceAvatar} from "@/features/workshop/workspace-avatar"

const sections = [
    {path: "general", label: "General", icon: Building2},
    {path: "appearance", label: "Appearance", icon: Palette},
    {path: "members", label: "Members", icon: Users},
    {path: "invites", label: "Invitations", icon: Link2},
    {path: "roles", label: "Roles & access", icon: ShieldCheck},
]

export function WorkshopSettingsLayout() {
    const context = useOutletContext<WorkshopOutletContext>()
    const {organization} = context
    const {pathname} = useLocation()
    const navigation = useRef<HTMLElement>(null)
    useLayoutEffect(() => {
        const nav = navigation.current
        if (!nav) return
        const revealActiveLink = () => {
            const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
            if (!active || nav.scrollWidth <= nav.clientWidth) return
            nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - active.clientWidth) / 2
        }
        revealActiveLink()
        const observer = new ResizeObserver(revealActiveLink)
        observer.observe(nav)
        for (const link of nav.children) observer.observe(link)
        return () => observer.disconnect()
    }, [pathname])

    return (
        <div className="workshop-settings">
            <aside className="workshop-settings-sidebar">
                <header>
                    <WorkspaceAvatar className="workshop-org-mark" name={organization.name} avatarUrl={organization.avatarUrl} kind="organization"/>
                    <span><strong>{organization.name}</strong><small>{organization.members.length} member{organization.members.length === 1 ? "" : "s"}</small></span>
                </header>
                <nav ref={navigation} aria-label="Organization settings">
                    {sections.map(({icon: Icon, label, path}) => (
                        <NavLink className={({isActive}) => cn("workshop-settings-link", isActive && "active")}
                                 key={path} to={path}>
                            <Icon/>
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <div className="workshop-settings-content">
                <Outlet key={organization.id} context={context}/>
            </div>
        </div>
    )
}
