import {ChevronDown} from "lucide-react"
import {Button} from "@/components/ui/button"
import {RelationshipEndSelect} from "./erd-relationship-symbols"
import {relationshipEnds, relationshipFieldIds, type ErdAnchor, type ErdDocument, type ErdRelationship} from "./tool-documents"

export function ErdRelationshipProperties({document, relation, initiallyOpen, onChange, onEditColumns, onCreateJunction, onDelete}: {
    document: ErdDocument; relation: ErdRelationship; initiallyOpen: boolean;
    onChange: (changes: Partial<ErdRelationship>) => void; onEditColumns: () => void; onCreateJunction: () => void; onDelete: () => void
}) {
    const parent = document.tables.find(table => table.id === relation.fromTable), child = document.tables.find(table => table.id === relation.toTable)
    const ends = relationshipEnds(relation)
    return <details className="erd-relationship-entry" open={initiallyOpen}>
        <summary><span><strong>{parent?.name} → {child?.name}</strong><small>{relation.cardinality}</small></span><ChevronDown/></summary>
        <div className="erd-relationship-fields">
            <div className="erd-relationship-columns"><code>{relationshipFieldIds(relation, "from").map(id => parent?.fields.find(item => item.id === id)?.name).join(", ")} → {relationshipFieldIds(relation, "to").map(id => child?.fields.find(item => item.id === id)?.name).join(", ")}</code><Button size="sm" variant="secondary" onClick={onEditColumns}>Edit columns</Button></div>
            <div className="tool-property-grid"><label>Cardinality<select aria-label={`Cardinality for ${parent?.name} to ${child?.name}`} value={relation.cardinality} onChange={event => onChange({cardinality: event.target.value as ErdRelationship["cardinality"]})}><option>1:1</option><option>1:N</option><option>N:1</option><option>N:M</option></select></label><label>On delete<select aria-label={`On delete for ${parent?.name} to ${child?.name}`} value={relation.onDelete} onChange={event => onChange({onDelete: event.target.value as ErdRelationship["onDelete"]})}><option>RESTRICT</option><option>CASCADE</option><option>SET NULL</option></select></label></div>
            {(["from", "to"] as const).map(end => {
                const left = end === "from", side = left ? "Left" : "Right", key = left ? "fromAnchor" : "toAnchor"
                return <section className="erd-relationship-end" key={end} aria-label={`${side} endpoint`}>
                    <h4>{side}<span>{left ? parent?.name : child?.name}</span></h4>
                    <RelationshipEndSelect right={!left} label="Notation" ariaLabel={`${side} end for ${parent?.name} to ${child?.name}`} value={left ? ends.leftEnd : ends.rightEnd} onChange={value => onChange(left ? {leftEnd: value} : {rightEnd: value})}/>
                    <label>Attachment<select aria-label={`${side} attachment for ${parent?.name} to ${child?.name}`} value={relation[key]?.edge ?? "auto"} onChange={event => onChange({[key]: event.target.value === "auto" ? undefined : {edge: event.target.value as ErdAnchor["edge"], offset: .5}})}><option value="auto">Automatic</option><option value="left">Left edge</option><option value="right">Right edge</option><option value="top">Top edge</option><option value="bottom">Bottom edge</option></select></label>
                </section>
            })}
            <footer>{relation.cardinality === "N:M" && <Button size="sm" variant="secondary" onClick={onCreateJunction}>Create junction table</Button>}<Button size="sm" variant="ghost" className="tool-delete" aria-label="Delete relationship" onClick={onDelete}>Remove relationship</Button></footer>
        </div>
    </details>
}
