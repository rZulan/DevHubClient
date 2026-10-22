import {Database} from "lucide-react"
import type {ErdTable} from "./tool-documents"

/** One static painted pattern replaces hundreds of unreadable field elements. */
export function ErdTableOverview({table}: {table: ErdTable}) {
    return <div className="erd-table-card erd-table-overview" role="img" aria-label={`${table.name}, ${table.fields.length} columns. Zoom in or select the table to see columns.`}>
        <article className="erd-table"><header><Database/><strong>{table.name}</strong><small>{table.fields.length} columns</small></header>
            {!!table.fields.length && <div className="erd-column-skeleton" aria-hidden="true"/>}
        </article>
    </div>
}
