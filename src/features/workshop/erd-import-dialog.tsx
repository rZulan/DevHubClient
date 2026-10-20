import {useRef, useState} from "react"
import {AlertTriangle, FileUp, LoaderCircle} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import {importErdFile, maxErdImportBytes, type ErdImportResult} from "./erd-import"
import {erdDialects, erdDialectLabels, type ErdDialect, type ErdDocument} from "./tool-documents"

export function ErdImportDialog({canEdit, tableCount, dialect, onImport}: {canEdit: boolean; tableCount: number; dialect: ErdDialect; onImport: (document: ErdDocument) => void}) {
    const [sqlDialect, setSqlDialect] = useState(dialect)
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("")
    const [result, setResult] = useState<ErdImportResult>(), [filename, setFilename] = useState("")
    const generation = useRef(0)
    function changeOpen(next: boolean) {
        generation.current++; setOpen(next); setBusy(false); setResult(undefined); setError(""); setFilename("")
        if (next) setSqlDialect(dialect)
    }
    async function selectFile(file?: File) {
        const currentGeneration = ++generation.current
        setResult(undefined); setError(""); setFilename(file?.name ?? "")
        if (!file) return
        setBusy(true)
        try {
            if (file.size > maxErdImportBytes) throw new Error("Choose an ERD file smaller than 4 MB.")
            const imported = importErdFile(await file.text(), file.name, sqlDialect)
            if (generation.current === currentGeneration) setResult(imported)
        } catch (failure) {if (generation.current === currentGeneration) setError(failure instanceof Error ? failure.message : "The file could not be read.")}
        finally {if (generation.current === currentGeneration) setBusy(false)}
    }
    return <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button size="sm" variant="ghost" disabled={!canEdit}><FileUp/> Import</Button></DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Import ERD</DialogTitle><DialogDescription>Choose a .sql schema or a .json ERD draft to replace this diagram.</DialogDescription></DialogHeader>
            <div className="erd-import-warning" role="alert"><AlertTriangle/><p><strong>This will override the current ERD.</strong> All current tables, columns and relationships{tableCount ? ` (${tableCount} tables)` : ""} will be replaced and saved to this project. Download your draft first if you want a separate backup. You can also undo the import in this session.</p></div>
            <label className="erd-import-file">SQL database target<select aria-label="SQL import database" value={sqlDialect} disabled={busy} onChange={event => {generation.current++; setSqlDialect(event.target.value as ErdDialect); setResult(undefined); setFilename(""); setError("")}}>{erdDialects.map(value => <option key={value} value={value}>{erdDialectLabels[value]}</option>)}</select></label>
            <label className="erd-import-file">SQL schema or JSON draft<input key={sqlDialect} type="file" accept=".sql,.json,application/json" disabled={busy || !canEdit} onChange={event => void selectFile(event.target.files?.[0])}/></label>
            {busy && <p className="erd-import-reading" role="status"><LoaderCircle className="animate-spin"/> Reading file…</p>}
            {error && <p className="tool-inline-error" role="alert">{error}</p>}
            {result && <div className="erd-import-preview"><strong>{filename}</strong><p>{result.document.tables.length} {result.document.tables.length === 1 ? "table" : "tables"} · {result.document.relationships.length} {result.document.relationships.length === 1 ? "relationship" : "relationships"}</p>
                {result.warnings.length > 0 && <><strong>Import notes</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></>}
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => changeOpen(false)}>Cancel</Button><Button disabled={!result || busy || !canEdit} onClick={() => {if (result && canEdit) {onImport(result.document); changeOpen(false)}}}>Replace current ERD</Button></DialogFooter>
        </DialogContent>
    </Dialog>
}
