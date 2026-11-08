import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {workshopToast} from "./workshop-toast-store"
import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useId, useImperativeHandle, useRef, useState, type Ref} from "react"
import {FileUp, LoaderCircle} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import {importErdFile, maxErdImportBytes, type ErdImportResult} from "./erd-import"
import {erdDialects, erdDialectLabels, type ErdDialect, type ErdDocument} from "./tool-documents"

export type ErdImportDialogHandle = {openFile: (file: File) => void}

export function ErdImportDialog({canEdit, tableCount, dialect, onImport, ref}: {canEdit: boolean; tableCount: number; dialect: ErdDialect; onImport: (document: ErdDocument) => void; ref?: Ref<ErdImportDialogHandle>}) {
    const [sqlDialect, setSqlDialect] = useState(dialect)
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("")
    const [result, setResult] = useState<ErdImportResult>(), [file, setFile] = useState<File>()
    const generation = useRef(0)
    const fileInput = useRef<HTMLInputElement>(null)
    const filenameId = useId()
    function changeOpen(next: boolean) {
        generation.current++; setOpen(next); setBusy(false); setResult(undefined); setError(""); setFile(undefined)
        if (next) setSqlDialect(dialect)
    }
    async function selectFile(file: File | undefined, targetDialect = sqlDialect) {
        const currentGeneration = ++generation.current
        setResult(undefined); setError(""); setFile(file); setBusy(!!file)
        if (!file) return
        try {
            if (file.size > maxErdImportBytes) throw new Error("Choose an ERD file smaller than 4 MB.")
            const source = await file.text()
            if (generation.current === currentGeneration) setResult(importErdFile(source, file.name, targetDialect))
        } catch (failure) {if (generation.current === currentGeneration) setError(failure instanceof Error ? failure.message : "The file could not be read.")}
        finally {if (generation.current === currentGeneration) setBusy(false)}
    }
    useImperativeHandle(ref, () => ({openFile(file) {
        if (!canEdit) return
        changeOpen(true)
        void selectFile(file, dialect)
    }}))
    return <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button size="sm" variant="ghost" disabled={!canEdit}><FileUp/> Import</Button></DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Import ERD</DialogTitle><DialogDescription>Choose a .sql schema or a .json ERD draft to replace this diagram.</DialogDescription></DialogHeader>
            <WorkshopToast variant="warning" title="Replace current ERD" duration={Infinity}><strong>This will override the current ERD.</strong> All current tables, columns and relationships{tableCount ? ` (${tableCount} tables)` : ""} will be replaced and saved to this project. Download your draft first if you want a separate backup. You can also undo the import in this session.</WorkshopToast>
            <label className="erd-import-file">SQL database target<WorkshopSelect aria-label="SQL import database" value={sqlDialect} disabled={busy} onValueChange={selectedValue => {
                const targetDialect = selectedValue as ErdDialect
                setSqlDialect(targetDialect)
                void selectFile(file, targetDialect)
            }}>{erdDialects.map(value => <option key={value} value={value}>{erdDialectLabels[value]}</option>)}</WorkshopSelect></label>
            <div className="erd-import-file">
                <span>SQL schema or JSON draft</span>
                <input ref={fileInput} type="file" hidden accept=".sql,.json,application/json" disabled={busy || !canEdit} onChange={event => {
                    const chosen = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    if (chosen) void selectFile(chosen)
                }}/>
                <div className="erd-import-file-picker">
                    <Button type="button" size="sm" variant="outline" className="shrink-0" aria-describedby={filenameId} disabled={busy || !canEdit} onClick={() => fileInput.current?.click()}>Choose file</Button>
                    <span id={filenameId} className="min-w-0 truncate" title={file?.name}>{file?.name ?? "No file chosen"}</span>
                </div>
            </div>
            {busy && <p className="erd-import-reading" role="status"><LoaderCircle className="animate-spin"/> Reading file…</p>}
            {error && <WorkshopToast variant="error" onDismiss={() => setError("")}>{error}</WorkshopToast>}
            {result && <div className="erd-import-preview"><p>{result.document.tables.length} {result.document.tables.length === 1 ? "table" : "tables"} · {result.document.relationships.length} {result.document.relationships.length === 1 ? "relationship" : "relationships"}</p>
                {result.warnings.length > 0 && <WorkshopToast variant="info" title="Import notes" duration={Infinity}><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></WorkshopToast>}
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => changeOpen(false)}>Cancel</Button><Button disabled={!result || busy || !canEdit} onClick={() => {if (result && canEdit) {onImport(result.document); workshopToast.success(`Imported ${result.document.tables.length} tables and ${result.document.relationships.length} relationships.`, {title: "ERD imported"}); changeOpen(false)}}}>Replace current ERD</Button></DialogFooter>
        </DialogContent>
    </Dialog>
}
