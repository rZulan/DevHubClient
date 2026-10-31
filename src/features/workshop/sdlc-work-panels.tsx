import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {Link} from "react-router-dom"
import {ArrowUpRight, CalendarDays, Check, Circle, ExternalLink, Flag, LockKeyhole, UserRound} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {sdlcDateLabel, sdlcOverdue, sdlcPhaseState, sdlcReadiness} from "./sdlc-work"
import type {SdlcPhase} from "./sdlc-models"
import type {SdlcPhaseWork, SdlcWork} from "./sdlc-document"
import type {WorkshopMember} from "./workshop-types"

export function SdlcPhaseWorkPanel({phase, work, members, canEdit, archived, done, onChange, begin, end}: {
    phase: SdlcPhase; work?: SdlcPhaseWork; members: WorkshopMember[]; canEdit: boolean; archived: boolean; done: boolean
    onChange: (changes: Partial<SdlcPhaseWork>) => void; begin: () => void; end: () => void
}) {
    const readiness = sdlcReadiness(phase, work), overdue = sdlcOverdue(work, done)
    const related = /design|architecture/.test(phase.id) ? [{to: "../erd", label: "ERD maker"}, {to: "../ui-editor", label: "UI/UX studio"}]
        : [{to: "../todo", label: "Task board"}, {to: "../notes", label: "Project notes"}]
    return <>
        <fieldset className="sdlc-work-fields" disabled={!canEdit || archived} onFocusCapture={event => {if ((event.target as HTMLElement).matches("input:not([type=checkbox]), textarea")) begin()}} onBlur={event => {if ((event.target as HTMLElement).matches("input:not([type=checkbox]), textarea")) end()}}>
            <div className="sdlc-section-caption"><strong>Phase ownership</strong>{archived && <LockKeyhole/>}</div>
            <label><span><UserRound/>Owner</span><WorkshopSelect aria-label="Phase owner" value={work?.ownerId ?? ""} onValueChange={selectedValue => onChange({ownerId: selectedValue || undefined})}><option value="">Unassigned</option>{work?.ownerId && !members.some(m => m.id === work.ownerId) && <option value={work.ownerId}>Former or unavailable member</option>}{members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</WorkshopSelect></label>
            <label><span><CalendarDays/>Target date{overdue && <em>Overdue</em>}</span><input aria-label="Phase target date" type="date" min="1900-01-01" max="9999-12-31" value={work?.targetDate ?? ""} onChange={event => onChange({targetDate: event.target.value || undefined})}/></label>
            <div className="sdlc-section-caption"><strong>Deliverables</strong><small>{readiness.done} / {readiness.items.length}</small></div>
            <div className="sdlc-deliverable-checklist">{readiness.items.map(item => <label key={item} className={work?.checked?.includes(item) ? "checked" : ""}><input type="checkbox" aria-label={`Deliverable: ${item}`} checked={work?.checked?.includes(item) ?? false} onChange={event => onChange({checked: event.target.checked ? [...work?.checked ?? [], item] : work?.checked?.filter(checked => checked !== item) ?? []})}/><span>{item}</span></label>)}</div>
            <label className="sdlc-blocked-toggle"><input type="checkbox" checked={work?.blocked ?? false} disabled={done} onChange={event => onChange({blocked: event.target.checked})}/><Flag/><span>Blocked / needs attention</span></label>
            {work?.blocked && <label className="sdlc-blocker-field">What is blocking this phase?<textarea aria-label="Phase blocker" maxLength={2000} rows={3} value={work.blocker ?? ""} placeholder="Capture the issue and what is needed to move forward…" onChange={event => onChange({blocker: event.target.value})}/><small>Resolve the blocker before completing this phase.</small></label>}
        </fieldset>
        {!archived && <nav className="sdlc-related-tools" aria-label="Related project tools"><span>Continue the work</span>{related.map(link => <Link key={link.to} to={link.to}>{link.label}<ArrowUpRight/></Link>)}</nav>}
    </>
}

export function SdlcOverview({title, phases, work, notes, selected, current, completed, isDone, members, archived, onSelect}: {
    title: string; phases: readonly SdlcPhase[]; work?: SdlcWork; notes: Record<string, string>; selected: number; current: number; completed: boolean
    isDone: (index: number) => boolean; members: WorkshopMember[]; archived: boolean; onSelect: (index: number) => void
}) {
    const blocked = phases.filter((phase, index) => !isDone(index) && work?.[phase.id]?.blocked).length, overdue = phases.filter((phase, index) => sdlcOverdue(work?.[phase.id], isDone(index))).length
    return <section className="sdlc-overview" aria-label="Roadmap phase overview"><header><div><span>{archived ? "ARCHIVED ROADMAP" : "THE WORK AHEAD"}</span><h2>{title}</h2><p>A clear view of ownership, readiness, and what needs attention.</p></div>{!!(blocked || overdue) && <div className="sdlc-attention-summary">{!!blocked && <span><Flag/>{blocked} blocked</span>}{!!overdue && <span><CalendarDays/>{overdue} overdue</span>}</div>}</header>
        <div className="sdlc-overview-list">{phases.map((phase, index) => {
            const detail = work?.[phase.id], done = isDone(index), state = sdlcPhaseState(phase, detail, done, index === current && !completed), readiness = sdlcReadiness(phase, detail), owner = members.find(m => m.id === detail?.ownerId)
            return <button type="button" className={`sdlc-overview-phase ${selected === index ? "selected" : ""}`} key={phase.id} aria-label={`Inspect ${phase.title}`} aria-pressed={selected === index} onClick={() => onSelect(index)}><span className={`sdlc-overview-number ${state}`}>{done ? <Check/> : phase.ongoing ? "↻" : String(index + 1).padStart(2, "0")}</span><div className="sdlc-overview-phase-main"><div><strong>{phase.title}</strong><span className={`sdlc-phase-badge ${state}`}>{state === "current" ? "In progress" : state[0].toUpperCase() + state.slice(1)}</span></div><p>{phase.description}</p><div className="sdlc-overview-phase-meta"><span><UserRound/>{owner ? owner.nickname || owner.name : detail?.ownerId ? "Former member" : "Unassigned"}</span>{detail?.targetDate && <span className={sdlcOverdue(detail, done) ? "overdue" : ""}><CalendarDays/>{sdlcDateLabel(detail.targetDate)}</span>}<span><Circle/>{readiness.done}/{readiness.items.length} deliverables</span>{notes[phase.id] && <span>Notes added</span>}</div></div><ArrowUpRight/></button>
        })}</div>
    </section>
}

export function SdlcCompletionDialog({phase, work, open, onClose, onConfirm}: {phase: SdlcPhase; work?: SdlcPhaseWork; open: boolean; onClose: () => void; onConfirm: () => void}) {
    const readiness = sdlcReadiness(phase, work)
    return <Dialog open={open} onOpenChange={value => {if (!value) onClose()}}><DialogContent className="sdlc-review-dialog"><DialogHeader><DialogTitle>Complete {phase.title}?</DialogTitle><DialogDescription>{readiness.blocked ? "This phase has an unresolved blocker. Return to its details to resolve it before continuing." : "Some deliverables have not been checked. Review them before recording this phase as complete."}</DialogDescription></DialogHeader>
        {readiness.blocked ? <p className="sdlc-review-blocker"><Flag/>{work?.blocker || "This phase needs attention."}</p> : <ul>{readiness.missing.map(item => <li key={item}><Circle/>{item}</li>)}</ul>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Review phase</Button>{!readiness.blocked && <Button onClick={onConfirm}>Complete anyway<Check/></Button>}</DialogFooter>
    </DialogContent></Dialog>
}

export function SdlcArchiveNotice({cycleName, onReturn}: {cycleName: string; onReturn: () => void}) {
    return <div className="sdlc-archive-notice" role="status"><LockKeyhole/><span>Viewing {cycleName.toLowerCase()} history. This snapshot is read only.</span><button type="button" onClick={onReturn}>Return to current<ExternalLink/></button></div>
}
