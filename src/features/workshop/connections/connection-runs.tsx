import {useState} from "react"
import {History, RefreshCw} from "lucide-react"
import {Button} from "@/components/ui/button"
import {useConnectionRunsQuery, useListConnectionsQuery, type ConnectionRun, type ConnectionScope} from "./connections-api"
import {ConnectionLoadError} from "./connection-load-error"
import {findNode} from "./connections-model"

const formatter = new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"})
const labelFor = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("-", " ").replace(/^./, first => first.toUpperCase())

function RunDetail({run, open, sourceLabel}: {run: ConnectionRun; open: boolean; sourceLabel: string}) {
    return <details className="connection-run" open={open || undefined}>
        <summary><span><strong>{run.ruleTitle}</strong><small>{labelFor(run.event)} · {sourceLabel}</small></span>
            <span className="connection-run-meta"><span>{labelFor(run.status)}</span><time dateTime={run.occurredAtUtc}>{formatter.format(new Date(run.occurredAtUtc))}</time></span></summary>
        <div className="connection-run-body">{run.detail && <p>{run.detail}</p>}
            {run.steps.length > 0 && <ol>{run.steps.map(step => <li key={step.actionId}>
                <div><strong>{step.label}</strong><span>{labelFor(step.status)}</span></div>{step.detail && <p>{step.detail}</p>}
            </li>)}</ol>}
        </div>
    </details>
}

export function ConnectionRuns({scope, connectionId, focusId, onFilter}: {
    scope: ConnectionScope; connectionId?: string; focusId?: string; onFilter: (connectionId: string | null) => void
}) {
    const [page, setPage] = useState(1)
    const connections = useListConnectionsQuery(scope)
    const query = useConnectionRunsQuery({...scope, connectionId, page}, {pollingInterval: 10000})
    const items = query.currentData
    const available = connections.currentData ?? []
    if (query.isError && !items) return <ConnectionLoadError error={query.error} fallback="Could not load run history." retry={() => void query.refetch()}/>
    return <section className="connection-runs-list">
        <div className="connection-section-title"><h3><History aria-hidden="true"/> Runs</h3>
            <div className="connection-row">
                <select aria-label="Filter runs by connection" value={connectionId ?? ""} onChange={event => {setPage(1); onFilter(event.target.value || null)}}>
                    <option value="">All connections</option>
                    {connectionId && !available.some(connection => connection.id === connectionId) && <option value={connectionId}>Selected connection</option>}
                    {available.map(connection => <option key={connection.id} value={connection.id}>{connection.title}</option>)}
                </select>
                <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw/>Refresh</Button>
            </div>
        </div>
        {query.isError && <ConnectionLoadError error={query.error} fallback="Could not refresh run history."/>}
        {!items && query.isFetching && <p className="connection-muted" role="status">Loading runs…</p>}
        {items?.length === 0 && <p className="connection-muted">No runs on this page.</p>}
        {items?.map(run => <RunDetail key={run.id} run={run} open={run.id === focusId}
            sourceLabel={findNode(available.find(connection => connection.id === run.connectionId)?.nodes ?? [], run.source)?.label ?? labelFor(run.source.kind)}/>)}
        {(page > 1 || (items?.length ?? 0) >= 50) && <div className="connection-row">
            <Button type="button" variant="outline" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="connection-muted">Page {page}</span>
            <Button type="button" variant="outline" size="sm" disabled={(items?.length ?? 0) < 50 || query.isFetching} onClick={() => setPage(page + 1)}>Next</Button>
        </div>}
    </section>
}
