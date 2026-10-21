import {useId, useState, type FormEvent, type ReactNode} from "react"
import {ChevronDown} from "lucide-react"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {RelationshipEndSelect} from "./erd-relationship-symbols"
import {suggestErdColumns} from "./erd-relationship-draft"
import {cardinalityForEnds, relationshipEnds, relationshipFieldIds, type ErdDocument, type ErdRelationship, type RelationshipEnd} from "./tool-documents"

function RelationshipSelect({label, value, onChange, children}: {label: string; value: string; onChange: (value: string) => void; children: ReactNode}) {
    const id = useId()
    return <div className="task-edit-field"><Label htmlFor={id}>{label}</Label><div className="task-edit-select"><select id={id} value={value} onChange={event => onChange(event.target.value)}>{children}</select><ChevronDown aria-hidden="true"/></div></div>
}

export function ErdRelationshipDialog({document, fromId, toId, initial, canEdit, onClose, onSave}: {
    document: ErdDocument; fromId: string; toId: string; initial?: ErdRelationship; canEdit: boolean; onClose: () => void; onSave: (relationship: Omit<ErdRelationship, "id">) => string
}) {
    const [fromTable, setFromTable] = useState(fromId)
    const [toTable, setToTable] = useState(toId || document.tables.find(table => table.id !== fromId)?.id || fromId)
    const [columns, setColumns] = useState(() => initial ? {fromField: initial.fromField, toField: initial.toField} : suggestErdColumns(document, fromTable, toTable))
    const [extraColumns, setExtraColumns] = useState(() => initial ? Array.from({length: Math.max(relationshipFieldIds(initial, "from").length, relationshipFieldIds(initial, "to").length) - 1}, (_, index) => ({fromField: relationshipFieldIds(initial, "from")[index + 1] ?? "", toField: relationshipFieldIds(initial, "to")[index + 1] ?? ""})) : [])
    const [leftEnd, setLeftEnd] = useState<RelationshipEnd>(initial ? relationshipEnds(initial).leftEnd : "one"), [rightEnd, setRightEnd] = useState<RelationshipEnd>(initial ? relationshipEnds(initial).rightEnd : "many")
    const [onDelete, setOnDelete] = useState<ErdRelationship["onDelete"]>(initial?.onDelete ?? "RESTRICT"), [error, setError] = useState("")
    const source = document.tables.find(table => table.id === fromTable), target = document.tables.find(table => table.id === toTable)
    const cardinality = cardinalityForEnds(leftEnd, rightEnd)
    function chooseCardinality(value: ErdRelationship["cardinality"]) {
        const ends = relationshipEnds({cardinality: value})
        setLeftEnd(ends.leftEnd); setRightEnd(ends.rightEnd); setError("")
        if (value === "N:M" && (!columns.fromField || !columns.toField)) {
            const key = (table: typeof source) => table?.fields.find(field => field.primary)?.id ?? table?.fields.find(field => field.unique)?.id ?? table?.fields[0]?.id ?? ""
            setColumns({fromField: columns.fromField || key(source), toField: columns.toField || key(target)})
        }
    }
    function chooseTable(side: "left" | "right", id: string) {
        if (side === "left") setFromTable(id); else setToTable(id)
        setExtraColumns([])
        setColumns(suggestErdColumns({...document, relationships: document.relationships.filter(item => item.id !== initial?.id)}, side === "left" ? id : fromTable, side === "right" ? id : toTable)); setError("")
    }
    function submit(event: FormEvent) {
        event.preventDefault()
        if (!canEdit) return
        const failure = onSave({fromTable, toTable, ...columns, ...(extraColumns.length ? {fromFields: [columns.fromField, ...extraColumns.map(pair => pair.fromField)], toFields: [columns.toField, ...extraColumns.map(pair => pair.toField)]} : {}), cardinality, leftEnd, rightEnd, onDelete,
            ...(initial?.fromAnchor ? {fromAnchor: initial.fromAnchor} : {}), ...(initial?.toAnchor ? {toAnchor: initial.toAnchor} : {})})
        if (failure) setError(failure); else onClose()
    }
    const tables = document.tables.map(table => <option key={table.id} value={table.id}>{table.name}</option>)
    return <Dialog open onOpenChange={open => {if (!open) onClose()}}><DialogContent className="workshop-task-edit-dialog erd-relationship-dialog">
        <DialogHeader className="task-edit-header"><div><DialogTitle>{initial ? "Edit relationship" : "Connect tables"}</DialogTitle><DialogDescription>Choose the columns and relationship between {source?.name ?? "the source"} and {target?.name ?? "the target"}.</DialogDescription></div></DialogHeader>
        <form className="task-edit-form" onSubmit={submit}>
            <fieldset className="task-edit-fields" disabled={!canEdit}>
                <div className="task-edit-metadata">
                    <div className="erd-connection-side">
                        <RelationshipSelect label="Left table" value={fromTable} onChange={value => chooseTable("left", value)}>{tables}</RelationshipSelect>
                        <RelationshipSelect label="Left column" value={columns.fromField} onChange={value => {setColumns(current => ({...current, fromField: value})); setError("")}}><option value="">Choose column</option>{source?.fields.map(field => <option value={field.id} key={field.id}>{field.name} · {field.type}</option>)}</RelationshipSelect>
                    </div>
                    <div className="erd-connection-side">
                        <RelationshipSelect label="Right table" value={toTable} onChange={value => chooseTable("right", value)}>{tables}</RelationshipSelect>
                        <RelationshipSelect label="Right column" value={columns.toField} onChange={value => {setColumns(current => ({...current, toField: value})); setError("")}}><option value="">Choose column</option>{target?.fields.map(field => <option value={field.id} key={field.id}>{field.name} · {field.type}</option>)}</RelationshipSelect>
                    </div>
                </div>
                <div className="task-edit-metadata">
                    <RelationshipSelect label="Cardinality" value={cardinality} onChange={value => chooseCardinality(value as ErdRelationship["cardinality"])}><option value="1:1">One to one</option><option value="1:N">One to many</option><option value="N:1">Many to one</option><option value="N:M">Many to many</option></RelationshipSelect>
                    <RelationshipSelect label="On delete" value={onDelete} onChange={value => {setOnDelete(value as ErdRelationship["onDelete"]); setError("")}}><option>RESTRICT</option><option>CASCADE</option><option>SET NULL</option></RelationshipSelect>
                </div>
                {extraColumns.map((pair, index) => <div className="erd-column-pair" key={index}>
                    <RelationshipSelect label={`Left column ${index + 2}`} value={pair.fromField} onChange={value => setExtraColumns(current => current.map((item, i) => i === index ? {...item, fromField: value} : item))}><option value="">Choose column</option>{source?.fields.map(field => <option key={field.id} value={field.id}>{field.name} · {field.type}</option>)}</RelationshipSelect>
                    <RelationshipSelect label={`Right column ${index + 2}`} value={pair.toField} onChange={value => setExtraColumns(current => current.map((item, i) => i === index ? {...item, toField: value} : item))}><option value="">Choose column</option>{target?.fields.map(field => <option key={field.id} value={field.id}>{field.name} · {field.type}</option>)}</RelationshipSelect>
                    <Button type="button" variant="ghost" aria-label={`Remove column pair ${index + 2}`} onClick={() => setExtraColumns(current => current.filter((_, i) => i !== index))}>Remove</Button>
                </div>)}
                <Button type="button" size="sm" variant="secondary" disabled={extraColumns.length >= Math.min(source?.fields.length ?? 0, target?.fields.length ?? 0) - 1} onClick={() => setExtraColumns(current => [...current, {fromField: "", toField: ""}])}>Add column pair</Button>
                <div className="task-edit-metadata"><RelationshipEndSelect label="Left end" value={leftEnd} onChange={value => {setLeftEnd(value); setError("")}}/><RelationshipEndSelect right label="Right end" value={rightEnd} onChange={value => {setRightEnd(value); setError("")}}/></div>
                {cardinality === "N:M" && <p className="tool-help">Saving will offer to create a junction table using both keys.</p>}
                {(!source?.fields.length || !target?.fields.length) && <p className="tool-help">Add columns to both tables before connecting them.</p>}
                {error && <p className="workshop-form-error" role="alert">{error}</p>}
            </fieldset>
            <footer className="task-edit-footer"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!canEdit || !columns.fromField || !columns.toField || !initial && document.relationships.length >= 2000}>{initial ? "Save changes" : "Save relationship"}</Button></footer>
        </form>
    </DialogContent></Dialog>
}
