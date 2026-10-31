import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Route, Routes} from "react-router-dom"
import {store} from "@/app/store"
import {WorkshopCanvasNotice, WorkshopStorageNotice} from "@/features/workshop/workshop-limit-notices"
import "@/index.css"
import "@/features/workshop/workshop-responsive.css"

const organizationId = "11111111-1111-4111-8111-111111111111"
createRoot(document.getElementById("root")!).render(<Provider store={store}><MemoryRouter initialEntries={[`/organizations/${organizationId}`]}><Routes><Route path="/organizations/:organizationId" element={
    <main className="workshop-shell" style={{display: "grid", gridTemplateColumns: "minmax(0,1fr)", gridAutoRows: "max-content", alignContent: "start", gap: 16, padding: 20, maxWidth: 900, margin: "0 auto"}}>
        <h1>Workshop usage</h1>
        <WorkshopStorageNotice organizationId={organizationId} persisted/>
        <WorkshopCanvasNotice tool="ideas" document={Array(1000).fill(null)}/>
        <WorkshopCanvasNotice tool="ui-editor" document={{layers: Array(2000).fill(null)}}/>
        <WorkshopCanvasNotice tool="ideas" document={Array(3000).fill(null)}/>
        <p role="alert">Saving resumes in 12s. Your draft is kept locally and remains editable.</p>
    </main>
}/></Routes></MemoryRouter></Provider>)
