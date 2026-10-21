import {useMemo, useState, type FormEvent} from "react"
import {Database, KeyRound, Link2} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {createErdJunction, erdDisplayType} from "./erd-schema"
import {ErdEndSymbol} from "./erd-relationship-symbols"
import type {ErdDocument, ErdRelationship} from "./tool-documents"
import "./erd-junction-dialog.css"

export function ErdJunctionDialog({document, relation, canEdit, onClose, onConfirm}: {
    document: ErdDocument; relation: ErdRelationship; canEdit: boolean; onClose: () => void;
    onConfirm: (create: boolean, name: string) => string
}) {
    const preview = useMemo(() => {
        try {return {document: createErdJunction(document, relation), error: ""}}
        catch (failure) {return {document: null, error: failure instanceof Error ? failure.message : "Could not create a junction table."}}
    }, [document, relation])
    const table = preview.document?.tables.at(-1)
    const [name, setName] = useState(table?.name ?? ""), [error, setError] = useState("")
    const left = document.tables.find(table => table.id === relation.fromTable)?.name ?? "Left table"
    const right = document.tables.find(table => table.id === relation.toTable)?.name ?? "Right table"
    function confirm(create: boolean) {
        if (!canEdit) return
        const failure = onConfirm(create, name)
        if (failure) setError(failure)
    }
    function submit(event: FormEvent) {event.preventDefault(); if (!preview.error && name.trim()) confirm(true)}
    return <Dialog open onOpenChange={open => {if (!open) onClose()}}>
        <DialogContent className="erd-junction-dialog sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader><DialogTitle>Create a junction table?</DialogTitle><DialogDescription>Connect {left} and {right} through a table with both keys.</DialogDescription></DialogHeader>
            <form onSubmit={submit} className="erd-junction-form">
                {table && <>
                    <label className="erd-junction-name">Table name<input aria-label="Junction table name" value={name} maxLength={150} disabled={!canEdit} onChange={event => {setName(event.target.value); setError("")}}/></label>
                    <div className="erd-junction-preview"><header><Database/><strong>{name || table.name}</strong><span>PK + FK</span></header>
                        {table.fields.map(field => <div key={field.id}><KeyRound/><Link2/><span>{field.name}</span><small>{erdDisplayType(field)}</small></div>)}
                    </div>
                    <div className="erd-junction-notations" aria-label="Junction relationships">
                        {preview.document!.relationships.slice(-2).map((edge, index) => <div key={edge.id}><span>{index === 0 ? left : right}</span><svg viewBox="0 -12 110 24" role="img" aria-label={`One to ${edge.rightEnd === "zero-many" ? "zero or many" : "one or many"}`}><path d="M0 0H110"/><ErdEndSymbol end="one"/><g transform="translate(110 0) scale(-1 1)"><ErdEndSymbol end={edge.rightEnd!}/></g></svg><span>{name || table.name}</span></div>)}
                    </div>
                    <p className="erd-junction-hint">Both foreign keys form the composite primary key.</p>
                    {relation.onDelete === "SET NULL" && <p className="erd-junction-hint">Junction keys are required, so deletion will use RESTRICT.</p>}
                </>}
                {(preview.error || error) && <p className="workshop-form-error" role="alert">{error || preview.error}</p>}
                <DialogFooter className="erd-junction-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" variant="outline" disabled={!canEdit} onClick={() => confirm(false)}>Keep as N:M</Button><Button type="submit" disabled={!canEdit || !!preview.error || !name.trim()}>Create junction table</Button></DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
}
