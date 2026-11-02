import {type FormEvent, type ReactNode, useState} from "react"
import {Tabs as TabsPrimitive} from "radix-ui"
import {
    ArrowLeft,
    ArrowUpRight,
    CheckCircle2,
    ExternalLink,
    FileText,
    FolderKanban,
    GitBranch,
    Pencil,
} from "lucide-react"
import {Link, useOutletContext, useParams} from "react-router-dom"

import {useAppSelector} from "@/app/hooks"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {WorkshopEmptyState} from "@/features/workshop/workshop-empty-state"
import {Progress} from "@/components/ui/progress"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {useWorkshop} from "@/features/workshop/workshop-context"
import {mapApiProject} from "@/features/workshop/workshop-data"
import {ProjectEditDialog, type ProjectEditSection} from "@/features/workshop/project-edit-dialog"
import {readGitHubSelections} from "@/features/workshop/github-repository-selection"
import type {ProjectStatus, SaveProjectInput, WorkshopProject,} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {useUpdateProjectMutation} from "@/services/api"
import "@/features/workshop/project-detail.css"

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function WorkshopProjectDetailPage() {
    const {projectId} = useParams()
    const {organization, project: currentProject, selectProject} = useOutletContext<WorkshopOutletContext>()
    const user = useAppSelector((state) => state.auth.user)
    const {updateProject: updateLocalProject} = useWorkshop()
    const [isEditing, setIsEditing] = useState(false)
    const [editSection, setEditSection] = useState<ProjectEditSection>("basics")
    const [saveError, setSaveError] = useState("")
    const [updateProject, {isLoading: isSaving}] = useUpdateProjectMutation()
    const matchingProject = organization.projects.find((candidate) => candidate.id === projectId)

    if (!matchingProject) {
        return (
            <div className="workshop-page">
                <WorkshopEmptyState icon={FolderKanban} title="Project not found"
                    description="This project may have been removed, or you may not have access to it."
                    action={<Button asChild variant="outline"><Link to="../projects"><ArrowLeft/>Back to projects</Link></Button>}/>
            </div>
        )
    }

    const project: WorkshopProject = matchingProject

    const team = organization.teams.find((candidate) => project.teamIds.includes(candidate.id))
    const lead = organization.members.find((member) => member.id === project.leadUserId)
    const projectTasks = organization.tasks.filter((task) => task.projectId === project.id)
    const completedTasks = projectTasks.filter((task) => task.status === "done").length
    const progress = projectTasks.length > 0
        ? Math.round((completedTasks / projectTasks.length) * 100)
        : 0
    const isPersistedOrganization = guidPattern.test(organization.id)
    const canManage = organization.ownerUserId === user?.id
        || (!isPersistedOrganization && organization.ownerUserId === "current")
        || team?.leaderId === user?.id
        || (!isPersistedOrganization && team?.leaderId === "current")
    const isCurrent = currentProject?.id === project.id
    const resources = [
        ...(project.githubRepositories ?? []).map(repo => ({label: repo.label || repo.fullName, href: repo.url, icon: GitBranch})),
        {label: "Repository", href: project.repository.startsWith("http") ? project.repository : undefined, icon: GitBranch},
        {label: "Documentation", href: project.documentationUrl, icon: FileText},
        {label: "Design file", href: project.designUrl, icon: Pencil},
        {label: "Live application", href: project.liveUrl, icon: ExternalLink},
    ].filter(resource => resource.href)

    function openEdit(section: ProjectEditSection = "basics") {
        setSaveError("")
        setEditSection(section)
        setIsEditing(true)
    }

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
            gitHubRepositories: readGitHubSelections(form.get("githubRepositories")),
            documentationUrl: optionalValue(form, "documentationUrl"),
            designUrl: optionalValue(form, "designUrl"),
            liveUrl: optionalValue(form, "liveUrl"),
            sdlcMethod: form.get("sdlcMethod") === "unspecified" ? undefined : optionalValue(form, "sdlcMethod"),
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
        <div className="workshop-page project-detail-view">
            <Link className="project-detail-back" to="../projects"><ArrowLeft/>Back to projects</Link>
            <header className="project-detail-header">
                <div className="project-detail-title">
                    <div className="project-detail-title-row">
                        <h1>{project.name}</h1>
                        <span className="workshop-status-badge" data-status={project.status}>{project.status}</span>
                        {isCurrent && <span className="project-detail-current"><CheckCircle2 aria-hidden="true"/>Current project</span>}
                    </div>
                </div>
                <div className="project-detail-actions">
                    {!isCurrent && <Button size="sm" variant="outline" onClick={() => selectProject(project.id)}>Set as current</Button>}
                    {canManage && <Button size="sm" variant="outline" onClick={() => openEdit()}><Pencil/>Edit project</Button>}
                </div>
            </header>

            <TabsPrimitive.Root className="project-detail-tabs" defaultValue="overview" key={project.id}>
                <TabsPrimitive.List aria-label="Project details">
                    <TabsPrimitive.Trigger value="overview">Overview</TabsPrimitive.Trigger>
                    <TabsPrimitive.Trigger value="technical">Technical</TabsPrimitive.Trigger>
                    <TabsPrimitive.Trigger value="links">Links</TabsPrimitive.Trigger>
                </TabsPrimitive.List>
                <TabsPrimitive.Content value="overview">
                    <section className="project-detail-section" aria-labelledby="project-info-title">
                        <h2 id="project-info-title">Project info</h2>
                        <dl className="project-detail-facts">
                            <ProjectFact label="Team" value={team?.name ?? "Team unavailable"}/>
                            <ProjectFact label="Project lead" value={lead?.name ?? "Not assigned"}/>
                            <ProjectFact label="Start date" value={formatDate(project.startDate)}/>
                            <ProjectFact label="Target release" value={formatDate(project.targetDate)}/>
                        </dl>
                        <p className="project-detail-updated">Updated {project.updatedAt}</p>
                    </section>
                    <section className="project-detail-section" aria-labelledby="project-tasks-title">
                        <div className="project-detail-section-heading">
                            <h2 id="project-tasks-title">Tasks</h2>
                            <Link to={`/workshop/${organization.id}/todo?project=${project.id}`} onClick={() => selectProject(project.id)}>View TODOs<ArrowUpRight/></Link>
                        </div>
                        {projectTasks.length > 0 ? <>
                            <div className="project-detail-task-progress">
                                <Progress value={progress} aria-label="Task completion" aria-valuenow={progress}/>
                                <span>{completedTasks} of {projectTasks.length} complete</span>
                            </div>
                            <ul className="project-detail-task-list">{projectTasks.slice(0, 5).map(task => <li key={task.id}>
                                <strong>{task.title}</strong>
                                <Badge variant={task.status === "done" ? "secondary" : "outline"}>{task.status === "progress" ? "In progress" : task.status === "done" ? "Done" : "Pending"}</Badge>
                            </li>)}</ul>
                        </> : <p className="project-detail-empty-copy">No tasks yet.</p>}
                    </section>
                </TabsPrimitive.Content>
                <TabsPrimitive.Content value="technical">
                    <section className="project-detail-section" aria-labelledby="project-technical-title">
                        <h2 id="project-technical-title">Technical setup</h2>
                        <dl className="project-detail-facts">
                            <ProjectFact label="SDLC method" value={project.sdlc}/>
                            <ProjectFact label="Database & storage" value={project.database}/>
                            <ProjectFact label="Environments" value={project.environments.join(" · ") || "Not specified"}/>
                        </dl>
                        <div className="project-detail-stack">
                            <h3>Tech stack</h3>
                            {project.techStack.length > 0 ? <div>{project.techStack.map(technology => <Badge key={technology} variant="secondary">{technology}</Badge>)}</div>
                                : <p>No technologies added.</p>}
                        </div>
                    </section>
                </TabsPrimitive.Content>
                <TabsPrimitive.Content value="links">
                    <section className="project-detail-section" aria-labelledby="project-links-title">
                        <h2 id="project-links-title">Project links</h2>
                        {resources.length > 0 ? <ul className="project-detail-resources">{resources.map(({label, href, icon: Icon}) => <li key={`${label}:${href}`}>
                            <a href={href} rel="noreferrer" target="_blank"><Icon aria-hidden="true"/><span><strong>{label}</strong><small>{href}</small></span><ArrowUpRight aria-hidden="true"/></a>
                        </li>)}</ul> : <WorkshopEmptyState className="workshop-empty-state-inset project-detail-links-empty" icon={ExternalLink} title="No links yet"
                            description={canManage ? "Add your project's repository, documentation, or other resources." : "Links shared by your team will appear here."}
                            action={canManage && <Button variant="outline" onClick={() => openEdit("links")}><Pencil/>Add links</Button>}/>}
                    </section>
                </TabsPrimitive.Content>
            </TabsPrimitive.Root>
            {isEditing && <ProjectEditDialog key={project.id} project={project} busy={isSaving} error={saveError}
                initialSection={editSection} onClose={() => setIsEditing(false)} onSave={handleSave}/>}
        </div>
    )
}

function ProjectFact({label, value}: {label: string; value: ReactNode}) {
    return <div><dt>{label}</dt><dd>{value}</dd></div>
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
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date(`${value}T00:00:00`))
}
