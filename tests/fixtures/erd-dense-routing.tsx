// Anonymous geometry reproduction; this preview never reads or writes project data.
import {useState} from "react"
import {createRoot} from "react-dom/client"
import {ErdConnections} from "@/features/workshop/erd-connections"
import {arrangeErd} from "@/features/workshop/erd-layout"
import {newField,tableHeight,type ErdDocument} from "@/features/workshop/tool-documents"
import geometry from "./erd-dense-routing.json"
import "@/index.css"

const focusId="table-057"
const initialDocument:ErdDocument={tables:geometry.tables.map(table=>({...table,name:table.id===focusId?"stores":table.id,fields:Array.from({length:table.columns},(_,i)=>({...newField(),id:`field-${i}`,name:i?`column_${i}`:"id"}))})),relationships:geometry.relationships as ErdDocument["relationships"]}
export function Preview() {
    const [document,setDocument]=useState(initialDocument),[overview,setOverview]=useState(false)
    const focus=document.tables.find(table=>table.id===focusId)!
    const [selected,setSelected]=useState<string|undefined>(document.relationships.find(relation=>relation.fromTable===focus.id||relation.toTable===focus.id)?.id)
    const left=Math.min(...document.tables.map(table=>table.x)),top=Math.min(...document.tables.map(table=>table.y))
    const width=Math.max(...document.tables.map(table=>table.x+300))-left,height=Math.max(...document.tables.map(table=>table.y+tableHeight(table)))-top
    const zoom=overview?Math.min((window.innerWidth-80)/width,(window.innerHeight-100)/height,.8):.8
    return <div className="dark" style={{height:"100dvh",overflow:"hidden",background:"var(--background)",color:"var(--foreground)",padding:20}}>
        <header style={{position:"relative",zIndex:10,display:"flex",gap:16,alignItems:"center",background:"var(--background)"}}><strong>Dense ERD: 75 tables / 148 relationships</strong><button onClick={()=>setSelected(undefined)}>Clear selection</button><button onClick={()=>setSelected(document.relationships.find(relation=>relation.fromTable===focus.id||relation.toTable===focus.id)?.id)}>Select stores relationship</button><button onClick={()=>setOverview(!overview)}>Toggle overview</button><button onClick={()=>{setDocument(arrangeErd(document));setOverview(true)}}>Auto arrange</button></header>
        <div style={{position:"relative",height:700,marginTop:20,overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,top:0,transform:`translate(${overview?40-left*zoom:-focus.x*zoom+820}px, ${overview?20-top*zoom:-focus.y*zoom+120}px) scale(${zoom})`,transformOrigin:"top left"}}>
                <ErdConnections document={document} selectedId={selected} onSelect={setSelected}/>
                {document.tables.map(table=><div key={table.id} style={{position:"absolute",left:table.x,top:table.y,width:300,height:tableHeight(table),border:"1px solid var(--border)",borderRadius:10,background:"var(--popover)"}}><header style={{height:48,padding:14,background:"var(--secondary)",fontWeight:600}}>{table.name}</header>{table.fields.map(field=><div key={field.id} style={{height:32,padding:"6px 16px",fontSize:13,fontFamily:"monospace",borderTop:"1px solid var(--border)"}}>{field.name}</div>)}</div>)}
            </div>
        </div>
    </div>
}
const root=createRoot(globalThis.document.getElementById("root")!)
root.render(<Preview/>)
if(import.meta.hot) import.meta.hot.dispose(()=>root.unmount())
