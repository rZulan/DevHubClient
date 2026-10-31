import {useId, useState} from "react"
import {RadioGroup} from "radix-ui"
import {ErdEndSymbol} from "./erd-relationship-symbols"
import {relationshipEnds, relationshipEndCounts, relationshipFieldIds, type ErdAnchor, type ErdDocument, type ErdRelationship, type RelationshipEnd} from "./tool-documents"
import "./erd-relationship-endpoints.css"

const rowOptions: {value: RelationshipEnd; label: string}[] = [
    {value: "one", label: "Exactly one"}, {value: "zero-one", label: "Zero or one"},
    {value: "many", label: "One or more"}, {value: "zero-many", label: "Zero or more"},
]
const edges = [{value: "top", label: "Top"}, {value: "left", label: "Left"}, {value: "right", label: "Right"}, {value: "bottom", label: "Bottom"}] as const

export function ErdRelationshipEndpoints({document, relation, canEdit, onChange}: {
    document: ErdDocument; relation: ErdRelationship; canEdit: boolean; onChange: (changes: Partial<ErdRelationship>) => void;
}) {
    const [active, setActive] = useState<"from" | "to">("to")
    const id = useId()
    const ends = relationshipEnds(relation)
    const tables = {from: document.tables.find(table => table.id === relation.fromTable), to: document.tables.find(table => table.id === relation.toTable)}
    const table = tables[active], other = tables[active === "from" ? "to" : "from"]
    const value = active === "from" ? ends.leftEnd : ends.rightEnd
    const anchorKey = active === "from" ? "fromAnchor" : "toAnchor", anchor = relation[anchorKey]
    return <section className="erd-endpoint-editor" aria-label="Relationship ends">
        <div className="erd-endpoint-heading"><strong>Relationship ends</strong><span>{relation.cardinality}</span></div>
        <div className="erd-endpoint-preview" role="tablist" aria-label="Choose relationship end">
            {(["from", "to"] as const).map((end, index) => <button type="button" role="tab" id={`${id}-${end}`} aria-controls={`${id}-settings`} aria-selected={active === end} aria-label={`${end === "from" ? "From" : "To"} endpoint: ${tables[end]?.name}`} key={end} tabIndex={active === end ? 0 : -1} onClick={() => setActive(end)} onKeyDown={event => {
                const next = event.key === "ArrowLeft" || event.key === "Home" ? "from" : event.key === "ArrowRight" || event.key === "End" ? "to" : undefined
                if (!next) return
                event.preventDefault(); setActive(next)
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next === "from" ? 0 : 1]?.focus()
            }}>
                <small>{relationshipEndCounts[index ? ends.rightEnd : ends.leftEnd]}</small><strong title={tables[end]?.name}>{tables[end]?.name}</strong>
                <code title={relationshipFieldIds(relation, end).map(id => tables[end]?.fields.find(field => field.id === id)?.name).join(", ")}>{relationshipFieldIds(relation, end).map(id => tables[end]?.fields.find(field => field.id === id)?.name).join(", ")}</code>
            </button>)}
            <svg className="erd-endpoint-connector" viewBox="0 -14 80 28" aria-label={`${relationshipEndCounts[ends.leftEnd]} to ${relationshipEndCounts[ends.rightEnd]}`} role="img"><path d="M0 0H80"/><ErdEndSymbol end={ends.leftEnd}/><g transform="translate(80 0) scale(-1 1)"><ErdEndSymbol end={ends.rightEnd}/></g></svg>
        </div>
        <div role="tabpanel" id={`${id}-settings`} aria-labelledby={`${id}-${active}`}><fieldset className="erd-endpoint-settings" disabled={!canEdit}>
            <div className="erd-endpoint-question"><strong>Rows in <b>{table?.name}</b></strong><p>For each row in <b>{other?.name}</b></p></div>
            <RadioGroup.Root className="erd-endpoint-rows" aria-label={`Rows in ${table?.name} per row in ${other?.name} (${active})`} value={value} onValueChange={selected => onChange(active === "from" ? {leftEnd: selected as RelationshipEnd} : {rightEnd: selected as RelationshipEnd})} disabled={!canEdit}>
                {rowOptions.map(option => <RadioGroup.Item className="erd-endpoint-row-option" key={option.value} value={option.value} aria-label={`${option.label} (${relationshipEndCounts[option.value]})`}>
                    <span><svg viewBox="0 -12 40 24" aria-hidden="true"><path d="M0 0H40"/><g transform={active === "to" ? "translate(40 0) scale(-1 1)" : undefined}><ErdEndSymbol end={option.value}/></g></svg><code>{relationshipEndCounts[option.value]}</code></span><strong>{option.label}</strong>
                </RadioGroup.Item>)}
            </RadioGroup.Root>
            <details className="erd-endpoint-routing">
                <summary><span>Line attachment</span><small>{anchor ? edges.find(edge => edge.value === anchor.edge)?.label : "Auto"}</small></summary>
                <div><RadioGroup.Root className="erd-endpoint-ports" aria-label={`Line attachment for ${table?.name} (${active})`} value={anchor?.edge ?? "auto"} disabled={!canEdit} onValueChange={edge => onChange({[anchorKey]: edge === "auto" ? undefined : {edge: edge as ErdAnchor["edge"], offset: .5}})}>
                    <div className="erd-endpoint-port-map"><div className="erd-endpoint-mini-table" data-edge={anchor?.edge ?? "auto"} aria-hidden="true"><span>{table?.name}</span><i/><i/><i/></div>
                        {edges.map(edge => <RadioGroup.Item key={edge.value} value={edge.value} className={`erd-endpoint-port erd-endpoint-port-${edge.value}`} aria-label={`${edge.label} edge`}>{edge.label}</RadioGroup.Item>)}
                    </div>
                    <RadioGroup.Item value="auto" className="erd-endpoint-auto">Automatic routing</RadioGroup.Item>
                </RadioGroup.Root></div>
            </details>
        </fieldset></div>
    </section>
}
