import { useMemo, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react"
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  FolderKanban,
  GitBranch,
  Layers3,
  LoaderCircle,
  Palette,
  Plus,
  Rocket,
  ShieldCheck,
  Tag,
  UserRound,
  Users,
  Workflow,
  X,
} from "lucide-react"
import { Link, useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import { useWorkshop } from "@/features/workshop/workshop-context"
import type {
  ProjectStatus,
  SaveProjectInput,
  WorkshopMember,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { createClientId } from "@/lib/create-client-id"
import {
  useCreateProjectMutation,
  useListTeamMembersQuery,
} from "@/services/api"

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const projectStatuses: ProjectStatus[] = [
  "Planning",
  "In development",
  "Review",
  "On hold",
  "Shipped",
  "Archived",
]
const projectWizardSteps = [
  { label: "Basics", title: "Project basics", description: "Name the project and assign its team and lead.", icon: FolderKanban },
  { label: "Technical", title: "Technical setup", description: "Record where the project lives and what it is built with.", icon: Database },
  { label: "Delivery", title: "Delivery plan", description: "Set the working method and important project dates.", icon: CalendarDays },
  { label: "Links", title: "Working links", description: "Connect documentation, designs, and the live application.", icon: ExternalLink },
]

export function WorkshopProjectsPage() {
  const {
    organization,
    project: currentProject,
    selectProject,
  } = useOutletContext<WorkshopOutletContext>()
  const user = useAppSelector((state) => state.auth.user)
  const { addProject } = useWorkshop()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [selectedLeadId, setSelectedLeadId] = useState("")
  const [projectError, setProjectError] = useState("")
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation()
  const isPersistedOrganization = guidPattern.test(organization.id)
  const canManageProjects = hasWorkshopPermission(
    organization,
    user?.id ?? "current",
    "Manage projects",
  )
  const manageableTeams = useMemo(
    () => organization.teams.filter((team) =>
      canManageProjects || team.leaderId === user?.id || team.leaderId === "current",
    ),
    [canManageProjects, organization.teams, user?.id],
  )
  const selectedTeam = manageableTeams.find((team) => team.id === selectedTeamId)
  const { data: apiTeamMembers } = useListTeamMembersQuery(
    { organizationId: organization.id, teamId: selectedTeamId },
    { skip: !isPersistedOrganization || !selectedTeamId },
  )
  const teamMembers = useMemo<WorkshopMember[]>(() => {
    if (!isPersistedOrganization) {
      return organization.members.filter((member) => selectedTeam?.memberIds.includes(member.id))
    }

    return (apiTeamMembers ?? []).map((member) => ({
      ...organization.members.find((candidate) => candidate.id === member.id),
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      username: member.username ?? member.email.split("@")[0],
      initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
      avatarUrl: member.avatarUrl,
      roleId: organization.members.find((candidate) => candidate.id === member.id)?.roleId ?? "member",
      teamIds: [selectedTeamId],
      online: organization.members.find((candidate) => candidate.id === member.id)?.online ?? false,
      presenceStatus: organization.members.find((candidate) => candidate.id === member.id)?.presenceStatus ?? "offline",
    }))
  }, [apiTeamMembers, isPersistedOrganization, organization.members, selectedTeam?.memberIds, selectedTeamId])

  function openCreateProject() {
    const firstTeam = manageableTeams[0]
    if (!firstTeam) return
    setSelectedTeamId(firstTeam.id)
    setSelectedLeadId(firstTeam.leaderId)
    setProjectError("")
    setWizardStep(0)
    setIsModalOpen(true)
  }

  function chooseTeam(teamId: string) {
    const team = manageableTeams.find((candidate) => candidate.id === teamId)
    setSelectedTeamId(teamId)
    setSelectedLeadId(team?.leaderId ?? "")
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (wizardStep < projectWizardSteps.length - 1) {
      advanceWizard(event.currentTarget)
      return
    }

    setProjectError("")
    const form = new FormData(event.currentTarget)
    const project = readProjectInput(form, selectedTeamId, selectedLeadId)

    if (!project.name || !project.summary || !project.teamId || !project.leadUserId) {
      setProjectError("Add a name and summary, then choose the owning team and project lead.")
      return
    }

    if (project.startDate && project.targetDate && project.targetDate < project.startDate) {
      setProjectError("The target date cannot be earlier than the start date.")
      return
    }

    try {
      if (isPersistedOrganization) {
        const created = await createProject({
          organizationId: organization.id,
          project,
        }).unwrap()
        selectProject(created.id)
      } else {
        const created = {
          id: createClientId(),
          name: project.name,
          summary: project.summary,
          status: project.status,
          teamIds: [project.teamId],
          leadUserId: project.leadUserId,
          techStack: project.techStack,
          repository: project.repositoryUrl || "Not linked",
          sdlc: project.sdlcMethod || "Not specified",
          database: project.databaseDetails || "Not specified",
          documentationUrl: project.documentationUrl,
          designUrl: project.designUrl,
          liveUrl: project.liveUrl,
          environments: project.environments,
          startDate: project.startDate,
          targetDate: project.targetDate,
          updatedAt: "Just now",
        }
        addProject(organization.id, created)
        selectProject(created.id)
      }

      setIsModalOpen(false)
    } catch (error) {
      setProjectError(getApiErrorMessage(error))
    }
  }

  function advanceWizard(form: HTMLFormElement) {
    setProjectError("")
    const activePanel = form.querySelector<HTMLElement>(`[data-wizard-step="${wizardStep}"]`)
    const fields = activePanel?.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select") ?? []

    for (const field of fields) {
      if (!field.reportValidity()) return
    }

    if (wizardStep === 2) {
      const values = new FormData(form)
      const startDate = String(values.get("startDate") ?? "")
      const targetDate = String(values.get("targetDate") ?? "")
      if (startDate && targetDate && targetDate < startDate) {
        setProjectError("The target date cannot be earlier than the start date.")
        return
      }
    }

    setWizardStep((current) => Math.min(projectWizardSteps.length - 1, current + 1))
  }

  return (
    <div className="workshop-page">
      <section className="workshop-page-heading compact">
        <div>

          <h2>Everything your teams are building.</h2>

        </div>
        {manageableTeams.length ? (
          <Button className="workshop-page-action" onClick={openCreateProject} type="button"><Plus /> New project</Button>
        ) : organization.teams.length === 0 ? (
          <Button className="workshop-page-action" disabled title="Create a team first" type="button"><Plus /> Create a team first</Button>
        ) : (
          <span className="workshop-owner-only"><ShieldCheck /> Owner or team leader managed</span>
        )}
      </section>

      {organization.projects.length ? (
        <div className="workshop-project-grid">
          {organization.projects.map((project) => {
            const teams = organization.teams.filter((team) => project.teamIds.includes(team.id))
            const lead = organization.members.find((member) => member.id === project.leadUserId)
            return (
              <article className={currentProject?.id === project.id ? "current" : ""} key={project.id}>
                <header>
                  <span className="workshop-project-icon"><FolderKanban /></span>
                  <span className="workshop-status-badge" data-status={project.status}>{project.status}</span>
                </header>
                <div className="workshop-project-title">
                  <h3>{project.name}</h3>
                  {currentProject?.id === project.id && <small>Current</small>}
                </div>
                <p>{project.summary}</p>
                <div className="workshop-project-ownership">
                  <span><Users /> {teams.map((team) => team.name).join(" + ") || "Team unavailable"}</span>
                  <span><UserRound /> {lead?.name ?? "Assigned project lead"}</span>
                </div>
                <div className="workshop-project-meta">
                  <div><GitBranch /><span><small>Repository</small><strong>{project.repository}</strong></span>{project.repository.startsWith("http") && <ArrowUpRight />}</div>
                  <div><Workflow /><span><small>Delivery method</small><strong>{project.sdlc}</strong></span></div>
                  <div><Database /><span><small>Data storage</small><strong>{project.database}</strong></span></div>
                  <div><Layers3 /><span><small>Environments</small><strong>{project.environments.join(" · ") || "Not specified"}</strong></span></div>
                </div>
                {project.techStack.length > 0 && <div className="workshop-stack-row">{project.techStack.map((technology) => <span key={technology}>{technology}</span>)}</div>}
                {(project.documentationUrl || project.designUrl || project.liveUrl) && (
                  <div className="workshop-project-links">
                    {project.documentationUrl && <a href={project.documentationUrl} rel="noreferrer" target="_blank"><FileText /> Docs</a>}
                    {project.designUrl && <a href={project.designUrl} rel="noreferrer" target="_blank"><Palette /> Design</a>}
                    {project.liveUrl && <a href={project.liveUrl} rel="noreferrer" target="_blank"><Rocket /> Live</a>}
                  </div>
                )}
                <footer>
                  <span><CalendarDays /> {formatSchedule(project.startDate, project.targetDate)}</span>
                  <div className="workshop-project-card-actions">
                    <Button asChild size="sm" variant="outline"><Link to={project.id}>Open project <ArrowUpRight /></Link></Button>
                    <Button disabled={currentProject?.id === project.id} onClick={() => selectProject(project.id)} size="sm" type="button" variant="outline">
                      {currentProject?.id === project.id ? "Selected" : "Set current"}
                    </Button>
                  </div>
                </footer>
              </article>
            )
          })}
        </div>
      ) : (
        <section className="workshop-empty-panel">
          <FolderKanban />
          <h3>Create your first project</h3>
          <p>Start with the owning team and lead, then capture the technical setup, delivery plan, dates, and working links.</p>
          {manageableTeams.length > 0 && <Button onClick={openCreateProject} type="button"><Plus /> New project</Button>}
        </section>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {isModalOpen && (
          <DialogContent className="workshop-modal workshop-project-modal sm:max-w-2xl">
            <span className="workshop-modal-icon"><FolderKanban /></span>
            <DialogHeader>
              <DialogTitle id="project-modal-title">Create a project</DialogTitle>
              <DialogDescription>Capture the details people need to understand, build, and ship the project.</DialogDescription>
            </DialogHeader>
            <nav aria-label="Project creation progress" className="workshop-wizard-progress">
              {projectWizardSteps.map(({ icon: Icon, label }, index) => (
                <div
                  aria-current={wizardStep === index ? "step" : undefined}
                  className={wizardStep === index ? "active" : wizardStep > index ? "complete" : ""}
                  key={label}
                >
                  <span>{wizardStep > index ? <Check /> : <Icon />}</span>
                  <small>{label}</small>
                </div>
              ))}
            </nav>
            <div className="workshop-wizard-heading">
              <span>Step {wizardStep + 1} of {projectWizardSteps.length}</span>
              <h3>{projectWizardSteps[wizardStep].title}</h3>
              <p>{projectWizardSteps[wizardStep].description}</p>
            </div>
            <form onSubmit={handleCreateProject}>
              <section className="workshop-project-wizard-panel" data-wizard-step="0" hidden={wizardStep !== 0}>
                <div className="workshop-form-grid">
                  <Label>Project name<Input autoFocus maxLength={150} name="name" placeholder="Northstar" required /></Label>
                  <Label>Status<Select defaultValue="Planning" name="status"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{projectStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></Label>
                  <Label className="wide">Summary<Textarea maxLength={2000} name="summary" placeholder="What is this project and what outcome should it create?" required rows={3} /></Label>
                  <Label>Owning team<Select name="teamId" onValueChange={chooseTeam} required value={selectedTeamId}><SelectTrigger className="w-full"><SelectValue placeholder="Choose a team" /></SelectTrigger><SelectContent>{manageableTeams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select></Label>
                  <Label>Project lead<Select name="leadUserId" onValueChange={setSelectedLeadId} required value={selectedLeadId}><SelectTrigger className="w-full"><SelectValue placeholder="Choose a project lead" /></SelectTrigger><SelectContent>{teamMembers.length === 0 && selectedTeam && <SelectItem value={selectedTeam.leaderId}>Team leader</SelectItem>}{teamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · @{member.username}</SelectItem>)}</SelectContent></Select></Label>
                </div>
              </section>

              <section className="workshop-project-wizard-panel" data-wizard-step="1" hidden={wizardStep !== 1}>
                <div className="workshop-form-grid">
                  <Label className="wide">GitHub or repository URL <span>Optional</span><Input name="repositoryUrl" placeholder="https://github.com/organization/project" type="url" /></Label>
                  <Label className="wide">Tech stack <span>Up to 10 tags</span><ChipInput name="techStack" placeholder="Press Enter or add a comma after each technology" /></Label>
                  <Label className="wide">Database & storage <span>Optional</span><ChipInput maxLength={500} name="databaseDetails" placeholder="Press Enter or add a comma after each service" /></Label>
                  <Label className="wide">Environments <span>Up to 10 tags</span><ChipInput name="environments" placeholder="Press Enter or add a comma after each environment" /></Label>
                </div>
              </section>

              <section className="workshop-project-wizard-panel" data-wizard-step="2" hidden={wizardStep !== 2}>
                <div className="workshop-form-grid three">
                  <Label>SDLC method<Input maxLength={150} name="sdlcMethod" placeholder="Agile · 2-week sprints" /></Label>
                  <Label>Start date<Input name="startDate" type="date" /></Label>
                  <Label>Target release<Input name="targetDate" type="date" /></Label>
                </div>
              </section>

              <section className="workshop-project-wizard-panel" data-wizard-step="3" hidden={wizardStep !== 3}>
                <div className="workshop-form-grid three">
                  <Label>Documentation<FileInput icon={<FileText />} name="documentationUrl" placeholder="https://docs..." /></Label>
                  <Label>Design file<FileInput icon={<Palette />} name="designUrl" placeholder="https://figma.com/..." /></Label>
                  <Label>Live app<FileInput icon={<ExternalLink />} name="liveUrl" placeholder="https://app..." /></Label>
                </div>
              </section>

              {projectError && <p className="workshop-form-error">{projectError}</p>}
              <div className="workshop-project-form-actions">
                <Button onClick={() => setIsModalOpen(false)} type="button" variant="ghost">Cancel</Button>
                <div>
                  {wizardStep > 0 && <Button onClick={() => { setProjectError(""); setWizardStep((current) => current - 1) }} type="button" variant="outline"><ChevronLeft /> Back</Button>}
                  {wizardStep < projectWizardSteps.length - 1 ? (
                    <Button className="workshop-primary-action" onClick={(event) => advanceWizard(event.currentTarget.form!)} type="button">Next <ChevronRight /></Button>
                  ) : (
                    <Button className="workshop-primary-action" disabled={isCreating} type="submit">
                      {isCreating ? <LoaderCircle className="animate-spin" /> : <Plus />}
                      Create project
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function FileInput({
  icon,
  name,
  placeholder,
}: {
  icon: React.ReactNode
  name: string
  placeholder: string
}) {
  return <span className="workshop-link-input">{icon}<Input name={name} placeholder={placeholder} type="url" /></span>
}

function ChipInput({
  maxLength,
  name,
  placeholder,
}: {
  maxLength?: number
  name: string
  placeholder: string
}) {
  const maxTags = 10
  const [chips, setChips] = useState<string[]>([])
  const [draft, setDraft] = useState("")

  function addChips(values: string[]) {
    const additions = values.map((value) => value.trim()).filter(Boolean)
    if (additions.length === 0) return

    setChips((current) => {
      const next = [...current]
      for (const addition of additions) {
        if (next.length >= maxTags) break
        if (!next.some((chip) => chip.toLocaleLowerCase() === addition.toLocaleLowerCase())) {
          next.push(addition)
        }
      }
      return next
    })
  }

  function commitDraft() {
    addChips([draft])
    setDraft("")
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (!value.includes(",")) {
      setDraft(value)
      return
    }

    const values = value.split(",")
    addChips(values.slice(0, -1))
    setDraft(values.at(-1) ?? "")
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && draft.trim()) {
      event.preventDefault()
      commitDraft()
    } else if (event.key === "Backspace" && !draft && chips.length > 0) {
      setChips((current) => current.slice(0, -1))
    }
  }

  return (
    <span className="workshop-tag-editor">
      <span className="workshop-tag-entry">
        <Input
          aria-label={`Add ${name}`}
          disabled={chips.length >= maxTags}
          maxLength={maxLength}
          onBlur={commitDraft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={chips.length >= maxTags ? "Tag limit reached" : placeholder}
          value={draft}
        />
        <Button aria-label="Add tag" disabled={!draft.trim() || chips.length >= maxTags} onClick={commitDraft} size="icon" type="button" variant="ghost"><Tag /></Button>
      </span>
      <span className={`workshop-tag-list${chips.length === 0 ? " empty" : ""}`}>
        {chips.length === 0 ? (
          <small>Your tags will appear here</small>
        ) : chips.map((chip) => (
          <span className="workshop-input-chip" key={chip}>
            {chip}
            <Button
              aria-label={`Remove ${chip}`}
              onClick={() => setChips((current) => current.filter((value) => value !== chip))}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </span>
        ))}
      </span>
      <span className="workshop-tag-footer">
        <small>{maxTags - chips.length} {maxTags - chips.length === 1 ? "tag" : "tags"} remaining</small>
        <Button disabled={chips.length === 0 && !draft} onClick={() => { setChips([]); setDraft("") }} size="xs" type="button" variant="ghost">Clear all</Button>
      </span>
      <Input name={name} type="hidden" value={[...chips, ...(chips.length < maxTags && draft.trim() ? [draft.trim()] : [])].join(", ")} />
    </span>
  )
}

function readProjectInput(
  form: FormData,
  teamId: string,
  leadUserId: string,
): SaveProjectInput {
  const optional = (name: string) => String(form.get(name) ?? "").trim() || undefined
  const list = (name: string) => String(form.get(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    name: String(form.get("name") ?? "").trim(),
    summary: String(form.get("summary") ?? "").trim(),
    status: String(form.get("status") ?? "Planning") as ProjectStatus,
    teamId,
    leadUserId,
    techStack: list("techStack"),
    repositoryUrl: optional("repositoryUrl"),
    documentationUrl: optional("documentationUrl"),
    designUrl: optional("designUrl"),
    liveUrl: optional("liveUrl"),
    sdlcMethod: optional("sdlcMethod"),
    databaseDetails: optional("databaseDetails"),
    environments: list("environments"),
    startDate: optional("startDate"),
    targetDate: optional("targetDate"),
  }
}

function formatSchedule(startDate?: string, targetDate?: string) {
  if (!startDate && !targetDate) return "Dates not set"
  if (!startDate) return `Target ${formatDate(targetDate!)}`
  if (!targetDate) return `Started ${formatDate(startDate)}`
  return `${formatDate(startDate)} – ${formatDate(targetDate)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
    .format(new Date(`${value}T00:00:00`))
}
