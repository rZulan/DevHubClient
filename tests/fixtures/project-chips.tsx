import {useState} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {store} from "@/app/store"
import {ProjectEditDialog} from "@/features/workshop/project-edit-dialog"
import {seedOrganizations} from "@/features/workshop/workshop-data"
import {WorkshopToaster} from "@/features/workshop/workshop-toaster"
import "@/index.css"

const project = {...seedOrganizations[0].projects[0], techStack:["React, TypeScript", ".NET"], database:"SQL Server, MariaDB", environments:["Development", "Production"]}
export function Preview() {
    const [open, setOpen] = useState(true), [saved, setSaved] = useState<Record<string, FormDataEntryValue> | null>(null)
    return <main style={{padding:24}}><WorkshopToaster/><button type="button" onClick={() => setOpen(true)}>Edit project</button>
        {saved && <pre role="status">{JSON.stringify(saved, null, 2)}</pre>}
        {open && <ProjectEditDialog project={project} initialSection="technical" busy={false} error="" onClose={() => setOpen(false)} onSave={event => {setSaved(Object.fromEntries(new FormData(event.currentTarget))); setOpen(false)}}/>}
    </main>
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><Preview/></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
