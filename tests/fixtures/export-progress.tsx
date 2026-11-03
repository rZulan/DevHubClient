// Anonymous real worker exports; navigation never touches project data or the API.
import {createRoot} from "react-dom/client"
import {Link, MemoryRouter, Route, Routes} from "react-router-dom"
import {ExportProgressPanel} from "@/features/exports/export-progress-panel"
import {exportManager} from "@/features/exports/export-manager"
import {runErdPngWorker} from "@/features/workshop/erd-png-worker-client"
import {defaultPalette} from "@/features/workshop/erd-image-scene"
import {arrangeErd} from "@/features/workshop/erd-layout"
import {newField, type ErdDocument} from "@/features/workshop/tool-documents"
import geometry from "./erd-dense-routing.json"
import "@/index.css"

const document:ErdDocument=arrangeErd({tables:geometry.tables.map(table=>({...table,name:table.id,fields:Array.from({length:table.columns},(_,i)=>({...newField(),id:`field-${i}`,name:i?`column_${i}`:"id"}))})),relationships:geometry.relationships as ErdDocument["relationships"]})
function start(project:string) {
    void exportManager.run({key:project,label:"ERD · HD PNG",detail:project},async context=>{
        const {blob}=await runErdPngWorker({document,palette:defaultPalette,options:{}},context)
        context.signal.throwIfAborted()
        const url=URL.createObjectURL(blob),anchor=window.document.createElement("a");anchor.href=url;anchor.download=`${project}.png`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
    }).catch(()=>{})
}
function App() {
    return <MemoryRouter><div className="dark" style={{minHeight:"100svh",padding:28,background:"var(--background)",color:"var(--foreground)"}}><nav style={{display:"flex",gap:20,marginBottom:24}}><Link to="/">Export preview</Link><Link to="/notes">Another page</Link></nav><Routes><Route path="/" element={<><h1>Project exports</h1><p>75 tables / 148 relationships · 4× HD · real background workers</p><div style={{display:"flex",gap:16,marginTop:20}}><button onClick={()=>start("Project Alpha")}>Export Alpha</button><button onClick={()=>start("Project Beta")}>Export Beta</button></div></>}/><Route path="/notes" element={<><h1>Another page</h1><p>The export list stays visible while work continues.</p></>}/></Routes><ExportProgressPanel/></div></MemoryRouter>
}
createRoot(window.document.getElementById("root")!).render(<App/>);
