// Real sidebar components with disposable in-memory data for interaction and visual checks.
import {useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {ErdTableProperties, type ErdPropertiesTab} from "@/features/workshop/erd-table-properties"
import {ErdRelationshipProperties} from "@/features/workshop/erd-relationship-properties"
import {ErdPanel} from "@/features/workshop/erd-panel"
import {newField, cardinalityForEnds, relationshipEnds, type ErdTable, type ErdField, type ErdRelationship} from "@/features/workshop/tool-documents"
import "@/index.css"
import "@/features/workshop/erd-properties.css"

export function Preview() {
    const [table, setTable] = useState<ErdTable>({id: "users", name: "users", x: 80, y: 80, fields: [{...newField(), type: "INT", autoIncrement: true}, {...newField("email"), unique: true}, newField("display_name")]})
    const orders: ErdTable = {id: "orders", name: "orders", x: 500, y: 80, fields: [{...newField("user_id"), id: "user_id", type: "INT"}]}
    const [relation, setRelation] = useState<ErdRelationship | null>({id: "r", fromTable: "users", fromField: table.fields[0].id, toTable: "orders", toField: "user_id", cardinality: "1:N", onDelete: "RESTRICT"})
    const [fieldId, setFieldId] = useState(table.fields[1].id), [tab, setTab] = useState<ErdPropertiesTab>("columns"), [canEdit, setCanEdit] = useState(true), [dark, setDark] = useState(false), [collapsed, setCollapsed] = useState(false)
    const field = table.fields.find(item => item.id === fieldId) ?? table.fields[0]
    useEffect(() => {document.documentElement.classList.toggle("dark", dark); return () => document.documentElement.classList.remove("dark")}, [dark])
    function updateField(changes: Partial<ErdField>) {setTable(current => ({...current, fields: current.fields.map(item => item.id === field.id ? {...item, ...changes, ...(changes.primary || changes.autoIncrement ? {nullable: false} : {})} : item)}))}
    return <div className={dark ? "dark" : ""} style={{height: "100dvh", display: "flex", flexDirection: "column", background: "var(--background)", color: "var(--foreground)"}}>
        <nav style={{display: "flex", flexWrap: "wrap", gap: 24, padding: 16, borderBottom: "1px solid var(--border)", fontSize: 12}}><strong>ERD properties preview</strong><label><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)}/> Dark theme</label><label><input type="checkbox" checked={!canEdit} onChange={event => setCanEdit(!event.target.checked)}/> Read-only</label><button onClick={() => setTable(current => ({...current, fields: [...current.fields.slice(0, 3), ...Array.from({length: 47}, (_, index) => newField(`column_${index + 4}`))]}))}>50 columns</button></nav>
        <div style={{display: "flex", flex: 1, minHeight: 0}}><main style={{flex: 1, padding: 32, background: "var(--secondary)"}}><h1 style={{fontSize: 20}}>Entity relationship diagram</h1><p style={{fontSize: 12, marginTop: 12}}>Disposable preview. Changes stay in this tab.</p><div style={{display: "flex", gap: 32, marginTop: 40, flexWrap: "wrap"}}>{[table, orders].map(item => <article key={item.id} style={{width: 240, background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: 16}}><strong>{item.name}</strong>{item.fields.map(column => <button style={{display: "block", width: "100%", textAlign: "left", paddingTop: 12, fontSize: 12}} key={column.id} onClick={() => {if (item.id === table.id) {setFieldId(column.id); setTab("columns")}}}>{column.name} · {column.type}</button>)}</article>)}</div></main>
            <ErdPanel side="right" title="Properties" detail="Table & column" collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} className="erd-properties-panel">
                <ErdTableProperties table={table} field={field} tab={tab} onTabChange={setTab} canEdit={canEdit} relationshipCount={relation ? 1 : 0} onSelectField={setFieldId} onAddColumn={() => {const added = newField(`column_${table.fields.length + 1}`); setTable({...table, fields: [...table.fields, added]}); setFieldId(added.id)}} onUpdateField={updateField} onUpdateTable={changes => setTable({...table, ...changes})} onDeleteField={() => setTable({...table, fields: table.fields.filter(item => item.id !== field.id)})} onDeleteTable={() => setTable({...table, fields: []})} relationships={<fieldset>{relation ? <ErdRelationshipProperties document={{tables: [table, orders], relationships: [relation]}} relation={relation} canEdit={canEdit} initiallyOpen onChange={changes => {const next = {...relation, ...changes}; const ends = relationshipEnds(next); setRelation({...next, cardinality: cardinalityForEnds(ends.leftEnd, ends.rightEnd)})}} onEditColumns={() => {}} onCreateJunction={() => {}} onDelete={() => setRelation(null)}/> : <p>No relationships yet.</p>}</fieldset>}/>
            </ErdPanel>
        </div>
    </div>
}
createRoot(document.getElementById("root")!).render(<Preview/>)
