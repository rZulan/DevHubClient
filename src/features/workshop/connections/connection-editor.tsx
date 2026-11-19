import {useEffect, useState} from "react"
import {Link} from "react-router-dom"
import {ArrowDown, ArrowRight, ArrowUp, ExternalLink, GitBranch, Plus, Search, Trash2, X, Zap} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {createClientId} from "@/lib/create-client-id"
import {cn} from "@/lib/utils"
import {useConnectionNodesQuery, type ConnectionArguments, type ConnectionBindings, type ConnectionCapability, type ConnectionChoice, type ConnectionDraft, type ConnectionField, type ConnectionNode, type ConnectionNodeRef, type ConnectionRule, type ConnectionScope} from "./connections-api"
import {ConnectionLoadError} from "./connection-load-error"
import {WorkshopSelect} from "../workshop-select"
import {actionOutputTargets, compatibleEventField, connectionNodeLink, findCapability, findNode, newConnectionRule, nodeKey, nodeTool, sameNode, toolLabels, validateConnection} from "./connections-model"

type Catalog = ConnectionCapability[]
const choiceLabel = (choices: ConnectionChoice[] | undefined, key: string) => choices?.find(choice => choice.kind === key)?.label ?? key
const nodeLabel = (nodes: ConnectionNode[], ref: ConnectionNodeRef) => findNode(nodes, ref)?.label ?? (ref.kind ? "Unavailable node" : "Choose a node")

function NodePicker({scope, nodes, catalog, add}: {scope: ConnectionScope; nodes: ConnectionNode[]; catalog: Catalog; add: (node: ConnectionNode) => void}) {
    const [search, setSearch] = useState("")
    const [q, setQuery] = useState("")
    const [kind, setKind] = useState("")
    const [page, setPage] = useState(1)
    useEffect(() => {
        const timer = window.setTimeout(() => {setQuery(search.trim()); setPage(1)}, 180)
        return () => window.clearTimeout(timer)
    }, [search])
    const {currentData, isFetching, isError, error, refetch} = useConnectionNodesQuery({...scope, q: q || undefined, kind: kind || undefined, page})
    const groups = (currentData ?? []).reduce<Record<string, ConnectionNode[]>>((result, node) => {
        const tool = nodeTool(node.reference.kind)
        const group = result[tool] ??= []
        group.push(node)
        return result
    }, {})
    return <div className="connection-node-picker">
        <div className="connection-picker-filter">
            <label className="connection-search"><Search aria-hidden="true"/><Input aria-label="Search project nodes" placeholder="Search project nodes" value={search}
                maxLength={150} onChange={event => setSearch(event.target.value)}/></label>
            <select aria-label="Filter by node type" value={kind} onChange={event => {setKind(event.target.value); setPage(1)}}>
                <option value="">All node types</option>
                {catalog.map(item => <option key={item.nodeKind} value={item.nodeKind}>{item.label}</option>)}
            </select>
        </div>
        {isError && <ConnectionLoadError error={error} fallback="Could not load project nodes." retry={() => void refetch()}/>}
        {!currentData && isFetching && <p className="connection-muted" role="status">Finding nodes…</p>}
        {currentData?.length === 0 && <p className="connection-muted">No matching nodes.</p>}
        {Object.entries(groups).map(([tool, group]) => <div key={tool} className="connection-node-group">
            <h4>{toolLabels[tool] ?? tool}</h4>
            <ul>{group.map(node => {
                const selected = nodes.some(item => sameNode(item.reference, node.reference))
                return <li key={nodeKey(node.reference)}><button type="button" disabled={selected} onClick={() => add(node)}>
                    <span><strong>{node.label}</strong><small>{node.path}</small></span>
                    {selected ? <small>Added</small> : <Plus aria-hidden="true"/>}
                </button></li>
            })}</ul>
        </div>)}
        {(page > 1 || (currentData?.length ?? 0) >= 50) && <div className="connection-row">
            <Button type="button" variant="outline" size="sm" disabled={page === 1 || isFetching} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="connection-muted">Page {page}</span>
            <Button type="button" variant="outline" size="sm" disabled={(currentData?.length ?? 0) < 50 || isFetching} onClick={() => setPage(page + 1)}>Next</Button>
        </div>}
    </div>
}

function NodeSelect({label, placeholder, nodes, value, onChange, disabled, outputId, outputs = []}: {
    label: string; nodes: ConnectionNode[]; value: ConnectionNodeRef; onChange: (ref: ConnectionNodeRef, outputId?: string) => void; disabled: boolean
    placeholder?: string; outputId?: string | null; outputs?: ReturnType<typeof actionOutputTargets>
}) {
    const key = outputId ? `step:${outputId}` : value.kind ? nodeKey(value) : ""
    const available = outputId ? outputs.some(output => output.stepId === outputId) : nodes.some(node => nodeKey(node.reference) === key)
    return <WorkshopSelect aria-label={label} disabled={disabled} value={key} onValueChange={selected => {
        const output = outputs.find(item => `step:${item.stepId}` === selected)
        if (output) {onChange(output.reference, output.stepId); return}
        const node = nodes.find(item => nodeKey(item.reference) === selected)
        if (node) onChange(node.reference)
    }}>
        {!available && <option value={key} disabled>{!key ? placeholder ?? "Choose a node" : outputId ? "Unavailable step output" : "Unavailable node"}</option>}
        {nodes.map(node => <option key={nodeKey(node.reference)} value={nodeKey(node.reference)} disabled={node.unavailable}>
            {node.label}{node.path !== node.label && ` · ${node.path}`}{node.unavailable && " · Unavailable"}
        </option>)}
        {outputs.length > 0 && <optgroup label="Earlier steps">{outputs.map(output => <option key={output.stepId} value={`step:${output.stepId}`}>{output.label}</option>)}</optgroup>}
    </WorkshopSelect>
}

function CapabilitySelect({label, choices, value, onChange, disabled}: {
    label: string; choices: ConnectionChoice[]; value: string; onChange: (value: string) => void; disabled: boolean
}) {
    return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} disabled={disabled || (!choices.length && !value)}>
        <option value="">{choices.length ? `Choose ${label.toLowerCase()}` : `No ${label.toLowerCase()} available`}</option>
        {value && !choices.some(choice => choice.kind === value) && <option value={value}>Unavailable {label.toLowerCase()}</option>}
        {choices.map(choice => <option key={choice.kind} value={choice.kind}>{choice.label}</option>)}
    </select>
}

function ArgumentsFields({scope, choice, node, value, onChange, disabled, binding}: {
    scope: ConnectionScope; choice?: ConnectionChoice; node?: ConnectionNode; value: ConnectionArguments
    onChange: (value: ConnectionArguments) => void; disabled: boolean
    binding?: {values?: ConnectionBindings | null; eventFields: ConnectionField[]; change: (args: ConnectionArguments, next: ConnectionBindings) => void}
}) {
    const lookup = useConnectionNodesQuery({...scope, kind: node?.reference.kind, id: node?.reference.id ?? undefined,
        parentId: node?.reference.parentId ?? undefined, page: 1}, {skip: !node || node.unavailable || !choice?.fields.length})
    const dynamicOptions = lookup.currentData?.find(item => node && sameNode(item.reference, node.reference))?.options ?? node?.options
    if (!choice?.fields.length) return null
    function change(key: string, text: string) {
        const next = {...value}
        if (text) next[key] = text
        else delete next[key]
        if (key === "fromTable") delete next.fromField
        if (key === "toTable") delete next.toField
        onChange(next)
    }
    return <div className="connection-arguments">{choice.fields.map(field => {
        const fieldValue = value[field.key] ?? ""
        const boundField = binding?.values?.[field.key]?.eventField ?? ""
        const candidates = binding?.eventFields.filter(eventField => compatibleEventField(eventField, field)) ?? []
        const startTable = value.fromTable ?? (node?.reference.kind === "erd-table" ? node.reference.id : undefined)
        const relatedTable = field.key === "fromField" ? startTable : field.key === "toField" ? value.toTable : undefined
        const options = field.options ?? (relatedTable ? dynamicOptions?.[`field:${relatedTable}`] : undefined) ?? dynamicOptions?.[field.key] ?? dynamicOptions?.[field.type]
        let control
        if (options || field.type === "boolean") {
            const values = options ?? [{value: "true", label: "Yes"}, {value: "false", label: "No"}]
            control = <select value={fieldValue} onChange={event => change(field.key, event.target.value)} disabled={disabled}>
                <option value="">{field.required ? "Select a value" : "Any or default"}</option>
                {fieldValue && !values.some(option => option.value === fieldValue) && <option value={fieldValue}>{fieldValue} (unavailable)</option>}
                {values.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        } else if (field.type === "long-text" || field.type === "multiline") {
            control = <Textarea rows={3} value={fieldValue} onChange={event => change(field.key, event.target.value)} disabled={disabled}/>
        } else {
            const type = ["date", "time", "number"].includes(field.type) ? field.type : "text"
            control = <Input type={type} value={fieldValue} onChange={event => change(field.key, event.target.value)} disabled={disabled}/>
        }
        return <div key={field.key} className="connection-argument">
            <label className="connection-field"><span>{field.label}{!field.required && <small>Optional</small>}</span>{boundField
                ? <small>Uses {candidates.find(field => field.key === boundField)?.label ?? boundField} from the event</small> : control}</label>
            {binding && (candidates.length > 0 || boundField) && <select aria-label={`${field.label} value source`} value={boundField} disabled={disabled} onChange={event => {
                const next = {...binding.values}
                const args = {...value}
                if (event.target.value) {next[field.key] = {eventField: event.target.value}; delete args[field.key]}
                else delete next[field.key]
                binding.change(args, next)
            }}>
                <option value="">Enter a value</option>
                {boundField && !candidates.some(candidate => candidate.key === boundField) && <option value={boundField}>Unavailable event field</option>}
                {candidates.map(candidate => <option key={candidate.key} value={candidate.key}>Use event’s {candidate.label}</option>)}
            </select>}
        </div>
    })}</div>
}

function describeChoice(choice: ConnectionChoice | undefined, values: ConnectionArguments, node?: ConnectionNode) {
    if (!choice) return ""
    return [choice.label, ...choice.fields.flatMap(field => {
        const value = values[field.key]
        if (!value || field.type === "multiline" || field.type === "long-text") return []
        const options = field.options ?? node?.options?.[field.key]
        return options?.find(option => option.value === value)?.label ?? value
    })].join(" · ")
}

function ruleSummary(rule: ConnectionRule, nodes: ConnectionNode[], catalog: Catalog) {
    const eventLabel = choiceLabel(findCapability(catalog, rule.source)?.eventChoices, rule.event) || "Choose an event"
    const actions = rule.actions.map((action, index) => {
        const label = choiceLabel(findCapability(catalog, action.target)?.actionChoices, action.kind) || "Choose an action"
        const output = action.targetFromStepId && actionOutputTargets(rule, index, catalog).find(item => item.stepId === action.targetFromStepId)
        return `${label} on ${output ? output.label : nodeLabel(nodes, action.target)}`
    })
    return `${nodeLabel(nodes, rule.source)} · ${eventLabel} → ${actions.join(" → ") || "Choose an action"}`
}

function RuleFlow({rule, nodes, catalog}: {rule: ConnectionRule; nodes: ConnectionNode[]; catalog: Catalog}) {
    const event = findCapability(catalog, rule.source)?.eventChoices.find(choice => choice.kind === rule.event)
    return <section className="connection-flow" aria-label="Rule flow">
        <div className="connection-flow-node"><small>Source</small><strong>{nodeLabel(nodes, rule.source)}</strong>
            <span>{describeChoice(event, rule.eventArguments, findNode(nodes, rule.source)) || "Choose an event"}</span></div>
        <ArrowRight className="connection-flow-arrow" aria-hidden="true"/>
        <ol aria-label="Action order">{rule.actions.map((action, index) => {
            const choice = findCapability(catalog, action.target)?.actionChoices.find(item => item.kind === action.kind)
            const output = action.targetFromStepId && actionOutputTargets(rule, index, catalog).find(item => item.stepId === action.targetFromStepId)
            return <li key={action.id} className="connection-flow-node"><small>Target</small><strong>{output ? output.label : nodeLabel(nodes, action.target)}</strong>
                <span>{describeChoice(choice, action.arguments, findNode(nodes, action.target)) || "Choose an action"}</span></li>
        })}</ol>
    </section>
}

function RuleEditor({scope, rule, nodes, catalog, writable, change}: {
    scope: ConnectionScope; rule: ConnectionRule; nodes: ConnectionNode[]; catalog: Catalog; writable: boolean; change: (rule: ConnectionRule) => void
}) {
    const events = findCapability(catalog, rule.source)?.eventChoices ?? []
    const event = events.find(item => item.kind === rule.event)
    const sourceNodes = nodes.filter(node => findCapability(catalog, node.reference)?.eventChoices.length)
    const conditionNodes = nodes.filter(node => findCapability(catalog, node.reference)?.conditionChoices.length)
    const actionNodes = nodes.filter(node => findCapability(catalog, node.reference)?.actionChoices.length)
    const canDelete = rule.actions.some(action => /^(?:remove|delete)(?:-|$)/.test(action.kind))
    const hasTarget = actionNodes.length > 0 || actionOutputTargets(rule, rule.actions.length, catalog).length > 0
    const clearEventBindings = () => rule.actions.map(action => ({...action, argumentBindings: undefined}))
    function addAction() {
        change({...rule, actions: [...rule.actions, {id: createClientId(), target: {kind: ""}, kind: "", arguments: {}}]})
    }
    return <div className="connection-rule-editor">
        <label className="connection-field"><span>Rule name</span><Input maxLength={150} disabled={!writable} value={rule.title}
            placeholder="Complete the task when Users appears" onChange={event => change({...rule, title: event.target.value})}/></label>
        <section className="connection-step">
            <h4><Zap aria-hidden="true"/> When</h4>
            <div className="connection-step-controls">
                <div className="connection-field"><span>Source node</span>
                    <NodeSelect label="Event source" placeholder="Choose a source node" nodes={sourceNodes} value={rule.source} disabled={!writable}
                        onChange={source => change({...rule, source, event: "", eventArguments: {}, actions: clearEventBindings()})}/>
                </div>
                <label className="connection-field"><span>Event</span>
                    <CapabilitySelect label="Event" choices={events} value={rule.event} disabled={!writable}
                        onChange={event => change({...rule, event, eventArguments: {}, actions: clearEventBindings()})}/>
                </label>
            </div>
            <ArgumentsFields scope={scope} choice={event} node={findNode(nodes, rule.source)} value={rule.eventArguments}
                disabled={!writable} onChange={eventArguments => change({...rule, eventArguments})}/>
        </section>
        <section className="connection-step">
            <div className="connection-step-heading">
                <h4><GitBranch aria-hidden="true"/> If <small>Optional</small></h4>
                {writable && conditionNodes.length > 0 && <Button variant="ghost" size="sm" type="button" onClick={() => change({...rule,
                    conditions: [...rule.conditions, {node: conditionNodes[0].reference, kind: "", arguments: {}}]})}><Plus/>Condition</Button>}
            </div>
            {rule.conditions.length > 1 && <label className="connection-field"><span>Match</span>
                <select disabled={!writable} value={rule.matchAny ? "any" : "all"} onChange={event => change({...rule, matchAny: event.target.value === "any"})}>
                    <option value="all">All conditions</option><option value="any">Any condition</option>
                </select></label>}
            {rule.conditions.map((condition, index) => {
                const choices = findCapability(catalog, condition.node)?.conditionChoices ?? []
                const update = (next: typeof condition) => change({...rule, conditions: rule.conditions.map((item, i) => index === i ? next : item)})
                return <div className="connection-substep" key={index}>
                    <div className="connection-step-controls with-control">
                        <NodeSelect label={`Condition ${index + 1} node`} nodes={conditionNodes} value={condition.node} disabled={!writable}
                            onChange={node => update({...condition, node, kind: "", arguments: {}})}/>
                        <CapabilitySelect label="Condition" choices={choices} value={condition.kind} disabled={!writable}
                            onChange={kind => update({...condition, kind, arguments: {}})}/>
                        {writable && <Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove condition ${index + 1}`}
                            onClick={() => change({...rule, conditions: rule.conditions.filter((_item, i) => i !== index)})}><X/></Button>}
                    </div>
                    <ArgumentsFields scope={scope} choice={choices.find(item => item.kind === condition.kind)} node={findNode(nodes, condition.node)} value={condition.arguments}
                        disabled={!writable} onChange={args => update({...condition, arguments: args})}/>
                </div>
            })}
        </section>
        <section className="connection-step">
            <div className="connection-step-heading">
                <h4><ArrowRight aria-hidden="true"/> Do</h4>
                {writable && hasTarget && <Button variant="ghost" size="sm" type="button" onClick={addAction}><Plus/>Action</Button>}
            </div>
            {rule.actions.map((action, index) => {
                const choices = findCapability(catalog, action.target)?.actionChoices ?? []
                const outputs = actionOutputTargets(rule, index, catalog)
                const output = outputs.find(item => item.stepId === action.targetFromStepId)
                const fieldNode = findNode(nodes, output?.action.target ?? action.target)
                const update = (next: typeof action) => change({...rule, actions: rule.actions.map(item => item.id === action.id ? next : item)})
                function reorder(offset: number) {
                    const actions = [...rule.actions]
                    const [item] = actions.splice(index, 1)
                    actions.splice(index + offset, 0, item)
                    change({...rule, actions})
                }
                return <div className="connection-substep" key={action.id}>
                    {writable && <div className="connection-action-heading">
                        {rule.actions.length > 1 && <small>Step {index + 1}</small>}
                        {rule.actions.length > 1 && <>
                            <Button variant="ghost" size="icon-sm" type="button" aria-label={`Move step ${index + 1} earlier`} disabled={index === 0 || action.targetFromStepId === rule.actions[index - 1].id} onClick={() => reorder(-1)}><ArrowUp/></Button>
                            <Button variant="ghost" size="icon-sm" type="button" aria-label={`Move step ${index + 1} later`} disabled={index === rule.actions.length - 1 || rule.actions[index + 1].targetFromStepId === action.id} onClick={() => reorder(1)}><ArrowDown/></Button>
                        </>}
                        <Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove action ${index + 1}`}
                            onClick={() => change({...rule, actions: rule.actions.filter(item => item.id !== action.id)})}><X/></Button>
                    </div>}
                    <div className="connection-step-controls">
                        <div className="connection-field"><span>Target node</span>
                            <NodeSelect label={`Action ${index + 1} target`} placeholder="Choose a target node" nodes={actionNodes} value={action.target}
                                disabled={!writable} outputId={action.targetFromStepId} outputs={outputs}
                                onChange={(target, targetFromStepId) => update({...action, target, targetFromStepId, kind: "", arguments: {}, argumentBindings: undefined})}/>
                        </div>
                        <label className="connection-field"><span>Action</span>
                            <CapabilitySelect label="Action" choices={choices} value={action.kind} disabled={!writable}
                                onChange={kind => update({...action, kind, arguments: {}, argumentBindings: undefined})}/>
                        </label>
                    </div>
                    <ArgumentsFields scope={scope} choice={choices.find(item => item.kind === action.kind)} node={fieldNode} value={action.arguments}
                        disabled={!writable} onChange={args => update({...action, arguments: args})} binding={{eventFields: event?.fields ?? [], values: action.argumentBindings,
                            change: (args, argumentBindings) => update({...action, arguments: args, argumentBindings})}}/>
                </div>
            })}
        </section>
        <div className="connection-rule-preview" aria-live="polite">{rule.conditions.length > 0 && <p>
            <strong>If {rule.matchAny ? "any match" : "all match"}</strong>{" "}{rule.conditions.map(condition => {
                const choice = findCapability(catalog, condition.node)?.conditionChoices.find(item => item.kind === condition.kind)
                return `${nodeLabel(nodes, condition.node)} · ${describeChoice(choice, condition.arguments, findNode(nodes, condition.node)) || "Choose a condition"}`
            }).join(" / ")}</p>}{ruleSummary(rule, nodes, catalog)}</div>
        {canDelete && <p className="connection-inline-error">This rule removes the selected item and applies its tool’s normal cleanup to linked items.</p>}
        <div className="connection-rule-toggles">
            <label><input type="checkbox" checked={rule.enabled} disabled={!writable} onChange={event => change({...rule, enabled: event.target.checked})}/>Enable rule</label>
            <label><input type="checkbox" checked={rule.includeAutomation} disabled={!writable} onChange={event => change({...rule, includeAutomation: event.target.checked})}/>Include events from automations</label>
        </div>
        <label className="connection-field"><span>Run frequency</span>
            <select value={rule.runOnce ? "once" : "recurring"} disabled={!writable}
                aria-describedby={rule.runOnce ? `connection-frequency-${rule.id}` : undefined}
                onChange={event => change({...rule, runOnce: event.target.value === "once"})}>
                <option value="recurring">Every matching event</option>
                <option value="once">Once after enabling</option>
            </select>
        </label>
        {rule.runOnce && <p id={`connection-frequency-${rule.id}`} className="connection-muted">To run it again, save it paused, then enable and save it.</p>}
    </div>
}

export function ConnectionEditor({scope, draft, catalog, writable, busy, checking, problem, anchor, ruleSelection, onChange, onSave, onCheck}: {
    scope: ConnectionScope; draft: ConnectionDraft; catalog: Catalog; writable: boolean; busy: boolean; checking: boolean; problem: string; anchor?: ConnectionNodeRef
    ruleSelection?: {rule: ConnectionRule | undefined; onSelect: (id: string) => void}
    onChange: (draft: ConnectionDraft) => void; onSave: () => void; onCheck: () => void
}) {
    const [ruleId, setRuleId] = useState("")
    const [picking, setPicking] = useState(draft.nodes.length < 2 && writable)
    const [validation, setValidation] = useState("")
    const rule = ruleSelection ? ruleSelection.rule : draft.rules.find(item => item.id === ruleId) ?? draft.rules[0]
    const selectRule = ruleSelection?.onSelect ?? setRuleId
    const canAddRule = draft.nodes.length >= 2
        && draft.nodes.some(node => !node.unavailable && findCapability(catalog, node.reference)?.eventChoices.length)
        && draft.nodes.some(node => !node.unavailable && findCapability(catalog, node.reference)?.actionChoices.length)

    function removeNode(node: ConnectionNode) {
        const inUse = draft.rules.some(item => sameNode(item.source, node.reference)
            || item.conditions.some(condition => sameNode(condition.node, node.reference))
            || item.actions.some(action => sameNode(action.target, node.reference)))
        if (inUse) {setValidation(`Remove the rules that use ${node.label} before removing this node.`); return}
        setValidation("")
        onChange({...draft, nodes: draft.nodes.filter(item => !sameNode(item.reference, node.reference))})
    }
    function addRule() {
        if (!canAddRule) return
        const next = newConnectionRule()
        selectRule(next.id)
        onChange({...draft, rules: [...draft.rules, next]})
    }
    function handleDraft(action: () => void) {
        const error = validateConnection(draft, catalog)
        setValidation(error)
        if (!error) action()
    }

    return <section className="connection-editor">
        <div className="connection-editor-top">
            <label className="connection-field"><span>Connection name</span><Input value={draft.title} maxLength={150} disabled={!writable}
                placeholder="Users schema handoff" onChange={event => onChange({...draft, title: event.target.value})}/></label>
        </div>
        <div className="connection-node-section">
            <div className="connection-section-title"><h3>Connected nodes</h3>
                {writable && <Button type="button" variant="outline" size="sm" aria-expanded={picking} onClick={() => setPicking(value => !value)}>{picking ? <X/> : <Plus/>}{picking ? "Close node picker" : "Add nodes"}</Button>}
            </div>
            <ul className="connection-node-list">{draft.nodes.map(node => <li key={nodeKey(node.reference)} className="connection-node-card">
                {node.unavailable ? <span className="connection-deleted-node"><small>{node.path} · Unavailable</small><strong>{node.label}</strong></span> : <Link to={connectionNodeLink(scope, node.reference)} aria-label={`Open ${node.label} in ${toolLabels[nodeTool(node.reference.kind)] ?? node.path}`}>
                    <span><small>{node.path}</small><strong>{node.label}</strong></span><ExternalLink aria-hidden="true"/>
                </Link>}
                {writable && (!anchor || !sameNode(anchor, node.reference)) && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${node.label}`} onClick={() => removeNode(node)}><X/></Button>}
            </li>)}</ul>
            {picking && writable && <NodePicker scope={scope} nodes={draft.nodes} catalog={catalog} add={node => {
                if (draft.nodes.some(item => sameNode(item.reference, node.reference))) return
                setValidation("")
                onChange({...draft, nodes: [...draft.nodes, node]})
            }}/>}
        </div>
        <div className="connection-rule-section">
            <div className="connection-section-title"><h3>Rules</h3>
                {writable && <Button type="button" variant="outline" size="sm" disabled={!canAddRule} onClick={addRule}><Plus/>Add rule</Button>}
            </div>
            {draft.rules.length === 0 && <p className="connection-muted">{draft.nodes.length < 2 ? "Add two or more nodes to configure a rule." : "Choose a source event and one or more actions to connect these nodes."}</p>}
            {draft.rules.length > 0 && <div className="connection-rules-layout">
                <ul className="connection-rule-list">{draft.rules.map((item, index) => <li key={item.id}>
                    <button type="button" aria-pressed={item.id === rule?.id} className={cn(item.id === rule?.id && "connection-rule-selected")} onClick={() => selectRule(item.id)}>
                        <span><strong>{item.title || `Rule ${index + 1}`}</strong>{!ruleSelection && <small>{ruleSummary(item, draft.nodes, catalog)}</small>}</span>
                        <small>{!item.enabled ? "Paused" : item.runOnce && draft.triggeredRuleIds?.includes(item.id) ? "Triggered once" : "Enabled"}</small>
                    </button>
                </li>)}</ul>
                {rule && <>
                    {!ruleSelection && rule.actions.length > 0 && <RuleFlow rule={rule} nodes={draft.nodes} catalog={catalog}/>}
                    <RuleEditor key={rule.id} scope={scope} rule={rule} nodes={draft.nodes} catalog={catalog} writable={writable} change={next => {
                        setValidation("")
                        onChange({...draft, rules: draft.rules.map(item => item.id === next.id ? next : item)})
                    }}/>
                    {writable && <Button type="button" variant="ghost" size="sm" className="connection-remove-rule" onClick={() => {
                        setValidation("")
                        onChange({...draft, rules: draft.rules.filter(item => item.id !== rule.id)})
                    }}><Trash2/>Remove selected rule</Button>}
                </>}
            </div>}
        </div>
        {(validation || problem) && <p role="alert" className="connection-inline-error">{validation || problem}</p>}
        {writable && <div className="connection-save connection-row">
            <Button type="button" variant="outline" disabled={checking || busy} onClick={() => handleDraft(onCheck)}>{checking ? "Checking…" : "Check draft"}</Button>
            <Button type="button" disabled={checking || busy} onClick={() => handleDraft(onSave)}>{busy ? "Saving…" : "Save connection"}</Button>
        </div>}
    </section>
}
