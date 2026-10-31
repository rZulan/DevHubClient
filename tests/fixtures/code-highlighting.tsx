import {useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {MemoryRouter} from "react-router-dom"
import {NoteMarkdown} from "@/features/workshop/note-markdown"
import {WikiMarkdown} from "@/features/workshop/wiki-markdown"
import "@/features/workshop/wiki.css"
import "@/index.css"

const body = "```bash theme=one-dark-pro\ngit clone <repository-url>\ncd <project-folder>\nnpm install\nnpm run dev\n\nnpm run build 2>build-errors.log\n```"
export function Preview() {
    const [dark, setDark] = useState(true)
    useEffect(() => {document.documentElement.classList.toggle("dark", dark)}, [dark])
    return <main style={{minHeight:"100dvh",padding:32,background:"var(--background)",color:"var(--foreground)"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:24,fontSize:13}}><strong>Code highlighting · isolated preview</strong><label><input type="checkbox" checked={dark} onChange={event=>setDark(event.target.checked)}/> Dark page</label></header>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 360px), 1fr))",gap:24}}>
            <section aria-label="Wiki example" className="wiki-article"><h2 style={{fontSize:16,marginBottom:12}}>Project Wiki</h2><WikiMarkdown body={body} pages={[]} projectId="code-highlight-preview"/></section>
            <section aria-label="Notes example"><h2 style={{fontSize:16,marginBottom:12}}>Notes</h2><NoteMarkdown body={body}/></section>
        </div>
    </main>
}
createRoot(document.getElementById("root")!).render(<MemoryRouter><Preview/></MemoryRouter>)
