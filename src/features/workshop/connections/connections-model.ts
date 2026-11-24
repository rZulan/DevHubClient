import {createClientId} from "@/lib/create-client-id"
import type {SavedToolDocument} from "../tool-documents-api"
import type {ConnectionAnchor, ConnectionBindings, ConnectionCapability, ConnectionChoice, ConnectionDefinition, ConnectionDraft, ConnectionField, ConnectionNode, ConnectionNodeRef, ConnectionRule, ConnectionScope} from "./connections-api"

export const toolLabels: Record<string, string> = {
    todo: "TODOs", erd: "ERD", calendar: "Calendar", "bug-reports": "Bug Reports", "ui-editor": "UI/UX Editor",
    sdlc: "SDLC Roadmap", uml: "UML", wiki: "Project Wiki", notes: "Notes",
}

const toolKinds: Record<string, string> = {
    "todo-board": "todo", "todo-column": "todo", "todo-task": "todo", "erd-table": "erd", "erd-column": "erd",
    "erd-relationship": "erd", "calendar-entry": "calendar", "bug-report": "bug-reports", "bug-category": "bug-reports",
    "ui-screen": "ui-editor", "ui-layer": "ui-editor", "sdlc-model": "sdlc", "sdlc-phase": "sdlc", "sdlc-cycle": "sdlc",
    "sdlc-release": "sdlc", "uml-diagram": "uml", "uml-element": "uml", "uml-relationship": "uml", "wiki-page": "wiki", "sticky-note": "notes",
}

export const nodeTool = (kind: string) => toolKinds[kind] ?? kind
export const nodeKey = ({kind, id, parentId}: ConnectionNodeRef) => JSON.stringify([kind, parentId ?? "", id ?? ""])
export const sameNode = (a: ConnectionNodeRef, b: ConnectionNodeRef) => nodeKey(a) === nodeKey(b)
export const findNode = (nodes: ConnectionNode[], reference: ConnectionNodeRef) => nodes.find(node => sameNode(node.reference, reference))
export const findCapability = (catalog: ConnectionCapability[], reference: ConnectionNodeRef) => catalog.find(capability => capability.nodeKind === reference.kind)

export function anchorNode({label, ...reference}: ConnectionAnchor): ConnectionNode {
    return {reference, label, path: toolLabels[nodeTool(reference.kind)] ?? label}
}

export type ConnectionSummary = Pick<ConnectionDefinition, "id" | "title" | "nodes" | "rules">

export const todoCalendarConnection: ConnectionSummary = {
    id: "todo-calendar",
    title: "TODOs → Calendar",
    nodes: [anchorNode({kind: "todo", label: toolLabels.todo}), anchorNode({kind: "calendar", label: toolLabels.calendar})],
    rules: [],
}

export const sdlcTodoConnection: ConnectionSummary = {
    id: "sdlc-todo",
    title: "SDLC Roadmap → TODOs",
    nodes: [anchorNode({kind: "sdlc", label: toolLabels.sdlc}), anchorNode({kind: "todo", label: toolLabels.todo})],
    rules: [],
}

export function isSdlcTodoConnected(document: SavedToolDocument["document"] | undefined) {
    return !!document && "connectToTodo" in document && document.connectToTodo === true
}

export function newConnectionDraft(anchor?: ConnectionAnchor): ConnectionDraft {
    return {title: "", revision: 0, nodes: anchor ? [anchorNode(anchor)] : [], rules: []}
}

export function newConnectionRule(): ConnectionRule {
    return {id: createClientId(), title: "", enabled: false, includeAutomation: false, runOnce: false, source: {kind: ""}, event: "", eventArguments: {}, matchAny: false,
        conditions: [], actions: [{id: createClientId(), target: {kind: ""}, kind: "", arguments: {}}]}
}

export function connectionPageLink(scope: ConnectionScope, connectionId?: string, view?: "runs", runId?: string) {
    const params = new URLSearchParams({project: scope.projectId})
    if (connectionId) params.set("connection", connectionId)
    if (view) params.set("view", view)
    if (runId) params.set("run", runId)
    return `/workshop/${scope.organizationId}/connections?${params}`
}

export function connectionNodeLink(scope: ConnectionScope, {kind, parentId, id}: ConnectionNodeRef) {
    const tool = nodeTool(kind)
    const params = new URLSearchParams({project: scope.projectId})
    if (kind === "todo-board" && id) params.set("todo", id)
    if ((kind === "todo-task" || kind === "todo-column") && parentId) {
        params.set("todo", parentId)
        if (kind === "todo-task" && id) params.set("task", id)
        if (kind === "todo-column" && id) params.set("column", id)
    }
    if (tool === "todo" && params.has("todo")) params.set("todoProject", scope.projectId)
    if (kind === "bug-report" && id) params.set("report", id)
    if (id && tool !== "todo" && kind !== "bug-report") {
        params.set("nodeKind", kind)
        params.set("node", id)
        if (parentId) params.set("nodeParent", parentId)
    }
    const route = tool === "wiki" ? "project-wiki" : tool
    return `/workshop/${scope.organizationId}/${route}?${params}`
}

export function actionOutputTargets(rule: ConnectionRule, actionIndex: number, catalog: ConnectionCapability[]) {
    return rule.actions.slice(0, actionIndex).flatMap((action, index) => {
        const createdKind = findCapability(catalog, action.target)?.actionChoices.find(choice => choice.kind === action.kind)?.createdNodeKind
        if (!createdKind) return []
        const capability = findCapability(catalog, {kind: createdKind})
        if (!capability?.actionChoices.length) return []
        return [{stepId: action.id, reference: {kind: createdKind}, label: `${capability.label} created in step ${index + 1}`, action}]
    })
}

export function compatibleEventField(source: ConnectionField, target: ConnectionField) {
    const normalize = (type: string) => type === "multiline" ? "text" : type
    if (normalize(source.type) !== normalize(target.type)) return false
    return !target.options?.length || Boolean(source.options?.length && source.options.every(option => target.options?.some(item => item.value === option.value)))
}

export function validateConnection(draft: ConnectionDraft, catalog: ConnectionCapability[]) {
    if (!draft.title.trim()) return "Enter a connection name."
    if (draft.nodes.length < 2) return "Add at least two nodes."
    function ready(choice: ConnectionChoice | undefined, values: Record<string, string>, bindings?: ConnectionBindings | null) {
        return choice && choice.fields.every(field => !field.required || Boolean(values[field.key]?.trim()) || Boolean(bindings?.[field.key]))
    }
    for (const [index, rule] of draft.rules.entries()) {
        const name = rule.title.trim() || `Rule ${index + 1}`
        if (!rule.title.trim()) return `Enter a name for ${name}.`
        const source = findNode(draft.nodes, rule.source)
        const event = findCapability(catalog, rule.source)?.eventChoices.find(choice => choice.kind === rule.event)
        if (!rule.source.kind) return `Choose a source node for ${name}.`
        if (!source || !ready(event, rule.eventArguments)) return `${name} needs an event and its required fields.`
        if (!rule.actions.length) return `${name} needs at least one action.`
        for (const condition of rule.conditions) {
            const choice = findCapability(catalog, condition.node)?.conditionChoices.find(item => item.kind === condition.kind)
            if (!findNode(draft.nodes, condition.node) || !ready(choice, condition.arguments)) return `Complete the conditions for ${name}.`
        }
        for (const [actionIndex, action] of rule.actions.entries()) {
            if (!action.target.kind) return `Choose a target node for action ${actionIndex + 1} in ${name}.`
            const choice = findCapability(catalog, action.target)?.actionChoices.find(item => item.kind === action.kind)
            const target = action.targetFromStepId
                ? actionOutputTargets(rule, actionIndex, catalog).find(output => output.stepId === action.targetFromStepId && sameNode(output.reference, action.target))
                : findNode(draft.nodes, action.target)
            if (!target || !ready(choice, action.arguments, action.argumentBindings)) return `Complete the actions for ${name}.`
            for (const [key, binding] of Object.entries(action.argumentBindings ?? {})) {
                const sourceField = event?.fields.find(field => field.key === binding.eventField)
                const targetField = choice?.fields.find(field => field.key === key)
                if (!sourceField || !targetField || !compatibleEventField(sourceField, targetField)) return `Review the event fields used by ${name}.`
            }
        }
    }
    return ""
}
