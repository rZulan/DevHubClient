import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckSquare2,
  ChevronDown,
  FolderKanban,
  Home,
  Lightbulb,
  Network,
  PanelRightClose,
  PanelRightOpen,
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
import { ThemeToggle } from "@/components/theme-toggle"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkshop } from "@/features/workshop/workshop-context"
import { mapApiProject } from "@/features/workshop/workshop-data"
import {
  getSelectedProjectId,
  setSelectedOrganizationId,
  setSelectedProjectId,
} from "@/features/workshop/workshop-storage"
import type {
  WorkshopOrganization,
  WorkshopProject,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import { cn } from "@/lib/utils"
import { useListProjectsQuery, useListTeamsQuery } from "@/services/api"

export type WorkshopOutletContext = {
  organization: WorkshopOrganization
  project?: WorkshopProject
  selectProject: (projectId: string) => void
}

const teamColors = ["#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24"]
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const navigation = [
  { label: "Lobby", icon: Home, path: "lobby" },
  { label: "TODO", icon: CheckSquare2, path: "todo" },
  { label: "Ideas", icon: Lightbulb, path: "ideation" },
  { label: "Projects", icon: FolderKanban, path: "projects" },
  { label: "Teams", icon: Users, path: "teams" },
  { label: "Org chart", icon: Network, path: "org-chart" },
  { label: "Roles & access", icon: ShieldCheck, path: "roles" },
]

const pageTitles: Record<string, string> = {
  lobby: "Lobby",
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
  const { organizationById } = useWorkshop()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  const [membersOpen, setMembersOpen] = useState(true)
  const [memberQuery, setMemberQuery] = useState("")
  const baseOrganization = organizationId ? organizationById(organizationId) : undefined
  const isPersistedOrganization = Boolean(organizationId && guidPattern.test(organizationId))
  const { data: apiTeams } = useListTeamsQuery(organizationId ?? "", {
    skip: !isPersistedOrganization,
  })
  const { data: apiProjects, isFetching: areProjectsFetching } = useListProjectsQuery(organizationId ?? "", {
    skip: !isPersistedOrganization,
  })
  const organization = useMemo(() => {
    if (!baseOrganization) return undefined

    return {
      ...baseOrganization,
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
  }, [apiProjects, apiTeams, baseOrganization])
  const [projectId, setProjectId] = useState(() =>
    organizationId ? getSelectedProjectId(organizationId) : null,
  )

  const visibleProjects = useMemo(() => {
    if (!organization) return []
    if (isPersistedOrganization) return organization.projects

    const currentMember = organization.members.find((member) =>
      member.id === user?.id || member.id === "current",
    )
    const role = organization.roles.find((candidate) => candidate.id === currentMember?.roleId)
    const canViewAll = role?.permissions.includes("View all projects")

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

  if (!organizationId || !organization) return <Navigate replace to="/workshop?choose=1" />

  const activeOrganizationId = organization.id
  const activePath = location.pathname.includes("/projects/")
    ? "project-detail"
    : location.pathname.split("/").at(-1) ?? "lobby"
  function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId)
    setSelectedProjectId(activeOrganizationId, nextProjectId)
  }

  const outletContext: WorkshopOutletContext = { organization, project, selectProject }

  return (
    <div className={cn("workshop-shell", !membersOpen && "members-collapsed")}>
      <aside className="workshop-sidebar">
        <Button className="workshop-org-switcher h-auto" onClick={() => navigate("/workshop?choose=1")} type="button" variant="ghost">
          <span className="workshop-org-mark">{organization.initials}</span>
          <span><strong>{organization.name}</strong><small>Switch organization</small></span>
          <ChevronDown />
        </Button>

        <nav aria-label="Workshop navigation" className="workshop-nav">
          <p>Workspace</p>
          {navigation.map(({ icon: Icon, label, path }) => (
            <NavLink className={({ isActive }) => cn("workshop-nav-link", isActive && "active")} key={path} to={path}>
              <Icon /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="workshop-sidebar-footer">
          <Link to="/"><ArrowLeft /> Back to DevHub</Link>
          <div className="workshop-sidebar-user">
            {user ? <UserAvatar className="size-8" user={user} /> : <span className="workshop-user-fallback">YO</span>}
            <span><strong>{user ? `${user.firstName} ${user.lastName}` : "You"}</strong><small>Online</small></span>
          </div>
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
                <SelectTrigger aria-label="Current project"><SelectValue placeholder="No project yet" /></SelectTrigger>
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

      {membersOpen && (
        <aside className="workshop-members">
          <header>
            <div>
              <Button aria-label="Collapse members" className="workshop-members-collapse" onClick={() => setMembersOpen(false)} size="icon" type="button" variant="ghost">
                <PanelRightClose />
              </Button>
              <Users /><strong>Members</strong><span>{organization.members.length}</span>
            </div>
            <label><Search /><Input aria-label="Search members" onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search" value={memberQuery} /></label>
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
                        <span className="workshop-member-avatar" style={{ background: `${role.color}24`, color: role.color }}>{member.initials}<i className={member.online ? "online" : ""} /></span>
                        <span><strong>{member.name}</strong><small>{member.status ?? `@${member.username}`}</small></span>
                      </Button>
                    ))}
                  </section>
                )
              })}
          </div>
        </aside>
      )}
    </div>
  )
}
