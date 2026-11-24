import {useId, useState} from "react"
import {ArrowUpRight, CalendarDays, Check, Circle, ExternalLink, Flag, Plus, UserRound, X} from "lucide-react"
import {Popover} from "radix-ui"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {WorkshopAssignees} from "./workshop-assignees"
import {sdlcAssignees, sdlcDateLabel, sdlcDeliverableDate, sdlcOverdue, sdlcPhaseState, sdlcReadiness} from "./sdlc-work"
import type {SdlcPhase} from "./sdlc-models"
import {maxSdlcAssignees, maxSdlcDeliverableLength, maxSdlcDeliverables, validSdlcDate, type SdlcPhaseWork, type SdlcWork} from "./sdlc-document"
import type {WorkshopMember} from "./workshop-types"

function SdlcDateControl({subject, value, iconOnly = false, onChange}: {
    subject: string; value?: string; iconOnly?: boolean; onChange: (date?: string) => void
}) {
    const id = useId()
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState(value ?? "")
    const invalid = draft !== "" && !validSdlcDate(draft)
    const action = `${value ? "Change" : "Set"} target date for ${subject}`

    function save(date?: string) {
        onChange(date)
        setOpen(false)
    }

    return <Popover.Root open={open} onOpenChange={next => {if (next) setDraft(value ?? ""); setOpen(next)}}>
        <Popover.Trigger asChild>
            <Button type="button" variant="ghost" size={iconOnly ? "icon-xs" : "xs"} className="sdlc-date-trigger"
                aria-label={action} title={action}>
                <CalendarDays aria-hidden="true"/>{!iconOnly && (value ? sdlcDateLabel(value) : "Set date")}
            </Button>
        </Popover.Trigger>
        <Popover.Portal>
            <Popover.Content className="sdlc-date-popover" aria-label={action} align="end" sideOffset={5} collisionPadding={10}>
                <form onSubmit={event => {
                    event.preventDefault()
                    if (!invalid) save(draft || undefined)
                }}>
                    <Label htmlFor={id}>Target date</Label>
                    <Input id={id} type="date" min="1900-01-01" max="9999-12-31"
                        value={draft} aria-invalid={invalid || undefined} onChange={event => setDraft(event.target.value)}/>
                    <div className="sdlc-date-actions">
                        {value && <Button type="button" variant="ghost" size="xs" onClick={() => save()}>Clear date</Button>}
                        <Button type="submit" size="xs" disabled={invalid}>Save date</Button>
                    </div>
                </form>
            </Popover.Content>
        </Popover.Portal>
    </Popover.Root>
}

export function SdlcPhasePlan({phase, work, members, canEdit, canManageDeliverables, onChange}: {
    phase: SdlcPhase; work?: SdlcPhaseWork; members: WorkshopMember[]; canEdit: boolean; canManageDeliverables: boolean
    onChange: (changes: Partial<SdlcPhaseWork>) => void
}) {
    const assigneeIds = sdlcAssignees(work)
    const {items, done} = sdlcReadiness(phase, work)
    const [adding, setAdding] = useState(false)
    const [draft, setDraft] = useState("")
    const label = draft.trim()
    const duplicate = items.includes(label)
    const canAdd = canManageDeliverables && items.length < maxSdlcDeliverables

    function changeAssignees(ids: string[]) {onChange({assigneeIds: ids, ownerId: undefined})}
    function toggleDeliverable(item: string, checked: boolean) {
        const completed = work?.checked?.filter(value => items.includes(value) && value !== item) ?? []
        onChange({checked: checked ? [...completed, item] : completed})
    }
    function changeDeliverables(next: string[], changed: string) {
        onChange({deliverables: next, checked: work?.checked?.filter(value => value !== changed)})
    }
    function changeDeliverableDate(item: string, date?: string) {
        const dates = {...work?.deliverableTargetDates}
        if (!date) delete dates[item]
        onChange({deliverableTargetDates: date ? {...dates, [item]: date} : dates})
    }
    function closeAdd() {setAdding(false); setDraft("")}

    return <div className="sdlc-phase-plan">
        {(canEdit || work?.targetDate) && <section className="sdlc-phase-target-date" aria-label="Phase target date">
            <h4>Target date</h4>
            {canEdit ? <SdlcDateControl subject={phase.title} value={work?.targetDate} onChange={targetDate => onChange({targetDate})}/>
                : work?.targetDate && <time dateTime={work.targetDate}>{sdlcDateLabel(work.targetDate)}</time>}
        </section>}
        <section aria-label="Phase assignees">
            <h4>Assignees</h4>
            <WorkshopAssignees ids={assigneeIds} members={members} editable={canEdit} disabled={false}
                addDisabled={assigneeIds.length >= maxSdlcAssignees} subject={phase.title} showNames
                onAdd={id => changeAssignees([...assigneeIds, id])}
                onRemove={id => changeAssignees(assigneeIds.filter(assignee => assignee !== id))}/>
        </section>
        <section aria-label="Phase deliverables">
            <div className="sdlc-section-caption">
                <h4>Deliverables</h4>
                {!!items.length && <small aria-label={`${done} of ${items.length} deliverables complete`}>{done} / {items.length}</small>}
                {canManageDeliverables && <Button type="button" variant="ghost" size="icon-xs" aria-label="Add deliverable"
                    title="Add deliverable" aria-expanded={adding && canAdd} disabled={!canAdd} onClick={() => adding ? closeAdd() : setAdding(true)}><Plus/></Button>}
            </div>
            {items.length ? <ul className="sdlc-deliverable-checklist">{items.map(item => {
                const checked = work?.checked?.includes(item) ?? false
                const target = sdlcDeliverableDate(work, item)
                return <li key={item} className={checked ? "checked" : ""}>
                    <div className="sdlc-deliverable-description">
                        <label><input type="checkbox" aria-label={`Deliverable: ${item}`} disabled={!canEdit} checked={checked}
                            onChange={event => toggleDeliverable(item, event.target.checked)}/><span>{item}</span></label>
                        {target && <time dateTime={target} title="Target date">{sdlcDateLabel(target)}</time>}
                    </div>
                    {canEdit && <SdlcDateControl subject={item} value={target} iconOnly onChange={date => changeDeliverableDate(item, date)}/>}
                    {canManageDeliverables && <Button type="button" variant="ghost" size="icon-xs" className="sdlc-remove-deliverable" aria-label={`Remove deliverable: ${item}`}
                        title="Remove deliverable" onClick={() => changeDeliverables(items.filter(value => value !== item), item)}><X/></Button>}
                </li>
            })}</ul> : <p className="sdlc-deliverable-empty">No deliverables yet.</p>}
            {adding && canAdd && <form className="sdlc-deliverable-form" onSubmit={event => {
                event.preventDefault()
                if (label && !duplicate) {changeDeliverables([...items, label], label); closeAdd()}
            }} onKeyDown={event => {
                if (event.key === "Escape") {event.stopPropagation(); closeAdd()}
            }}>
                <input autoFocus aria-label="Deliverable name" placeholder="Deliverable name" maxLength={maxSdlcDeliverableLength}
                    value={draft} onChange={event => setDraft(event.target.value)}/>
                <Button type="submit" size="xs" disabled={!label || duplicate}>Add</Button>
                {duplicate && <small role="status">This deliverable is already listed.</small>}
            </form>}
        </section>
    </div>
}

export function SdlcOverview({title, phases, work, notes, selected, current, completed, isDone, members, archived, onSelect}: {
    title: string; phases: readonly SdlcPhase[]; work?: SdlcWork; notes: Record<string, string>; selected: number; current: number; completed: boolean
    isDone: (index: number) => boolean; members: WorkshopMember[]; archived: boolean; onSelect: (index: number) => void
}) {
    const blocked = phases.filter((phase, index) => !isDone(index) && work?.[phase.id]?.blocked).length, overdue = phases.filter((phase, index) => sdlcOverdue(work?.[phase.id], isDone(index))).length
    return <section className="sdlc-overview" aria-label="Roadmap phase overview"><header><div><span>{archived ? "ARCHIVED ROADMAP" : "THE WORK AHEAD"}</span><h2>{title}</h2><p>A clear view of ownership, readiness, and what needs attention.</p></div>{!!(blocked || overdue) && <div className="sdlc-attention-summary">{!!blocked && <span><Flag/>{blocked} blocked</span>}{!!overdue && <span><CalendarDays/>{overdue} overdue</span>}</div>}</header>
        <div className="sdlc-overview-list">{phases.map((phase, index) => {
            const detail = work?.[phase.id], done = isDone(index), state = sdlcPhaseState(phase, detail, done, index === current && !completed), readiness = sdlcReadiness(phase, detail)
            const assignees = sdlcAssignees(detail).map(id => {
                const member = members.find(candidate => candidate.id === id)
                return member?.nickname || member?.name || "Former member"
            })
            return <button type="button" className={`sdlc-overview-phase ${selected === index ? "selected" : ""}`} key={phase.id} aria-label={`Inspect ${phase.title}`} aria-pressed={selected === index} onClick={() => onSelect(index)}><span className={`sdlc-overview-number ${state}`}>{done ? <Check/> : phase.ongoing ? "↻" : String(index + 1).padStart(2, "0")}</span><div className="sdlc-overview-phase-main"><div><strong>{phase.title}</strong><span className={`sdlc-phase-badge ${state}`}>{state === "current" ? "In progress" : state[0].toUpperCase() + state.slice(1)}</span></div><p>{phase.description}</p><div className="sdlc-overview-phase-meta"><span><UserRound/>{assignees.join(", ") || "Unassigned"}</span>{detail?.targetDate && <span className={sdlcOverdue(detail, done) ? "overdue" : ""}><CalendarDays/>{sdlcDateLabel(detail.targetDate)}</span>}<span><Circle/>{readiness.done}/{readiness.items.length} deliverables</span>{notes[phase.id] && <span>Notes added</span>}</div></div><ArrowUpRight/></button>
        })}</div>
    </section>
}

export function SdlcCompletionDialog({phase, work, open, onClose, onConfirm}: {phase: SdlcPhase; work?: SdlcPhaseWork; open: boolean; onClose: () => void; onConfirm: () => void}) {
    const readiness = sdlcReadiness(phase, work)
    return <Dialog open={open} onOpenChange={value => {if (!value) onClose()}}><DialogContent className="sdlc-review-dialog"><DialogHeader><DialogTitle>Complete {phase.title}?</DialogTitle><DialogDescription>{readiness.blocked ? "Clear the blocker once it’s resolved, then review the phase again." : "Some deliverables have not been checked. Review them before recording this phase as complete."}</DialogDescription></DialogHeader>
        {readiness.blocked ? <p className="sdlc-review-blocker"><Flag/>{work?.blocker || "This phase needs attention."}</p> : <ul>{readiness.missing.map(item => <li key={item}><Circle/>{item}</li>)}</ul>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Review phase</Button><Button onClick={onConfirm}>{readiness.blocked ? "Clear blocker" : "Complete anyway"}<Check/></Button></DialogFooter>
    </DialogContent></Dialog>
}

export function SdlcArchiveNotice({cycleName, onReturn}: {cycleName: string; onReturn: () => void}) {
    return <WorkshopToast variant="info" title="Read-only history"><span>Viewing {cycleName.toLowerCase()} history. This snapshot is read only.</span><button type="button" onClick={onReturn}>Return to current<ExternalLink/></button></WorkshopToast>
}
import {WorkshopToast} from "@/features/workshop/workshop-toast"
