// In-memory settings only; no real portal is enabled or changed.
import {createRoot} from "react-dom/client"
import {useState} from "react"
import {Provider} from "react-redux"
import {store} from "@/app/store"
import {BugPortalSettings} from "@/features/workshop/bug-report-settings"
import {bugReportsApi} from "@/features/workshop/bug-reports-api"
import type {BugPortal} from "@/features/workshop/bug-reports"
import "@/index.css"
import "@/features/workshop/bug-reports.css"

let portal: BugPortal = {token: "00112233445566778899" + "a".repeat(44), shortCode: "ABEiM0RVZneImQ", enabled: true, revision: 0}
bugReportsApi.injectEndpoints({overrideExisting: true, endpoints: builder => ({
    getBugPortal: builder.query({queryFn: () => ({data: {...portal}}), providesTags: [{type: "BugPortal", id: "preview"}]}),
    saveBugPortal: builder.mutation({queryFn: (input: {enabled: boolean; rotate: boolean}) => {portal = {...portal, enabled: input.enabled, revision: portal.revision + 1, ...(input.rotate ? {token: "ffeeddccbbaa99887766" + "b".repeat(44), shortCode: "_-7dzLuqmYh3Zg"} : {})}; return {data: {...portal}}}, invalidatesTags: [{type: "BugPortal", id: "preview"}]}),
})})
document.documentElement.classList.add("dark")
export function Preview() {
    const [clipboard, setClipboard] = useState("")
    async function checkClipboard() {
        try {setClipboard(await navigator.clipboard.readText())}
        catch {setClipboard("Clipboard read unavailable")}
    }
    return <main className="min-h-screen bg-background p-6 text-foreground"><h1 className="mb-6 text-lg font-semibold">Bug reports · isolated preview</h1><BugPortalSettings scope={{organizationId: "preview", projectId: "preview"}}/><button type="button" onClick={() => void checkClipboard()}>Check copied URL</button>{clipboard && <p role="status">Clipboard: {clipboard}</p>}</main>
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><Preview/></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
