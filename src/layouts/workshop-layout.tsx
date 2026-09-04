import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Building2,
  Check,
  CheckSquare2,
  ChevronDown,
  FolderKanban,
  Home,
  Lightbulb,
  Link2,
  LoaderCircle,
  LogOut,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react"
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { ChatDialog } from "@/features/chat/chat-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserAvatar } from "@/components/user-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OrganizationSetupDialog } from "@/features/workshop/organization-setup-dialog"
import { useCreateOrJoinOrganization } from "@/features/workshop/use-create-or-join-organization"
import { useWorkshop } from "@/features/workshop/workshop-context"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import { mapApiProject } from "@/features/workshop/workshop-data"
import { useWorkshopPresence } from "@/features/workshop/use-workshop-presence"
import { useSignOut } from "@/features/auth/use-sign-out"
import {
  getSelectedProjectId,
  clearWorkshopResumePath,
  setSelectedOrganizationId,
  setSelectedProjectId,
} from "@/features/workshop/workshop-storage"
import type {
  WorkshopMember,
  WorkshopOrganization,
  WorkshopPresenceStatus,
  WorkshopProject,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import { cn } from "@/lib/utils"
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
}

const teamColors = ["#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24"]
const statusLabels: Record<Exclude<WorkshopPresenceStatus, "offline">, string> = {
  online: "Online",
  away: "Away",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
}
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const navigation = [
  { label: "Dashboard", icon: Home, path: "dashboard" },
  { label: "TODO", icon: CheckSquare2, path: "todo" },
  { label: "Ideas", icon: Lightbulb, path: "ideation" },
  { label: "Projects", icon: FolderKanban, path: "projects" },
  { label: "Teams", icon: Users, path: "teams" },
  { label: "Org chart", icon: Network, path: "org-chart" },
  { label: "Roles & access", icon: ShieldCheck, path: "roles" },
]

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  todo: "Project board",
  ideation: "Ideation canvas",
  projects: "Projects",
  "project-detail": "Project details",
  teams: "Teams",
  "org-chart": "Organization chart",
  roles: "Roles & access",
}

export function WorkshopLayout() {
  const { organizationId } = useParams()
  const { organizationById, organizations, isLoading: areOrganizationsLoading } = useWorkshop()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  const setup = useCreateOrJoinOrganization(openOrganization)

  function openOrganization(organizationId: string) {
    setSelectedOrganizationId(organizationId)
    navigate(`/workshop/${organizationId}/dashboard`)
  }
  const [membersOpen, setMembersOpen] = useState(true)
  const [memberQuery, setMemberQuery] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState("")
  const [inviteExpiresAt, setInviteExpiresAt] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [copied, setCopied] = useState(false)
  const { isSigningOut, signOut } = useSignOut()
  const [createOrganizationInvite, { isLoading: isCreatingInvite }] = useCreateOrganizationInviteMutation()
  const baseOrganization = organizationId ? organizationById(organizationId) : undefined
  const isPersistedOrganization = Boolean(organizationId && guidPattern.test(organizationId))
  const { data: apiTeams } = useListTeamsQuery(organizationId ?? "", {
    skip: !isPersistedOrganization,
  })
  const { data: apiMembers } = useListOrganizationMembersQuery(organizationId ?? "", {
    skip: !isPersistedOrganization,
  })
  const { data: apiRoles } = useListOrganizationRolesQuery(organizationId ?? "", {
    skip: !isPersistedOrganization,
  })
  const { data: apiProjects, isFetching: areProjectsFetching } = useListProjectsQuery(organizationId ?? "", {
    skip: !isPersistedOrganization,
  })
  const { presenceByUserId, status: currentStatus, setStatus } = useWorkshopPresence(
    organizationId ?? "",
    isPersistedOrganization,
  )
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

    return {
      ...baseOrganization,
      roles,
      members: apiMembers
        ? apiMembers.map((member): WorkshopMember => {
          const presenceStatus = presenceByUserId.get(member.id.toLowerCase()) ?? "offline"
          const primaryRole = roles
            .filter((role) => member.roleIds.includes(role.id))
            .sort((left, right) => left.order - right.order)[0]
          return {
            id: member.id,
            name: `${member.firstName} ${member.lastName}`.trim(),
            username: member.username ?? member.email.split("@")[0],
            initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
            avatarUrl: member.avatarUrl,
            roleId: primaryRole?.id ?? roles.at(-1)?.id ?? "member",
            roleIds: member.roleIds,
            isOwner: member.isOwner,
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
          color: teamColors[index % teamColors.length],
          leaderId: team.leaderUserId,
          memberIds: [team.leaderUserId],
          memberCount: team.memberCount,
        }))
        : baseOrganization.teams,
      projects: apiProjects
        ? apiProjects.map(mapApiProject)
        : baseOrganization.projects,
    }
  }, [apiMembers, apiProjects, apiRoles, apiTeams, baseOrganization, presenceByUserId])
  const [projectId, setProjectId] = useState(() =>
    organizationId ? getSelectedProjectId(organizationId) : null,
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
    if (!organization || !project) return
    if (project.id !== projectId) setProjectId(project.id)
    setSelectedOrganizationId(organization.id)
    setSelectedProjectId(organization.id, project.id)
  }, [organization, project, projectId])

  if (isPersistedOrganization && areOrganizationsLoading) {
    return <div className="workshop-loading min-h-svh"><LoaderCircle className="animate-spin" /> Loading workshop…</div>
  }

  if (!organizationId || !organization) return <Navigate replace to="/workshop" />

  const activeOrganizationId = organization.id
  const activePath = location.pathname.includes("/projects/")
    ? "project-detail"
    : location.pathname.split("/").at(-1) ?? "dashboard"
  function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId)
    setSelectedProjectId(activeOrganizationId, nextProjectId)
  }

  const canInvite = isPersistedOrganization &&
    hasWorkshopPermission(organization, user?.id, "Create invites")

  async function openInviteDialog() {
    setInviteOpen(true)
    setInviteLink("")
    setInviteExpiresAt("")
    setInviteError("")
    setCopied(false)

    try {
      const invite = await createOrganizationInvite(activeOrganizationId).unwrap()
      setInviteLink(`${window.location.origin}/workshop?invite=${invite.token}`)
      setInviteExpiresAt(invite.expiresAtUtc)
    } catch {
      setInviteError("The invite link could not be created. Please try again.")
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
    } catch {
      setInviteError("Copying was blocked by your browser. Select and copy the link manually.")
    }
  }

  const outletContext: WorkshopOutletContext = { organization, project, selectProject }

  return (
    <div className={cn("workshop-shell", !membersOpen && "members-collapsed")}>
      <aside className="workshop-sidebar">
        <div className="workshop-org-header">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="workshop-org-switcher h-auto" type="button" variant="ghost">
                <span className="workshop-org-mark">{organization.initials}</span>
                <span><strong>{organization.name}</strong><small>Switch organization</small></span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="workshop-org-menu">
              {organizations.map((candidate) => (
                <DropdownMenuItem key={candidate.id} onSelect={() => openOrganization(candidate.id)}>
                  <span className="workshop-org-mark">{candidate.initials}</span>
                  <span>{candidate.name}</span>
                  {candidate.id === activeOrganizationId && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/workshop?choose=1")}><Building2 /> Organization Selector</DropdownMenuItem>
              <DropdownMenuItem disabled={!canInvite} onSelect={() => void openInviteDialog()}><Link2 /> Invite members</DropdownMenuItem>
              <DropdownMenuItem onSelect={setup.openCreate}><Plus /> Create an organization</DropdownMenuItem>
              <DropdownMenuItem onSelect={setup.openJoin}><Link2 /> Join Org</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav aria-label="Workshop navigation" className="workshop-nav">
          <p>Workspace</p>
          {navigation.map(({ icon: Icon, label, path }) => (
            <NavLink className={({ isActive }) => cn("workshop-nav-link", isActive && "active")} key={path} to={path}>
              <Icon /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="workshop-sidebar-footer">
          <Link onClick={clearWorkshopResumePath} to="/"><ArrowLeft /> Back to DevHub</Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={`workshop-sidebar-user status-${currentStatus} h-auto`} type="button" variant="ghost">
                <span className="workshop-sidebar-user-avatar">
                  {user ? <UserAvatar className="size-8" user={user} /> : <span className="workshop-user-fallback">YO</span>}
                  <i className={`presence-${currentStatus}`} />
                </span>
                <span><strong>{user ? `${user.firstName} ${user.lastName}` : "You"}</strong><small>{statusLabels[currentStatus]}</small></span>
                <ChevronDown className="workshop-status-chevron" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="workshop-presence-menu" side="top">
              <DropdownMenuRadioGroup
                onValueChange={(value) => setStatus(value as Exclude<WorkshopPresenceStatus, "offline">)}
                value={currentStatus}
              >
                {(Object.entries(statusLabels) as [Exclude<WorkshopPresenceStatus, "offline">, string][]).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <i className={`workshop-status-dot presence-${value}`} />
                    <span><strong>{label}</strong>{value === "invisible" && <small>Appear offline</small>}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="workshop-presence-logout"
                disabled={isSigningOut}
                onSelect={() => void signOut()}
                variant="destructive"
              >
                <LogOut />
                {isSigningOut ? "Signing out…" : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <section className="workshop-main-column">
        <header className="workshop-topbar">
          <div>
            <small>{organization.name}</small>
            <h1>{pageTitles[activePath] ?? "Workshop"}</h1>
          </div>
          <div className="workshop-topbar-actions">
            <div className="workshop-project-select">
              <span>Current project</span>
              <Select
                disabled={visibleProjects.length === 0}
                onValueChange={selectProject}
                value={project?.id}
              >
                <SelectTrigger aria-label="Current project" className="border-0 bg-secondary text-secondary-foreground dark:bg-secondary dark:hover:bg-secondary"><SelectValue placeholder="No project yet" /></SelectTrigger>
                <SelectContent>
                  {visibleProjects.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ThemeToggle />
            {!membersOpen && (
              <Button aria-label="Open members" className="workshop-icon-button" onClick={() => setMembersOpen(true)} size="icon" type="button" variant="ghost">
                <PanelRightOpen />
              </Button>
            )}
          </div>
        </header>

        <main className={cn("workshop-content", activePath === "ideation" && "workshop-content-canvas")}>
          <Outlet context={outletContext} />
        </main>
      </section>

      {isPersistedOrganization && <ChatDialog currentUserId={user?.id} members={organization.members} organizationId={activeOrganizationId} />}

      {membersOpen && (
        <aside className="workshop-members">
          <header>
            <div>
              <Button aria-label="Collapse members" className="workshop-members-collapse" onClick={() => setMembersOpen(false)} size="icon" type="button" variant="ghost">
                <PanelRightClose />
              </Button>
              <Users /><strong>Members</strong><span>{organization.members.length}</span>
            </div>
            <label><Search /><Input aria-label="Search members" className="border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent" onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search" value={memberQuery} /></label>
          </header>
          <div className="workshop-member-list">
            {[...organization.roles]
              .sort((a, b) => a.order - b.order)
              .map((role) => {
                const members = organization.members.filter((member) =>
                  member.roleId === role.id && `${member.name} ${member.username}`.toLowerCase().includes(memberQuery.toLowerCase()),
                )
                if (members.length === 0) return null
                return (
                  <section key={role.id}>
                    <h2 style={{ color: role.color }}>{role.name} — {members.length}</h2>
                    {members.map((member) => (
                      <Button className="workshop-member h-auto" key={member.id} type="button" variant="ghost">
                        <span className="workshop-member-avatar">
                          <Avatar className="size-8">
                            {member.avatarUrl && <AvatarImage alt={member.name} src={member.avatarUrl} />}
                            <AvatarFallback style={{ background: `${role.color}24`, color: role.color }}>{member.initials}</AvatarFallback>
                          </Avatar>
                          <i className={`presence-${member.presenceStatus ?? (member.online ? "online" : "offline")}`} />
                        </span>
                        <span><strong>{member.name}</strong><small>{member.status ?? `@${member.username}`}</small></span>
                      </Button>
                    ))}
                  </section>
                )
              })}
          </div>
        </aside>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="workshop-modal sm:max-w-md">
          <span className="workshop-modal-icon"><Link2 /></span>
          <DialogHeader>
            <DialogTitle>Invite members</DialogTitle>
            <DialogDescription>Anyone with this link can join {organization.name}. It expires after 7 days.</DialogDescription>
          </DialogHeader>
          <div className="workshop-invite-content">
            {isCreatingInvite ? (
              <div className="workshop-loading"><LoaderCircle className="animate-spin" /> Creating a secure link…</div>
            ) : inviteLink ? (
              <>
                <Label>Invite link</Label>
                <div className="workshop-invite-copy-row">
                  <Input aria-label="Invite link" readOnly value={inviteLink} />
                  <Button onClick={copyInviteLink} type="button">{copied ? <Check /> : <Link2 />}{copied ? "Copied" : "Copy link"}</Button>
                </div>
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
