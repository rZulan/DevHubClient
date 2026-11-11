// Disposable geometry only: exercise the production canvas, worker and relationship renderer.
import {Profiler, useMemo, useRef, useState} from "react"
import {createRoot} from "react-dom/client"
import {ToolCanvas} from "@/features/workshop/tool-canvas"
import {ErdConnections} from "@/features/workshop/erd-connections"
import {useErdRoutePlan} from "@/features/workshop/use-erd-route-plan"
import {saveCanvasView} from "@/features/workshop/canvas-view-storage"
import {ErdTableOverview} from "@/features/workshop/erd-table-overview"
import {isErdTableOverview} from "@/features/workshop/erd-table-detail"
import {newField, tableHeight, type ErdDocument} from "@/features/workshop/tool-documents"
import geometry from "./erd-dense-routing.json"
import "@/index.css"

const initial: ErdDocument = {tables: geometry.tables.map(table => ({...table, name: table.id, fields: Array.from({length: table.columns}, (_, i) => ({...newField(), id: `field-${i}`, name: `column_${i}`}))})), relationships: geometry.relationships as ErdDocument["relationships"]}
const focus = initial.tables[57]
saveCanvasView("erd-drag-performance-preview", {zoom: .75, pan: {x: 140 - focus.x * .75, y: 100 - focus.y * .75}})

export function Preview() {
    const [document, setDocument] = useState(initial), [selected, setSelected] = useState([focus.id]), [relation, setRelation] = useState<string>()
    const [hidden, setHidden] = useState(false), [moves, setMoves] = useState(0)
    const [revision, setRevision] = useState(0), undo = useRef<ErdDocument[]>([]), redo = useRef<ErdDocument[]>([])
    const frames = useRef<number[]>([])
    const plan = useErdRoutePlan(document, !hidden)
    const nodes = useMemo(() => document.tables.map(table => ({...table, width: 300, height: tableHeight(table)})), [document.tables])
    const current = document.tables.find(table => table.id === selected[0])
    return <main className="erd-workspace project-tool-workspace dark" style={{height: "100dvh", background: "var(--background)", color: "var(--foreground)"}}>
        <header style={{display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", padding: 12, fontSize: 13}}>
            <strong>ERD drag preview: {document.tables.length} tables / {document.relationships.length} relationships</strong>
            <button onClick={() => setHidden(value => !value)}>Relationships {hidden ? "hidden" : "visible"}</button>
            <button onClick={() => {
                const tables = Array.from({length: 500}, (_, i) => ({...initial.tables[0], id: `t${i}`, name: `table_${i}`, x: (i % 25) * 440, y: Math.floor(i / 25) * 500}))
                const relationships = Array.from({length: 2000}, (_, i) => ({id: `r${i}`, fromTable: `t${i % 500}`, toTable: `t${(i * 17 + 1) % 500}`, fromField: 'field-0', toField: 'field-1', cardinality: '1:N' as const, onDelete: 'RESTRICT' as const}))
                setDocument({tables, relationships}); setSelected(['t0'])
            }}>Load 500 tables</button>
            <span>Committed moves: {moves}</span><span>Crossing masks: {plan.crossings.size}</span>
            <span>Selected position: {current?.x}, {current?.y}</span>
            <button onClick={() => {const samples = frames.current; alert(`${samples.length} React updates; average ${(samples.reduce((a,b) => a+b,0) / Math.max(1,samples.length)).toFixed(2)} ms; max ${Math.max(0,...samples).toFixed(2)} ms`); frames.current = []}}>Render timings</button>
        </header>
        <Profiler id="erd" onRender={(_id, _phase, duration) => {frames.current.push(duration)}}>
            <ToolCanvas key={revision} nodes={nodes} selectedIds={selected} onSelect={ids => {setSelected(ids); setRelation(undefined)}} canEdit cullNodes deferMoves
                viewStorageKey="erd-drag-performance-preview" contentBounds={plan.connections.map(connection => connection.route.bounds)}
                beginTransaction={() => {}} endTransaction={() => {}} canUndo={!!undo.current.length} canRedo={!!redo.current.length}
                undo={() => {const previous = undo.current.pop(); if (previous) {redo.current.push(document); setDocument(previous)}}}
                redo={() => {const next = redo.current.pop(); if (next) {undo.current.push(document); setDocument(next)}}} onDelete={() => {}}
                onMove={positions => {
                    const moved = new Map(positions.map(position => [position.id, position]))
                    undo.current.push(document); redo.current = []
                    setDocument({...document, tables: document.tables.map(table => moved.has(table.id) ? {...table, x: moved.get(table.id)!.x, y: moved.get(table.id)!.y} : table)})
                    setMoves(count => count + 1)
                }} renderConnections={(positions, viewport) => <ErdConnections document={document} plan={plan} positions={positions} viewport={viewport} selectedId={relation} onSelect={setRelation} canEdit showRelationships={!hidden}/>}
                renderNode={(node, {zoom}) => {
                    const table = document.tables.find(table => table.id === node.id)!
                    return isErdTableOverview(zoom, selected.includes(node.id)) ? <ErdTableOverview table={table}/> : <article className="erd-table"><header><strong>{table.name}</strong></header>{table.fields.map(field => <div className="erd-field-row" key={field.id}>{field.name}</div>)}</article>
                }}>
                <button onClick={() => {saveCanvasView("erd-drag-performance-preview", {zoom: .75, pan: {x: 140, y: 100}}); setRevision(value => value + 1)}}>Focus origin</button>
            </ToolCanvas>
        </Profiler>
    </main>
}
const root = createRoot(globalThis.document.getElementById("root")!)
root.render(<Preview/>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
