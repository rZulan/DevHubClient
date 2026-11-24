import {useState} from "react"
import {Plus, X} from "lucide-react"
import {Popover} from "radix-ui"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Input} from "@/components/ui/input"
import type {WorkshopMember} from "./workshop-types"

function fitAssigneePill(chip: HTMLSpanElement) {
    const row = chip.parentElement
    const details = chip.querySelector(".workshop-assignee-details")
    if (!row || !details) return

    const rowBounds = row.getBoundingClientRect()
    const chipBounds = chip.getBoundingClientRect()
    const available = getComputedStyle(chip).direction === "rtl" ? chipBounds.right - rowBounds.left : rowBounds.right - chipBounds.left
    const avatarWidth = chip.querySelector<HTMLElement>(".workshop-assignee-avatar")?.offsetWidth ?? 0
    const pillWidth = Math.min(rowBounds.width, avatarWidth + details.scrollWidth + 2)
    const overlap = Math.max(0, Math.ceil(pillWidth - available))
    // Keep the avatar in its row when the expanded pill would otherwise wrap.
    chip.style.setProperty("--assignee-max-width", `${rowBounds.width}px`)
    chip.style.setProperty("--assignee-overlap", `${overlap}px`)
    chip.toggleAttribute("data-overflows-row", overlap > 0)
}

export function WorkshopAssignees({ids, members, editable, disabled, subject, showNames = false, addDisabled = false, onAdd, onRemove}: {
    ids: string[]
    members: WorkshopMember[]
    editable: boolean
    disabled: boolean
    subject: string
    showNames?: boolean
    addDisabled?: boolean
    onAdd: (id: string) => void
    onRemove: (id: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const available = members.filter(member => !ids.includes(member.id) && `${showNames ? member.nickname ?? "" : ""} ${member.name} ${member.username}`.toLowerCase().includes(search.toLowerCase()))
    return <div className={`workshop-task-assignees${showNames ? " workshop-assignees-named" : ""}`} role="group" aria-label={`Assignees for ${subject}`}
                onDragStart={event => event.stopPropagation()}>
        {ids.map(id => {
            const member = members.find(candidate => candidate.id === id)
            const name = (showNames && member?.nickname) || member?.name || "Former member"
            const avatar = <Avatar><AvatarImage src={member?.avatarUrl} alt=""
                                                draggable={false}/><AvatarFallback>{member?.initials ?? "?"}</AvatarFallback></Avatar>
            if (showNames) return <span className="workshop-named-assignee" key={id} role="group" aria-label={name} tabIndex={0}
                onPointerEnter={event => fitAssigneePill(event.currentTarget)}
                onFocus={event => fitAssigneePill(event.currentTarget)}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("data-tapped")
                }}>
                <span className="workshop-assignee-pill">
                    <span className="workshop-assignee-avatar" aria-hidden="true" onPointerUp={event => {
                        if (event.pointerType !== "touch") return
                        const chip = event.currentTarget.closest<HTMLElement>(".workshop-named-assignee")
                        if (!chip) return
                        chip.setAttribute("data-tapped", "")
                        chip.focus({preventScroll: true})
                    }}>{avatar}</span>
                    <span className="workshop-assignee-details">
                        <span className="workshop-assignee-details-content">
                            <span className="workshop-assignee-name" aria-hidden="true" title={name}>{name}</span>
                            {editable && <button type="button" className="workshop-named-assignee-remove" disabled={disabled}
                                title={`Remove ${name}`} aria-label={`Remove ${name} from ${subject}`} onClick={() => onRemove(id)}><X aria-hidden="true"/></button>}
                        </span>
                    </span>
                </span>
            </span>
            return editable ? <button type="button" className="workshop-task-assignee" disabled={disabled} key={id}
                                      title={`Remove ${name}`} aria-label={`Remove ${name} from ${subject}`}
                                      onClick={() => onRemove(id)}>
                {avatar}<span className="workshop-task-assignee-remove" aria-hidden="true"><X/></span>
            </button> : <span className="workshop-task-assignee" key={id} title={name} aria-label={name}>{avatar}</span>
        })}
        {editable && <Popover.Root open={open} onOpenChange={value => {
            setOpen(value);
            setSearch("")
        }}>
            <Popover.Trigger asChild>
                <button type="button" className="workshop-task-assignee-add" disabled={disabled || addDisabled}
                        title="Add assignees" aria-label={`Add assignees to ${subject}`}><Plus/></button>
            </Popover.Trigger>
            <Popover.Portal><Popover.Content className="workshop-assignee-picker" align="start" sideOffset={6}
                                             collisionPadding={12}>
                <strong>Add assignees</strong>
                <Input aria-label="Search members" placeholder="Search members…" value={search}
                       onChange={event => setSearch(event.target.value)}/>
                <div className="workshop-assignee-options">
                    {available.map(member => <button type="button" key={member.id} disabled={disabled} onClick={() => {
                        onAdd(member.id);
                        setOpen(false)
                    }}>
                        <Avatar><AvatarImage src={member.avatarUrl}
                                             alt=""/><AvatarFallback>{member.initials}</AvatarFallback></Avatar>
                        <span>{(showNames && member.nickname) || member.name}{member.username && <small>@{member.username}</small>}</span><Plus
                        aria-hidden="true"/>
                    </button>)}
                    {!available.length &&
                        <p>{members.every(member => ids.includes(member.id)) ? "All members are assigned." : "No members found."}</p>}
                </div>
            </Popover.Content></Popover.Portal>
        </Popover.Root>}
        {!editable && !ids.length && <span className="text-xs text-muted-foreground">Unassigned</span>}
    </div>
}
