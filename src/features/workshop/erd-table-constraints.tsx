import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useState} from "react"
import {Button} from "@/components/ui/button"
import {createClientId} from "@/lib/create-client-id"
import type {ErdTable} from "./tool-documents"

export function ErdTableConstraints({table, onChange}: {table: ErdTable; onChange: (changes: Partial<ErdTable>) => void}) {
    const [kind, setKind] = useState("index"), [name, setName] = useState(""), [fields, setFields] = useState<string[]>([]), [expression, setExpression] = useState("")
    const [error, setError] = useState("")
    function add() {
        const label = name.trim()
        if (!label || [...(table.indexes ?? []), ...(table.checks ?? [])].some(item => item.name.toLowerCase() === label.toLowerCase())) {setError("Enter a unique name for this table."); return}
        if (kind === "check") {
            if (!expression.trim()) {setError("Enter a SQL condition, such as total >= 0."); return}
            onChange({checks: [...(table.checks ?? []), {id: createClientId(), name: label, expression: expression.trim()}]})
        } else {
            const selected = fields.filter(id => table.fields.some(field => field.id === id))
            if (!selected.length) {setError("Choose at least one column."); return}
            onChange({indexes: [...(table.indexes ?? []), {id: createClientId(), name: label, fields: selected, unique: kind === "unique"}]})
        }
        setName(""); setFields([]); setExpression(""); setError("")
    }
    return <div className="erd-constraints">
        <div className="tool-section-heading"><strong>Indexes & constraints</strong></div>
        {(table.indexes ?? []).map(index => <div className="erd-constraint-entry" key={index.id}><span><strong>{index.name}</strong><small>{index.unique ? "Unique" : "Index"}: {index.fields.map(id => table.fields.find(field => field.id === id)?.name).join(", ")}</small></span><button type="button" aria-label={`Remove ${index.name}`} onClick={() => onChange({indexes: table.indexes!.filter(item => item.id !== index.id)})}>Remove</button></div>)}
        {(table.checks ?? []).map(check => <div className="erd-constraint-entry" key={check.id}><span><strong>{check.name}</strong><small>Check: {check.expression}</small></span><button type="button" aria-label={`Remove ${check.name}`} onClick={() => onChange({checks: table.checks!.filter(item => item.id !== check.id)})}>Remove</button></div>)}
        <details className="erd-properties-disclosure"><summary>Add index or constraint</summary><div><label>Type<WorkshopSelect value={kind} onValueChange={selectedValue => {setKind(selectedValue); setError("")}}><option value="index">Index</option><option value="unique">Unique key (one or more columns)</option><option value="check">Check condition</option></WorkshopSelect></label>
        <label>Constraint name<input maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder={kind === "check" ? "positive_total" : "idx_table_columns"}/></label>
        {kind === "check" ? <label>SQL condition<textarea maxLength={2000} value={expression} onChange={event => setExpression(event.target.value)} placeholder="total >= 0"/></label> : <div role="group" aria-label="Index columns">{table.fields.map(field => <label className="tool-checkbox" key={field.id}><input type="checkbox" checked={fields.includes(field.id)} onChange={event => setFields(current => event.target.checked ? [...current, field.id] : current.filter(id => id !== field.id))}/>{field.name}</label>)}</div>}
        {error && <p className="tool-inline-error" role="alert">{error}</p>}
        <Button size="sm" variant="secondary" disabled={kind === "check" ? (table.checks?.length ?? 0) >= 200 : (table.indexes?.length ?? 0) >= 200} onClick={add}>Add {kind === "check" ? "check" : kind === "unique" ? "unique key" : "index"}</Button></div></details>
    </div>
}
