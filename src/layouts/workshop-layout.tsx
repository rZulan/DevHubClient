import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react"
import {
    ArrowLeft,
    Building2,
    Check,
    ChevronDown,
    Link2,
    LoaderCircle,
    LogOut,
    Menu,
    PanelRightClose,
    PanelRightOpen,
    Plus,
    Settings,
} from "lucide-react"
import {ArrowSquareOutIcon} from "@phosphor-icons/react/dist/csr/ArrowSquareOut"
import {CaretRightIcon} from "@phosphor-icons/react/dist/csr/CaretRight"
import {FolderSimpleIcon} from "@phosphor-icons/react/dist/csr/FolderSimple"
import {Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams,} from "react-router-dom"

import {useAppSelector} from "@/app/hooks"
import {ChatDialog} from "@/features/chat/chat-dialog"
import {WorkshopNotifications} from "@/features/workshop/workshop-notifications"
import {WorkshopStorageNotice} from "@/features/workshop/workshop-limit-notices"
import {ThemeToggle} from "@/components/theme-toggle"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"
import {UserAvatar} from "@/components/user-avatar"
import {WorkspaceAvatar} from "@/features/workshop/workspace-avatar"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {useOrganizationColorScheme} from "@/features/workshop/appearance/use-organization-color-scheme"
import {OrganizationSetupDialog} from "@/features/workshop/organization-setup-dialog"
import {useCreateOrJoinOrganization} from "@/features/workshop/use-create-or-join-organization"
import {extractInviteToken} from "@/features/workshop/organization-invite-code"
import {useWorkshop} from "@/features/workshop/workshop-context"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {mapApiProject} from "@/features/workshop/workshop-data"
import {useWorkshopPresence} from "@/features/workshop/use-workshop-presence"
import {useSignOut} from "@/features/auth/use-sign-out"
import {MemberSidebarEntry} from "@/features/workshop/member-sidebar-entry"
import {
    clearWorkshopResumePath,
    getSelectedProjectId,
    setSelectedOrganizationId,
    setSelectedProjectId,
} from "@/features/workshop/workshop-storage"
import type {
    ColorScheme,
    WorkshopMember,
    WorkshopOrganization,
    WorkshopPresenceStatus,
    WorkshopProject,
    WorkshopTeam,
} from "@/features/workshop/workshop-types"
import {cn} from "@/lib/utils"
import {ProjectToolsNavigation} from "@/features/workshop/project-tools-navigation"
import {WorkshopNavigationGroup} from "@/features/workshop/workshop-navigation-group"
import {organizationNavigation} from "@/features/workshop/workshop-navigation"
import {projectNavigationCategories} from "@/features/workshop/project-tools"
import {useCompactWorkshop, WorkshopContentWidthContext} from "@/hooks/use-compact-workshop"
import "@/features/workshop/workshop-responsive.css"
import {ResponsiveWorkshopPanel} from "@/features/workshop/responsive-workshop-panel"
import {
    useCreateOrganizationInviteMutation,
    useListOrganizationMembersQuery,
    useListOrganizationRolesQuery,
    useListProjectsQuery,
    useListTeamsQuery,
} from "@/services/api"

export type WorkshopOutletContext = {
    organization: WorkshopOrganization
    project?: WorkshopProject
    selectProject: (projectId: string) => void
    isPersistedOrganization: boolean
    canInvite: boolean
    openInviteDialog: () => void
    /** Previews a color scheme without saving it; pass nothing to restore the saved one. */
    previewColorScheme: (scheme?: ColorScheme) => void
}

const teamColors = ["#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24"]
const statusLabels: Record<Exclude<WorkshopPresenceStatus, "offline">, string> = {
    online: "Online",
    away: "Away",
    dnd: "Do Not Disturb",
    invisible: "Invisible",
}
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const pageTitles: Record<string, string> = {
    dashboard: "Dashboard",
    "project-wiki": "Project Wiki",
    "bug-reports": "Bug Reports",
    todo: "TODOs",
    calendar: "Calendar",
    notes: "Notes",
    erd: "ERD maker",
    "ui-editor": "UI/UX Editor",
    sdlc: "SDLC Roadmap",
    "state-machine": "State Machine",
    projects: "Projects",
    "project-detail": "Project details",
    teams: "Teams",
    "org-chart": "Organization chart",
    settings: "Organization settings",
}
const constructionPages = new Set(["dashboard", "ui-editor", "sdlc", "state-machine", "projects", "project-detail", "project-wiki", "bug-reports"])

export function WorkshopLayout() {
    const {organizationId} = useParams()
    const {organizationById, organizations, isLoading: areOrganizationsLoading} = useWorkshop()
    const location = useLocation()
    const navigate = useNavigate()
    const user = useAppSelector((state) => state.auth.user)
    const setup = useCreateOrJoinOrganization(openOrganization)

    function openOrganization(organizationId: string) {
        setSelectedOrganizationId(organizationId)
        navigate(`/workshop/${organizationId}/dashboard`)
    }

    const [membersOpen, setMembersOpen] = useState(true)
    const mainColumn = useRef<HTMLElement>(null)
    const [contentWidth, setContentWidth] = useState<number | null>(null)
    const compact = useCompactWorkshop()
    const compactMembers = useCompactWorkshop(1400)
    const [navigationOpen, setNavigationOpen] = useState(false)
    const [compactMembersOpen, setCompactMembersOpen] = useState(false)
    useEffect(() => {setNavigationOpen(false); setCompactMembersOpen(false)}, [location.pathname, compact, compactMembers])
    const [projectGroupsOpen, setProjectGroupsOpen] = useState<Record<string, boolean>>({planning: true, design: true, knowledge: true})
    const [projectsOpen, setProjectsOpen] = useState(true)
    const [memberQuery, setMemberQuery] = useState("")
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteLink, setInviteLink] = useState("")
    const [inviteExpiresAt, setInviteExpiresAt] = useState("")
    const [inviteError, setInviteError] = useState("")
    const [copied, setCopied] = useState<"code" | "link" | null>(null)
    const inviteCode = extractInviteToken(inviteLink) ?? ""
    const {isSigningOut, signOut} = useSignOut()
    const [createOrganizationInvite, {isLoading: isCreatingInvite}] = useCreateOrganizationInviteMutation()
    const baseOrganization = organizationId ? organizationById(organizationId) : undefined
    const isPersistedOrganization = Boolean(organizationId && guidPattern.test(organizationId))
    const {currentData: apiTeams} = useListTeamsQuery(organizationId ?? "", {
        skip: !isPersistedOrganization || !baseOrganization,
    })
    const {
        currentData: apiMembers,
        error: membershipError,
        isLoading: areMembersLoading
    } = useListOrganizationMembersQuery(organizationId ?? "", {
        skip: !isPersistedOrganization,
    })
    const {currentData: apiRoles} = useListOrganizationRolesQuery(organizationId ?? "", {
        skip: !isPersistedOrganization,
    })
    const {currentData: apiProjects, isFetching: areProjectsFetching} = useListProjectsQuery(organizationId ?? "", {
        skip: !isPersistedOrganization,
    })
    const {presenceByUserId, status: currentStatus, setStatus} = useWorkshopPresence(
        organizationId ?? "",
        isPersistedOrganization,
    )
    const {previewColorScheme} = useOrganizationColorScheme(organizationId ?? "", isPersistedOrganization)
    const organization = useMemo(() => {
        if (!baseOrganization) return undefined

        const roles = apiRoles
            ? apiRoles.map((role) => ({
                id: role.id,
                name: role.name,
                color: role.color,
                order: role.position,
                permissions: role.permissions,
                isOwnerRole: role.isOwnerRole,
                isDefaultRole: role.isDefaultRole,
                memberCount: role.memberCount,
            }))
            : baseOrganization.roles

        const rolesById = new Map(roles.map(role => [role.id, role]))
        return {
            ...baseOrganization,
            roles,
            members: apiMembers
                ? apiMembers.map((member): WorkshopMember => {
                    const presenceStatus = presenceByUserId.get(member.id.toLowerCase()) ?? "offline"
                    const primaryRole = member.roleIds.reduce<(typeof roles)[number] | undefined>((best, id) => {
                        const role = rolesById.get(id)
                        return role && (!best || role.order < best.order) ? role : best
                    }, undefined)
                    return {
                        id: member.id,
                        name: member.nickname?.trim() || `${member.firstName} ${member.lastName}`.trim(),
                        profileName: `${member.firstName} ${member.lastName}`.trim(),
                        nickname: member.nickname ?? undefined,
                        username: member.username ?? member.email.split("@")[0],
                        initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
                        avatarUrl: member.avatarUrl,
                        roleId: primaryRole?.id ?? roles.at(-1)?.id ?? "member",
                        roleIds: member.roleIds,
                        isOwner: member.isOwner,
                        joinedAtUtc: member.joinedAtUtc,
                        teamIds: [],
                        online: presenceStatus !== "offline" && presenceStatus !== "invisible",
                        presenceStatus,
                    }
                })
                : baseOrganization.members.map((member) => ({
                    ...member,
                    presenceStatus: member.presenceStatus ?? (member.online ? "online" : "offline"),
                })),
            teams: apiTeams
                ? apiTeams.map((team, index): WorkshopTeam => ({
                    id: team.id,
                    name: team.name,
                    description: team.description ?? "",
                    avatarUrl: team.avatarUrl,
                    color: teamColors[index % teamColors.length],
                    leaderId: team.leaderUserId,
                    memberIds: team.memberIds ?? [team.leaderUserId],
                    memberCount: team.memberCount,
                }))
                : baseOrganization.teams,
            projects: apiProjects
                ? apiProjects.map(mapApiProject)
                : baseOrganization.projects,
        }
    }, [apiMembers, apiProjects, apiRoles, apiTeams, baseOrganization, presenceByUserId])
    const [projectId, setProjectId] = useState(() =>
        new URLSearchParams(location.search).get("project") ?? (organizationId ? getSelectedProjectId(user?.id, organizationId) : null),
    )

    const visibleProjects = useMemo(() => {
        if (!organization) return []
        if (isPersistedOrganization) return organization.projects

        const currentMember = organization.members.find((member) =>
            member.id === user?.id || member.id === "current",
        )
        const canViewAll = hasWorkshopPermission(
            organization,
            user?.id ?? currentMember?.id,
            "View all projects",
        )

        return organization.projects.filter((project) =>
            canViewAll || currentMember?.teamIds.some((teamId) => project.teamIds.includes(teamId)),
        )
    }, [isPersistedOrganization, organization, user?.id])

    const selectedProject = visibleProjects.find((candidate) => candidate.id === projectId)
    const shouldUseFirstProject = !projectId || !isPersistedOrganization || !areProjectsFetching
    const project = selectedProject ?? (shouldUseFirstProject ? visibleProjects[0] : undefined)

    useEffect(() => {
        const linkedProject = new URLSearchParams(location.search).get("project")
        if (linkedProject && linkedProject !== projectId && visibleProjects.some(candidate => candidate.id === linkedProject)) setProjectId(linkedProject)
    }, [location.pathname, location.search, projectId, visibleProjects])

    useEffect(() => {
        if (!organization || !project) return
        if (project.id !== projectId) setProjectId(project.id)
        setSelectedOrganizationId(organization.id)
        setSelectedProjectId(user?.id, organization.id, project.id)
    }, [organization, project, projectId, user?.id])

    const memberGroups = useMemo(() => {
        if (!organization || !membersOpen && !compactMembersOpen) return []
        const query = memberQuery.trim().toLowerCase()
        const groups = new Map<string, WorkshopMember[]>()
        for (const member of organization.members) {
            if (query && !`${member.name} ${member.username}`.toLowerCase().includes(query)) continue
            const group = groups.get(member.roleId)
            if (group) group.push(member)
            else groups.set(member.roleId, [member])
        }
        return [...organization.roles].sort((a, b) => a.order - b.order)
            .map(role => ({role, members: groups.get(role.id) ?? []}))
            .filter(group => group.members.length > 0)
    }, [organization, membersOpen, compactMembersOpen, memberQuery])

    const activePath = location.pathname.includes("/projects/")
        ? "project-detail"
        : location.pathname.includes("/settings")
            ? "settings"
            : location.pathname.split("/").at(-1) ?? "dashboard"

    useEffect(() => {
        const category = projectNavigationCategories.find(group => group.tools.some(path => path === activePath))
        if (category) setProjectGroupsOpen(current => ({...current, [category.id]: true}))
        if (activePath === "projects" || activePath === "project-detail") setProjectsOpen(true)
    }, [activePath])

    const accessDenied = membershipError && "status" in membershipError &&
        (membershipError.status === 403 || membershipError.status === 404)
    useLayoutEffect(() => {
        const column = mainColumn.current
        if (!column) return
        const measure = () => setContentWidth(column.clientWidth)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(column)
        return () => observer.disconnect()
    }, [organization?.id, areOrganizationsLoading, areMembersLoading, accessDenied])
    if (isPersistedOrganization && accessDenied) return <Navigate replace to="/workshop?choose=1"/>

    if (isPersistedOrganization && (areOrganizationsLoading || areMembersLoading)) {
        return <div className="workshop-loading min-h-svh"><LoaderCircle className="animate-spin"/> Loading workshop…
        </div>
    }

    if (!organizationId || !organization) return <Navigate replace to="/workshop"/>

    const activeOrganizationId = organization.id
    function selectProject(nextProjectId: string) {
        setProjectId(nextProjectId)
        setSelectedProjectId(user?.id, activeOrganizationId, nextProjectId)
        const params = new URLSearchParams(location.search)
        if (params.has("project") || location.pathname.endsWith("/project-wiki")) {
            params.set("project", nextProjectId)
            for (const key of ["page", "report", "todo", "todoProject", "task"]) params.delete(key)
            navigate({pathname: location.pathname, search: params.toString()}, {replace: true})
        }
    }

    const canInvite = isPersistedOrganization &&
        hasWorkshopPermission(organization, user?.id, "Create invites")

    async function openInviteDialog() {
        setInviteOpen(true)
        setInviteLink("")
        setInviteExpiresAt("")
        setInviteError("")
        setCopied(null)

        try {
            const invite = await createOrganizationInvite(activeOrganizationId).unwrap()
            setInviteLink(`${window.location.origin}/workshop?invite=${invite.token}`)
            setInviteExpiresAt(invite.expiresAtUtc)
        } catch {
            setInviteError("The invite link could not be created. Please try again.")
        }
    }

    async function copyInvite(kind: "code" | "link") {
        try {
            await navigator.clipboard.writeText(kind === "code" ? inviteCode : inviteLink)
            setCopied(kind)
        } catch {
            setInviteError("Copying was blocked by your browser. Select and copy the code manually.")
        }
    }

    const outletContext: WorkshopOutletContext = {
        organization,
        project,
        selectProject,
        isPersistedOrganization,
        canInvite,
        openInviteDialog: () => void openInviteDialog(),
        previewColorScheme,
    }

    return (
        <div className={cn("workshop-shell", (compactMembers || !membersOpen) && "members-collapsed")}>
            <ResponsiveWorkshopPanel compact={compact} open={navigationOpen} onOpenChange={setNavigationOpen} title="Workshop navigation" side="left">
            <aside className="workshop-sidebar">
                <div className="workshop-org-header">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="workshop-org-switcher h-auto" type="button" variant="ghost">
                                <WorkspaceAvatar className="workshop-org-mark" name={organization.name} avatarUrl={organization.avatarUrl} kind="organization"/>
                                <span><strong>{organization.name}</strong><small>Switch organization</small></span>
                                <ChevronDown/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="workshop-org-menu">
                            {organizations.map((candidate) => (
                                <DropdownMenuItem key={candidate.id} onSelect={() => openOrganization(candidate.id)}>
                                    <WorkspaceAvatar className="workshop-org-mark" name={candidate.name} avatarUrl={candidate.avatarUrl} kind="organization"/>
                                    <span>{candidate.name}</span>
                                    {candidate.id === activeOrganizationId && <Check className="ml-auto"/>}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem
                                onSelect={() => navigate(`/workshop/${activeOrganizationId}/settings`)}><Settings/> Organization
                                settings</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => navigate("/workshop?choose=1")}><Building2/> Organization
                                Selector</DropdownMenuItem>
                            <DropdownMenuItem disabled={!canInvite}
                                              onSelect={() => void openInviteDialog()}><Link2/> Invite
                                members</DropdownMenuItem>
                            <DropdownMenuItem onSelect={setup.openCreate}><Plus/> Create an
                                organization</DropdownMenuItem>
                            <DropdownMenuItem onSelect={setup.openJoin}><Link2/> Join Org</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <nav aria-label="Workshop navigation" className="workshop-nav">
                    <WorkshopNavigationGroup title="Organization" items={organizationNavigation} activePath={activePath} underConstruction/>
                    {projectNavigationCategories.map(category => <ProjectToolsNavigation key={`${user?.id}:${activeOrganizationId}:${category.id}`} userId={user?.id ?? "current"}
                        organizationId={activeOrganizationId} category={category} expanded={projectGroupsOpen[category.id] ?? true}
                        onToggle={() => setProjectGroupsOpen(current => ({...current, [category.id]: !current[category.id]}))}/>)}
                    <div className={cn("workshop-nav-group workshop-projects-group", projectsOpen && "open")}>
                        <button
                            aria-expanded={projectsOpen}
                            className={cn(
                                "workshop-nav-group-trigger",
                                (activePath === "projects" || activePath === "project-detail") && "active",
                            )}
                            onClick={() => setProjectsOpen((open) => !open)}
                            type="button"
                        >
                            <span className="workshop-construction-label">Projects<UnderConstructionIndicator/></span><CaretRightIcon className="workshop-nav-chevron"/>
                        </button>
                        <div className="workshop-nav-submenu">
                            <NavLink className={({isActive}) => cn("workshop-nav-link", isActive && "active")}
                                     end to="projects">
                                <span className="workshop-construction-label">All projects<UnderConstructionIndicator/></span>
                            </NavLink>
                            {visibleProjects.map((candidate) => {
                                const isCurrent = candidate.id === project?.id
                                return (
                                    <ContextMenu key={candidate.id}>
                                        <ContextMenuTrigger className="workshop-project-context-trigger">
                                            <NavLink
                                                aria-label={`${candidate.name}${isCurrent ? ", current project" : ""}`}
                                                className={({isActive}) => cn(
                                                    "workshop-nav-link workshop-project-entry",
                                                    isActive && "active",
                                                    isCurrent && "current",
                                                )}
                                                title={`${candidate.name}${isCurrent ? " — current project" : ""}`}
                                                to={`projects/${candidate.id}`}
                                            >
                                                <span className="workshop-construction-label"><span className="workshop-project-name">{candidate.name}</span><UnderConstructionIndicator/></span>
                                                {isCurrent && <i aria-hidden="true" className="workshop-current-project-dot"/>}
                                            </NavLink>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="workshop-project-context-menu">
                                            <ContextMenuLabel className="workshop-project-context-header">
                                                <span><FolderSimpleIcon weight="duotone"/></span>
                                                <span>
                                                    <strong title={candidate.name}>{candidate.name}</strong>
                                                    <small>{isCurrent ? "Current project" : "Project actions"}</small>
                                                </span>
                                            </ContextMenuLabel>
                                            <ContextMenuSeparator/>
                                            <ContextMenuItem
                                                className="workshop-project-context-item"
                                                onSelect={() => navigate(`/workshop/${activeOrganizationId}/projects/${candidate.id}`)}
                                            >
                                                <ArrowSquareOutIcon/><span>Open project</span>
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                className="workshop-project-context-item"
                                                disabled={isCurrent}
                                                onSelect={() => selectProject(candidate.id)}
                                            >
                                                <Check/>
                                                <span>{isCurrent ? "Selected as current" : "Set as current project"}</span>
                                                {isCurrent && <span className="workshop-project-context-status">Active</span>}
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                )
                            })}
                        </div>
                    </div>
                </nav>

                <div className="workshop-sidebar-footer">
                    <Link onClick={clearWorkshopResumePath} to="/"><ArrowLeft aria-hidden="true"/><span>Back to DevHub</span></Link>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className={`workshop-sidebar-user status-${currentStatus} h-auto`} type="button"
                                    variant="ghost">
                <span className="workshop-sidebar-user-avatar">
                  {user ? <UserAvatar className="size-8" user={user}/> :
                      <span className="workshop-user-fallback">YO</span>}
                    <i className={`presence-${currentStatus}`}/>
                </span>
                                <span><strong>{user ? `${user.firstName} ${user.lastName}` : "You"}</strong><small>{statusLabels[currentStatus]}</small></span>
                                <ChevronDown className="workshop-status-chevron"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="workshop-presence-menu" side="top">
                            <DropdownMenuRadioGroup
                                onValueChange={(value) => setStatus(value as Exclude<WorkshopPresenceStatus, "offline">)}
                                value={currentStatus}
                            >
                                {(Object.entries(statusLabels) as [Exclude<WorkshopPresenceStatus, "offline">, string][]).map(([value, label]) => (
                                    <DropdownMenuRadioItem key={value} value={value}>
                                        <i className={`workshop-status-dot presence-${value}`}/>
                                        <span><strong>{label}</strong>{value === "invisible" &&
                                            <small>Appear offline</small>}</span>
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem
                                className="workshop-presence-logout"
                                disabled={isSigningOut}
                                onSelect={() => void signOut()}
                                variant="destructive"
                            >
                                <LogOut/>
                                {isSigningOut ? "Signing out…" : "Log out"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>
            </ResponsiveWorkshopPanel>

            <section ref={mainColumn} className="workshop-main-column">
                <header className="workshop-topbar">
                    {compact && <Button variant="outline" size="icon" className="workshop-navigation-toggle" aria-label="Open workshop navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu aria-hidden="true"/></Button>}
                    <div className="workshop-topbar-title">
                        <small title={organization.name}>{organization.name}</small>
                        <h1 className="workshop-construction-label" title={pageTitles[activePath] ?? "Workshop"}><span>{pageTitles[activePath] ?? "Workshop"}</span>{constructionPages.has(activePath) && <UnderConstructionIndicator/>}</h1>
                    </div>
                    <div className="workshop-topbar-actions">
                        <div className="workshop-project-select">
                            <span>Current project</span>
                            <Select
                                disabled={visibleProjects.length === 0}
                                onValueChange={selectProject}
                                value={project?.id}
                            >
                                <SelectTrigger
                                    aria-label="Current project"
                                    className="w-full min-w-0 border-0 bg-secondary text-secondary-foreground dark:bg-secondary dark:hover:bg-secondary [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:text-left"
                                    title={project?.name}
                                >
                                    <SelectValue placeholder="No project yet"/>
                                </SelectTrigger>
                                <SelectContent position="popper" align="start"
                                               className="w-(--radix-select-trigger-width) min-w-0 p-1">
                                    {visibleProjects.map((candidate) => (
                                        <SelectItem className="py-2 [&>span:last-child]:min-w-0" key={candidate.id}
                                                    value={candidate.id}>
                                            <span className="truncate" title={candidate.name}>{candidate.name}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <WorkshopNotifications key={`${user?.id}:${activeOrganizationId}`} organizationId={activeOrganizationId} userId={user?.id ?? "current"} enabled={isPersistedOrganization && !!user?.id}/>
                        <ThemeToggle/>
                        {(compactMembers || !membersOpen) && (
                            <Button aria-label="Open members" className="workshop-icon-button"
                                    onClick={() => compactMembers ? setCompactMembersOpen(true) : setMembersOpen(true)} size="icon" type="button" variant="ghost">
                                <PanelRightOpen/>
                            </Button>
                        )}
                    </div>
                </header>

                <WorkshopStorageNotice organizationId={activeOrganizationId} persisted={isPersistedOrganization}/>
                <main className={cn("workshop-content", ["erd", "ui-editor", "sdlc"].includes(activePath) && "workshop-content-canvas")}>
                    <WorkshopContentWidthContext value={contentWidth}>
                        <Outlet key={activeOrganizationId} context={outletContext}/>
                    </WorkshopContentWidthContext>
                </main>
            </section>

            {isPersistedOrganization &&
                <ChatDialog key={activeOrganizationId} currentUserId={user?.id} members={organization.members}
                            organizationId={activeOrganizationId}/>}

            {(compactMembers || membersOpen) && (
                <ResponsiveWorkshopPanel compact={compactMembers} open={compactMembersOpen} onOpenChange={setCompactMembersOpen} title="Members" side="right">
                <aside className="workshop-members">
                    <header>
                        <div>
                            <Button aria-label="Collapse members" className="workshop-members-collapse"
                                    onClick={() => compactMembers ? setCompactMembersOpen(false) : setMembersOpen(false)} size="icon" type="button" variant="ghost">
                                <PanelRightClose/>
                            </Button>
                            <strong>Members</strong><span>{organization.members.length}</span>
                        </div>
                        <label><Input aria-label="Search members"
                                               className="border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent"
                                               onChange={(event) => setMemberQuery(event.target.value)}
                                               placeholder="Search" value={memberQuery}/></label>
                    </header>
                    <div className="workshop-member-list">
                        {memberGroups.map(({role, members}) => {
                            return (
                                <section key={role.id}>
                                    <h2 style={{color: role.color}}>{role.name} — {members.length}</h2>
                                    {members.map((member) => (
                                        <MemberSidebarEntry key={member.id} member={member} organization={organization}>
                                            <Button className="workshop-member h-auto" type="button" variant="ghost">
                        <span className="workshop-member-avatar">
                          <Avatar className="size-8">
                            {member.avatarUrl && <AvatarImage alt={member.name} src={member.avatarUrl}/>}
                              <AvatarFallback style={{
                                  background: `${role.color}24`,
                                  color: role.color
                              }}>{member.initials}</AvatarFallback>
                          </Avatar>
                          <i className={`presence-${member.presenceStatus ?? (member.online ? "online" : "offline")}`}/>
                        </span>
                                                <span><strong>{member.name}</strong><small>{member.status ?? `@${member.username}`}</small></span>
                                            </Button>
                                        </MemberSidebarEntry>
                                    ))}
                                </section>
                            )
                        })}
                    </div>
                </aside>
                </ResponsiveWorkshopPanel>
            )}

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="workshop-modal sm:max-w-md">
                    <span className="workshop-modal-icon"><Link2/></span>
                    <DialogHeader>
                        <DialogTitle>Invite members</DialogTitle>
                        <DialogDescription>Anyone with this code or its invite link can join {organization.name}. It expires after 7
                            days.</DialogDescription>
                    </DialogHeader>
                    <div className="workshop-invite-content">
                        {isCreatingInvite ? (
                            <div className="workshop-loading"><LoaderCircle className="animate-spin"/> Creating a secure
                                link…</div>
                        ) : inviteLink ? (
                            <>
                                <Label>Invite code</Label>
                                <div className="workshop-invite-copy-row">
                                    <Input aria-label="Invite code" readOnly value={inviteCode}/>
                                    <Button onClick={() => void copyInvite("code")} type="button">{copied === "code" ? <Check/> :
                                        <Link2/>}{copied === "code" ? "Copied" : "Copy code"}</Button>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => void copyInvite("link")} type="button">{copied === "link" ? <Check/> : <Link2/>}{copied === "link" ? "Link copied" : "Copy invite link"}</Button>
                                {inviteExpiresAt && <p>Expires {new Date(inviteExpiresAt).toLocaleString()}.</p>}
                            </>
                        ) : null}
                        {inviteError && <p className="workshop-form-error">{inviteError}</p>}
                    </div>
                </DialogContent>
            </Dialog>

            <OrganizationSetupDialog
                busy={setup.isCreating || setup.isJoining}
                error={setup.error}
                mode={setup.mode}
                onClose={setup.close}
                onSubmitCreate={setup.handleCreate}
                onSubmitJoin={setup.handleJoin}
            />
        </div>
    )
}
