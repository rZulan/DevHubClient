import {useState} from "react"
import {BookOpen, Filter, Play, Zap} from "lucide-react"
import {Input} from "@/components/ui/input"
import {useConnectionCatalogQuery, type ConnectionChoice, type ConnectionScope} from "./connections-api"
import {ConnectionLoadError} from "./connection-load-error"
import {nodeTool, toolLabels} from "./connections-model"

function CapabilitiesList({title, choices, icon: Icon}: {title: string; choices: ConnectionChoice[]; icon: typeof Zap}) {
    return <section className="connection-catalog-column"><h4><Icon aria-hidden="true"/>{title}</h4>
        {choices.length === 0 ? <p className="connection-muted">None available</p> : <ul>{choices.map(choice => <li key={choice.kind}>{choice.label}
            {choice.fields.length > 0 && <small>{choice.fields.map(field => field.required ? `${field.label} (required)` : field.label).join(" · ")}</small>}
        </li>)}</ul>}
    </section>
}

export function ConnectionCatalog({scope}: {scope: ConnectionScope}) {
    const query = useConnectionCatalogQuery(scope)
    const [search, setSearch] = useState("")
    const searchKey = search.trim().toLocaleLowerCase()
    const items = query.currentData?.filter(item => !searchKey || [item.label, item.tool, toolLabels[nodeTool(item.nodeKind)],
        ...[...item.eventChoices, ...item.conditionChoices, ...item.actionChoices].map(choice => choice.label)]
        .some(value => value?.toLocaleLowerCase().includes(searchKey)))

    if (query.isError) return <ConnectionLoadError error={query.error} fallback="Could not load the capability catalog." retry={() => void query.refetch()}/>
    if (!items) return <p className="connection-muted" role="status">Loading catalog…</p>
    return <section className="connection-catalog">
        <div className="connection-section-title"><h3><BookOpen aria-hidden="true"/> Available capabilities</h3>
            <Input aria-label="Search capabilities" value={search} placeholder="Search tools, nodes, and capabilities" onChange={event => setSearch(event.target.value)}/></div>
        {!items.length && <p className="connection-muted">No matching capabilities.</p>}
        {items.map(item => <details key={item.nodeKind} className="connection-catalog-item">
            <summary><strong>{item.label}</strong><span>{toolLabels[nodeTool(item.nodeKind)] ?? item.tool}</span></summary>
            <div className="connection-catalog-grid">
                <CapabilitiesList title="Events" choices={item.eventChoices} icon={Zap}/>
                <CapabilitiesList title="Conditions" choices={item.conditionChoices} icon={Filter}/>
                <CapabilitiesList title="Actions" choices={item.actionChoices} icon={Play}/>
            </div>
        </details>)}
    </section>
}
