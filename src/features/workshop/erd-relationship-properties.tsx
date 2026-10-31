import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {ChevronDown} from "lucide-react"
import {Button} from "@/components/ui/button"
import {ErdRelationshipEndpoints} from "./erd-relationship-endpoints"
import {type ErdDocument, type ErdRelationship} from "./tool-documents"

export function ErdRelationshipProperties({document, relation, initiallyOpen, canEdit, onChange, onEditColumns, onCreateJunction, onDelete}: {
    document: ErdDocument; relation: ErdRelationship; initiallyOpen: boolean; canEdit: boolean;
    onChange: (changes: Partial<ErdRelationship>) => void; onEditColumns: () => void; onCreateJunction: () => void; onDelete: () => void
}) {
    const parent = document.tables.find(table => table.id === relation.fromTable), child = document.tables.find(table => table.id === relation.toTable)
    return <details className="erd-relationship-entry" open={initiallyOpen}>
        <summary><span><strong>{parent?.name} → {child?.name}</strong><small>{relation.cardinality}</small></span><ChevronDown/></summary>
        <div className="erd-relationship-fields">
            <ErdRelationshipEndpoints document={document} relation={relation} canEdit={canEdit} onChange={onChange}/>
            <Button size="sm" variant="secondary" disabled={!canEdit} onClick={onEditColumns}>Edit connected columns</Button>
            <label>When a referenced row is deleted<WorkshopSelect disabled={!canEdit} aria-label={`On delete for ${parent?.name} to ${child?.name}`} value={relation.onDelete} onValueChange={selectedValue => onChange({onDelete: selectedValue as ErdRelationship["onDelete"]})}><option value="RESTRICT">Prevent deletion (RESTRICT)</option><option value="CASCADE">Delete related rows (CASCADE)</option><option value="SET NULL">Clear reference (SET NULL)</option></WorkshopSelect></label>
            <footer>{relation.cardinality === "N:M" && <Button size="sm" variant="secondary" disabled={!canEdit} onClick={onCreateJunction}>Create junction table</Button>}<Button size="sm" variant="ghost" disabled={!canEdit} className="tool-delete" aria-label="Delete relationship" onClick={onDelete}>Remove relationship</Button></footer>
        </div>
    </details>
}
