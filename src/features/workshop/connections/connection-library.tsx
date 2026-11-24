import {useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState} from "react"
import {skipToken} from "@reduxjs/toolkit/query"
import {Link, useNavigate} from "react-router-dom"
import {ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp, Link2, Pencil, Plus, Search, Trash2} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {useConnectionAccessQuery, useConnectionCatalogQuery, useConnectionNodesQuery, useDeleteConnectionMutation, useListConnectionsQuery, useSaveConnectionMutation, useValidateConnectionMutation, type ConnectionAnchor, type ConnectionCapability, type ConnectionDefinition, type ConnectionDraft, type ConnectionScope, type ConnectionValidation} from "./connections-api"
import {ConnectionEditor} from "./connection-editor"
import {ConnectionGraph} from "./connection-graph"
import {overviewGraph, previewGraph} from "./connection-graph-layout"
import {projectConnectionGraph, type ProjectMapSelection} from "./connection-project-graph"
import {connectionError} from "./connection-errors"
import {ConnectionLoadError} from "./connection-load-error"
import {useGetToolDocumentQuery} from "../tool-documents-api"
import {anchorNode, connectionNodeLink, connectionPageLink, findCapability, findNode, isSdlcTodoConnected, newConnectionDraft, sameNode, sdlcTodoConnection, todoCalendarConnection, type ConnectionSummary} from "./connections-model"
import {TodoCalendarConnectionSettings} from "./todo-calendar-connection-settings"
import "./connections.css"
import "./connection-dialog.css"

export type ConnectionCarry = {draft: ConnectionDraft; projectId: string}

const validationLabels = {ready: "Conditions pass", "conditions-unmet": "Conditions do not pass", "condition-unavailable": "Condition unavailable"}
const connectionStateLabels = {enabled: "Enabled", triggered: "Triggered once", paused: "Paused", draft: "Draft", removed: "Removed"}

function connectionState({rules, triggeredRuleIds}: ConnectionDefinition) {
    if (rules.some(rule => rule.enabled && !(rule.runOnce && triggeredRuleIds?.includes(rule.id)))) return "enabled"
    if (triggeredRuleIds?.length) return "triggered"
    return rules.length ? "paused" : "draft"
}

function DraftValidation({result, draft, catalog}: {result: ConnectionValidation; draft: ConnectionDraft; catalog: ConnectionCapability[]}) {
    return <section className="connection-notice connection-validation-result" aria-live="polite">
        <h3>Draft check</h3>
        {result.rules.length === 0 && <p>The selected nodes are valid. Add a rule to check its conditions.</p>}
        {result.rules.map(rule => <div key={rule.ruleId}>
            <strong>{draft.rules.find(item => item.id === rule.ruleId)?.title ?? "Rule"}</strong>{" · "}{validationLabels[rule.status]}
            {rule.conditions.length > 0 && <ul>{rule.conditions.map((condition, index) => {
                const node = findNode(draft.nodes, condition.node)
                const check = findCapability(catalog, condition.node)?.conditionChoices.find(choice => choice.kind === condition.kind)
                return <li key={index}>{node?.label ?? "Unavailable node"} · {check?.label ?? condition.kind} · {condition.passed === null ? "Unavailable" : condition.passed ? "Passed" : "Failed"}{condition.detail && ` · ${condition.detail}`}</li>
            })}</ul>}
        </div>)}
    </section>
}

export function ConnectionLibrary({scope, anchor, initialDraft, selection, onSelect, onClose, todoCalendarEnabled}: {
    scope: ConnectionScope; anchor?: ConnectionAnchor; initialDraft?: ConnectionDraft; selection?: string | null; todoCalendarEnabled: boolean
    onSelect?: (id: string | null) => void; onClose?: () => void
}) {
    const navigate = useNavigate()
    const list = useListConnectionsQuery(scope, {refetchOnFocus: true, refetchOnMountOrArgChange: true})
    const access = useConnectionAccessQuery(scope)
    const catalog = useConnectionCatalogQuery(scope)
    const anchorLookup = useConnectionNodesQuery({...scope, kind: anchor?.kind,
        id: anchor?.id ?? undefined, parentId: anchor?.parentId ?? undefined, page: 1}, {skip: !anchor})
    const showRoadmapConnection = !anchor || sdlcTodoConnection.nodes.some(node => sameNode(node.reference, anchor))
    const roadmap = useGetToolDocumentQuery(showRoadmapConnection ? {...scope, tool: "sdlc"} : skipToken,
        {refetchOnFocus: true, refetchOnMountOrArgChange: true})
    const sdlcTodoEnabled = isSdlcTodoConnected(roadmap.currentData?.document)
    const builtIns = useMemo(() => [
        ...(todoCalendarEnabled ? [todoCalendarConnection] : []),
        ...(sdlcTodoEnabled ? [sdlcTodoConnection] : []),
    ], [sdlcTodoEnabled, todoCalendarEnabled])
    const [save, saveResult] = useSaveConnectionMutation()
    const [validate, validationResult] = useValidateConnectionMutation()
    const [remove, removeResult] = useDeleteConnectionMutation()
    const [localSelection, setLocalSelection] = useState<string | null>(null)
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [editing, setEditing] = useState<ConnectionDraft | null>(initialDraft ?? null)
    const [search, setSearch] = useState("")
    const [stateFilter, setStateFilter] = useState("")
    const [problem, setProblem] = useState("")
    const [notice, setNotice] = useState("")
    const [validation, setValidation] = useState<{draft: ConnectionDraft; result: ConnectionValidation} | null>(null)
    const [confirmRemove, setConfirmRemove] = useState(false)
    const [showEditor, setShowEditor] = useState(() => !anchor && !!initialDraft)
    const [previewRuleId, setPreviewRuleId] = useState("")
    const [showIndex, setShowIndex] = useState(() => !anchor && !window.matchMedia("(max-width: 640px)").matches)
    const indexId = useId()
    const editorTrigger = useRef<HTMLButtonElement>(null)
    const q = useDeferredValue(search.trim().toLocaleLowerCase())
    const selectedId = selection === undefined ? localSelection : selection
    const selectedTodoCalendar = selectedId === todoCalendarConnection.id
    const selectedSdlcTodo = sdlcTodoEnabled && selectedId === sdlcTodoConnection.id
    const selectedBuiltIn = selectedTodoCalendar ? todoCalendarConnection : selectedSdlcTodo ? sdlcTodoConnection : undefined
    const connections = useMemo(() => (list.currentData ?? []).filter(item => !anchor || item.nodes.some(node => sameNode(node.reference, anchor))),
        [list.currentData, anchor])
    const selected = connections.find(item => item.id === selectedId)
    const sourceDraft = editing ?? selected
    const liveAnchor = anchorLookup.currentData?.find(node => anchor && sameNode(node.reference, anchor))
    const draft = sourceDraft && liveAnchor ? {...sourceDraft, nodes: sourceDraft.nodes.map(node => sameNode(node.reference, liveAnchor.reference) ? liveAnchor : node)} : sourceDraft
    const writable = access.currentData?.canManage === true
    function matchesFilter(connection: ConnectionSummary, state: string) {
        return (!stateFilter || state === stateFilter) && (!q || [connection.title, ...connection.nodes.flatMap(node => [node.label, node.path])]
            .some(value => value.toLocaleLowerCase().includes(q)))
    }
    const filtered = connections.filter(connection => matchesFilter(connection, connectionState(connection)))
    const todoCalendarState = todoCalendarEnabled ? "enabled" : "removed"
    const showTodoCalendar = matchesFilter(todoCalendarConnection, todoCalendarState)
    const showSdlcTodo = sdlcTodoEnabled && matchesFilter(sdlcTodoConnection, "enabled")

    const select = useCallback((id: string | null) => {
        if (onSelect) onSelect(id)
        else setLocalSelection(id)
    }, [onSelect])
    const open = useCallback((itemId: string | null) => {
        setSelectedNodeId(null)
        setEditing(null)
        setPreviewRuleId("")
        setProblem("")
        setNotice("")
        setValidation(null)
        setConfirmRemove(false)
        select(itemId)
    }, [select])
    const clearMapSelection = useCallback(() => {
        if (selectedId) open(null)
        else setSelectedNodeId(null)
    }, [open, selectedId])
    const selectMapItem = useCallback((item: ProjectMapSelection) => {
        if ("connectionId" in item) open(item.connectionId)
        else {
            if (selectedId) open(null)
            setSelectedNodeId(item.nodeId)
        }
    }, [open, selectedId])
    const map = useMemo(() => {
        if (anchor) return null
        const connectionId = selected?.id ?? builtIns.find(connection => connection.id === selectedBuiltIn?.id)?.id
        const selection = connectionId ? {connectionId} : selectedNodeId ? {nodeId: selectedNodeId} : null
        return projectConnectionGraph([...builtIns, ...connections], selection, selectMapItem)
    }, [anchor, builtIns, connections, selected, selectedBuiltIn, selectedNodeId, selectMapItem])
    const hasMapSelection = !!selectedBuiltIn || !!selected || !!map?.vertices.some(node => node.emphasis === "selected")
    useEffect(() => {
        if (anchor || !hasMapSelection || showEditor) return
        function handleEscape(event: KeyboardEvent) {
            if (event.key !== "Escape" || event.defaultPrevented || event.repeat) return
            event.preventDefault()
            clearMapSelection()
        }
        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [anchor, clearMapSelection, hasMapSelection, showEditor])
    function create() {
        select(null)
        setPreviewRuleId("")
        setConfirmRemove(false)
        setProblem("")
        setNotice("")
        setValidation(null)
        setEditing(newConnectionDraft(anchor))
    }
    async function saveDraft() {
        if (!draft || !sourceDraft) return
        setProblem("")
        setNotice("")
        setValidation(null)
        try {
            const saved = await save({...scope, draft: {...draft, title: draft.title.trim()}}).unwrap()
            select(saved.id)
            setEditing(null)
            setNotice("Connection saved.")
        } catch (error) {setProblem(connectionError(error, "Could not save this connection."))}
    }
    async function checkDraft() {
        if (!draft || !sourceDraft) return
        setProblem("")
        setNotice("")
        setValidation(null)
        try {setValidation({draft: sourceDraft, result: await validate({...scope, draft: {...draft, title: draft.title.trim()}}).unwrap()})}
        catch (error) {setProblem(connectionError(error, "Could not check this draft."))}
    }
    async function deleteCurrent() {
        if (!draft?.id) return
        setProblem("")
        setNotice("")
        setValidation(null)
        try {
            await remove({...scope, id: draft.id, revision: draft.revision}).unwrap()
            setEditing(null)
            setConfirmRemove(false)
            setShowEditor(false)
            select(null)
            setNotice("Connection deleted.")
        } catch (error) {setProblem(connectionError(error, "Could not delete this connection."))}
    }

    const failedQueries = [list, access, catalog].filter(query => query.isError)
    if (failedQueries.length) return <ConnectionLoadError error={failedQueries[0].error} fallback="Could not load project connections."
        retry={() => {for (const query of failedQueries) void query.refetch()}}/>
    if (!list.currentData || !catalog.currentData || !access.currentData) return <p className="connection-muted" role="status">Loading connections…</p>

    const capabilities = catalog.currentData
    const updateDraft = (next: ConnectionDraft) => {setEditing(next); setNotice(""); setProblem(""); setValidation(null)}

    if (anchor) {
        const source = liveAnchor ?? anchorNode(anchor)
        const hasSelection = connections.length > 0 || !!draft
        const linkedBuiltIns = builtIns.filter(connection => connection.nodes.some(node => sameNode(node.reference, anchor)))
        function openConnection(id: string) {
            if (linkedBuiltIns.some(connection => connection.id === id)) {
                onClose?.()
                navigate(connectionPageLink(scope, id))
                return
            }
            if (draft?.id !== id) open(id)
            setShowEditor(true)
        }
        function editConnections() {
            const first = connections[0]
            if (!draft && first) open(first.id)
            else if (!draft) create()
            setShowEditor(true)
        }

        if (!showEditor || !draft) {
            const label = hasSelection ? writable ? "Edit connections" : "View connections" : writable ? "New connection" : "Open Connections"
            const Icon = hasSelection ? writable ? Pencil : Link2 : writable ? Plus : ArrowUpRight
            const action = <><Icon aria-hidden="true"/><span className="connection-overview-action-label" aria-hidden="true"><span>{label}</span></span></>

            return <ConnectionGraph key="overview" title="Source graph" hideTitle
                graph={overviewGraph(source, [...linkedBuiltIns, ...connections], openConnection)}
                toolbar={hasSelection || writable
                    ? <Button type="button" size="icon" className="connection-overview-action" aria-label={label} onClick={editConnections}>{action}</Button>
                    : <Button size="icon" className="connection-overview-action" asChild>
                        <Link to={connectionPageLink(scope)} aria-label={label} onClick={onClose}>{action}</Link>
                    </Button>}/>
        }

        const rule = draft.rules.find(item => item.id === previewRuleId)
        return <div className="connection-dialog-workspace">
            <div className="connection-dialog-sidebar">
                <div className="connection-dialog-sidebar-heading">
                    <Button type="button" variant="ghost" size="sm" disabled={saveResult.isLoading} onClick={() => setShowEditor(false)}><ArrowLeft/>All connections</Button>
                </div>
                <div className="connection-dialog-sidebar-body">
                    <div className="connection-dialog-picker">
                        <label className="connection-field"><span>Connection</span>
                            <select disabled={saveResult.isLoading} value={draft.id ?? ""} onChange={event => open(event.target.value)}>
                                {!draft.id && <option value="" disabled>New connection</option>}
                                {connections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                        </label>
                        {writable && <Button type="button" size="icon-sm" variant="outline" title="New connection" aria-label="New connection"
                            disabled={!draft.id || saveResult.isLoading} onClick={create}><Plus/></Button>}
                    </div>
                    {notice && <p className="connection-notice" role="status">{notice}</p>}
                    <fieldset className="connection-dialog-fields" disabled={saveResult.isLoading}>
                        <ConnectionEditor key={draft.id ?? "new"} scope={scope} draft={draft} catalog={capabilities} writable={writable} busy={saveResult.isLoading}
                            checking={validationResult.isLoading} problem={problem} anchor={anchor} onChange={updateDraft}
                            ruleSelection={{rule, onSelect: setPreviewRuleId}} onSave={() => void saveDraft()} onCheck={() => void checkDraft()}/>
                    </fieldset>
                    {validation && validation.draft === sourceDraft && <DraftValidation result={validation.result} draft={draft} catalog={capabilities}/>}
                    <div className="connection-editor-footer">
                        <Button variant="ghost" size="sm" asChild><Link to={connectionPageLink(scope, draft.id)} state={{draft, projectId: scope.projectId} satisfies ConnectionCarry}
                            onClick={onClose}>Open in Connections<ArrowUpRight/></Link></Button>
                        {draft.id && <Button variant="ghost" size="sm" asChild><Link to={connectionPageLink(scope, draft.id, "runs")} onClick={onClose}>View run history</Link></Button>}
                    </div>
                </div>
            </div>
            <ConnectionGraph key={draft.id ?? "new"} title={rule ? rule.title.trim() || "Rule preview" : "Connection preview"}
                graph={previewGraph(source, draft.nodes, capabilities, rule)}
                toolbar={rule && <Button type="button" variant="outline" size="sm" onClick={() => setPreviewRuleId("")}>Show all nodes</Button>}
                message={draft.nodes.length < 2 && <p>Add a node to preview its link to {source.label}.</p>}
                legend={rule ? <><span data-tone="source">Trigger</span><span data-tone="condition">Condition</span><span data-tone="action">Action</span></>
                    : <><span data-tone="source">Source</span><span>{draft.nodes.length - 1} linked {draft.nodes.length === 2 ? "node" : "nodes"}</span></>}/>
        </div>
    }

    if (!map) return null
    return <>
        <aside className="connection-index" aria-label="Project connections">
            <div className="connection-section-title">
                <h3>Project connections</h3>
                <Button type="button" variant="ghost" size="icon-sm" aria-controls={indexId} aria-expanded={showIndex}
                    aria-label={showIndex ? "Hide project connections" : "Show project connections"} onClick={() => setShowIndex(value => !value)}>
                    {showIndex ? <ChevronUp/> : <ChevronDown/>}
                </Button>
            </div>
            {!showEditor && notice && <p className="connection-notice" role="status">{notice}</p>}
            <div id={indexId} className="connection-index-body" hidden={!showIndex}>
                {writable && <Button type="button" variant="outline" size="sm" onClick={event => {
                    editorTrigger.current = event.currentTarget
                    create()
                    setShowEditor(true)
                }}><Plus/>New connection</Button>}
                <div className="connection-index-filter">
                    <label className="connection-search"><Search aria-hidden="true"/><Input aria-label="Filter connections" placeholder="Filter by connection or node" value={search} onChange={event => setSearch(event.target.value)}/></label>
                    <select aria-label="Filter connection status" value={stateFilter} onChange={event => setStateFilter(event.target.value)}>
                        <option value="">Any state</option>{Object.entries(connectionStateLabels).map(([state, label]) =>
                            <option key={state} value={state}>{label}</option>)}
                    </select>
                </div>
                {showTodoCalendar || showSdlcTodo || filtered.length ? <ul className="connection-index-list">
                    {showTodoCalendar && <li><button type="button" aria-pressed={selectedTodoCalendar} onClick={event => {
                        editorTrigger.current = event.currentTarget
                        open(todoCalendarConnection.id)
                        setShowEditor(true)
                    }}><span><strong>{todoCalendarConnection.title}</strong><small>Default connection</small></span>
                        <small>{connectionStateLabels[todoCalendarState]}</small></button></li>}
                    {showSdlcTodo && <li><button type="button" aria-pressed={selectedSdlcTodo} onClick={event => {
                        editorTrigger.current = event.currentTarget
                        open(sdlcTodoConnection.id)
                        setShowEditor(true)
                    }}><span><strong>{sdlcTodoConnection.title}</strong><small>Default connection</small></span>
                        <small>{connectionStateLabels.enabled}</small></button></li>}
                    {filtered.map(item => <li key={item.id}>
                        <button type="button" aria-pressed={selected?.id === item.id} onClick={() => open(item.id)}>
                            <span><strong>{item.title}</strong><small>{item.nodes.map(node => node.label).join(" · ")}</small></span>
                            <small>{connectionStateLabels[connectionState(item)]}</small>
                        </button>
                    </li>)}
                </ul> : <p className="connection-muted">No matching connections.</p>}
            </div>
        </aside>
        <ConnectionGraph graph={map} title="Project map" hideTitle recenterOnDrop={false}
            onBackgroundClick={hasMapSelection && !showEditor ? clearMapSelection : undefined}
            toolbar={(draft || hasMapSelection) && <div className="connection-map-actions">
                {hasMapSelection && <Button type="button" variant="ghost" size="sm" onClick={clearMapSelection}>Clear selection</Button>}
                {(draft || selectedBuiltIn) && <Button type="button" size="sm" onClick={event => {
                    editorTrigger.current = event.currentTarget
                    setShowEditor(true)
                }}>{writable && !selectedSdlcTodo && <Pencil/>}{writable && !selectedSdlcTodo ? selectedTodoCalendar ? "Manage connection" : draft?.id ? "Edit connection" : "Edit draft" : "View connection"}</Button>}
            </div>}/>
        <Dialog open={showEditor && (!!draft || !!selectedBuiltIn)} onOpenChange={setShowEditor}>
            {showEditor && (draft || selectedBuiltIn) && <DialogContent className={selectedBuiltIn ? undefined : "connection-page-editor-dialog"} onCloseAutoFocus={event => {
                const trigger = editorTrigger.current
                if (trigger?.isConnected) {event.preventDefault(); trigger.focus()}
            }}>
                <DialogHeader>
                    <DialogTitle>{selectedBuiltIn?.title ?? (draft?.id ? draft.title || "Connection details" : "New connection")}</DialogTitle>
                    <DialogDescription className={selectedBuiltIn ? undefined : "sr-only"}>
                        {selectedSdlcTodo ? "Each roadmap phase has a TODO board. Checking a deliverable moves its task to the final column, and roadmap target dates appear on the linked boards and tasks." :
                            selectedTodoCalendar ? "Show dated TODO boards and tasks in this project’s Calendar." : "Review the project nodes and rules for this connection."}
                    </DialogDescription>
                </DialogHeader>
                {selectedSdlcTodo ? <div className="connection-editor-footer">
                    <Button asChild variant="outline"><Link to={connectionNodeLink(scope, {kind: "sdlc"})}>Open roadmap<ArrowUpRight/></Link></Button>
                    <Button asChild><Link to={connectionNodeLink(scope, {kind: "todo"})}>Open TODOs<ArrowUpRight/></Link></Button>
                </div> : selectedTodoCalendar ? <TodoCalendarConnectionSettings scope={scope} enabled={todoCalendarEnabled} writable={writable}/>
                    : draft && <div className="connection-main-editor">
                    {notice && <p className="connection-notice" role="status">{notice}</p>}
                    <ConnectionEditor key={draft.id ?? "new"} scope={scope} draft={draft} catalog={capabilities} writable={writable} busy={saveResult.isLoading}
                        checking={validationResult.isLoading} problem={problem} onChange={updateDraft}
                        onSave={() => void saveDraft()} onCheck={() => void checkDraft()}/>
                    {validation && validation.draft === sourceDraft && <DraftValidation result={validation.result} draft={draft} catalog={capabilities}/>}
                    <div className="connection-editor-footer">
                        {draft.id && <Button variant="ghost" asChild><Link to={connectionPageLink(scope, draft.id, "runs")}>View run history</Link></Button>}
                        {writable && draft.id && <Button type="button" variant="ghost" onClick={() => setConfirmRemove(true)}><Trash2/>Delete connection</Button>}
                    </div>
                    {confirmRemove && <div className="connection-inline-error connection-remove-confirm" role="alert">
                        <p>Delete {draft.title}? Its rules will stop running.</p>
                        <div className="connection-row">
                            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmRemove(false)}>Keep connection</Button>
                            <Button type="button" variant="destructive" size="sm" disabled={removeResult.isLoading} onClick={() => void deleteCurrent()}>{removeResult.isLoading ? "Deleting…" : "Delete connection"}</Button>
                        </div>
                    </div>}
                </div>}
            </DialogContent>}
        </Dialog>
    </>
}
