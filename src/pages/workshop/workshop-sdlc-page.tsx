import {useState} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowRight, Check, CheckCircle2, Flag, Stars} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {waterfallPhases} from "@/features/workshop/tool-documents"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"

const positions = [{x: 100, y: 355}, {x: 260, y: 235}, {x: 420, y: 380}, {x: 580, y: 215}, {x: 740, y: 345}, {x: 900, y: 190}]
export function WorkshopSdlcPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><Stars/><h3>No project selected</h3><p>Select or create a project to chart its development journey.</p></section>
    return <SdlcRoadmap key={`${userId}:${organization.id}:${project.id}`}/>
}
function SdlcRoadmap() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization, userId, "Manage projects")
    const editor = useToolDocument({organizationId: organization.id, projectId: project!.id, tool: "sdlc"}, userId, canWrite, isPersistedOrganization)
    const {document, setDocument, canEdit} = editor
    const [selectedPhase, setSelectedPhase] = useState<number | null>(null)
    const selected = selectedPhase ?? document.currentPhase
    const phase = waterfallPhases[selected]
    const completedCount = document.completed ? waterfallPhases.length : document.currentPhase
    const progress = Math.round(completedCount / waterfallPhases.length * 100)
    function current(index: number) {setDocument(value => ({...value, currentPhase: index, completed: false})); setSelectedPhase(index)}
    function advance() {
        if (document.currentPhase === waterfallPhases.length - 1) setDocument(value => ({...value, completed: true}))
        else current(document.currentPhase + 1)
    }
    return <section className="project-tool-workspace sdlc-workspace">
        <ToolDocumentHeader title="Development constellation" projectName={project!.name} {...editor} canWrite={canWrite} persisted={isPersistedOrganization} onSave={() => void editor.save()} onRetry={editor.retry} onReload={editor.reload} tool="sdlc" document={document}/>
        <div className="sdlc-layout">
            <div className="sdlc-universe">
                <svg className="sdlc-starfield" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    {Array.from({length: 130}, (_, index) => <circle key={index} cx={(index * 7919 + 43) % 1000} cy={(index * 3571 + 71) % 650} r={index % 7 === 0 ? 1.6 : .7} opacity={.15 + index % 6 * .1}/>)}
                </svg>
                <div className="sdlc-universe-heading"><span><Stars/> THE PROJECT'S JOURNEY</span><h2>Every phase, a new constellation.</h2><p>Follow your project from its first idea to a living system.</p>
                    <div className="sdlc-model-control"><label>SDLC model<select aria-label="SDLC model" value={document.model} disabled={!canEdit} onChange={() => setDocument(value => ({...value, model: "waterfall"}))}><option value="waterfall">Waterfall</option></select></label>
                        <label>Current phase<select aria-label="Current Waterfall phase" value={document.currentPhase} disabled={!canEdit} onChange={event => current(Number(event.target.value))}>{waterfallPhases.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}</select></label>
                    </div>
                </div>
                <div className="sdlc-constellation" aria-label="Waterfall roadmap">
                    <svg viewBox="0 0 1000 580" preserveAspectRatio="none" aria-hidden="true">
                        {positions.slice(1).map((position, index) => <path key={index} d={`M${positions[index].x} ${positions[index].y} L${position.x} ${position.y}`} className={index < completedCount ? "completed" : ""}/>)}
                        {positions.map((position, index) => <g className={`sdlc-satellite-stars ${index < completedCount ? "completed" : ""}`} key={index}><path d={`M${position.x} ${position.y} l-30 -30 l14 -30 l42 10 l-26 50 l34 30 l-15 28`}/><circle cx={position.x - 30} cy={position.y - 30} r="3"/><circle cx={position.x - 16} cy={position.y - 60} r="2"/><circle cx={position.x + 26} cy={position.y - 50} r="3"/><circle cx={position.x + 34} cy={position.y + 30} r="2"/><circle cx={position.x + 19} cy={position.y + 58} r="3"/></g>)}
                    </svg>
                    {waterfallPhases.map((item, index) => {
                        const done = index < completedCount, active = index === document.currentPhase && !document.completed
                        return <button type="button" key={item.id} aria-label={`${item.title}, ${done ? "completed" : active ? "current phase" : "upcoming"}`} aria-pressed={selected === index}
                            className={`sdlc-phase-star ${done ? "completed" : ""} ${active ? "current" : ""} ${selected === index ? "selected" : ""}`}
                            style={{left: `${positions[index].x / 10}%`, top: `${positions[index].y / 580 * 100}%`}} onClick={() => setSelectedPhase(index)}>
                            <span className="sdlc-star-core">{done ? <Check/> : <Stars/>}</span><small>0{index + 1}</small><strong>{item.title}</strong><em>{done ? "Completed" : active ? "You are here" : "Upcoming"}</em>
                        </button>
                    })}
                </div>
                <div className="sdlc-progress-card"><div><span>{document.completed ? "Journey complete" : "Journey progress"}</span><strong>{progress}%</strong></div><progress max="100" value={progress} aria-label="Waterfall completion"/><small>{completedCount} of {waterfallPhases.length} phases complete · Waterfall follows a sequential path.</small></div>
            </div>
            <aside className="sdlc-phase-inspector tool-inspector" aria-label="Roadmap phase details">
                <header><span className="sdlc-phase-number">0{selected + 1}</span><strong>{phase.title}</strong><small>{selected < completedCount ? "Completed phase" : selected === document.currentPhase ? "Current phase" : "Upcoming phase"}</small></header>
                <p className="sdlc-phase-description">{phase.description}</p>
                <div className="tool-section-heading"><strong>Deliverables</strong><Flag/></div>
                <ul className="sdlc-deliverables">{phase.deliverables.split(", ").map(item => <li key={item}><CheckCircle2/>{item}</li>)}</ul>
                <label>Phase notes<textarea disabled={!canEdit} rows={6} maxLength={10000} placeholder="Record milestones, decisions and progress…" value={document.notes[phase.id] ?? ""} onChange={event => setDocument(value => ({...value, notes: {...value.notes, [phase.id]: event.target.value}}))}/></label>
                {selected === document.currentPhase && !document.completed ? <Button disabled={!canEdit} onClick={advance}><Check/>{selected === 5 ? "Complete roadmap" : "Complete phase & continue"}<ArrowRight/></Button>
                    : <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Set as current phase</Button>}
                <p className="tool-help">Setting a phase marks all earlier phases complete and later phases upcoming. You can return to an earlier phase at any time.</p>
                <div className="sdlc-phase-list">{waterfallPhases.map((item, index) => <button type="button" key={item.id} className={selected === index ? "active" : ""} onClick={() => setSelectedPhase(index)}><span>{index < completedCount ? <Check/> : index + 1}</span>{item.title}{index === document.currentPhase && !document.completed && <i/>}</button>)}</div>
            </aside>
        </div>
    </section>
}
