import {useEffect, useId, useRef, useState, type CSSProperties} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowRight, Check, ChevronLeft, ChevronRight, FileText, ListChecks, LocateFixed, Map, Maximize, Minus, PanelRight, Plus, Redo2, RotateCcw, Stars, Undo2} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {DropdownMenuItem} from "@/components/ui/dropdown-menu"
import {useCompactWorkshop} from "@/hooks/use-compact-workshop"
import {ResponsiveWorkshopPanel} from "@/features/workshop/responsive-workshop-panel"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {iterativeReleasePhases, sdlcModelIds, sdlcModels, type SdlcModel} from "@/features/workshop/sdlc-models"
import {advanceSdlc, advanceSdlcRelease, maxSdlcHistory, nextSdlcPhase, sdlcPhaseDone, setSdlcPhase, setSdlcReleasePhase, startSdlcCycle, startSdlcRelease, switchSdlcModel, updateSdlcNote, updateSdlcWork, type SdlcDocument, type SdlcPhaseWork} from "@/features/workshop/sdlc-document"
import {sdlcCompletion, sdlcMarkdown, sdlcPhaseState, sdlcReadiness} from "@/features/workshop/sdlc-work"
import {SdlcArchiveNotice, SdlcCompletionDialog, SdlcOverview, SdlcPhaseWorkPanel} from "@/features/workshop/sdlc-work-panels"
import {SdlcImportDialog} from "@/features/workshop/sdlc-import-dialog"
import {downloadFile} from "@/features/workshop/tool-documents"
import {roadmapSize} from "@/features/workshop/sdlc-camera"
import {sdlcAdvanceLabel, sdlcLinks, sdlcQuality, sdlcRework} from "@/features/workshop/sdlc-flow"
import {useSdlcCamera} from "@/features/workshop/use-sdlc-camera"
import {SdlcConstellationIllustration} from "@/features/workshop/sdlc-constellation-illustration"
import {SdlcStarfield} from "@/features/workshop/sdlc-starfield"
import {IterativeTornado, type TornadoControls} from "@/features/workshop/iterative-tornado"
import {tornadoHue} from "@/features/workshop/tornado-geometry"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/sdlc-inspector.css"
import "@/features/workshop/sdlc-workflow.css"
import "@/features/workshop/sdlc-studio.css"
export function WorkshopSdlcPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><Stars/><h3>No project selected</h3><p>Select or create a project to chart its development journey.</p></section>
    return <SdlcRoadmap key={`${userId}:${organization.id}:${project.id}`}/>
}
function SdlcRoadmap() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization, userId, "Manage roadmap")
    const editor = useToolDocument({organizationId: organization.id, projectId: project!.id, tool: "sdlc"}, userId, canWrite, isPersistedOrganization)
    const {document, setDocument, canEdit} = editor
    const [selectedPhase, setSelectedPhase] = useState<{model: SdlcModel; index: number; release?: boolean} | null>(null)
    const [archiveSelection, setArchiveSelection] = useState<{model: SdlcModel; cycle: number} | null>(null)
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
    const [overview, setOverview] = useState(false), [inspectorOpen, setInspectorOpen] = useState(false), [notice, setNotice] = useState("")
    const [completion, setCompletion] = useState<{document: SdlcDocument; release: boolean; phase: typeof sdlcModels.waterfall.phases[number]; work?: SdlcPhaseWork} | null>(null)
    const compact = useCompactWorkshop(), viewId = useId()
    const inspectorId = useId()
    const inspectorBody = useRef<HTMLElement>(null)
    const isIterative = document.model === "iterative"
    const navigation = useSdlcCamera(!isIterative && !overview)
    const tornado = useRef<TornadoControls>(null)
    const [tornadoZoom, setTornadoZoom] = useState(1)
    const markerId = useId()
    const model = sdlcModels[document.model], phases = model.phases, positions = model.positions
    const phaseLinks = sdlcLinks(document.model)
    const archive = archiveSelection?.model === document.model ? document.history?.find(entry => entry.cycle === archiveSelection.cycle) : undefined
    const active = archive ? {...document, notes: archive.notes, work: archive.work, currentPhase: phases.length - 1, completed: true, released: archive.released ?? document.model === "agile"} : document
    const activeRelease = archive ? archive.release : document.release
    const releaseView = !!activeRelease && (selectedPhase?.model !== document.model || selectedPhase.release === true)
    const detailPhases = releaseView ? iterativeReleasePhases : phases
    const cycle = archive?.cycle ?? document.cycle ?? 1
    const selected = selectedPhase?.model === document.model ? Math.min(selectedPhase.index, detailPhases.length - 1) : releaseView ? activeRelease!.currentPhase : active.currentPhase
    const phase = detailPhases[selected]
    const pairedPhase = detailPhases.findIndex(item => item.id === phase.pair)
    const {done: completedCount, total: requiredCount, percent: progress} = sdlcCompletion(document.model, releaseView ? activeRelease! : active, releaseView)
    const phaseNumber = (index: number) => phases.slice(0, index + 1).filter(item => !item.optional && !item.ongoing).length
    const detailCurrent = releaseView ? activeRelease!.currentPhase : active.currentPhase
    const detailCompleted = releaseView ? activeRelease!.completed : active.completed
    const detailDone = (index: number) => releaseView ? activeRelease!.completed || index < activeRelease!.currentPhase : sdlcPhaseDone(active, index)
    const detailNotes = releaseView ? activeRelease!.notes : active.notes
    const detailWork = releaseView ? activeRelease!.work : active.work
    const readOnlyPhase = !!archive || !releaseView && !!document.release
    const cycleName = model.cycle ? `${model.cycle} ${cycle}` : "Roadmap"
    const lastPhase = detailCurrent === detailPhases.length - 1
    const rework = !releaseView ? sdlcRework(document.model, selected) : null
    const phaseState = sdlcPhaseState(phase, detailWork?.[phase.id], detailDone(selected), selected === detailCurrent && !detailCompleted)
    useEffect(() => {
        const element = inspectorBody.current
        element?.scrollTo({top: 0}); element?.closest(".workshop-drawer")?.scrollTo({top: 0})
    }, [document.model, cycle, selected, releaseView, inspectorOpen])
    function openDetails() {setInspectorCollapsed(false); if (compact) setInspectorOpen(true)}
    function select(index: number) {
        setSelectedPhase({model: document.model, index, release: releaseView})
        openDetails()
        if (releaseView) return
        if (isIterative) tornado.current?.focus(cycle, index)
        else navigation.reveal(positions[index])
    }
    function selectRelease(index: number) {setSelectedPhase({model: document.model, index, release: true}); openDetails()}
    function selectTornadoPhase(number: number, index: number) {
        setArchiveSelection(number === (document.cycle ?? 1) ? null : {model: document.model, cycle: number})
        setSelectedPhase({model: document.model, index})
        openDetails()
    }
    function viewCycle(number: number) {
        setArchiveSelection(number === (document.cycle ?? 1) ? null : {model: document.model, cycle: number}); setSelectedPhase(null)
        if (isIterative) tornado.current?.focus(number, number === (document.cycle ?? 1) ? document.currentPhase : phases.length - 1)
    }
    function current(index: number) {
        if (!canEdit || readOnlyPhase) return
        const work = releaseView ? document.release?.work : document.work
        const blocked = index > detailCurrent ? detailPhases.slice(detailCurrent, index).find(phase => work?.[phase.id]?.blocked) : undefined
        if (blocked) {setNotice(`Resolve the blocker in ${blocked.title} before advancing past it.`); return}
        setDocument(value => releaseView ? setSdlcReleasePhase(value, index) : setSdlcPhase(value, index)); setNotice(""); select(index)
    }
    function changeModel(nextModel: SdlcModel) {
        const next = switchSdlcModel(document, nextModel)
        setDocument(next); setSelectedPhase(null); setArchiveSelection(null)
        if (nextModel !== "iterative") navigation.reset(sdlcModels[nextModel].positions[next.currentPhase])
    }
    function commitAdvance(snapshot: SdlcDocument, releasing: boolean) {
        const updated = releasing ? advanceSdlcRelease(snapshot) : advanceSdlc(snapshot)
        setDocument(value => value === snapshot ? updated : value); setSelectedPhase(null); setNotice("")
        if (releasing) return
        const next = nextSdlcPhase(snapshot)
        if (next !== null) {
            if (isIterative) tornado.current?.focus(document.cycle ?? 1, next)
            else navigation.reveal(positions[next])
        }
    }
    function advance() {
        if (!canEdit || readOnlyPhase) return
        const currentPhase = detailPhases[detailCurrent], work = detailWork?.[currentPhase.id], readiness = sdlcReadiness(currentPhase, work)
        if (readiness.blocked || !currentPhase.ongoing && readiness.missing.length) {setCompletion({document, release: releaseView, phase: currentPhase, work}); return}
        commitAdvance(document, releaseView)
    }
    function historyAction(redo = false) {if (!canEdit) return; editor.endTransaction(); if (redo) editor.redo(); else editor.undo(); setSelectedPhase(null); setArchiveSelection(null); setNotice("")}
    function showCurrent() {
        setArchiveSelection(null); setSelectedPhase(null); openDetails()
        if (!document.release) {if (isIterative) tornado.current?.focus(document.cycle ?? 1, document.currentPhase); else navigation.reveal(positions[document.currentPhase])}
    }
    function startCycle() {
        setDocument(startSdlcCycle); setSelectedPhase(null); setArchiveSelection(null)
        if (!isIterative) navigation.reset(positions[0])
    }
    function proceedToRelease() {setDocument(startSdlcRelease); setSelectedPhase(null); setArchiveSelection(null)}
    function phaseActions() {
        if (archive) return <Button variant="secondary" onClick={() => viewCycle(document.cycle ?? 1)}>Return to current {model.cycle?.toLowerCase()}<ArrowRight/></Button>
        if (releaseView) return activeRelease!.completed ? <><p className="tool-help" role="status">Release roadmap complete.</p><Button disabled={!canEdit || (document.history?.length ?? 0) >= maxSdlcHistory} onClick={startCycle}><RotateCcw/>Start iteration {(document.cycle ?? 1) + 1}<ArrowRight/></Button><Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Reopen selected phase</Button></>
            : selected === detailCurrent ? <Button disabled={!canEdit} onClick={advance}><Check/>{lastPhase ? "Complete release roadmap" : "Complete deployment"}<ArrowRight/></Button>
            : <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Set as current phase</Button>
        if (document.release) return <><p className="tool-help">Iteration work is preserved while you progress through release.</p><Button variant="secondary" onClick={() => selectRelease(document.release!.currentPhase)}>View release progress<ArrowRight/></Button></>
        if (document.completed && model.cycle) return <>{isIterative ? <section className="sdlc-iteration-decision" aria-label="Iteration decision"><strong>What comes next?</strong><p>Iterate on feedback, or release when the acceptance criteria are met.</p><Button disabled={!canEdit || (document.history?.length ?? 0) >= maxSdlcHistory} onClick={startCycle}><RotateCcw/>Start iteration {(document.cycle ?? 1) + 1}<ArrowRight/></Button><Button variant="secondary" disabled={!canEdit} onClick={proceedToRelease}>Proceed to release<ArrowRight/></Button></section>
            : <Button disabled={!canEdit || (document.history?.length ?? 0) >= maxSdlcHistory} onClick={startCycle}><RotateCcw/>Start {model.cycle.toLowerCase()} {(document.cycle ?? 1) + 1}<ArrowRight/></Button>}<Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Reopen selected phase</Button></>
        return <>{document.completed ? <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Reopen selected phase</Button> : selected === document.currentPhase ? <Button disabled={!canEdit} onClick={advance}><Check/>{sdlcAdvanceLabel(document.model, selected)}<ArrowRight/></Button> : <Button variant="secondary" disabled={!canEdit} onClick={() => current(selected)}>Set as current phase</Button>}
            {!document.completed && selected === document.currentPhase && <>{document.model === "agile" && selected === 4 && <Button variant="secondary" disabled={!canEdit} onClick={() => current(5)}>Release Done increment<ArrowRight/></Button>}{rework !== null && <Button variant="secondary" disabled={!canEdit} onClick={() => current(rework)}><RotateCcw/>{document.model === "agile" ? "Continue development" : "Fix defects & retest"}</Button>}</>}
        </>
    }
    return <section className="project-tool-workspace sdlc-workspace" onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && !(event.target as HTMLElement).closest("input, textarea, [contenteditable=true]") && ["z", "y"].includes(event.key.toLowerCase())) {event.preventDefault(); if (!event.repeat) historyAction(event.key.toLowerCase() === "y" || event.shiftKey)}
    }}>
        <ToolDocumentHeader title="Development roadmap" projectName={project!.name} {...editor} canWrite={canWrite} persisted={isPersistedOrganization} onSave={() => void editor.save()} onRetry={editor.retry} onReload={editor.reload} tool="sdlc" document={document} exportItems={<DropdownMenuItem disabled={editor.status === "loading"} onSelect={() => downloadFile(sdlcMarkdown(document, project!.name, Object.fromEntries(organization.members.map(member => [member.id, member.nickname || member.name]))), "development-roadmap.md", "text/markdown;charset=utf-8")}><FileText/>Export roadmap report (Markdown)</DropdownMenuItem>}>
            <SdlcImportDialog document={document} canEdit={canEdit} onImport={draft => {setDocument(draft); setSelectedPhase(null); setArchiveSelection(null); setNotice("Roadmap restored. Its saved models, notes, phase tracking, and history are available.")}}/>
        </ToolDocumentHeader>
        <div className="sdlc-studio-bar"><div className="sdlc-view-tabs" role="tablist" aria-label="Roadmap views" onKeyDown={event => {if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {event.preventDefault(); const next = event.key === "End" || event.key === "ArrowRight"; setOverview(next); (event.currentTarget.children[next ? 1 : 0] as HTMLButtonElement).focus()}}}><button type="button" role="tab" aria-selected={!overview} aria-controls={`${viewId}-map`} onClick={() => setOverview(false)}><Map/>Map</button><button type="button" role="tab" aria-selected={overview} aria-controls={`${viewId}-overview`} onClick={() => setOverview(true)}><ListChecks/>Overview</button></div><div className="sdlc-studio-actions"><button type="button" disabled={!canEdit || !editor.canUndo} title="Undo · Ctrl+Z" aria-label="Undo roadmap change" onClick={() => historyAction()}><Undo2/></button><button type="button" disabled={!canEdit || !editor.canRedo} title="Redo · Ctrl+Shift+Z" aria-label="Redo roadmap change" onClick={() => historyAction(true)}><Redo2/></button><i/><button type="button" onClick={showCurrent} title="Inspect and locate the current phase"><LocateFixed/><span>Current phase</span></button>{compact && <button type="button" aria-label="Open phase details" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen(true)}><PanelRight/><span>Details</span></button>}</div></div>
        {notice && <div className="sdlc-studio-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
        {archive && <SdlcArchiveNotice cycleName={cycleName} onReturn={() => viewCycle(document.cycle ?? 1)}/>}
        <div className="sdlc-layout">
            <div className="sdlc-universe" data-model={document.model} style={{"--sdlc-model-color": isIterative ? `hsl(${tornadoHue(cycle)} 72% 65%)` : model.color} as CSSProperties}>
                <div className="sdlc-sky"><SdlcStarfield camera={navigation.camera}/></div>
                <div className="sdlc-canvas-toolbar">
                    <div className="sdlc-model-control"><label>SDLC model<select aria-label="SDLC model" value={document.model} disabled={!canEdit} onChange={event => changeModel(event.target.value as SdlcModel)}>{sdlcModelIds.map(id => <option key={id} value={id}>{sdlcModels[id].title}</option>)}</select></label>
                        <label>{releaseView ? "Release phase" : document.model === "agile" ? "Current activity" : "Current phase"}<select aria-label={releaseView ? "Current release phase" : `Current ${model.title} phase`} value={detailCurrent} disabled={!canEdit || readOnlyPhase} onChange={event => current(Number(event.target.value))}>{detailPhases.map((item, index) => <option key={item.id} value={index}>{item.title}{item.optional ? " (optional)" : ""}</option>)}</select></label>
                        {model.cycle && <label>{model.cycle}<select aria-label={`View ${model.cycle.toLowerCase()}`} value={cycle} onChange={event => viewCycle(Number(event.target.value))}>
                            {document.history?.map(entry => <option key={entry.cycle} value={entry.cycle}>{entry.cycle} · completed</option>)}<option value={document.cycle ?? 1}>{document.cycle ?? 1} · {document.completed ? "completed" : "current"}</option>
                        </select></label>}
                    </div>
                    <span className="sdlc-map-label" title={model.summary}><span/>{releaseView ? activeRelease!.completed ? "Release complete" : `Release · ${iterativeReleasePhases[activeRelease!.currentPhase].title}` : active.completed ? `${cycleName} complete` : document.model === "agile" ? `Focus · ${phases[active.currentPhase].title}` : `Phase ${String(active.currentPhase + 1).padStart(2, "0")} / ${String(phases.length).padStart(2, "0")}`}</span>
                </div>
                <details className="sdlc-workflow-guide" key={document.model}><summary>How {model.title} flows · references</summary><p>{model.guidance}</p>
                    <div className="sdlc-path-legend"><span><i/>Progression</span><span><i className="dashed"/>{document.model === "v-model" ? "Test-basis pairing" : document.model === "agile" ? "Feedback / optional release" : "Feedback / rework"}</span></div>
                    <nav aria-label={`${model.title} workflow sources`}>{model.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</nav>
                </details>
                {activeRelease && <div className="sdlc-scope-tabs" role="group" aria-label="Iteration or release"><button type="button" aria-pressed={!releaseView} onClick={() => setSelectedPhase({model: document.model, index: active.currentPhase, release: false})}>Iteration work</button><button type="button" aria-pressed={releaseView} onClick={() => setSelectedPhase({model: document.model, index: activeRelease.currentPhase, release: true})}>Release path</button></div>}
                {overview ? <div className="sdlc-overview-container" role="tabpanel" id={`${viewId}-overview`}><SdlcOverview title={`${model.title}${model.cycle ? ` · ${cycleName}` : ""}${releaseView ? " · Release path" : ""}`} phases={detailPhases} work={detailWork} notes={detailNotes} selected={selected} current={detailCurrent} completed={detailCompleted} isDone={detailDone} members={organization.members} archived={!!archive} onSelect={select}/></div>
                : <div className="sdlc-scene-container" role="tabpanel" id={`${viewId}-map`}>{document.model === "iterative" ? <IterativeTornado ref={tornado} cycles={document.cycle ?? 1} phases={phases} currentPhase={document.currentPhase} completed={document.completed} work={document.work}
                    selectedCycle={cycle} selectedPhase={releaseView ? -1 : selected} onSelect={selectTornadoPhase} onZoomChange={setTornadoZoom}/>
                : <div ref={navigation.viewport} className={`sdlc-viewport ${navigation.dragging ? "is-dragging" : ""}`} tabIndex={0} role="region" aria-label={`${model.title} roadmap canvas`} aria-describedby="sdlc-navigation-help" {...navigation.handlers}>
                <div className="sdlc-camera" style={{width: roadmapSize.width, height: roadmapSize.height, "--sdlc-label-scale": Math.min(4, Math.max(.7, 1 / navigation.camera.zoom)), transform: `translate3d(${navigation.camera.x}px, ${navigation.camera.y}px, 0) scale(${navigation.camera.zoom})`} as CSSProperties}>
                <div className={`sdlc-constellation ${navigation.camera.zoom < .48 ? "compact-labels" : ""}`} aria-label={`${model.title} roadmap`}>
                    <SdlcConstellationIllustration model={document.model}/>
                    <svg className="sdlc-roadmap-links" viewBox={`0 0 ${roadmapSize.width} ${roadmapSize.height}`} aria-hidden="true">
                        <defs><marker id={markerId} viewBox="0 0 10 10" refX="37" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L9 5L1 9" fill="none" stroke="var(--sdlc-ink)" strokeWidth="1.3"/></marker></defs>
                        <g className="sdlc-path-shadow">{phaseLinks.filter(link => link.kind === "flow").map((link, index) => <path key={index} d={link.path}/>)}</g>
                        {phaseLinks.map((link, index) => {
                            const highlighted = link.kind === "validation" && (selected === link.from || selected === link.to)
                            if (link.kind === "feedback" && document.model === "waterfall" && selected !== 3) return null
                            return <path key={index} d={link.path} data-from={phases[link.from].id} data-to={phases[link.to].id} data-kind={link.kind}
                                markerEnd={link.kind === "validation" ? undefined : `url(#${markerId})`}
                                className={`sdlc-link sdlc-link-${link.kind} ${highlighted ? "selected" : ""} ${link.kind === "flow" && sdlcPhaseDone(active, link.from) ? "completed" : ""}`}><title>{phases[link.from].title} → {phases[link.to].title}{link.label ? ` · ${link.label}` : ""}</title></path>
                        })}
                        {phaseLinks.filter(link => link.label && link.labelX !== undefined).map((link, index) => <text key={index} x={link.labelX} y={link.labelY} className={`sdlc-link-label ${selected === link.from || selected === link.to ? "selected" : ""}`}>{link.label}</text>)}
                        {document.model === "agile" && <text className="sdlc-agile-activity-note" x="500" y="360"><tspan x="500">Design · Build · Test</tspan><tspan x="500" dy="21">overlap during the Sprint</tspan></text>}
                    </svg>
                    {phases.map((item, index) => {
                        const done = sdlcPhaseDone(active, index), currentPhase = index === active.currentPhase && !active.completed
                        return <button type="button" key={`${document.model}:${item.id}`} aria-label={`${item.title}, ${done ? "completed" : active.work?.[item.id]?.blocked ? "blocked" : currentPhase ? "current phase" : item.ongoing ? "ongoing" : item.optional ? "optional" : "upcoming"}`} aria-pressed={selected === index}
                            className={`sdlc-phase-star label-${positions[index].label} ${item.optional ? "optional" : ""} ${done ? "completed" : ""} ${currentPhase ? "current" : ""} ${!done && active.work?.[item.id]?.blocked ? "blocked" : ""} ${selected === index ? "selected" : ""} ${pairedPhase === index ? "paired" : ""}`}
                            style={{left: positions[index].x, top: positions[index].y}} onFocus={event => {if (event.currentTarget.matches(":focus-visible")) navigation.reveal(positions[index])}} onClick={() => {setSelectedPhase({model: document.model, index}); openDetails()}}>
                            <span className="sdlc-star-core"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path className="sdlc-star-rays" d="M32 0L35 25L48 16L39 29L64 32L39 35L48 48L35 39L32 64L29 39L16 48L25 35L0 32L25 29L16 16L29 25Z"/><path className="sdlc-star-light" d="M32 8L36 28L56 32L36 36L32 56L28 36L8 32L28 28Z"/><circle cx="32" cy="32" r="4"/></svg></span><span className="sdlc-star-label"><small>{item.optional ? "OPTIONAL" : item.ongoing ? "ONGOING" : String(phaseNumber(index)).padStart(2, "0")}</small><strong>{item.title}</strong><em>{done ? <><Check/> Completed</> : active.work?.[item.id]?.blocked ? "Blocked" : currentPhase ? "You are here" : item.optional ? "Release when ready" : item.ongoing ? "Refine throughout" : "Upcoming"}</em></span>
                        </button>
                    })}
                </div>
                </div>
                </div>}</div>}
                {isIterative && activeRelease && <nav className="sdlc-release-path" aria-label={`Iteration ${cycle} release milestones`}>
                    <span>{cycleName}<small>Release path</small></span><ArrowRight aria-hidden="true"/>
                    {iterativeReleasePhases.map((item, index) => <button type="button" key={item.id} aria-label={`View ${item.title.toLowerCase()}`} aria-pressed={releaseView && selected === index}
                        className={index < activeRelease.currentPhase || activeRelease.completed ? "completed" : ""} onClick={() => selectRelease(index)}>
                        <span>{index < activeRelease.currentPhase || activeRelease.completed ? <Check/> : index + 1}</span>{item.title}{index === 0 && <ArrowRight aria-hidden="true"/>}
                    </button>)}
                </nav>}
                <footer className="sdlc-canvas-footer">
                    <div className="sdlc-progress-card"><div><span>{cycleName}{releaseView ? " release" : ""} {detailCompleted ? "complete" : "progress"}</span><strong>{progress}%</strong></div><progress max="100" value={progress} aria-label={`${model.title}${releaseView ? " release" : ""} completion`}/><small>{completedCount} of {requiredCount} {releaseView ? "milestones" : document.model === "agile" ? "checkpoints" : "phases"} complete{document.model === "agile" ? active.released ? " · Released" : " · Release optional" : ""}</small></div>
                    {!overview && <div className="sdlc-navigation"><div className="sdlc-zoom-controls" role="group" aria-label="Roadmap view"><button type="button" aria-label="Zoom out" disabled={isIterative ? tornadoZoom <= .45 : navigation.camera.zoom <= .2} onClick={() => isIterative ? tornado.current?.zoom(1 / 1.2) : navigation.zoom(1 / 1.2)}><Minus/></button><output aria-label="Roadmap zoom">{Math.round((isIterative ? tornadoZoom : navigation.camera.zoom) * 100)}%</output><button type="button" aria-label="Zoom in" disabled={isIterative ? tornadoZoom >= 5 : navigation.camera.zoom >= 2} onClick={() => isIterative ? tornado.current?.zoom(1.2) : navigation.zoom(1.2)}><Plus/></button><button type="button" aria-label="Fit roadmap" title="Fit roadmap (Home)" onClick={() => isIterative ? tornado.current?.fit() : navigation.fit()}><Maximize/></button></div><p id="sdlc-navigation-help">{isIterative ? "Drag to orbit · Shift-drag to pan · Scroll to zoom" : "Drag to pan · Scroll to zoom"}<span className="sr-only">. Focus the canvas and use arrow keys to {isIterative ? "rotate, Shift and arrow keys to pan" : "pan"}, plus or minus to zoom, and Home to {isIterative ? "reset the 3D view" : "fit the roadmap"}.</span></p></div>}
                </footer>
            </div>
            <ResponsiveWorkshopPanel compact={compact} open={inspectorOpen} onOpenChange={setInspectorOpen} title="Phase details" side="right"><div className={`sdlc-inspector-panel ${!compact && inspectorCollapsed ? "is-collapsed" : ""}`}>
                <div className="sdlc-inspector-heading"><strong>Phase details</strong><button type="button" aria-label={`${inspectorCollapsed ? "Expand" : "Collapse"} phase details`} title={`${inspectorCollapsed ? "Expand" : "Collapse"} phase details`}
                    aria-expanded={compact || !inspectorCollapsed} aria-controls={inspectorId} onClick={() => compact ? setInspectorOpen(false) : setInspectorCollapsed(value => !value)}>{inspectorCollapsed && !compact ? <ChevronLeft/> : <ChevronRight/>}</button></div>
                {inspectorCollapsed && !compact && <span className="sdlc-inspector-rail-label" aria-hidden="true">Phase details</span>}
            <aside ref={inspectorBody} id={inspectorId} hidden={!compact && inspectorCollapsed} className="sdlc-phase-inspector tool-inspector" aria-label="Roadmap phase details">
                <header><span className="sdlc-phase-number">{phase.optional ? "◇" : phase.ongoing ? "↻" : String(releaseView ? selected + 1 : phaseNumber(selected)).padStart(2, "0")}</span><strong>{phase.title}</strong><small className={`sdlc-phase-badge ${phaseState}`}>{archive ? `${cycleName} · ${phaseState}` : phaseState === "current" ? "Current phase" : phaseState === "completed" ? "Completed phase" : phaseState[0].toUpperCase() + phaseState.slice(1)}</small></header>
                <p className="sdlc-phase-description">{phase.description}</p>
                <SdlcPhaseWorkPanel phase={phase} work={detailWork?.[phase.id]} members={organization.members} canEdit={canEdit} archived={readOnlyPhase} done={detailDone(selected)} onChange={changes => {if (!readOnlyPhase) setDocument(value => updateSdlcWork(value, document.model, phase.id, changes, releaseView))}} begin={editor.beginTransaction} end={editor.endTransaction}/>
                <label className="sdlc-notes-field">Phase notes<textarea aria-label="Phase notes" disabled={!canEdit || readOnlyPhase} rows={5} maxLength={10000} placeholder="Record milestones, decisions and progress…" value={detailNotes[phase.id] ?? ""} onFocus={editor.beginTransaction} onBlur={editor.endTransaction} onChange={event => {if (!readOnlyPhase) setDocument(value => updateSdlcNote(value, document.model, phase.id, event.target.value, releaseView))}}/></label>
                <details className="sdlc-quality-details" key={`${document.model}:${phase.id}`}><summary>Quality & validation guidance</summary><section className="sdlc-quality-activity" aria-label="Quality activity"><strong>{document.model === "v-model" && selected < 4 ? "Review & test preparation" : "Quality activity"}</strong><p>{sdlcQuality(document.model, phase)}</p></section>{pairedPhase >= 0 && <div className="sdlc-validation-pair"><small>{selected < 4 ? "Validated by" : "Verifies"}</small><button type="button" onClick={() => select(pairedPhase)}>{phases[pairedPhase].title}<ArrowRight/></button></div>}</details>
                <p className="tool-help">{model.summary} {model.cycle ? "Each new cycle keeps the previous cycle's notes in history." : "Setting a phase marks earlier phases complete. You can return to an earlier phase at any time."}</p>
                <div className="sdlc-phase-list">{detailPhases.map((item, index) => <button type="button" key={item.id} className={selected === index ? "active" : ""} onClick={() => select(index)}><span>{detailDone(index) ? <Check/> : item.optional ? "◇" : item.ongoing ? "↻" : releaseView ? index + 1 : phaseNumber(index)}</span>{item.title}{item.optional && <small>Optional</small>}{index === detailCurrent && !detailCompleted && <i/>}</button>)}</div>
            </aside>
            <footer className="sdlc-phase-actions">{phaseActions()}</footer>
            </div></ResponsiveWorkshopPanel>
        </div>
        {completion && <SdlcCompletionDialog open phase={completion.phase} work={completion.work} onClose={() => setCompletion(null)} onConfirm={() => {if (completion.document === document && canEdit) commitAdvance(completion.document, completion.release); else setNotice("The roadmap changed while this review was open. Review the current phase again."); setCompletion(null)}}/>}
    </section>
}
