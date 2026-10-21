import {ArrowLeft} from "lucide-react"
import ReactMarkdown from "react-markdown"
import {Link} from "react-router-dom"
import changelog from "../../../CHANGELOG.md?raw"

export function ChangelogsPage() {
    return <section className="mx-auto w-full max-w-3xl" aria-labelledby="changelogs-title">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4" to="/"><ArrowLeft className="size-4"/>Back home</Link>
        <h1 className="mb-10 text-4xl font-bold tracking-tight" id="changelogs-title">Changelogs</h1>
        <div className="rounded-2xl border bg-card/80 p-6 backdrop-blur-sm sm:p-8">
            <ReactMarkdown components={{
                h2: ({children}) => <h2 className="mt-10 border-b pb-4 text-2xl font-semibold tracking-tight first:mt-0">{children}</h2>,
                h3: ({children}) => <h3 className="mt-6 mb-3 text-base font-semibold">{children}</h3>,
                ul: ({children}) => <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ul>,
                p: ({children}) => <p className="my-3 text-sm leading-relaxed text-muted-foreground">{children}</p>,
            }}>{changelog.replace(/^# Changelog\s*/, "")}</ReactMarkdown>
        </div>
    </section>
}
