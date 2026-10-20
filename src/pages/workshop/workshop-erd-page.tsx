import {useCallback, useMemo, useRef, useState} from "react"
import {useOutletContext} from "react-router-dom"
import {Database, FileCode, ImageDown, KeyRound, LayoutGrid, Link2, Plus} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {DropdownMenuItem} from "@/components/ui/dropdown-menu"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {ToolCanvas} from "@/features/workshop/tool-canvas"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {dataTypes, erdDialects, erdDialectLabels, downloadFile, erdSql, newField, removeField, removeTable, tableHeight, cardinalityForEnds, relationshipEnds, relationshipFieldIds, type ErdDialect, type ErdAnchor, type ErdField, type ErdRelationship, type ErdTable} from "@/features/workshop/tool-documents"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {createClientId} from "@/lib/create-client-id"
import {ErdImportDialog} from "@/features/workshop/erd-import-dialog"
import {RelationshipEndSelect} from "@/features/workshop/erd-relationship-symbols"
import {ErdConnections, type ErdReattachment} from "@/features/workshop/erd-connections"
import {erdConnectionBounds} from "@/features/workshop/erd-connection"
import {ErdEditableName} from "@/features/workshop/erd-editable-name"
import {ErdPanel} from "@/features/workshop/erd-panel"
import {ErdRelationshipDialog} from "@/features/workshop/erd-relationship-dialog"
import {erdRelationshipError, reattachErdEnd} from "@/features/workshop/erd-relationship-draft"
import {arrangeErd} from "@/features/workshop/erd-layout"
import {createErdJunction, erdSchemaIssues, erdSqlType} from "@/features/workshop/erd-schema"
import {ErdTableConstraints} from "@/features/workshop/erd-table-constraints"
import {exportErdPng} from "@/features/workshop/erd-image-export"
import {erdRenderIndex} from "@/features/workshop/erd-render-index"

export function WorkshopErdPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><Database/><h3>No project selected</h3><p>Select or create a project to build its data model.</p></section>
    return <ErdEditor key={`${userId}:${organization.id}:${project.id}`}/>
}
function ErdEditor() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization, userId, "Edit ideation")
    const editor = useToolDocument({organizationId: organization.id, projectId: project!.id, tool: "erd"}, userId, canWrite, isPersistedOrganization)
    const {document, setDocument, canEdit} = editor
    const dialect = document.dialect ?? "postgresql"
    const schemaIssues = useMemo(() => erdSchemaIssues(document), [document])
    const connectionBounds = useMemo(() => erdConnectionBounds(document), [document])
    const renderIndex = useMemo(() => erdRenderIndex(document), [document])
    const canvasNodes = useMemo(() => document.tables.map(table => ({...table, width: 300, height: tableHeight(table)})), [document.tables])
    const [selectedIds, setSelectedIds] = useState<string[]>([]), [fieldId, setFieldId] = useState("")
    const [selectedRelationId, setSelectedRelationId] = useState("")
    const [reattaching, setReattaching] = useState<{draft: ErdRelationship; original: ErdRelationship} | null>(null)
    const [tablesCollapsed, setTablesCollapsed] = useState(false), [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
    const [connecting, setConnecting] = useState<{fromId: string; toId: string} | null>(null)
    const [relationError, setRelationError] = useState("")
    const [arrangement, setArrangement] = useState(0)
    const workspace = useRef<HTMLElement>(null)
    const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState("")
    async function exportPng() {
        if (!workspace.current || exporting) return
        setExporting(true); setExportError("")
        try {await exportErdPng(document, workspace.current, "erd-diagram.png")}
        catch (error) {setExportError(error instanceof Error ? error.message : "Could not export the diagram as PNG.")}
        finally {setExporting(false)}
    }
    const selected = renderIndex.tables.get(selectedIds[0])
    const selectedRelation = document.relationships.find(relation => relation.id === selectedRelationId)
    const visibleRelations = document.relationships.filter(relation => selectedRelation ? relation.id === selectedRelation.id : selectedIds.includes(relation.fromTable) || selectedIds.includes(relation.toTable))
    const field = selected?.fields.find(item => item.id === fieldId) ?? selected?.fields[0]
    function selectTables(ids: string[]) {setSelectedIds(ids); setSelectedRelationId("")}
    function selectRelation(id: string) {setSelectedRelationId(id); setSelectedIds([]); setFieldId("")}
    const updateTable = useCallback((id: string, changes: Partial<ErdTable>) => {
        const next = {...document, tables: document.tables.map(table => table.id === id ? {...table, ...changes} : table)}
        if (document.relationships.some(relation => !erdRelationshipError(document, relation) && erdRelationshipError(next, relation))) {setRelationError(""); return}
        setDocument(next); setRelationError("")
    }, [document, setDocument])
    function updateField(changes: Partial<ErdField>) {
        if (!selected || !field) return
        updateTable(selected.id, {fields: selected.fields.map(item => item.id === field.id ? {...item, ...changes, ...(changes.primary || changes.autoIncrement ? {nullable: false} : {}), ...(changes.type && !["INT", "BIGINT"].includes(changes.type) ? {autoIncrement: false} : {}), ...(changes.autoIncrement ? {defaultValue: ""} : {})} : item)})
    }
    function addTable() {
        const id = createClientId()
        setDocument(current => ({...current, tables: [...current.tables, {id, name: `table_${current.tables.length + 1}`, x: 80 + current.tables.length % 3 * 360, y: 60 + Math.floor(current.tables.length / 3) * 250, fields: [newField()]}]}))
        selectTables([id]); setFieldId("")
    }
    function addExample() {
        const users = {id: createClientId(), name: "users", x: 80, y: 80, fields: [newField(), {...newField("email"), unique: true}]}
        const orders = {id: createClientId(), name: "orders", x: 500, y: 260, fields: [newField(), {...newField("user_id"), type: "UUID" as const, length: ""}, {...newField("total"), type: "DECIMAL" as const, length: "10,2"}]}
        setDocument({...document, tables: [users, orders], relationships: [{id: createClientId(), fromTable: users.id, fromField: users.fields[0].id, toTable: orders.id, toField: orders.fields[1].id, cardinality: "1:N", onDelete: "RESTRICT"}]})
        selectTables([users.id])
    }
    function addRelation(draft: Omit<ErdRelationship, "id">) {
        if (!canEdit) return "Editing is currently unavailable. Close this dialog and try again."
        if (document.relationships.length >= 2000) return "This diagram has reached the relationship limit."
        const relation = {...draft, id: createClientId()}
        const error = erdRelationshipError(document, relation)
        if (error) return error
        setDocument(current => ({...current, relationships: [...current.relationships, relation]})); setRelationError("")
        return ""
    }
    function updateRelation(relation: ErdRelationship, changes: Partial<ErdRelationship>) {
        const ends = changes.cardinality ? relationshipEnds({cardinality: changes.cardinality}) : {...relationshipEnds(relation), ...changes}
        const next = {...relation, ...changes, leftEnd: ends.leftEnd, rightEnd: ends.rightEnd, cardinality: cardinalityForEnds(ends.leftEnd, ends.rightEnd)}
        const error = erdRelationshipError(document, next)
        if (error) {setRelationError(error); return}
        setDocument(current => ({...current, relationships: current.relationships.map(item => item.id === relation.id ? next : item)})); setRelationError("")
    }
    function reattach(id: string, end: "from" | "to", target: ErdReattachment) {
        if (!canEdit) return
        const original = document.relationships.find(relation => relation.id === id)
        if (!original) return
        const draft = reattachErdEnd(document, original, end, target)
        if (!draft) return
        selectRelation(id); setRelationError("")
        if (draft.fromTable !== original.fromTable || draft.toTable !== original.toTable) {setReattaching({draft, original}); return}
        setDocument(current => ({...current, relationships: current.relationships.map(relation => relation.id === id ? draft : relation)}))
    }
    function saveReattachment(changes: Omit<ErdRelationship, "id">) {
        if (!canEdit || !reattaching) return "Editing is currently unavailable. Close this dialog and try again."
        const existing = document.relationships.find(relation => relation.id === reattaching.original.id)
        if (JSON.stringify(existing) !== JSON.stringify(reattaching.original)) return "This relationship changed while the dialog was open. Close it and drag the endpoint again."
        const next = {...changes, id: existing!.id}, error = erdRelationshipError(document, next)
        if (error) return error
        setDocument(current => ({...current, relationships: current.relationships.map(relation => relation.id === next.id ? next : relation)}))
        return ""
    }
    function deleteSelected() {
        setDocument(current => selectedRelation ? {...current, relationships: current.relationships.filter(relation => relation.id !== selectedRelation.id)} : selectedIds.reduce(removeTable, current))
        selectTables([])
    }
    const renderedTables = useMemo(() => new Map(document.tables.map(table => [table.id, <article key={table.id} className="erd-table"><header><Database/><strong><ErdEditableName name={table.name} label={`Rename table ${table.name}`} canEdit={canEdit} onChange={name => updateTable(table.id, {name})}/></strong><small>{table.fields.length} columns</small></header>
                        {table.fields.map(item => <div role="button" tabIndex={0} key={item.id} className={`erd-field-row ${selected?.id === table.id && field?.id === item.id ? "active" : ""}`} onPointerDown={event => event.stopPropagation()} onClick={() => {selectTables([table.id]); setFieldId(item.id)}} onKeyDown={event => {if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); selectTables([table.id]); setFieldId(item.id)}}}>
                            <span className="erd-field-key">{item.primary ? <KeyRound/> : renderIndex.foreignKeys.get(table.id)?.has(item.id) ? <Link2/> : null}</span><ErdEditableName name={item.name} label={`Rename column ${table.name}.${item.name}`} canEdit={canEdit} onChange={name => setDocument(current => ({...current, tables: current.tables.map(value => value.id === table.id ? {...value, fields: value.fields.map(column => column.id === item.id ? {...column, name} : column)} : value)}))}/><small title={item.autoIncrement ? "Generated ID" : undefined}>{erdSqlType(item, dialect)}{item.autoIncrement ? " ↗" : ""}</small><i>{item.nullable ? "?" : ""}</i>
                        </div>)}
                        {!table.fields.length && <p>No columns yet</p>}
                    </article>])), [document, canEdit, selected?.id, field?.id, dialect, renderIndex, updateTable, setDocument])
    return <section ref={workspace} className="project-tool-workspace erd-workspace">
        <ToolDocumentHeader title="Entity relationship diagram" projectName={project!.name} {...editor} canWrite={canWrite} persisted={isPersistedOrganization} onSave={() => void editor.save()} onRetry={editor.retry} onReload={editor.reload} tool="erd" document={document} exporting={exporting} exportItems={<>
            <DropdownMenuItem title={schemaIssues.length ? "Resolve schema issues before exporting SQL" : `Export ${erdDialectLabels[dialect]} SQL`} disabled={!document.tables.length || !!schemaIssues.length} onSelect={() => {setExportError(""); try {downloadFile(erdSql(document), `schema-${dialect}.sql`, "text/plain")} catch (error) {setExportError(error instanceof Error ? error.message : "Could not export SQL.")}}}><FileCode/>Export as SQL</DropdownMenuItem>
            <DropdownMenuItem disabled={!document.tables.length} onSelect={() => void exportPng()}><ImageDown/>Export as PNG</DropdownMenuItem>
        </>}>
            <label className="erd-database-target">Database<select aria-label="Database target" disabled={!canEdit} value={dialect} onChange={event => setDocument(current => ({...current, dialect: event.target.value as ErdDialect}))}>{erdDialects.map(value => <option key={value} value={value}>{erdDialectLabels[value]}</option>)}</select></label>
            <Button size="sm" variant="secondary" disabled={!canEdit || !document.tables.length} title="Arrange related tables and tidy relationship paths" onClick={() => {
                setDocument(arrangeErd); setArrangement(value => value + 1)
            }}><LayoutGrid/> Auto arrange</Button>
            <ErdImportDialog canEdit={canEdit} tableCount={document.tables.length} dialect={dialect} onImport={imported => {
                setDocument(imported); selectTables(imported.tables[0] ? [imported.tables[0].id] : []); setFieldId(""); setConnecting(null); setReattaching(null); setRelationError("")
            }}/>
        </ToolDocumentHeader>
        {exportError && <div className="tool-document-error" role="alert">{exportError}</div>}
        <div className="tool-editor-body">
            <ErdPanel side="left" title="Tables" detail={`${document.tables.length} tables`} collapsed={tablesCollapsed} onToggle={() => setTablesCollapsed(value => !value)}>
                {!!schemaIssues.length && <details className="erd-schema-issues"><summary>{schemaIssues.length} SQL export {schemaIssues.length === 1 ? "issue" : "issues"}</summary><ul>{schemaIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
                <Button size="sm" variant="secondary" disabled={!canEdit || document.tables.length >= 500} onClick={addTable}>Add table</Button>
                <div className="tool-layer-list">{document.tables.map(table => <button type="button" className={selectedIds.includes(table.id) ? "active" : ""} key={table.id} onClick={() => {selectTables([table.id]); setFieldId("")}}><span>{table.name}</span><small>{table.fields.length}</small></button>)}</div>
            </ErdPanel>
            <ToolCanvas nodes={canvasNodes} cullNodes deferMoves selectedIds={selectedIds} onSelect={selectTables} {...editor} onDelete={deleteSelected} contentBounds={connectionBounds} fitViewKey={arrangement}
                onConnect={document.relationships.length >= 2000 ? undefined : (fromId, toId) => {if (canEdit) setConnecting({fromId, toId})}}
                onMove={positions => setDocument(current => {
                    const moved = new Map(positions.map(position => [position.id, position]))
                    let changed = false
                    const tables = current.tables.map(table => {
                        const position = moved.get(table.id)
                        if (!position || table.x === position.x && table.y === position.y) return table
                        changed = true; return {...table, x: position.x, y: position.y}
                    })
                    return changed ? {...current, tables} : current
                })}
                renderNode={node => renderedTables.get(node.id)}
                renderConnections={(positions, viewport) => <ErdConnections document={document} positions={positions} viewport={viewport} canEdit={canEdit} selectedId={selectedRelationId} onSelect={selectRelation} onReattach={reattach}/>}>
                <Button size="sm" variant="secondary" disabled={!canEdit} onClick={addTable}><Plus/> Table</Button>
                {!document.tables.length && <Button size="sm" variant="ghost" disabled={!canEdit} onClick={addExample}>Load example</Button>}
            </ToolCanvas>
            {(selected || selectedRelation) && <ErdPanel side="right" title="Properties" detail={selected ? "Table & column" : "Relationship"} collapsed={propertiesCollapsed} onToggle={() => setPropertiesCollapsed(value => !value)}>
                <fieldset disabled={!canEdit}>
                {selected && <>
                    <label>Table name<input maxLength={150} value={selected.name} onChange={event => updateTable(selected.id, {name: event.target.value || "table"})}/></label>
                    <div className="tool-property-grid"><label>X<input type="number" value={Math.round(selected.x)} onChange={event => updateTable(selected.id, {x: Number(event.target.value)})}/></label><label>Y<input type="number" value={Math.round(selected.y)} onChange={event => updateTable(selected.id, {y: Number(event.target.value)})}/></label></div>
                    <div className="tool-section-heading"><strong>Columns</strong><button type="button" aria-label="Add column" disabled={selected.fields.length >= 200} onClick={() => {const item = newField(`column_${selected.fields.length + 1}`); updateTable(selected.id, {fields: [...selected.fields, item]}); setFieldId(item.id)}}><Plus/></button></div>
                    <label>Edit column<select value={field?.id ?? ""} onChange={event => setFieldId(event.target.value)}>{selected.fields.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                    {field && <><label>Column name<input maxLength={150} value={field.name} onChange={event => updateField({name: event.target.value || "column"})}/></label>
                        <div className="tool-property-grid"><label>Data type<select value={field.type} onChange={event => updateField({type: event.target.value as ErdField["type"], length: ""})}>{dataTypes.map(type => <option key={type} value={type}>{type} · {erdSqlType({...field, type, length: ""}, dialect)}</option>)}</select></label>
                        <label>Length / precision<input placeholder="255 or 10,2" maxLength={30} disabled={!["VARCHAR", "DECIMAL"].includes(field.type)} value={field.length} onChange={event => updateField({length: event.target.value})}/></label></div>
                        <label className="tool-checkbox"><input type="checkbox" checked={field.primary} onChange={event => updateField({primary: event.target.checked})}/>Primary key</label>
                        <label className="tool-checkbox"><input type="checkbox" checked={field.nullable} disabled={field.primary || field.autoIncrement} onChange={event => updateField({nullable: event.target.checked})}/>Nullable</label>
                        <label className="tool-checkbox"><input type="checkbox" checked={field.unique} onChange={event => updateField({unique: event.target.checked})}/>Unique</label>
                        <label className="tool-checkbox"><input type="checkbox" checked={field.autoIncrement ?? false} disabled={!["INT", "BIGINT"].includes(field.type)} onChange={event => updateField({autoIncrement: event.target.checked})}/>Generated integer ID</label>
                        <label>Default SQL expression<input maxLength={500} disabled={field.autoIncrement} placeholder="e.g. CURRENT_TIMESTAMP" value={field.defaultValue} onChange={event => updateField({defaultValue: event.target.value})}/></label>
                        <Button size="sm" variant="ghost" className="tool-delete" onClick={() => setDocument(current => removeField(current, selected.id, field.id))}>Delete column</Button>
                    </>}
                    <ErdTableConstraints key={selected.id} table={selected} onChange={changes => updateTable(selected.id, changes)}/>
                    <Button size="sm" variant="ghost" className="tool-delete" onClick={deleteSelected}>Delete table</Button>
                </>}
                <div className="tool-section-heading"><strong>Relationships</strong></div>
                {!visibleRelations.length && <p className="tool-help">Drag a handle from a table edge onto another table to create a relationship.</p>}
                {relationError && <p className="tool-inline-error" role="alert">{relationError}</p>}
                {visibleRelations.map(relation => {
                    const parent = document.tables.find(table => table.id === relation.fromTable), child = document.tables.find(table => table.id === relation.toTable)
                    return <div className="erd-relationship-entry" key={relation.id}><span><strong>{parent?.name} → {child?.name}</strong><small>{relationshipFieldIds(relation, "from").map(id => parent?.fields.find(item => item.id === id)?.name).join(", ")} → {relationshipFieldIds(relation, "to").map(id => child?.fields.find(item => item.id === id)?.name).join(", ")}</small>
                        <Button size="sm" variant="secondary" onClick={() => setReattaching({draft: relation, original: relation})}>Edit columns</Button>
                        {relation.cardinality === "N:M" && <Button size="sm" variant="secondary" onClick={() => {try {const next = createErdJunction(document, relation); setDocument(next); selectTables([next.tables.at(-1)!.id]); setRelationError("")} catch (error) {setRelationError(error instanceof Error ? error.message : "Could not create junction table.")}}}>Create junction table</Button>}
                        <div className="tool-property-grid"><label>Cardinality<select aria-label={`Cardinality for ${parent?.name} to ${child?.name}`} value={relation.cardinality} onChange={event => updateRelation(relation, {cardinality: event.target.value as ErdRelationship["cardinality"]})}><option>1:1</option><option>1:N</option><option>N:1</option><option>N:M</option></select></label><label>On delete<select aria-label={`On delete for ${parent?.name} to ${child?.name}`} value={relation.onDelete} onChange={event => updateRelation(relation, {onDelete: event.target.value as ErdRelationship["onDelete"]})}><option>RESTRICT</option><option>CASCADE</option><option>SET NULL</option></select></label></div>
                        <div className="tool-property-grid"><RelationshipEndSelect label="Left end" ariaLabel={`Left end for ${parent?.name} to ${child?.name}`} value={relationshipEnds(relation).leftEnd} onChange={value => updateRelation(relation, {leftEnd: value})}/><RelationshipEndSelect right label="Right end" ariaLabel={`Right end for ${parent?.name} to ${child?.name}`} value={relationshipEnds(relation).rightEnd} onChange={value => updateRelation(relation, {rightEnd: value})}/></div>
                        <div className="tool-property-grid">{(["from", "to"] as const).map(end => {
                            const key = end === "from" ? "fromAnchor" : "toAnchor"
                            return <label key={end}>{end === "from" ? "Left attachment" : "Right attachment"}<select aria-label={`${end === "from" ? "Left" : "Right"} attachment for ${parent?.name} to ${child?.name}`} value={relation[key]?.edge ?? "auto"} onChange={event => updateRelation(relation, {[key]: event.target.value === "auto" ? undefined : {edge: event.target.value as ErdAnchor["edge"], offset: .5}})}><option value="auto">Automatic</option><option value="left">Left edge</option><option value="right">Right edge</option><option value="top">Top edge</option><option value="bottom">Bottom edge</option></select></label>
                        })}</div>
                    </span><button type="button" aria-label="Delete relationship" onClick={() => setDocument(current => ({...current, relationships: current.relationships.filter(item => item.id !== relation.id)}))}>Remove</button></div>
                })}
                </fieldset>
            </ErdPanel>}
        </div>
        {connecting && <ErdRelationshipDialog document={document} {...connecting} canEdit={canEdit} onClose={() => setConnecting(null)} onSave={addRelation}/>}
        {reattaching && <ErdRelationshipDialog document={document} fromId={reattaching.draft.fromTable} toId={reattaching.draft.toTable} initial={reattaching.draft} canEdit={canEdit} onClose={() => setReattaching(null)} onSave={saveReattachment}/>}
    </section>
}
