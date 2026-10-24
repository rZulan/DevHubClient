import {useId, useRef, useState, type CSSProperties} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Flag, Maximize, Minus, Plus, RotateCcw, Stars} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {iterativeReleasePhases, sdlcModelIds, sdlcModels, type SdlcModel} from "@/features/workshop/sdlc-models"
import {advanceSdlc, advanceSdlcRelease, maxSdlcHistory, setSdlcPhase, setSdlcReleasePhase, startSdlcCycle, startSdlcRelease, switchSdlcModel} from "@/features/workshop/sdlc-document"
import {roadmapSize} from "@/features/workshop/sdlc-camera"
import {waterfallConnection} from "@/features/workshop/sdlc-waterfall-geometry"
import {useSdlcCamera} from "@/features/workshop/use-sdlc-camera"
import {SdlcConstellationIllustration} from "@/features/workshop/sdlc-constellation-illustration"
import {SdlcStarfield} from "@/features/workshop/sdlc-starfield"
import {IterativeTornado, type TornadoControls} from "@/features/workshop/iterative-tornado"
import {tornadoHue} from "@/features/workshop/tornado-geometry"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/sdlc-inspector.css"
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
    const [selectedPhase, setSelectedPhase] = useState<{model: SdlcModel; index: number; release?: boolean} | null>(null)
    const [archiveSelection, setArchiveSelection] = useState<{model: SdlcModel; cycle: number} | null>(null)
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
    const inspectorId = useId()
    const isIterative = document.model === "iterative"
    const navigation = useSdlcCamera(!isIterative)
    const tornado = useRef<TornadoControls>(null)
    const [tornadoZoom, setTornadoZoom] = useState(1)
    const markerId = useId()
    const model = sdlcModels[document.model], phases = model.phases, positions = model.positions
    const phaseLinks = positions.slice(1).map((position, index) => document.model === "waterfall"
        ? waterfallConnection(positions[index], position)
        : `M${positions[index].x} ${positions[index].y} L${position.x} ${position.y}`)
    const archive = archiveSelection?.model === document.model ? document.history?.find(entry => entry.cycle === archiveSelection.cycle) : undefined
    const active = archive ? {...document, notes: archive.notes, currentPhase: phases.length - 1, completed: true} : document
    const activeRelease = archive ? archive.release : document.release
    const releaseView = !!activeRelease && (selectedPhase?.model !== document.model || selectedPhase.release === true)
    const detailPhases = releaseView ? iterativeReleasePhases : phases
    const cycle = archive?.cycle ?? document.cycle ?? 1
    const selected = selectedPhase?.model === document.model ? Math.min(selectedPhase.index, detailPhases.length - 1) : releaseView ? activeRelease!.currentPhase : active.currentPhase
    const phase = detailPhases[selected]
    const pairedPhase = detailPhases.findIndex(item => item.id === phase.pair)
    const completedCount = active.completed ? phases.length : active.currentPhase
    const detailCurrent = releaseView ? activeRelease!.currentPhase : active.currentPhase
    const detailCompleted = releaseView ? activeRelease!.completed : active.completed
    const detailCompletedCount = detailCompleted ? detailPhases.length : detailCurrent
    const detailNotes = releaseView ? activeRelease!.notes : active.notes
    const readOnlyPhase = !!archive || !releaseView && !!document.release
    const progress = Math.round(completedCount / phases.length * 100)
    const cycleName = model.cycle ? `${model.cycle} ${cycle}` : "Roadmap"
    const lastPhase = detailCurrent === detailPhases.length - 1
    function select(index: number) {
        setSelectedPhase({model: document.model, index, release: releaseView})
        if (releaseView) return
        if (isIterative) tornado.current?.focus(cycle, index)
        else navigation.reveal(positions[index])
    }
    function selectRelease(index: number) {setSelectedPhase({model: document.model, index, release: true})}
    function selectTornadoPhase(number: number, index: number) {
        setArchiveSelection(number === (document.cycle ?? 1) ? null : {model: document.model, cycle: number})
        setSelectedPhase({model: document.model, index})
    }
    function viewCycle(number: number) {
        setArchiveSelection(number === (document.cycle ?? 1) ? null : {model: document.model, cycle: number}); setSelectedPhase(null)
        if (isIterative) tornado.current?.focus(number, number === (document.cycle ?? 1) ? document.currentPhase : phases.length - 1)
    }
    function current(index: number) {setDocument(value => releaseView ? setSdlcReleasePhase(value, index) : setSdlcPhase(value, index)); select(index)}
    function changeModel(nextModel: SdlcModel) {
        const next = switchSdlcModel(document, nextModel)
        setDocument(next); setSelectedPhase(null); setArchiveSelection(null)
        if (nextModel !== "iterative") navigation.reset(sdlcModels[nextModel].positions[next.currentPhase])
    }
    function advance() {
        setDocument(releaseView ? advanceSdlcRelease : advanceSdlc); setSelectedPhase(null)
        if (releaseView) return
        if (!lastPhase) {
            if (isIterative) tornado.current?.focus(document.cycle ?? 1, document.currentPhase + 1)
            else navigation.reveal(positions[document.currentPhase + 1])
        }
    }
    function startCycle() {
        setDocument(startSdlcCycle); setSelectedPhase(null); setArchiveSelection(null)
        if (!isIterative) navigation.reset(positions[0])
    }
    function proceedToRelease() {setDocument(startSdlcRelease); setSelectedPhase(null); setArchiveSelection(null)}
    return <section className="project-tool-workspace sdlc-workspace">
        <ToolDocumentHeader title="Development roadmap" projectName={project!.name} {...editor} canWrite={canWrite} persisted={isPersistedOrganization} onSave={() => void editor.save()} onRetry={editor.retry} onReload={editor.reload} tool="sdlc" document={document}/>
        <div className="sdlc-layout">
            <div className="sdlc-universe" data-model={document.model} style={{"--sdlc-model-color": isIterative ? `hsl(${tornadoHue(cycle)} 72% 65%)` : model.color} as CSSProperties}>
                <SdlcStarfield camera={navigation.camera}/>
                <div className="sdlc-canvas-toolbar">
                    <div className="sdlc-model-control"><label>SDLC model<select aria-label="SDLC model" value={document.model} disabled={!canEdit} onChange={event => changeModel(event.target.value as SdlcModel)}>{sdlcModelIds.map(id => <option key={id} value={id}>{sdlcModels[id].title}</option>)}</select></label>
                        <label>{releaseView ? "Release phase" : "Current phase"}<select aria-label={releaseView ? "Current release phase" : `Current ${model.title} phase`} value={detailCurrent} disabled={!canEdit || readOnlyPhase} onChange={event => current(Number(event.target.value))}>{detailPhases.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}</select></label>
                        {model.cycle && <label>{model.cycle}<select aria-label={`View ${model.cycle.toLowerCase()}`} value={cycle} onChange={event => viewCycle(Number(event.target.value))}>
                            {document.history?.map(entry => <option key={entry.cycle} value={entry.cycle}>{entry.cycle} · completed</option>)}<option value={document.cycle ?? 1}>{document.cycle ?? 1} · {document.completed ? "completed" : "current"}</option>
                        </select></label>}
                    </div>
                    <span className="sdlc-map-label" title={model.summary}><span/>{releaseView ? activeRelease!.completed ? "Release complete" : `Release · ${iterativeReleasePhases[activeRelease!.currentPhase].title}` : active.completed ? `${cycleName} complete` : `Phase ${String(active.currentPhase + 1).padStart(2, "0")} / ${String(phases.length).padStart(2, "0")}`}</span>
                </div>
                {document.model === "iterative" ? <IterativeTornado ref={tornado} cycles={document.cycle ?? 1} phases={phases} currentPhase={document.currentPhase} completed={document.completed}
                    selectedCycle={cycle} selectedPhase={releaseView ? -1 : selected} onSelect={selectTornadoPhase} onZoomChange={setTornadoZoom}/>
                : <div ref={navigation.viewport} className={`sdlc-viewport ${navigation.dragging ? "is-dragging" : ""}`} tabIndex={0} role="region" aria-label={`${model.title} roadmap canvas`} aria-describedby="sdlc-navigation-help" {...navigation.handlers}>
                <div className="sdlc-camera" style={{width: roadmapSize.width, height: roadmapSize.height, "--sdlc-label-scale": Math.min(1.65, Math.max(.7, 1 / navigation.camera.zoom)), transform: `translate3d(${navigation.camera.x}px, ${navigation.camera.y}px, 0) scale(${navigation.camera.zoom})`} as CSSProperties}>
                <div className="sdlc-constellation" aria-label={`${model.title} roadmap`}>
                    <SdlcConstellationIllustration model={document.model}/>
                    <svg className="sdlc-roadmap-links" viewBox={`0 0 ${roadmapSize.width} ${roadmapSize.height}`} aria-hidden="true">
                        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="var(--sdlc-ink)" strokeWidth="1.3"/></marker></defs>
                        <g className="sdlc-path-shadow">{phaseLinks.map((path, index) => <path key={index} d={path}/>)}</g>
                        {phaseLinks.map((path, index) => <path key={index} d={path} className={index < completedCount ? "completed" : ""}/>)}
                        {model.loop && <path className="sdlc-cycle-return" d={model.loop} markerEnd={`url(#${markerId})`}/>}
                    </svg>
                    {phases.map((item, index) => {
                        const done = index < completedCount, currentPhase = index === active.currentPhase && !active.completed
                        return <button type="button" key={`${document.model}:${item.id}`} aria-label={`${item.title}, ${done ? "completed" : currentPhase ? "current phase" : "upcoming"}`} aria-pressed={selected === index}
                            className={`sdlc-phase-star label-${positions[index].label} ${done ? "completed" : ""} ${currentPhase ? "current" : ""} ${selected === index ? "selected" : ""} ${pairedPhase === index ? "paired" : ""}`}
                            style={{left: positions[index].x, top: positions[index].y}} onFocus={event => {if (event.currentTarget.matches(":focus-visible")) navigation.reveal(positions[index])}} onClick={() => setSelectedPhase({model: document.model, index})}>
                            <span className="sdlc-star-core"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path className="sdlc-star-rays" d="M32 0L35 25L48 16L39 29L64 32L39 35L48 48L35 39L32 64L29 39L16 48L25 35L0 32L25 29L16 16L29 25Z"/><path className="sdlc-star-light" d="M32 8L36 28L56 32L36 36L32 56L28 36L8 32L28 28Z"/><circle cx="32" cy="32" r="4"/></svg></span><span className="sdlc-star-label"><small>{String(index + 1).padStart(2, "0")}</small><strong>{item.title}</strong><em>{done ? <><Check/> Completed</> : currentPhase ? "You are here" : "Upcoming"}</em></span>
                        </button>
                    })}
                </div>
                </div>
                </div>}
                {isIterative && activeRelease && <nav className="sdlc-release-path" aria-label={`Iteration ${cycle} release milestones`}>
                    <span>{cycleName}<small>Release path</small></span><ArrowRight aria-hidden="true"/>
                    {iterativeReleasePhases.map((item, index) => <button type="button" key={item.id} aria-label={`View ${item.title.toLowerCase()}`} aria-pressed={releaseView && selected === index}
                        className={index < activeRelease.currentPhase || activeRelease.completed ? "completed" : ""} onClick={() => selectRelease(index)}>
                        <span>{index < activeRelease.currentPhase || activeRelease.completed ? <Check/> : index + 1}</span>{item.title}{index === 0 && <ArrowRight aria-hidden="true"/>}
                    </button>)}
                </nav>}
                <footer className="sdlc-canvas-footer">
                    <div className="sdlc-progress-card"><div><span>{cycleName} {active.completed ? "complete" : "progress"}</span><strong>{progress}%</strong></div><progress max="100" value={progress} aria-label={`${model.title} completion`}/><small>{completedCount} of {phases.length} phases complete</small></div>
                    <div className="sdlc-navigation"><div className="sdlc-zoom-controls" role="group" aria-label="Roadmap view"><button type="button" aria-label="Zoom out" disabled={isIterative ? tornadoZoom <= .45 : navigation.camera.zoom <= .2} onClick={() => isIterative ? tornado.current?.zoom(1 / 1.2) : navigation.zoom(1 / 1.2)}><Minus/></button><output aria-label="Roadmap zoom">{Math.round((isIterative ? tornadoZoom : navigation.camera.zoom) * 100)}%</output><button type="button" aria-label="Zoom in" disabled={isIterative ? tornadoZoom >= 5 : navigation.camera.zoom >= 2} onClick={() => isIterative ? tornado.current?.zoom(1.2) : navigation.zoom(1.2)}><Plus/></button><button type="button" aria-label="Fit roadmap" title="Fit roadmap (Home)" onClick={() => isIterative ? tornado.current?.fit() : navigation.fit()}><Maximize/></button></div><p id="sdlc-navigation-help">{isIterative ? "Drag to orbit · Shift-drag to pan · Scroll to zoom" : "Drag to pan · Scroll to zoom"}<span className="sr-only">. Focus the canvas and use arrow keys to {isIterative ? "rotate, Shift and arrow keys to pan" : "pan"}, plus or minus to zoom, and Home to {isIterative ? "reset the 3D view" : "fit the roadmap"}.</span></p></div>
                </footer>
            </div>
            <div className={`sdlc-inspector-panel ${inspectorCollapsed ? "is-collapsed" : ""}`}>
                <div className="sdlc-inspector-heading"><strong>Phase details</strong><button type="button" aria-label={`${inspectorCollapsed ? "Expand" : "Collapse"} phase details`} title={`${inspectorCollapsed ? "Expand" : "Collapse"} phase details`}
                    aria-expanded={!inspectorCollapsed} aria-controls={inspectorId} onClick={() => setInspectorCollapsed(value => !value)}>{inspectorCollapsed ? <ChevronLeft/> : <ChevronRight/>}</button></div>
                {inspectorCollapsed && <span className="sdlc-inspector-rail-label" aria-hidden="true">Phase details</span>}
            <aside id={inspectorId} hidden={inspectorCollapsed} className="sdlc-phase-inspector tool-inspector" aria-label="Roadmap phase details">
                <header><span className="sdlc-phase-number">{String(selected + 1).padStart(2, "0")}</span><strong>{phase.title}</strong><small>{archive ? `${cycleName} · ${releaseView ? "released" : "completed"}` : selected < detailCompletedCount ? "Completed phase" : selected === detailCurrent ? "Current phase" : "Upcoming phase"}</small></header>
                <p className="sdlc-phase-description">{phase.description}</p>
                {pairedPhase >= 0 && <div className="sdlc-validation-pair"><small>{selected < 4 ? "Validated by" : "Verifies"}</small><button type="button" onClick={() => select(pairedPhase)}>{phases[pairedPhase].title}<ArrowRight/></button></div>}
                <div className="tool-section-heading"><strong>Deliverables</strong><Flag/></div>
                <ul className="sdlc-deliverables">{phase.deliverables.split(", ").map(item => <li key={item}><CheckCircle2/>{item}</li>)}</ul>
                <label>Phase notes<textarea disabled={!canEdit || readOnlyPhase} rows={6} maxLength={10000} placeholder="Record milestones, decisions and progress…" value={detailNotes[phase.id] ?? ""} onChange={event => setDocument(value => releaseView && value.release ? {...value, release: {...value.release, notes: {...value.release.notes, [phase.id]: event.target.value}}} : {...value, notes: {...value.notes, [phase.id]: event.target.value}})}/></label>
                {archive ? <p className="tool-help">Archived {model.cycle?.toLowerCase()} notes are preserved. Choose the current {model.cycle?.toLowerCase()} to continue working.</p>
                    : releaseView ? <>
                        {activeRelease!.completed ? <><p className="tool-help" role="status">Release roadmap complete. You can start another iteration when new feedback or requirements arrive.</p><Button disabled={!canEdit || (document.history?.length ?? 0) >= maxSdlcHistory} onClick={startCycle}><RotateCcw/>Start iteration {(document.cycle ?? 1) + 1}<ArrowRight/></Button><Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Reopen selected phase</Button></>
                            : selected === detailCurrent ? <Button disabled={!canEdit} onClick={advance}><Check/>{lastPhase ? "Complete release roadmap" : "Complete deployment"}<ArrowRight/></Button>
                            : <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Set as current phase</Button>}
                    </>
                    : document.release ? <><p className="tool-help">This iteration is complete. Its notes are preserved while you work through release.</p><Button variant="secondary" onClick={() => selectRelease(document.release!.currentPhase)}>View release progress<ArrowRight/></Button></>
                    : document.completed && model.cycle ? <>
                        {isIterative ? <section className="sdlc-iteration-decision" aria-label="Iteration decision">
                            <strong>What comes next?</strong><p>Start another iteration to address feedback, or proceed to release if the version meets your acceptance criteria.</p>
                            <Button disabled={!canEdit || (document.history?.length ?? 0) >= maxSdlcHistory} onClick={startCycle}><RotateCcw/>Start iteration {(document.cycle ?? 1) + 1}<ArrowRight/></Button>
                            <Button variant="secondary" disabled={!canEdit} onClick={proceedToRelease}>Proceed to release<ArrowRight/></Button>
                        </section> : <Button disabled={!canEdit || (document.history?.length ?? 0) >= maxSdlcHistory} onClick={startCycle}><RotateCcw/>Start {model.cycle.toLowerCase()} {(document.cycle ?? 1) + 1}<ArrowRight/></Button>}
                        <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Reopen selected phase</Button>
                    </>
                    : selected === document.currentPhase && !document.completed ? <Button disabled={!canEdit} onClick={advance}><Check/>{lastPhase ? isIterative ? "Complete evaluation" : `Complete ${model.cycle?.toLowerCase() ?? "roadmap"}` : "Complete phase & continue"}<ArrowRight/></Button>
                    : <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Set as current phase</Button>}
                <p className="tool-help">{model.summary} {model.cycle ? "Each new cycle keeps the previous cycle's notes in history." : "Setting a phase marks earlier phases complete. You can return to an earlier phase at any time."}</p>
                <div className="sdlc-phase-list">{detailPhases.map((item, index) => <button type="button" key={item.id} className={selected === index ? "active" : ""} onClick={() => select(index)}><span>{index < detailCompletedCount ? <Check/> : index + 1}</span>{item.title}{index === detailCurrent && !detailCompleted && <i/>}</button>)}</div>
            </aside>
            </div>
        </div>
    </section>
}
