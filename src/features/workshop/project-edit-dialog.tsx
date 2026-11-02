import {useId, useState, type FormEvent} from "react"
import {Tabs} from "radix-ui"
import {Check, LoaderCircle, Pencil} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {ProjectFormField as Field} from "./project-form-field"
import {sdlcModelIds, sdlcModels} from "./sdlc-models"
import type {WorkshopProject} from "./workshop-types"
import "./project-create.css"
import "./project-edit-dialog.css"
import {GitHubRepositoriesField} from "./github-repositories-field"

const sections = [
    {id: "basics", label: "Basics", title: "Project basics"},
    {id: "technical", label: "Technical", title: "Technical setup"},
    {id: "delivery", label: "Delivery", title: "Delivery plan"},
    {id: "links", label: "Links", title: "Project links"},
] as const
export type ProjectEditSection = typeof sections[number]["id"]
const statuses = ["Planning", "In development", "Review", "On hold", "Shipped", "Archived"] as const

export function ProjectEditDialog({project, busy, error, initialSection = "basics", onClose, onSave}: {
    project: WorkshopProject
    busy: boolean
    error: string
    initialSection?: ProjectEditSection
    onClose: () => void
    onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
}) {
    const id = useId()
    const [section, setSection] = useState<string>(initialSection)
    const [validationError, setValidationError] = useState("")
    const method = project.sdlc === "Not specified" ? "" : project.sdlc
    const knownMethod = sdlcModelIds.some(model => sdlcModels[model].title === method)

    function focusField(field: HTMLInputElement | HTMLTextAreaElement, message: string) {
        setValidationError(message)
        const panel = field.closest<HTMLElement>("[data-edit-section]")
        if (panel?.dataset.editSection) setSection(panel.dataset.editSection)
        requestAnimationFrame(() => field.focus())
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        setValidationError("")
        const form = event.currentTarget
        for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) {
            if (field.disabled || field.type === "hidden") continue
            if (!field.checkValidity()) {
                focusField(field, field.validationMessage)
                return
            }
            if (field.required && !field.value.trim()) {
                focusField(field, "Enter a project name and summary.")
                return
            }
        }
        const start = form.elements.namedItem("startDate") as HTMLInputElement
        const target = form.elements.namedItem("targetDate") as HTMLInputElement
        if (start.value && target.value && target.value < start.value) {
            focusField(target, "The target date cannot be earlier than the start date.")
            return
        }
        void onSave(event)
    }

    return <Dialog open onOpenChange={open => {if (!open && !busy) onClose()}}>
        <DialogContent className="workshop-modal project-create-dialog project-edit-dialog" aria-describedby={undefined} showCloseButton={!busy}>
            <DialogHeader className="project-create-header">
                <span className="workshop-modal-icon" aria-hidden="true"><Pencil/></span>
                <DialogTitle>Edit project</DialogTitle>
            </DialogHeader>
            <form className="project-create-form" noValidate onSubmit={submit} onInput={() => setValidationError("")}>
                <Tabs.Root className="project-edit-tabs" value={section} onValueChange={setSection}>
                    <Tabs.List className="project-edit-tab-list" aria-label="Project settings">
                        {sections.map(item => <Tabs.Trigger key={item.id} value={item.id}>{item.label}</Tabs.Trigger>)}
                    </Tabs.List>
                    <div className="project-create-body project-edit-body">
                        <h3>{sections.find(item => item.id === section)?.title}</h3>
                        <fieldset disabled={busy} className="project-edit-fields">
                            <Tabs.Content value="basics" forceMount className="project-edit-panel" data-edit-section="basics">
                                <div className="project-create-grid">
                                    <Field id={`${id}-name`} label="Project name"><Input id={`${id}-name`} autoFocus defaultValue={project.name} maxLength={150} name="name" required/></Field>
                                    <Field id={`${id}-status`} label="Status"><Select defaultValue={project.status} name="status" disabled={busy}>
                                        <SelectTrigger id={`${id}-status`}><SelectValue/></SelectTrigger>
                                        <SelectContent>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                                    </Select></Field>
                                    <Field id={`${id}-summary`} label="Summary" wide><Textarea id={`${id}-summary`} defaultValue={project.summary} maxLength={2000} name="summary" required rows={4}/></Field>
                                </div>
                            </Tabs.Content>
                            <Tabs.Content value="technical" forceMount className="project-edit-panel" data-edit-section="technical">
                                <div className="project-create-grid">
                                    <Field id={`${id}-stack`} label="Tech stack" hint="Comma-separated" wide><Input id={`${id}-stack`} defaultValue={project.techStack.join(", ")} name="techStack" placeholder="React, TypeScript, .NET"/></Field>
                                    <Field id={`${id}-database`} label="Database & storage" hint="Optional" wide><Input id={`${id}-database`} defaultValue={project.database === "Not specified" ? "" : project.database} maxLength={500} name="databaseDetails" placeholder="SQL Server, Redis"/></Field>
                                    <Field id={`${id}-environments`} label="Environments" hint="Comma-separated" wide><Input id={`${id}-environments`} defaultValue={project.environments.join(", ")} name="environments" placeholder="Development, Production"/></Field>
                                </div>
                            </Tabs.Content>
                            <Tabs.Content value="delivery" forceMount className="project-edit-panel" data-edit-section="delivery">
                                <div className="project-create-grid">
                                    <Field id={`${id}-method`} label="SDLC method" hint="Optional" wide><Select defaultValue={method || "unspecified"} name="sdlcMethod" disabled={busy}>
                                        <SelectTrigger id={`${id}-method`}><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unspecified">Not specified</SelectItem>
                                            {method && !knownMethod && <SelectItem value={method}>{method}</SelectItem>}
                                            {sdlcModelIds.map(model => <SelectItem key={model} value={sdlcModels[model].title}>{sdlcModels[model].title}</SelectItem>)}
                                        </SelectContent>
                                    </Select></Field>
                                    <Field id={`${id}-start`} label="Start date" hint="Optional"><Input id={`${id}-start`} defaultValue={project.startDate} name="startDate" type="date"/></Field>
                                    <Field id={`${id}-target`} label="Target release" hint="Optional"><Input id={`${id}-target`} defaultValue={project.targetDate} name="targetDate" type="date"/></Field>
                                </div>
                            </Tabs.Content>
                            <Tabs.Content value="links" forceMount className="project-edit-panel" data-edit-section="links">
                                <div className="project-create-grid single">
                                    <GitHubRepositoriesField initial={project.githubRepositories} disabled={busy}/>
                                    <Field id={`${id}-repository`} label="Repository URL" hint="Optional"><Input id={`${id}-repository`} defaultValue={project.repository.startsWith("http") ? project.repository : ""} name="repositoryUrl" type="url" placeholder="https://github.com/organization/project"/></Field>
                                    <Field id={`${id}-docs`} label="Documentation" hint="Optional"><Input id={`${id}-docs`} defaultValue={project.documentationUrl} name="documentationUrl" type="url" placeholder="https://docs.example.com"/></Field>
                                    <Field id={`${id}-design`} label="Design file" hint="Optional"><Input id={`${id}-design`} defaultValue={project.designUrl} name="designUrl" type="url" placeholder="https://figma.com/..."/></Field>
                                    <Field id={`${id}-app`} label="Live app" hint="Optional"><Input id={`${id}-app`} defaultValue={project.liveUrl} name="liveUrl" type="url" placeholder="https://app.example.com"/></Field>
                                </div>
                            </Tabs.Content>
                        </fieldset>
                        {(validationError || error) && <p className="workshop-form-error project-create-error" role="alert">{validationError || error}</p>}
                    </div>
                </Tabs.Root>
                <div className="project-create-footer">
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin"/> : <Check/>}{busy ? "Saving…" : "Save changes"}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
}
