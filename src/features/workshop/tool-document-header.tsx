import {ChevronDown, Download, FileJson, LoaderCircle, Save} from "lucide-react"
import {Button} from "@/components/ui/button"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {downloadFile, type DocumentTool, type ToolDocumentMap} from "./tool-documents"
export function ToolDocumentHeader({title, projectName, status, error, canWrite, persisted, onSave, onRetry, onReload, tool, document, children, exportItems, exporting = false}: {
    title: string; projectName: string; status: string; error: string; canWrite: boolean; persisted: boolean; onSave: () => void; onRetry: () => void; onReload: () => void
    tool: DocumentTool; document: ToolDocumentMap[DocumentTool]; children?: React.ReactNode; exportItems?: React.ReactNode; exporting?: boolean
}) {
    return <><header className="project-tool-header"><div><strong>{title}</strong><small>{projectName}</small></div><div className="project-tool-header-actions">
        <span role="status" className={`tool-save-status ${status}`}>{status === "loading" || status === "saving" ? <LoaderCircle className="animate-spin"/> : null}
            {!canWrite ? "View only" : status === "saved" ? persisted ? "All changes saved" : "Saved in this browser" : status === "unsaved" ? "Unsaved changes" : status === "load-error" ? "Could not load" : status === "conflict" ? "Save conflict" : status === "error" ? "Save failed" : status === "loading" ? "Loading…" : "Saving…"}</span>
        {children}
        {exportItems ? <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" disabled={exporting}>{exporting ? <LoaderCircle className="animate-spin"/> : <Download/>}{exporting ? "Exporting…" : "Export"}<ChevronDown/></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">{exportItems}<DropdownMenuSeparator/><DropdownMenuItem onSelect={() => downloadFile(JSON.stringify(document, null, 2), `${tool}-draft.json`, "application/json")}><FileJson/>Export draft (JSON)</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu> : <Button size="sm" variant="ghost" title="Download document as JSON" onClick={() => downloadFile(JSON.stringify(document, null, 2), `${tool}-draft.json`, "application/json")}><Download/> Draft</Button>}
        {canWrite && <Button size="sm" variant="secondary" disabled={["loading", "load-error", "saving", "conflict"].includes(status)} onClick={onSave}><Save/> Save</Button>}
    </div></header>
    {error && <div className="tool-document-error" role="alert"><span>{error}</span>
        {status === "conflict" ? <Button size="sm" variant="outline" onClick={onReload}>Discard draft & reload</Button> : <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>}</>
}
