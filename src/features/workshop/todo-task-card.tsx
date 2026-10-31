import {useRef, type DragEvent} from "react"
import {ChevronsLeft, ChevronsRight, Copy, Pencil, Trash2, UserRound, CheckCircle2, GripHorizontal, Ellipsis} from "lucide-react"
import {Card} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent} from "@/components/ui/context-menu"
import {DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent} from "@/components/ui/dropdown-menu"
import {TodoAssignees} from "./todo-assignees"
import {todoDateLabel} from "./todo-schedule"
import type {TodoTask, TodoColumn} from "./todo-api"
import type {WorkshopMember} from "./workshop-types"

export function TodoTaskCard({task, columns, members, userId, canManage, disabled, dragging, onEdit, onDuplicate, onDelete, onMove, onAssign, onError, onDragStart, onDragEnd}: {
    task: TodoTask; columns: TodoColumn[]; members: WorkshopMember[]; userId?: string; canManage: boolean; disabled: boolean; dragging?: boolean
    onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onMove: (status: string) => void
    onAssign: (id: string, remove: boolean) => void; onError: (message: string) => void
    onDragStart?: (event: DragEvent<HTMLDivElement>) => void; onDragEnd?: () => void
}) {
    const ids = task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : [])
    const index = columns.findIndex(column => column.id === task.status), previous = columns[index - 1], next = columns[index + 1]
    const complete = columns.at(-1)
    const openingDialog = useRef(false)
    function openDialog(action: () => void) {openingDialog.current = true; action()}
    async function copy() {
        try {await navigator.clipboard.writeText([task.title, task.description].filter(Boolean).join("\n\n"))}
        catch {onError("The task could not be copied to the clipboard.")}
    }
    function items(dropdown = false) {
        const Item = dropdown ? DropdownMenuItem : ContextMenuItem, MenuLabel = dropdown ? DropdownMenuLabel : ContextMenuLabel
        const Separator = dropdown ? DropdownMenuSeparator : ContextMenuSeparator, Sub = dropdown ? DropdownMenuSub : ContextMenuSub
        const SubTrigger = dropdown ? DropdownMenuSubTrigger : ContextMenuSubTrigger, SubContent = dropdown ? DropdownMenuSubContent : ContextMenuSubContent
        return <>
            <MenuLabel className="max-w-64 truncate">{task.title}</MenuLabel>
            {canManage && <>
                <Item disabled={disabled} onSelect={() => openDialog(onEdit)}><Pencil className="size-4"/> Edit task</Item>
                <Item disabled={disabled} onSelect={onDuplicate}><Copy className="size-4"/> Duplicate task</Item>
                <Sub><SubTrigger disabled={disabled}>Move to</SubTrigger><SubContent>
                    {columns.map(column => <Item key={column.id} disabled={task.status === column.id} onSelect={() => onMove(column.id)}>{column.name}</Item>)}
                </SubContent></Sub>
                {complete && task.status !== complete.id && <Item disabled={disabled} onSelect={() => onMove(complete.id)}><CheckCircle2 className="size-4"/> Mark complete</Item>}
                {userId && members.some(member => member.id === userId) && <Item disabled={disabled} onSelect={() => onAssign(userId, ids.includes(userId))}><UserRound className="size-4"/>{ids.includes(userId) ? "Unassign me" : "Assign to me"}</Item>}
                <Separator/>
            </>}
            <Item onSelect={() => void copy()}><Copy className="size-4"/> Copy task text</Item>
            {canManage && <><Separator/><Item variant="destructive" disabled={disabled} onSelect={() => openDialog(onDelete)}><Trash2 className="size-4"/> Delete task</Item></>}
        </>
    }
    function closeMenu(event: Event) {if (openingDialog.current) {event.preventDefault(); openingDialog.current = false}}
    return <ContextMenu><ContextMenuTrigger asChild><Card tabIndex={0} aria-label={`Task: ${task.title}`}
        id={`todo-task-${task.id}`} className={`workshop-task${dragging ? " workshop-task-dragging" : ""}`} draggable={canManage && !disabled}
        onDragStart={event => {if ((event.target as HTMLElement).closest("button, input, textarea")) {event.preventDefault(); return}; onDragStart?.(event)}} onDragEnd={onDragEnd}
        onDoubleClick={event => {if (canManage && !disabled && !(event.target as HTMLElement).closest("button, input, textarea")) onEdit()}}
        onKeyDown={event => {if (event.target === event.currentTarget && canManage && !disabled && (event.key === "Enter" || event.key === "F2")) {event.preventDefault(); onEdit()}}}>
        <DropdownMenu><DropdownMenuTrigger asChild><Button className="workshop-task-actions-trigger" variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`}><Ellipsis/></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={closeMenu}>{items(true)}</DropdownMenuContent>
        </DropdownMenu>
        <h3>{task.title}</h3>{task.description && <p>{task.description}</p>}
        {task.targetDate && <span className="workshop-task-dates" data-completed={task.status === complete?.id}>{todoDateLabel(task)}</span>}
        <TodoAssignees ids={ids} members={members} editable={canManage} disabled={disabled} taskTitle={task.title}
            onAdd={id => onAssign(id, false)} onRemove={id => onAssign(id, true)}/>
        {canManage && <>
            {previous && <Button aria-label={`Move ${task.title} to ${previous.name}`} title={`Move to ${previous.name}`} className="workshop-task-edge workshop-task-edge-left" disabled={disabled} variant="ghost" onClick={() => onMove(previous.id)}><ChevronsLeft/></Button>}
            {next && <Button aria-label={`Move ${task.title} to ${next.name}`} title={`Move to ${next.name}`} className="workshop-task-edge workshop-task-edge-right" disabled={disabled} variant="ghost" onClick={() => onMove(next.id)}><ChevronsRight/></Button>}
            <span className="workshop-task-drag-handle" title="Drag task to another column" aria-hidden="true"><GripHorizontal/></span>
        </>}
    </Card></ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={closeMenu}>{items()}</ContextMenuContent>
    </ContextMenu>
}
