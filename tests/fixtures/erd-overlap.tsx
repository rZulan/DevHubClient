// Disposable visual fixture for crossings, coincident paths and shared end symbols.
import {useState} from "react"
import {createRoot} from "react-dom/client"
import {ErdConnections} from "@/features/workshop/erd-connections"
import {newField, type ErdDocument} from "@/features/workshop/tool-documents"
import "@/index.css"

const document: ErdDocument = {
    tables: [
        {id:"left",name:"accounts",x:20,y:200,fields:[{...newField(),id:"left-id"}]},
        {id:"right",name:"orders",x:1000,y:200,fields:[{...newField(),id:"right-id"}]},
        {id:"top",name:"products",x:450,y:0,fields:[{...newField(),id:"top-id"}]},
        {id:"bottom",name:"stock",x:450,y:500,fields:[{...newField(),id:"bottom-id"}]},
    ],
    relationships: [
        {id:"horizontal",fromTable:"left",toTable:"right",fromField:"left-id",toField:"right-id",cardinality:"1:N",leftEnd:"one",rightEnd:"zero-many",onDelete:"RESTRICT"},
        {id:"vertical",fromTable:"top",toTable:"bottom",fromField:"top-id",toField:"bottom-id",fromAnchor:{edge:"bottom",offset:.5},toAnchor:{edge:"top",offset:.5},cardinality:"1:N",onDelete:"RESTRICT"},
        {id:"coincident",fromTable:"left",toTable:"right",fromField:"left-id",toField:"right-id",cardinality:"1:1",onDelete:"RESTRICT"},
    ],
}
function Preview() {
    const [selected, setSelected] = useState<string | undefined>("horizontal")
    return <div className="dark" style={{height:"100dvh",overflow:"auto",background:"var(--background)",color:"var(--foreground)",padding:24}}>
        <nav style={{display:"flex",gap:12,alignItems:"center",fontSize:13}}><strong>Overlapping relationships</strong>{["horizontal","vertical","coincident"].map(id=><button key={id} onClick={()=>setSelected(id)} aria-pressed={selected===id} style={{padding:8,border:"1px solid var(--border)",borderRadius:6}}>Select {id}</button>)}<button onClick={()=>setSelected(undefined)}>Clear selection</button></nav>
        <div style={{position:"relative",width:1300,height:650,marginTop:30,transform:"scale(.8)",transformOrigin:"top left",backgroundImage:"radial-gradient(var(--border) 1px, transparent 1px)",backgroundSize:"20px 20px"}}>
            <ErdConnections document={document} selectedId={selected} onSelect={setSelected}/>
            {document.tables.map(table=><div key={table.id} style={{position:"absolute",left:table.x,top:table.y,width:300,height:100,border:"1px solid var(--border)",borderRadius:8,padding:16,background:"var(--background)"}}><strong>{table.name}</strong><p style={{marginTop:16,fontSize:12}}>id · UUID</p></div>)}
        </div>
    </div>
}
createRoot(globalThis.document.getElementById("root")!).render(<Preview/> )
