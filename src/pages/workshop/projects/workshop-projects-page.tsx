import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode, useId, useMemo, useState} from "react"
import {
    Check,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileText,
    FolderKanban,
    LoaderCircle,
    Palette,
    Plus,
    ShieldCheck,
    Tag,
    X,
} from "lucide-react"
import {Link, useOutletContext} from "react-router-dom"

import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {WorkshopEmptyState} from "@/features/workshop/workshop-empty-state"
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useWorkshop} from "@/features/workshop/workshop-context"
import {sdlcModelIds, sdlcModels} from "@/features/workshop/sdlc-models"
import {ProjectFormField as ProjectField} from "@/features/workshop/project-form-field"
import type {ProjectStatus, SaveProjectInput, WorkshopMember,} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {createClientId} from "@/lib/create-client-id"
import {useCreateProjectMutation, useListTeamMembersQuery,} from "@/services/api"
import "@/features/workshop/project-create.css"
import "@/features/workshop/project-cards.css"
import {GitHubRepositoriesField} from "@/features/workshop/github-repositories-field"
import {readGitHubSelections} from "@/features/workshop/github-repository-selection"

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
    {label: "Basics", title: "Project basics"},
    {label: "Technical", title: "Technical setup"},
    {label: "Delivery", title: "Delivery plan"},
    {label: "Links", title: "Working links"},
]

export function WorkshopProjectsPage() {
    const wizardId = useId()
    const {
        organization,
        project: currentProject,
        selectProject,
    } = useOutletContext<WorkshopOutletContext>()
    const user = useAppSelector((state) => state.auth.user)
    const {addProject} = useWorkshop()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [wizardStep, setWizardStep] = useState(0)
    const [selectedTeamId, setSelectedTeamId] = useState("")
    const [selectedLeadId, setSelectedLeadId] = useState("")
    const [projectError, setProjectError] = useState("")
    const [createProject, {isLoading: isCreating}] = useCreateProjectMutation()
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
    const {data: apiTeamMembers} = useListTeamMembersQuery(
        {organizationId: organization.id, teamId: selectedTeamId},
        {skip: !isPersistedOrganization || !selectedTeamId},
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
            {organization.projects.length > 0 && <section className="workshop-page-heading compact">
                <div>

                    <h2>Everything your teams are building.</h2>

                </div>
                {manageableTeams.length ? (
                    <Button className="workshop-page-action" onClick={openCreateProject} type="button"><Plus/> New
                        project</Button>
                ) : organization.teams.length === 0 ? (
                    <Button className="workshop-page-action" disabled title="Create a team first"
                            type="button"><Plus/> Create a team first</Button>
                ) : (
                    <span className="workshop-owner-only"><ShieldCheck/> Owner or team leader managed</span>
                )}
            </section>}

            {organization.projects.length ? (
                <div className="workshop-project-grid">
                    {organization.projects.map(project => (
                        <article className={`project-summary-card${currentProject?.id === project.id ? " current" : ""}`} key={project.id}>
                            <header>
                                <div className="project-summary-heading">
                                    <span className="workshop-project-icon" aria-hidden="true"><FolderKanban/></span>
                                    <h3><Link className="project-summary-link" to={project.id} aria-label={`Open project ${project.name}`}>{project.name}</Link></h3>
                                </div>
                                <span className="workshop-status-badge" data-status={project.status}>{project.status}</span>
                            </header>
                            <p>{project.summary}</p>
                            <footer>
                                {currentProject?.id === project.id && <span className="project-summary-current"><Check aria-hidden="true"/>Current project</span>}
                                <Button className="project-summary-set-current" type="button" variant="outline" size="sm"
                                    disabled={currentProject?.id === project.id} onClick={() => selectProject(project.id)}
                                    aria-label={`Set ${project.name} as current project`}>Set as current</Button>
                            </footer>
                        </article>
                    ))}
                </div>
            ) : (
                <WorkshopEmptyState icon={FolderKanban} title="No projects yet"
                    description={organization.teams.length === 0 ? "Create a team first, then add a project to bring your work together." : "Projects you can access will appear here. Create a project to get started."}
                    action={manageableTeams.length > 0 ? <Button onClick={openCreateProject} type="button"><Plus/>Create project</Button>
                        : organization.teams.length === 0 ? <Button asChild variant="outline"><Link to={`/workshop/${organization.id}/teams`}>View teams</Link></Button> : undefined}/>
            )}

            <Dialog open={isModalOpen} onOpenChange={open => {if (!isCreating) setIsModalOpen(open)}}>
                {isModalOpen && (
                    <DialogContent className="workshop-modal project-create-dialog" aria-describedby={undefined} showCloseButton={!isCreating}>
                        <DialogHeader className="project-create-header">
                            <span className="workshop-modal-icon" aria-hidden="true"><FolderKanban/></span>
                            <DialogTitle>Create project</DialogTitle>
                            <span className="project-create-step-count">{wizardStep + 1} / {projectWizardSteps.length}</span>
                        </DialogHeader>
                        <nav aria-label="Project creation progress" className="project-create-progress">
                            <ol>{projectWizardSteps.map(({label}, index) => (
                                <li aria-current={wizardStep === index ? "step" : undefined} data-complete={wizardStep > index} key={label}>
                                    <span aria-hidden="true">{wizardStep > index ? <Check/> : index + 1}</span>
                                    <span>{label}</span>
                                </li>
                            ))}</ol>
                        </nav>
                        <form className="project-create-form" onSubmit={handleCreateProject}>
                            <div className="project-create-body">
                                <h3>{projectWizardSteps[wizardStep].title}</h3>
                                <section className="project-create-step" data-wizard-step="0" hidden={wizardStep !== 0}>
                                    <div className="project-create-grid">
                                        <ProjectField id={`${wizardId}-name`} label="Project name">
                                            <Input id={`${wizardId}-name`} autoFocus maxLength={150} name="name" placeholder="e.g. Northstar" required/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-status`} label="Status">
                                            <Select defaultValue="Planning" name="status"><SelectTrigger id={`${wizardId}-status`}><SelectValue/></SelectTrigger><SelectContent>{projectStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-summary`} label="Summary" wide>
                                            <Textarea id={`${wizardId}-summary`} maxLength={2000} name="summary" placeholder="A short project summary" required rows={3}/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-team`} label="Owning team">
                                            <Select name="teamId" onValueChange={chooseTeam} required value={selectedTeamId}><SelectTrigger id={`${wizardId}-team`}><SelectValue placeholder="Choose a team"/></SelectTrigger><SelectContent>{manageableTeams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-lead`} label="Project lead">
                                            <Select name="leadUserId" onValueChange={setSelectedLeadId} required value={selectedLeadId}><SelectTrigger id={`${wizardId}-lead`}><SelectValue placeholder="Choose a lead"/></SelectTrigger><SelectContent>{teamMembers.length === 0 && selectedTeam && <SelectItem value={selectedTeam.leaderId}>Team leader</SelectItem>}{teamMembers.map(member => <SelectItem key={member.id} value={member.id}>{member.name} · @{member.username}</SelectItem>)}</SelectContent></Select>
                                        </ProjectField>
                                    </div>
                                </section>
                                <section className="project-create-step" data-wizard-step="1" hidden={wizardStep !== 1}>
                                    <div className="project-create-grid">
                                        <div className="project-create-field wide"><GitHubRepositoriesField/></div>
                                        <ProjectField id={`${wizardId}-repository`} label="Repository URL" hint="Optional" wide>
                                            <Input id={`${wizardId}-repository`} name="repositoryUrl" placeholder="https://github.com/organization/project" type="url"/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-stack`} label="Tech stack" hint="Optional" wide>
                                            <ChipInput id={`${wizardId}-stack`} name="techStack" placeholder="React, TypeScript, .NET"/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-database`} label="Database & storage" hint="Optional">
                                            <ChipInput id={`${wizardId}-database`} maxLength={500} name="databaseDetails" placeholder="SQL Server, Redis"/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-environments`} label="Environments" hint="Optional">
                                            <ChipInput id={`${wizardId}-environments`} name="environments" placeholder="Development, Production"/>
                                        </ProjectField>
                                    </div>
                                </section>
                                <section className="project-create-step" data-wizard-step="2" hidden={wizardStep !== 2}>
                                    <div className="project-create-grid">
                                        <ProjectField id={`${wizardId}-method`} label="SDLC method" hint="Optional" wide>
                                            <Select name="sdlcMethod" defaultValue="unspecified">
                                                <SelectTrigger id={`${wizardId}-method`}><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unspecified">Not specified</SelectItem>
                                                    {sdlcModelIds.map(id => <SelectItem key={id} value={sdlcModels[id].title}>{sdlcModels[id].title}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-start`} label="Start date" hint="Optional">
                                            <Input id={`${wizardId}-start`} name="startDate" type="date"/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-target`} label="Target release" hint="Optional">
                                            <Input id={`${wizardId}-target`} name="targetDate" type="date"/>
                                        </ProjectField>
                                    </div>
                                </section>
                                <section className="project-create-step" data-wizard-step="3" hidden={wizardStep !== 3}>
                                    <div className="project-create-grid single">
                                        <ProjectField id={`${wizardId}-docs`} label="Documentation" hint="Optional">
                                            <FileInput id={`${wizardId}-docs`} icon={<FileText/>} name="documentationUrl" placeholder="https://docs.example.com"/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-design`} label="Design file" hint="Optional">
                                            <FileInput id={`${wizardId}-design`} icon={<Palette/>} name="designUrl" placeholder="https://figma.com/..."/>
                                        </ProjectField>
                                        <ProjectField id={`${wizardId}-app`} label="Live app" hint="Optional">
                                            <FileInput id={`${wizardId}-app`} icon={<ExternalLink/>} name="liveUrl" placeholder="https://app.example.com"/>
                                        </ProjectField>
                                    </div>
                                </section>
                                {projectError && <WorkshopToast variant="error" onDismiss={() => setProjectError("")}>{projectError}</WorkshopToast>}
                            </div>
                            <div className="project-create-footer">
                                <Button disabled={isCreating} onClick={() => setIsModalOpen(false)} type="button" variant="ghost">Cancel</Button>
                                <div>
                                    {wizardStep > 0 && <Button disabled={isCreating} onClick={() => {setProjectError(""); setWizardStep(current => current - 1)}} type="button" variant="outline"><ChevronLeft/>Back</Button>}
                                    {wizardStep < projectWizardSteps.length - 1 ? <Button onClick={event => advanceWizard(event.currentTarget.form!)} type="button">Next<ChevronRight/></Button>
                                        : <Button disabled={isCreating} type="submit">{isCreating ? <LoaderCircle className="animate-spin"/> : <Plus/>}{isCreating ? "Creating…" : "Create project"}</Button>}
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
                       id,
                       icon,
                       name,
                       placeholder,
                   }: {
    id: string
    icon: ReactNode
    name: string
    placeholder: string
}) {
    return <span className="project-create-link">{icon}<Input id={id} name={name} placeholder={placeholder} type="url"/></span>
}

function ChipInput({
                       id,
                       maxLength,
                       name,
                       placeholder,
                   }: {
    id: string
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
            id={id}
            disabled={chips.length >= maxTags}
            maxLength={maxLength}
            onBlur={commitDraft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={chips.length >= maxTags ? "Tag limit reached" : placeholder}
            value={draft}
        />
        <Button aria-label="Add tag" disabled={!draft.trim() || chips.length >= maxTags} onClick={commitDraft}
                size="icon" type="button" variant="ghost"><Tag/></Button>
      </span>
      <span className={`workshop-tag-list${chips.length === 0 ? " empty" : ""}`}>
        {chips.map((chip) => (
            <span className="workshop-input-chip" key={chip}>
            {chip}
                <Button
                    aria-label={`Remove ${chip}`}
                    onClick={() => setChips((current) => current.filter((value) => value !== chip))}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
              <X/>
            </Button>
          </span>
        ))}
      </span>
      <span className="workshop-tag-footer">
        <small>{chips.length} / {maxTags}</small>
        <Button disabled={chips.length === 0 && !draft} onClick={() => {
            setChips([]);
            setDraft("")
        }} size="xs" type="button" variant="ghost">Clear all</Button>
      </span>
      <Input name={name} type="hidden"
             value={[...chips, ...(chips.length < maxTags && draft.trim() ? [draft.trim()] : [])].join(", ")}/>
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
        gitHubRepositories: readGitHubSelections(form.get("githubRepositories")),
        documentationUrl: optional("documentationUrl"),
        designUrl: optional("designUrl"),
        liveUrl: optional("liveUrl"),
        sdlcMethod: form.get("sdlcMethod") === "unspecified" ? undefined : optional("sdlcMethod"),
        databaseDetails: optional("databaseDetails"),
        environments: list("environments"),
        startDate: optional("startDate"),
        targetDate: optional("targetDate"),
    }
}
