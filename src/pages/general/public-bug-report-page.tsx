import {useEffect, useState} from "react"
import {Link, useParams} from "react-router-dom"
import {Bug, Check, LoaderCircle, RefreshCw} from "lucide-react"
import {BrandMark} from "@/components/brand-mark"
import {Button} from "@/components/ui/button"
import {BugReportForm} from "@/features/workshop/bug-report-form"
import {bugError, publicBugRequest, type BugReceipt, type PublicBugForm} from "@/features/workshop/bug-reports"
import "@/features/workshop/bug-reports.css"

export function PublicBugReportPage() {
    const {token = ""} = useParams()
    return <PublicBugReport key={token} token={token}/>
}
function PublicBugReport({token}: {token: string}) {
    const [form, setForm] = useState<PublicBugForm | null>(null), [receipt, setReceipt] = useState<BugReceipt | null>(null)
    const [error, setError] = useState(""), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0), [unavailable, setUnavailable] = useState(false)
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true); setError(""); setUnavailable(false)
        publicBugRequest<PublicBugForm>(token, undefined, controller.signal).then(setForm).catch(failure => {
            if (controller.signal.aborted) return
            setUnavailable(failure.status === 404); setError(bugError(failure, "The form could not be loaded. Check your connection and try again."))
        }).finally(() => {if (!controller.signal.aborted) setLoading(false)})
        return () => controller.abort()
    }, [token, attempt])
    return <div className="public-bug-page">
        <title>{form ? `Report a bug · ${form.projectName}` : "Report a bug · DevHub"}</title><meta name="referrer" content="no-referrer"/><meta name="robots" content="noindex, nofollow"/>
        <header className="public-bug-brand"><Link to="/" aria-label="DevHub home"><BrandMark className="size-8"/><strong>DevHub</strong></Link><span>PUBLIC BUG REPORT</span></header>
        <main className="public-bug-card">
            {loading ? <div className="bug-loading" role="status"><LoaderCircle className="animate-spin"/>Loading report form…</div> : error ? <div className="public-bug-result"><span className="public-bug-icon"><Bug/></span><h1>{unavailable ? "This link is unavailable" : "Couldn’t load the form"}</h1><p>{unavailable ? "The project may have disabled or replaced this link. Ask the project team for an active submission link." : error}</p>{!unavailable && <Button variant="outline" onClick={() => setAttempt(value => value + 1)}><RefreshCw/>Try again</Button>}</div> : receipt ? <div className="public-bug-result"><span className="public-bug-icon success"><Check/></span><span className="bug-eyebrow">REPORT RECEIVED</span><h1>Thanks for helping us improve.</h1><p>Your report and attachments have been sent to the {form?.projectName} team. Keep this reference for any follow-up with them.</p><strong className="bug-receipt">{receipt.reference}</strong><small>This confirmation does not send an email.</small><Button variant="outline" onClick={() => setReceipt(null)}>Submit another report</Button></div> : form && <>
                <div className="public-bug-intro"><span className="public-bug-icon"><Bug/></span><span className="bug-eyebrow">{form.projectName}</span><h1>Something not working?</h1><p>Tell the team what went wrong. A few details can make all the difference.</p><span className="public-bug-no-account"><Check/>No account needed. Just your email.</span></div>
                <BugReportForm categories={form.categories} onSubmit={body => publicBugRequest<BugReceipt>(token, body)} onSuccess={setReceipt}/>
            </>}
        </main>
        <footer className="public-bug-footer">Bug reports powered by <Link to="/">DevHub</Link></footer>
    </div>
}
