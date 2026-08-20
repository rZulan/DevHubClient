import { useState, type FormEvent } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  FolderKanban,
  GitBranch,
  Layers3,
  ListChecks,
  LoaderCircle,
  Pencil,
  Rocket,
  UserRound,
  Users,
  Workflow,
} from "lucide-react"
import { Link, useOutletContext, useParams } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { useWorkshop } from "@/features/workshop/workshop-context"
import { mapApiProject } from "@/features/workshop/workshop-data"
import type {
  ProjectStatus,
  SaveProjectInput,
  WorkshopProject,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { useUpdateProjectMutation } from "@/services/api"

const projectStatuses: ProjectStatus[] = [
  "Planning",
  "In development",
  "Review",
  "On hold",
  "Shipped",
  "Archived",
]
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function WorkshopProjectDetailPage() {
  const { projectId } = useParams()
  const { organization, project: currentProject, selectProject } = useOutletContext<WorkshopOutletContext>()
  const user = useAppSelector((state) => state.auth.user)
  const { updateProject: updateLocalProject } = useWorkshop()
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [updateProject, { isLoading: isSaving }] = useUpdateProjectMutation()
  const matchingProject = organization.projects.find((candidate) => candidate.id === projectId)

  if (!matchingProject) {
    return (
      <div className="workshop-page">
        <section className="workshop-empty-panel">
          <FolderKanban />
          <h3>Project not found</h3>
          <p>This project may have been removed, or you may not have access to it.</p>
          <Button asChild><Link to="../projects"><ArrowLeft /> Back to projects</Link></Button>
        </section>
      </div>
    )
  }

  const project: WorkshopProject = matchingProject

  const team = organization.teams.find((candidate) => project.teamIds.includes(candidate.id))
  const lead = organization.members.find((member) => member.id === project.leadUserId)
  const projectTasks = organization.tasks.filter((task) => task.projectId === project.id)
  const completedTasks = projectTasks.filter((task) => task.status === "done").length
  const activeTasks = projectTasks.filter((task) => task.status === "progress").length
  const progress = projectTasks.length > 0
    ? Math.round((completedTasks / projectTasks.length) * 100)
    : 0
  const isPersistedOrganization = guidPattern.test(organization.id)
  const canManage = organization.ownerUserId === user?.id
    || (!isPersistedOrganization && organization.ownerUserId === "current")
    || team?.leaderId === user?.id
    || (!isPersistedOrganization && team?.leaderId === "current")
  const isCurrent = currentProject?.id === project.id

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError("")
    const form = new FormData(event.currentTarget)
    const startDate = optionalValue(form, "startDate")
    const targetDate = optionalValue(form, "targetDate")

    if (startDate && targetDate && targetDate < startDate) {
      setSaveError("The target date cannot be earlier than the start date.")
      return
    }

    const projectInput: SaveProjectInput = {
      name: String(form.get("name") ?? "").trim(),
      summary: String(form.get("summary") ?? "").trim(),
      status: String(form.get("status") ?? project.status) as ProjectStatus,
      teamId: project.teamIds[0],
      leadUserId: project.leadUserId,
      techStack: splitTags(form.get("techStack")),
      repositoryUrl: optionalValue(form, "repositoryUrl"),
      documentationUrl: optionalValue(form, "documentationUrl"),
      designUrl: optionalValue(form, "designUrl"),
      liveUrl: optionalValue(form, "liveUrl"),
      sdlcMethod: optionalValue(form, "sdlcMethod"),
      databaseDetails: optionalValue(form, "databaseDetails"),
      environments: splitTags(form.get("environments")),
      startDate,
      targetDate,
    }

    if (!projectInput.name || !projectInput.summary || !projectInput.teamId || !projectInput.leadUserId) {
      setSaveError("The project needs a name, summary, owning team, and project lead.")
      return
    }

    try {
      let savedProject: WorkshopProject
      if (isPersistedOrganization) {
        const response = await updateProject({
          organizationId: organization.id,
          projectId: project.id,
          project: projectInput,
        }).unwrap()
        savedProject = mapApiProject(response)
      } else {
        savedProject = {
          ...project,
          name: projectInput.name,
          summary: projectInput.summary,
          status: projectInput.status,
          techStack: projectInput.techStack,
          repository: projectInput.repositoryUrl || "Not linked",
          documentationUrl: projectInput.documentationUrl,
          designUrl: projectInput.designUrl,
          liveUrl: projectInput.liveUrl,
          sdlc: projectInput.sdlcMethod || "Not specified",
          database: projectInput.databaseDetails || "Not specified",
          environments: projectInput.environments,
          startDate: projectInput.startDate,
          targetDate: projectInput.targetDate,
          updatedAt: "Just now",
        }
      }

      updateLocalProject(organization.id, savedProject)
      setIsEditing(false)
    } catch (error) {
      setSaveError(getApiErrorMessage(error))
    }
  }

  return (
    <div className="workshop-page workshop-project-detail-page">
      <Link className="workshop-project-back" to="../projects"><ArrowLeft /> Back to projects</Link>

      <section className="workshop-project-detail-heading">
        <div className="workshop-project-detail-title">
          <span className="workshop-project-icon"><FolderKanban /></span>
          <div>
            <div><span className="workshop-status-badge" data-status={project.status}>{project.status}</span>{isCurrent && <Badge variant="secondary">Current project</Badge>}</div>
            <h2>{project.name}</h2>
            <p>{project.summary}</p>
          </div>
        </div>
        <div className="workshop-project-detail-actions">
          {!isCurrent && <Button onClick={() => selectProject(project.id)} type="button" variant="outline">Set as current</Button>}
          {canManage && <Button onClick={() => { setSaveError(""); setIsEditing(true) }} type="button"><Pencil /> Edit project</Button>}
        </div>
      </section>

      <section className="workshop-project-metric-grid">
        <Metric icon={<CheckCircle2 />} label="Progress" value={`${progress}%`} />
        <Metric icon={<ListChecks />} label="Completed tasks" value={`${completedTasks} / ${projectTasks.length}`} />
        <Metric icon={<Clock3 />} label="In progress" value={String(activeTasks)} />
        <Metric icon={<CalendarDays />} label="Last updated" value={project.updatedAt} />
      </section>

      <div className="workshop-project-detail-layout">
        <div className="workshop-project-detail-main">
          <Card className="workshop-project-overview-card">
            <CardHeader>
              <CardTitle>Project overview</CardTitle>
              <CardDescription>Ownership, schedule, and delivery progress.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="workshop-project-overview-grid">
                <Detail icon={<Users />} label="Owning team" value={team?.name ?? "Team unavailable"} />
                <Detail icon={<UserRound />} label="Project lead" value={lead?.name ?? "Assigned project lead"} />
                <Detail icon={<CalendarDays />} label="Start date" value={formatDate(project.startDate)} />
                <Detail icon={<Rocket />} label="Target release" value={formatDate(project.targetDate)} />
              </div>
              <div className="workshop-project-progress">
                <span><strong>Delivery progress</strong><b>{progress}%</b></span>
                <Progress value={progress} />
                <small>{completedTasks} of {projectTasks.length} tasks completed</small>
              </div>
            </CardContent>
          </Card>

          <Card className="workshop-project-technical-card">
            <CardHeader>
              <CardTitle>Technical setup</CardTitle>
              <CardDescription>The primary services and delivery conventions for this project.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="workshop-project-technical-grid">
                <Detail icon={<GitBranch />} label="Repository" value={project.repository} />
                <Detail icon={<Workflow />} label="Delivery method" value={project.sdlc} />
                <Detail icon={<Database />} label="Data storage" value={project.database} />
                <Detail icon={<Layers3 />} label="Environments" value={project.environments.join(" · ") || "Not specified"} />
              </div>
              <div className="workshop-project-detail-stack">
                <span>Tech stack</span>
                <div>{project.techStack.length > 0 ? project.techStack.map((technology) => <Badge key={technology} variant="secondary">{technology}</Badge>) : <small>No technologies added yet.</small>}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="workshop-project-task-card">
            <CardHeader>
              <CardTitle>Project tasks</CardTitle>
              <CardDescription>A snapshot of work tied to this project.</CardDescription>
            </CardHeader>
            <CardContent>
              {projectTasks.length > 0 ? projectTasks.slice(0, 6).map((task) => (
                <div key={task.id}>
                  <span><strong>{task.title}</strong><small>{task.label} · {task.priority} priority</small></span>
                  <Badge variant={task.status === "done" ? "secondary" : "outline"}>{task.status === "progress" ? "In progress" : task.status}</Badge>
                </div>
              )) : <p>No tasks have been added to this project yet.</p>}
            </CardContent>
          </Card>
        </div>

        <aside className="workshop-project-detail-sidebar">
          <Card>
            <CardHeader><CardTitle>Project links</CardTitle><CardDescription>Open the project’s working resources.</CardDescription></CardHeader>
            <CardContent className="workshop-project-resource-list">
              <ResourceLink href={project.repository.startsWith("http") ? project.repository : undefined} icon={<GitBranch />} label="Repository" />
              <ResourceLink href={project.documentationUrl} icon={<FileText />} label="Documentation" />
              <ResourceLink href={project.designUrl} icon={<Layers3 />} label="Design file" />
              <ResourceLink href={project.liveUrl} icon={<ExternalLink />} label="Live application" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Project access</CardTitle><CardDescription>Who can change this project.</CardDescription></CardHeader>
            <CardContent className="workshop-project-access">
              <span><Users /><div><strong>{team?.name ?? "Owning team"}</strong><small>Team members can view project work.</small></div></span>
              <span><Pencil /><div><strong>Owner and team leader</strong><small>Can update project information.</small></div></span>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog onOpenChange={setIsEditing} open={isEditing}>
        {isEditing && (
          <DialogContent className="workshop-modal workshop-project-edit-modal sm:max-w-3xl">
            <span className="workshop-modal-icon"><Pencil /></span>
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
              <DialogDescription>Update the information teammates use to understand and deliver this project.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave}>
              <div className="workshop-project-edit-grid">
                <Label>Project name<Input defaultValue={project.name} maxLength={150} name="name" required /></Label>
                <Label>Status<Select defaultValue={project.status} name="status"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{projectStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></Label>
                <Label className="wide">Summary<Textarea defaultValue={project.summary} maxLength={2000} name="summary" required rows={4} /></Label>
                <Label className="wide">Tech stack <span>Separate values with commas</span><Input defaultValue={project.techStack.join(", ")} name="techStack" placeholder="React, .NET, PostgreSQL" /></Label>
                <Label className="wide">Repository URL<Input defaultValue={project.repository.startsWith("http") ? project.repository : ""} name="repositoryUrl" placeholder="https://github.com/..." type="url" /></Label>
                <Label>Delivery method<Input defaultValue={project.sdlc === "Not specified" ? "" : project.sdlc} maxLength={150} name="sdlcMethod" /></Label>
                <Label>Database and storage<Input defaultValue={project.database === "Not specified" ? "" : project.database} maxLength={500} name="databaseDetails" /></Label>
                <Label className="wide">Environments <span>Separate values with commas</span><Input defaultValue={project.environments.join(", ")} name="environments" placeholder="Development, Staging, Production" /></Label>
                <Label>Start date<Input defaultValue={project.startDate} name="startDate" type="date" /></Label>
                <Label>Target release<Input defaultValue={project.targetDate} name="targetDate" type="date" /></Label>
                <Label>Documentation URL<Input defaultValue={project.documentationUrl} name="documentationUrl" type="url" /></Label>
                <Label>Design URL<Input defaultValue={project.designUrl} name="designUrl" type="url" /></Label>
                <Label className="wide">Live application URL<Input defaultValue={project.liveUrl} name="liveUrl" type="url" /></Label>
              </div>
              {saveError && <p className="workshop-form-error">{saveError}</p>}
              <div className="workshop-project-edit-actions">
                <Button onClick={() => setIsEditing(false)} type="button" variant="ghost">Cancel</Button>
                <Button disabled={isSaving} type="submit">{isSaving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Save changes</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></CardContent></Card>
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div>{icon}<span><small>{label}</small><strong>{value}</strong></span></div>
}

function ResourceLink({ href, icon, label }: { href?: string; icon: React.ReactNode; label: string }) {
  if (!href) return <span className="disabled">{icon}<strong>{label}</strong><small>Not linked</small></span>
  return <a href={href} rel="noreferrer" target="_blank">{icon}<strong>{label}</strong><ArrowUpRight /></a>
}

function optionalValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim() || undefined
}

function splitTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, values) => item && values.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 10)
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`))
}
