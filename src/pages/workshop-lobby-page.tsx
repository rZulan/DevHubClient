import { useMemo, useState, type CSSProperties } from "react"
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  History,
  Lightbulb,
  ListTodo,
  Plus,
  Users,
} from "lucide-react"
import { Link, useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CreateTeamDialog } from "@/features/workshop/create-team-dialog"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import type {
  ApiTeam,
  WorkshopMember,
  WorkshopTask,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import {
  useListOrganizationMembersQuery,
  useListTeamsQuery,
} from "@/services/api"

const teamColors = ["#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24"]
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function WorkshopLobbyPage() {
  const { organization, project } = useOutletContext<WorkshopOutletContext>()
  const user = useAppSelector((state) => state.auth.user)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const isPersistedOrganization = guidPattern.test(organization.id)
  const canManageTeams = hasWorkshopPermission(
    organization,
    user?.id ?? "current",
    "Manage teams",
  )
  const { data: apiTeams } = useListTeamsQuery(organization.id, {
    skip: !isPersistedOrganization,
  })
  const { data: apiMembers } = useListOrganizationMembersQuery(organization.id, {
    skip: !isPersistedOrganization,
  })

  const members = useMemo<WorkshopMember[]>(() => {
    if (!apiMembers) return organization.members
    return apiMembers.map((member) => ({
      ...organization.members.find((candidate) => candidate.id === member.id),
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      username: member.username ?? member.email.split("@")[0],
      initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
      avatarUrl: member.avatarUrl,
      roleId: organization.members.find((candidate) => candidate.id === member.id)?.roleId ?? "member",
      teamIds: [],
      online: organization.members.find((candidate) => candidate.id === member.id)?.online ?? false,
      presenceStatus: organization.members.find((candidate) => candidate.id === member.id)?.presenceStatus ?? "offline",
    }))
  }, [apiMembers, organization.members])

  const teams = useMemo<WorkshopTeam[]>(() => {
    if (!apiTeams) return organization.teams
    return apiTeams.map((team, index) => mapApiTeam(team, index))
  }, [apiTeams, organization.teams])

  const currentUserId = user?.id ?? "current"
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : members.find((member) => member.id === currentUserId)?.name ?? "there"
  const projectTasks = organization.tasks.filter((task) => task.projectId === project?.id)
  const assignedTasks = organization.tasks
    .filter((task) => task.assigneeId === currentUserId || task.assigneeId === "current")
    .slice(0, 6)
  const completedTasks = projectTasks.filter((task) => task.status === "done").length
  const pendingTasks = projectTasks.filter((task) => task.status === "pending").length
  const activeTasks = projectTasks.filter((task) => task.status === "progress").length
  const quickActions = [
    { title: "Create new project", description: "Define ownership, stack, and delivery dates.", icon: Plus, to: "../projects" },
    { title: "Open task board", description: "Review work assigned across the current project.", icon: ListTodo, to: "../todo" },
    { title: "Start an idea", description: "Capture a note or map a flow on the canvas.", icon: Lightbulb, to: "../ideation" },
  ]

  return (
    <div className="workshop-page workshop-dashboard-page">
      <section className="workshop-dashboard-heading">
        <div>
          <span className="workshop-page-kicker">Organization lobby</span>
          <h2>Welcome back, <strong>{displayName}</strong></h2>
          <p>{project ? `Here’s what is moving in ${project.name}.` : `Here’s what is happening across ${organization.name}.`}</p>
        </div>
        <Badge variant="outline"><i /> {members.filter((member) => member.online).length} online</Badge>
      </section>

      <div className="workshop-dashboard-layout">
        <div className="workshop-dashboard-main">
          <section className="workshop-dashboard-section">
            <header><span>Quick actions</span></header>
            <div className="workshop-quick-actions">
              {quickActions.map(({ description, icon: Icon, title, to }) => (
                <Link key={title} to={to}>
                  <span><Icon /></span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                  <ArrowRight />
                </Link>
              ))}
              {canManageTeams ? (
                <Button onClick={() => setIsCreatingTeam(true)} type="button" variant="outline">
                  <span><Users /></span>
                  <strong>Create a team</strong>
                  <small>Choose a team leader and organize members.</small>
                  <ArrowRight />
                </Button>
              ) : (
                <Link to="../teams">
                  <span><Users /></span>
                  <strong>View teams</strong>
                  <small>See ownership and team membership.</small>
                  <ArrowRight />
                </Link>
              )}
            </div>
          </section>

          <section className="workshop-dashboard-section workshop-personal-todo">
            <header><span>Your TODO</span><Link to="../todo">Open board <ArrowRight /></Link></header>
            <Card>
              <CardHeader><span>Task</span><span>Status</span></CardHeader>
              <CardContent>
                {assignedTasks.length > 0 ? assignedTasks.map((task) => <DashboardTaskRow key={task.id} task={task} />) : (
                  <p>No tasks assigned to you yet.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="workshop-dashboard-section workshop-statistics">
            <header><span>Statistics</span><small>{project?.name ?? organization.name}</small></header>
            <div className="workshop-statistics-panel">
              <div className="workshop-stat-bars" aria-label="Project task statistics">
                <StatBar color="blue" label="Pending" total={projectTasks.length} value={pendingTasks} />
                <StatBar color="amber" label="Active" total={projectTasks.length} value={activeTasks} />
                <StatBar color="green" label="Done" total={projectTasks.length} value={completedTasks} />
                <StatBar color="slate" label="Teams" total={Math.max(teams.length, 1)} value={teams.length} />
              </div>
              <div className="workshop-trend-chart">
                <div><strong>Project pulse</strong><small>Work completed over the current cycle</small></div>
                <svg aria-label="Project activity trend" preserveAspectRatio="none" role="img" viewBox="0 0 600 180">
                  <line x1="0" x2="600" y1="164" y2="164" />
                  <polyline className="comparison" fill="none" points="0,164 120,100 240,128 360,72 480,116 600,46" />
                  <polyline className="primary" fill="none" points="0,164 120,124 240,78 360,68 480,62 600,28" />
                </svg>
              </div>
            </div>
          </section>
        </div>

        <aside className="workshop-dashboard-activity">
          <header><History /><strong>Recent activity</strong></header>
          <ol>
            <ActivityItem copy={`created the ${project?.name ?? "current"} project workspace`} name={displayName} time="10 minutes ago" />
            <ActivityItem copy="moved a task to In progress" name={members[1]?.name ?? displayName} time="38 minutes ago" />
            <ActivityItem copy="added a note to Ideas" name={members[2]?.name ?? displayName} time="2 hours ago" />
            <ActivityItem copy="completed a project task" name={members[3]?.name ?? displayName} time="Yesterday" />
          </ol>
          <Button asChild variant="ghost"><Link to="../todo">Load more <ArrowRight /></Link></Button>
        </aside>
      </div>

      <CreateTeamDialog
        defaultLeaderId={user?.id ?? members[0]?.id}
        members={members}
        onOpenChange={setIsCreatingTeam}
        open={isCreatingTeam}
        organization={organization}
        teams={teams}
      />
    </div>
  )
}

function DashboardTaskRow({ task }: { task: WorkshopTask }) {
  const Icon = task.status === "done" ? CheckCircle2 : task.status === "progress" ? Clock3 : Circle
  return (
    <div>
      <span><Icon /><strong>{task.title}</strong></span>
      <Badge variant={task.status === "done" ? "secondary" : "outline"}>{task.status === "progress" ? "In progress" : task.status}</Badge>
    </div>
  )
}

function StatBar({ color, label, total, value }: { color: string; label: string; total: number; value: number }) {
  const height = total > 0 ? Math.max(18, Math.round((value / total) * 100)) : 18
  return (
    <div>
      <span><i data-color={color} style={{ "--bar-height": `${height}%` } as CSSProperties} /></span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  )
}

function ActivityItem({ copy, name, time }: { copy: string; name: string; time: string }) {
  return <li><i /><p><strong>{name}</strong> {copy}<small>{time}</small></p></li>
}

function mapApiTeam(team: ApiTeam, index: number): WorkshopTeam {
  return {
    id: team.id,
    name: team.name,
    description: team.description ?? "",
    color: teamColors[index % teamColors.length],
    leaderId: team.leaderUserId,
    memberIds: [team.leaderUserId],
    memberCount: team.memberCount,
  }
}
