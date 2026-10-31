import {useId, type ReactNode} from "react"
import {Button} from "@/components/ui/button"
import {WorkshopSelect} from "./workshop-select"
import {ErdTableConstraints} from "./erd-table-constraints"
import {dataTypes, type ErdField, type ErdTable} from "./tool-documents"
import {ErdColumnNavigator} from "./erd-column-navigator"

export type ErdPropertiesTab = "columns" | "table" | "relationships"

export function ErdTableProperties({table, field, tab, onTabChange, canEdit, relationshipCount, relationships, onSelectField, onAddColumn, onUpdateField, onUpdateTable, onDeleteField, onDeleteTable}: {
    table: ErdTable; field?: ErdField; tab: ErdPropertiesTab; onTabChange: (tab: ErdPropertiesTab) => void; canEdit: boolean;
    relationshipCount: number; relationships: ReactNode; onSelectField: (id: string) => void; onAddColumn: () => void;
    onUpdateField: (changes: Partial<ErdField>) => void; onUpdateTable: (changes: Partial<ErdTable>) => void;
    onDeleteField: () => void; onDeleteTable: () => void;
}) {
    const id = useId()
    const tabs = [{id: "columns", label: "Columns"}, {id: "table", label: "Table"}, {id: "relationships", label: "Relations"}] as const
    return <>
        <div className="erd-properties-context"><div><strong>{table.name}</strong><small>{table.fields.length} columns · {relationshipCount} relationships</small></div></div>
        <div className="erd-properties-tabs" role="tablist" aria-label="Table properties">
            {tabs.map(({id: value, label}, index) => <button type="button" role="tab" key={value} id={`${id}-${value}`} aria-selected={tab === value} aria-controls={`${id}-content`} tabIndex={tab === value ? 0 : -1} onClick={() => onTabChange(value)} onKeyDown={event => {
                const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1
                if (next < 0) return
                event.preventDefault(); onTabChange(tabs[next].id)
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
            }}>{label}</button>)}
        </div>
        <div className="erd-properties-tab-content" role="tabpanel" tabIndex={0} id={`${id}-content`} aria-labelledby={`${id}-${tab}`}>
            {tab === "columns" && <>
                <div className="erd-properties-section-title"><strong>Columns <small>{table.fields.length}</small></strong><Button size="sm" variant="ghost" disabled={!canEdit || table.fields.length >= 200} onClick={onAddColumn}>Add</Button></div>
                <ErdColumnNavigator key={table.id} fields={table.fields} selectedId={field?.id} onSelect={onSelectField}/>
                {field && <fieldset disabled={!canEdit} className="erd-column-editor">
                    <label>Column name<input maxLength={150} value={field.name} onChange={event => onUpdateField({name: event.target.value || "column"})}/></label>
                    <div className={field.type === "VARCHAR" || field.type === "DECIMAL" ? "tool-property-grid" : undefined}>
                        <label>Data type<WorkshopSelect value={field.type} onValueChange={value => onUpdateField({type: value as ErdField["type"], length: ""})}>{dataTypes.map(type => <option key={type} value={type}>{type}</option>)}</WorkshopSelect></label>
                        {field.type === "VARCHAR" && <label>Max. characters<input placeholder="255" maxLength={30} value={field.length} onChange={event => onUpdateField({length: event.target.value})}/></label>}
                        {field.type === "DECIMAL" && <label>Digits, decimals<input placeholder="10,2" maxLength={30} value={field.length} onChange={event => onUpdateField({length: event.target.value})}/></label>}
                    </div>
                    <div className="erd-column-rules">
                        <label className="tool-checkbox"><input type="checkbox" checked={field.primary} onChange={event => onUpdateField({primary: event.target.checked})}/><span>Primary key</span></label>
                        <label className="tool-checkbox"><input type="checkbox" checked={field.nullable} disabled={!canEdit || field.primary || field.autoIncrement} onChange={event => onUpdateField({nullable: event.target.checked})}/><span>Allow empty values</span></label>
                        <label className="tool-checkbox"><input type="checkbox" checked={field.unique} onChange={event => onUpdateField({unique: event.target.checked})}/><span>Unique values</span></label>
                        {["INT", "BIGINT"].includes(field.type) && <label className="tool-checkbox"><input type="checkbox" checked={field.autoIncrement ?? false} onChange={event => onUpdateField({autoIncrement: event.target.checked})}/><span>Auto-increment</span></label>}
                    </div>
                    <details className="erd-properties-disclosure"><summary>Default value</summary><div><label>SQL expression<input maxLength={500} disabled={!canEdit || field.autoIncrement} placeholder="e.g. CURRENT_TIMESTAMP" value={field.defaultValue} onChange={event => onUpdateField({defaultValue: event.target.value})}/></label></div></details>
                    {field.defaultValue && <p className="tool-help">Default: <code>{field.defaultValue}</code></p>}
                    <Button size="sm" variant="ghost" className="tool-delete erd-properties-delete" onClick={onDeleteField}>Delete column</Button>
                </fieldset>}
            </>}
            {tab === "table" && <fieldset disabled={!canEdit}>
                <label>Table name<input maxLength={150} value={table.name} onChange={event => onUpdateTable({name: event.target.value || "table"})}/></label>
                <ErdTableConstraints key={table.id} table={table} onChange={onUpdateTable}/>
                <details className="erd-properties-disclosure"><summary>Position on canvas</summary><div><div className="tool-property-grid"><label>X position<input type="number" value={Math.round(table.x)} onChange={event => onUpdateTable({x: Number(event.target.value)})}/></label><label>Y position<input type="number" value={Math.round(table.y)} onChange={event => onUpdateTable({y: Number(event.target.value)})}/></label></div></div></details>
                <Button size="sm" variant="ghost" className="tool-delete erd-properties-delete" title="Deletes this table and its relationships" onClick={onDeleteTable}>Delete table</Button>
            </fieldset>}
            {tab === "relationships" && relationships}
        </div>
    </>
}
