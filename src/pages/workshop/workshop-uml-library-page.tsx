import {useRef, useState} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowRight, FilePlus2, Pencil, Plus, Redo2, Search, Shapes, Trash2, Undo2} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {WorkshopEmptyState, WorkshopNoProject} from "@/features/workshop/workshop-empty-state"
import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {newUmlDiagram, updateUmlDiagram, type UmlDiagram} from "@/features/workshop/uml-library"
import {umlTypes, type UmlType} from "@/features/workshop/uml-catalog"
import {PlaygroundCanvas} from "./workshop-ideation-page"
import {canvasViewKey} from "@/features/workshop/canvas-view-storage"
import "@/features/workshop/uml-library.css"

export function WorkshopUmlLibraryPage() {
    const {organization,project} = useOutletContext<WorkshopOutletContext>(), userId = useAppSelector(s => s.auth.user?.id) ?? "current"
    if (!project) return <WorkshopNoProject icon={Shapes}/>
    return <UmlLibraryPage key={`${userId}:${organization.id}:${project.id}`}/>
}
function UmlLibraryPage() {
    const {organization,project,isPersistedOrganization} = useOutletContext<WorkshopOutletContext>(), userId = useAppSelector(s => s.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization,userId,"Edit UML diagrams"), editor = useToolDocument({organizationId:organization.id,projectId:project!.id,tool:"uml"},userId,canWrite,isPersistedOrganization)
    const {document:library,canEdit} = editor, latest = useRef(library); latest.current = library
    const [activeId,setActiveId] = useState<string | null>(null), [query,setQuery] = useState("")
    const [form,setForm] = useState<{id: string | null; name: string; type: UmlType | null} | null>(null), [deleting,setDeleting] = useState<UmlDiagram | null>(null)
    const active = library.diagrams.find(d => d.id === activeId), filtered = library.diagrams.filter(d => `${d.name} ${umlTypes.find(t => t.id === d.type)?.label ?? "Universal"}`.toLowerCase().includes(query.toLowerCase()))
    function submit() {
        if (!canEdit || !form?.name.trim() || !form.id && library.diagrams.length >= 100) return
        if (form.id) editor.setDocument(current => updateUmlDiagram(current,form.id!,{name:form.name.trim(),type:form.type}))
        else {const diagram = newUmlDiagram(form.name,form.type); editor.setDocument(current => ({...current,diagrams:[...current.diagrams,diagram]})); setActiveId(diagram.id)}
        setForm(null)
    }
    return <section className="project-tool-workspace uml-library-workspace">
        <ToolDocumentHeader title={active ? active.name : "UML"} projectName={project!.name} status={editor.status} error={editor.error} canWrite={canWrite} persisted={isPersistedOrganization} onSave={editor.save} onRetry={editor.retry} onReload={editor.reload} tool="uml" document={library}>
            <Button size="icon-sm" variant="ghost" aria-label="Undo UML change" disabled={!canEdit || !editor.canUndo} onClick={editor.undo}><Undo2/></Button><Button size="icon-sm" variant="ghost" aria-label="Redo UML change" disabled={!canEdit || !editor.canRedo} onClick={editor.redo}><Redo2/></Button>
            {active ? <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => setForm({id:active.id,name:active.name,type:active.type})}><Pencil/>Settings</Button> : <Button size="sm" disabled={!canEdit || library.diagrams.length >= 100} onClick={() => setForm({id:null,name:"",type:null})}><Plus/>Create UML</Button>}
        </ToolDocumentHeader>
        {active ? <div className="uml-playground-host"><PlaygroundCanvas key={active.id} viewStorageKey={canvasViewKey(userId, organization.id, project!.id, "uml", active.id)} diagram={active} onBack={() => setActiveId(null)} adapter={{canEdit,status:editor.status,error:editor.error,save:editor.save,retry:editor.retry,reload:editor.reload,setItems:items => {if (canEdit && latest.current.diagrams.some(d => d.id === active.id)) editor.setDocument(current => updateUmlDiagram(current,active.id,{items}))}}}/></div> : <div className="uml-directory">
            <div className="uml-directory-heading"><div><h1>UML diagrams</h1></div><span>{library.diagrams.length} diagrams</span></div>
            {!!library.diagrams.length && <label className="uml-directory-search"><Search aria-hidden="true"/><input aria-label="Search UML diagrams" placeholder="Find a diagram…" value={query} onChange={e => setQuery(e.target.value)}/></label>}
            {editor.status === "loading" ? <p role="status">Loading UML diagrams…</p> : !library.diagrams.length ? <WorkshopEmptyState icon={Shapes} title="Your diagrams start here" description={null} action={canWrite && <Button disabled={!canEdit} onClick={() => setForm({id:null,name:"",type:null})}><FilePlus2/>Create UML</Button>}/> : !filtered.length ? <p>No diagrams match your search.</p> : <div className="uml-directory-grid">{filtered.map(diagram => <article className="uml-directory-card" key={diagram.id}>
                <button type="button" className="uml-directory-open" onClick={() => setActiveId(diagram.id)}><span className="uml-directory-icon"><Shapes/></span><strong>{diagram.name}</strong><span>{umlTypes.find(t => t.id === diagram.type)?.label ?? "Universal UML"}</span><small>{diagram.items.length} elements · Edited {new Date(diagram.updatedAt).toLocaleDateString()}</small><span className="uml-directory-open-label">Open diagram<ArrowRight/></span></button>
                <div className="uml-directory-actions"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${diagram.name}`} disabled={!canEdit} onClick={() => setForm({id:diagram.id,name:diagram.name,type:diagram.type})}><Pencil/></Button><Button size="icon-sm" variant="ghost" aria-label={`Delete ${diagram.name}`} disabled={!canEdit} onClick={() => setDeleting(diagram)}><Trash2/></Button></div>
            </article>)}</div>}
        </div>}
        <Dialog open={!!form} onOpenChange={open => {if (!open) setForm(null)}}><DialogContent><DialogHeader><DialogTitle>{form?.id ? "Diagram settings" : "Create UML diagram"}</DialogTitle><DialogDescription>Name your diagram. Choosing a type puts that category first without hiding other UML shapes.</DialogDescription></DialogHeader>{form && <form className="uml-create-form" onSubmit={e => {e.preventDefault();submit()}}><label>Name<input autoFocus required maxLength={150} value={form.name} placeholder="e.g. Checkout flow" onChange={e => setForm({...form,name:e.target.value})}/></label><label>Type <span>(optional)</span><WorkshopSelect value={form.type ?? ""} onValueChange={type => setForm({...form,type:type as UmlType || null})}><option value="">Universal — no preferred type</option>{umlTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</WorkshopSelect></label><DialogFooter><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={!canEdit || !form.name.trim() || !form.id && library.diagrams.length >= 100}>{form.id ? "Save settings" : "Create & open"}</Button></DialogFooter></form>}</DialogContent></Dialog>
        <Dialog open={!!deleting} onOpenChange={open => {if (!open) setDeleting(null)}}><DialogContent><DialogHeader><DialogTitle>Delete {deleting?.name}?</DialogTitle><DialogDescription>This removes the diagram and its elements. You can use Undo to restore it.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={!canEdit} onClick={() => {if (canEdit && deleting) editor.setDocument(current => ({...current,diagrams:current.diagrams.filter(d => d.id !== deleting.id)}));setDeleting(null)}}>Delete diagram</Button></DialogFooter></DialogContent></Dialog>
    </section>
}
