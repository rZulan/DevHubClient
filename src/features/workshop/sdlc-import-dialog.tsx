import {useRef, useState} from "react"
import {FileUp, FolderCheck} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {normalizeSdlcDocument, validSdlcDocument, type SdlcDocument} from "./sdlc-document"
import {sdlcStoredModels} from "./sdlc-work"
import {sdlcModels} from "./sdlc-models"

export function SdlcImportDialog({document, canEdit, onImport}: {document: SdlcDocument; canEdit: boolean; onImport: (document: SdlcDocument) => void}) {
    const input = useRef<HTMLInputElement>(null), latest = useRef(document); latest.current = document
    const [draft, setDraft] = useState<{document: SdlcDocument; name: string; baseline: string} | null>(null), [error, setError] = useState("")
    async function read(file?: File) {
        if (!file || !canEdit) return
        setError("")
        try {
            if (file.size > 4000000) throw new Error("Choose a roadmap JSON draft smaller than 4 MB.")
            const value = JSON.parse(await file.text())
            if (!validSdlcDocument(value)) throw new Error("This file is not a valid SDLC roadmap draft. Check its phases, dates, and history.")
            setDraft({document: normalizeSdlcDocument(value), name: file.name, baseline: JSON.stringify(latest.current)})
        } catch (failure) {setError(failure instanceof Error ? failure.message : "Could not read this roadmap.")}
        finally {if (input.current) input.current.value = ""}
    }
    const changed = draft && draft.baseline !== JSON.stringify(document), models = draft ? sdlcStoredModels(draft.document) : []
    return <><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => input.current?.click()} title="Restore an exported roadmap JSON draft"><FileUp/>Import</Button><input ref={input} type="file" hidden accept=".json,application/json" aria-label="Import roadmap draft" onChange={event => void read(event.target.files?.[0])}/>
        {error && <Dialog open onOpenChange={open => {if (!open) setError("")}}><DialogContent><DialogHeader><DialogTitle>Could not import roadmap</DialogTitle><DialogDescription>{error}</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setError("")}>Close</Button></DialogFooter></DialogContent></Dialog>}
        <Dialog open={!!draft} onOpenChange={open => {if (!open) setDraft(null)}}><DialogContent className="sdlc-review-dialog"><DialogHeader><DialogTitle>Restore roadmap draft</DialogTitle><DialogDescription>Review the draft before replacing this project’s roadmap. You can undo the import.</DialogDescription></DialogHeader>
            {draft && <><div className="sdlc-import-summary"><FolderCheck/><div><strong>{draft.name}</strong><span>{sdlcModels[draft.document.model].title} · {draft.document.completed ? "Completed" : "In progress"}</span></div></div><ul>{models.map(model => {const state = model === draft.document.model ? draft.document : draft.document.modelStates![model]!; return <li key={model}><span>{sdlcModels[model].title}</span><small>{state.history?.length ?? 0} archived cycles · {Object.values(state.notes).filter(Boolean).length} phase notes</small></li>})}</ul><p className="sdlc-import-warning">This replaces the active model, saved models, phase tracking, and cycle history.</p>{changed && <p role="alert" className="sdlc-import-warning">The roadmap changed after you opened this draft. Close this dialog and choose the file again to review the latest version.</p>}</>}
            <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!canEdit || !!changed} onClick={() => {if (draft && draft.baseline === JSON.stringify(latest.current)) {onImport(draft.document); setDraft(null)}}}>Restore roadmap</Button></DialogFooter>
        </DialogContent></Dialog>
    </>
}
