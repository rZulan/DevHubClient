import {useRef, useState} from "react"
import {Download, FileArchive, FileText, FolderOpen, LoaderCircle, Upload} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {createClientId} from "@/lib/create-client-id"
import {downloadFile} from "./tool-documents"
import {wikiLimits, wikiSlug, type WikiDocument, type WikiPage} from "./wiki-document"
import {exportWikiZip, importWikiZip, maxWikiArchiveBytes, maxWikiMarkdownBytes, readWikiMarkdown} from "./wiki-files"

type MarkdownPage = Pick<WikiPage, "title" | "body">
type ImportFile = {kind: "page"; page: MarkdownPage} | {kind: "zip"; wiki: WikiDocument; reviewed: WikiDocument}

export function WikiFileActions({document, page, projectName, userId, canWrite, canImport, open, onOpenChange, onExportPage, onImportPage, onImportWiki}: {
    document: WikiDocument
    page?: WikiPage
    projectName: string
    userId: string
    canWrite: boolean
    canImport: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
    onExportPage: (page: WikiPage) => void
    onImportPage: (page: MarkdownPage) => void
    onImportWiki: (wiki: WikiDocument, reviewed: WikiDocument) => void
}) {
    const [reading, setReading] = useState(false)
    const [fileName, setFileName] = useState("")
    const [file, setFile] = useState<ImportFile>()
    const [error, setError] = useState("")
    const input = useRef<HTMLInputElement>(null)
    const filesButton = useRef<HTMLButtonElement>(null)
    const openingImport = useRef(false)
    const readVersion = useRef(0)

    function changeOpen(next: boolean) {
        readVersion.current++
        onOpenChange(next)
        setReading(false)
        setFileName("")
        setFile(undefined)
        setError("")
    }

    async function selectFile(selected: File) {
        const version = ++readVersion.current
        const reviewed = document
        setFileName(selected.name)
        setFile(undefined)
        setError("")
        setReading(true)
        try {
            let result: ImportFile
            if (/\.zip$/i.test(selected.name)) {
                if (selected.size > maxWikiArchiveBytes) throw new Error("The ZIP file is too large.")
                const wiki = importWikiZip(new Uint8Array(await selected.arrayBuffer()), reviewed, userId, new Date().toISOString(), createClientId)
                result = {kind: "zip", wiki, reviewed}
            } else if (/\.(md|markdown)$/i.test(selected.name)) {
                if (reviewed.pages.length >= wikiLimits.pages) throw new Error(`This wiki has reached its ${wikiLimits.pages}-page limit.`)
                if (selected.size > maxWikiMarkdownBytes) throw new Error("The Markdown file is too large.")
                result = {kind: "page", page: readWikiMarkdown(await selected.text(), selected.name)}
            } else {
                throw new Error("Choose a Markdown or ZIP file.")
            }
            if (version === readVersion.current) setFile(result)
        } catch (failure) {
            if (version === readVersion.current) setError(failure instanceof Error && !("code" in failure) ? failure.message : "Could not read this file.")
        } finally {
            if (version === readVersion.current) setReading(false)
        }
    }

    function importFile() {
        if (!canImport || !file || reading) return
        try {
            if (file.kind === "page") onImportPage(file.page)
            else onImportWiki(file.wiki, file.reviewed)
            changeOpen(false)
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Could not import this file.")
        }
    }

    if (!canWrite && !document.pages.length) return null
    const replacing = file?.kind === "zip" && file.reviewed.pages.length > 0

    return <>
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button ref={filesButton} type="button" variant="outline" size="sm" className="wiki-files-trigger" aria-label="Wiki files" title="Wiki files">
                    <FolderOpen aria-hidden="true"/><span>Files</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48" onCloseAutoFocus={event => {
                if (openingImport.current) {
                    event.preventDefault()
                    openingImport.current = false
                }
            }}>
                {canWrite && <DropdownMenuItem disabled={!canImport} onSelect={() => {openingImport.current = true; changeOpen(true)}}>
                    <Upload/>Import Markdown or ZIP
                </DropdownMenuItem>}
                <DropdownMenuItem disabled={!page} onSelect={() => {if (page) onExportPage(page)}}>
                    <FileText/>Export page (.md)
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!document.pages.length} onSelect={() => downloadFile(exportWikiZip(document), `${wikiSlug(projectName)}-wiki.zip`, "application/zip")}>
                    <Download/>Export wiki (.zip)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" onCloseAutoFocus={event => {
                event.preventDefault()
                filesButton.current?.focus()
            }}>
                <DialogHeader>
                    <DialogTitle>Import into wiki</DialogTitle>
                    <DialogDescription>Choose a Markdown page or a ZIP with one Markdown file per page folder.</DialogDescription>
                </DialogHeader>
                <div className="flex min-w-0 items-center gap-3">
                    <input ref={input} type="file" hidden accept=".md,.markdown,.zip,text/markdown,application/zip" onChange={event => {
                        const selected = event.currentTarget.files?.[0]
                        event.currentTarget.value = ""
                        if (selected) void selectFile(selected)
                    }}/>
                    <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={!canImport || reading}>Choose file</Button>
                    {fileName && <span className="truncate text-muted-foreground" title={fileName}>{fileName}</span>}
                </div>
                {reading && <p role="status" className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin"/>Reading file…</p>}
                {file?.kind === "page" && <p className="flex items-center gap-2"><FileText className="size-4 shrink-0"/><span className="wrap-anywhere">{file.page.title}</span></p>}
                {file?.kind === "zip" && <div>
                    <p className="flex items-center gap-2"><FileArchive className="size-4"/>{file.wiki.pages.length} {file.wiki.pages.length === 1 ? "page" : "pages"}</p>
                    {replacing && <p className="mt-2 text-muted-foreground">This replaces all current pages and their revision history.</p>}
                </div>}
                {error && <p role="alert" className="wrap-anywhere text-destructive">{error}</p>}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
                    <Button type="button" variant={replacing ? "destructive" : "default"} onClick={importFile} disabled={!file || reading || !canImport}>
                        {file?.kind === "page" ? "Review page" : replacing ? "Replace wiki" : "Import wiki"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
}
