import {useId, useState} from "react"
import {ChevronDown, ChevronUp, Download, LoaderCircle, TriangleAlert, X} from "lucide-react"
import {exportManager} from "./export-manager"
import {useExportJobs} from "./use-export-jobs"
import {useExportPanelPosition} from "./use-export-panel-position"
import "./export-progress-panel.css"

export function ExportProgressPanel() {
    const jobs = useExportJobs(), [minimized, setMinimized] = useState(false), listId = useId()
    const panel = useExportPanelPosition(jobs.length > 0)
    if (!jobs.length) return null
    const active = jobs.filter(job => job.status !== "error").length, failures = jobs.length - active
    const summary = active ? `Exports in progress (${active})` : "Export failed"
    return <section ref={panel} className={`export-progress-panel${minimized ? " minimized" : ""}`} aria-label="Exports">
        <button className="export-progress-heading" type="button" aria-expanded={!minimized} aria-controls={listId} aria-label={minimized ? "Expand exports" : "Minimize exports"} onClick={() => setMinimized(value => !value)}>
            <Download aria-hidden="true"/><strong>{summary}</strong>{failures > 0 && active > 0 && <span className="export-progress-failure-count">{failures} failed</span>}{minimized ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}
        </button>
        <div className="sr-only" role="status" aria-live="polite">{active ? `${active} ${active === 1 ? "export" : "exports"} in progress.` : "Exports finished."}{failures ? ` ${failures} failed.` : ""}</div>
        <ul id={listId} hidden={minimized} className="export-progress-list">
            {jobs.map(job => <li key={job.id} className="export-progress-item">
                <div className="export-progress-item-heading">{job.status === "error" ? <TriangleAlert aria-hidden="true"/> : <LoaderCircle className="animate-spin" aria-hidden="true"/>}
                    <div><strong>{job.label}</strong>{job.detail && <small title={job.detail}>{job.detail}</small>}</div>
                    <button className="export-progress-cancel" type="button" title={job.status === "error" ? "Dismiss" : "Cancel export"} aria-label={`${job.status === "error" ? "Dismiss" : "Cancel"} ${job.label}${job.detail ? ` — ${job.detail}` : ""}`} onClick={() => job.status === "error" ? exportManager.dismiss(job.id) : exportManager.cancel(job.id)}><X aria-hidden="true"/></button>
                </div>
                {job.status === "error" ? <p className="export-progress-error" role="alert">{job.error}</p> : <>
                    <div className="export-progress-track" role="progressbar" aria-label={`${job.label}${job.detail ? ` — ${job.detail}` : ""}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress} aria-valuetext={job.status === "queued" ? "Queued" : job.progress ? `${job.progress}%` : "Preparing"} data-preparing={job.status === "running" && !job.progress}>
                        <span style={{width: `${job.status === "running" && !job.progress ? 8 : job.progress}%`}}/>
                    </div>
                    <p className="export-progress-caption"><span>{job.status === "queued" ? "Queued" : job.progress ? "Exporting" : "Preparing…"}</span><span>{job.progress}%</span></p>
                </>}
            </li>)}
        </ul>
    </section>
}
