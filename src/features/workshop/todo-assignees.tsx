import {useState} from "react"
import {Plus, X} from "lucide-react"
import {Popover} from "radix-ui"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Input} from "@/components/ui/input"
import type {WorkshopMember} from "./workshop-types"

export function TodoAssignees({ids, members, editable, disabled, taskTitle, onAdd, onRemove}: {
    ids: string[]
    members: WorkshopMember[]
    editable: boolean
    disabled: boolean
    taskTitle: string
    onAdd: (id: string) => void
    onRemove: (id: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const available = members.filter(member => !ids.includes(member.id) && `${member.name} ${member.username}`.toLowerCase().includes(search.toLowerCase()))
    return <div className="workshop-task-assignees" aria-label={`Assignees for ${taskTitle}`}
                onDragStart={event => event.stopPropagation()}>
        {ids.map(id => {
            const member = members.find(candidate => candidate.id === id)
            const name = member?.name ?? "Former member"
            const avatar = <Avatar><AvatarImage src={member?.avatarUrl} alt=""
                                                draggable={false}/><AvatarFallback>{member?.initials ?? "?"}</AvatarFallback></Avatar>
            return editable ? <button type="button" className="workshop-task-assignee" disabled={disabled} key={id}
                                      title={`Remove ${name}`} aria-label={`Remove ${name} from ${taskTitle}`}
                                      onClick={() => onRemove(id)}>
                {avatar}<span className="workshop-task-assignee-remove" aria-hidden="true"><X/></span>
            </button> : <span className="workshop-task-assignee" key={id} title={name} aria-label={name}>{avatar}</span>
        })}
        {editable && <Popover.Root open={open} onOpenChange={value => {
            setOpen(value);
            setSearch("")
        }}>
            <Popover.Trigger asChild>
                <button type="button" className="workshop-task-assignee-add" disabled={disabled}
                        title="Add assignees" aria-label={`Add assignees to ${taskTitle}`}><Plus/></button>
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
                        <span>{member.name}{member.username && <small>@{member.username}</small>}</span><Plus
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
