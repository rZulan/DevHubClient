import {useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent} from "react"
import {Tabs} from "radix-ui"
import {Check, Database, FileCode, Palette, Plus} from "lucide-react"
import {Button} from "@/components/ui/button"
import {DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem} from "@/components/ui/dropdown-menu"
import {ErdPanel} from "./erd-panel"
import {erdSql, type ErdDocument} from "./tool-documents"
import {prepareErdSql} from "./erd-sql-editor"
import {NoteCodeTokens} from "./note-code-highlight"
import {useNoteCodeHighlight} from "./use-note-code-highlight"
import {loadNoteCodeOptions, noteCodeTheme} from "./shiki-highlighter"
import "./erd-schema-sidebar.css"

type SqlDraft = {source: string; base: string}
const sqlThemeStorageKey = "devhub.erd.sql-theme"

export function ErdSchemaSidebar({document, canEdit, collapsed, onToggle, selectedIds, onSelect, onAddTable, onApply, schemaIssues}: {
    document: ErdDocument; canEdit: boolean; collapsed: boolean; onToggle: () => void; selectedIds: string[];
    onSelect: (id: string) => void; onAddTable: () => void; onApply: (document: ErdDocument) => void; schemaIssues: string[]
}) {
    const [tab, setTab] = useState("tables"), [width, setWidth] = useState(360)
    const drag = useRef<{x: number; width: number} | null>(null)
    const [draft, setDraft] = useState<SqlDraft | null>(null)
    const [error, setError] = useState(""), [notice, setNotice] = useState("")
    const [warnings, setWarnings] = useState<string[] | null>(null)
    const [sqlTheme, setSqlTheme] = useState(() => {
        try {return localStorage.getItem(sqlThemeStorageKey) || noteCodeTheme.id}
        catch {return noteCodeTheme.id}
    })
    const generated = useMemo(() => {
        try {return {source: erdSql(document), error: ""}}
        catch (failure) {return {source: "", error: failure instanceof Error ? failure.message : "Resolve the schema issues to generate SQL."}}
    }, [document])
    const version = generated.error ? JSON.stringify({dialect: document.dialect, tables: document.tables.map(({x: _x, y: _y, ...table}) => table), relationships: document.relationships}) : generated.source
    const dirty = !!draft, stale = !!draft && draft.base !== version
    const source = draft?.source ?? generated.source
    const resizeLimit = () => Math.min(640, Math.floor(window.innerWidth / 2))
    const resize = (next: number) => setWidth(Math.max(280, Math.min(resizeLimit(), next)))

    useEffect(() => {
        if (!dirty) return
        const leaving = (event: BeforeUnloadEvent) => event.preventDefault()
        window.addEventListener("beforeunload", leaving)
        return () => window.removeEventListener("beforeunload", leaving)
    }, [dirty])

    function change(next: string) {
        setDraft(next === generated.source ? null : {source: next, base: draft?.base ?? version})
        setError(""); setNotice(""); setWarnings(null)
    }
    function apply(acceptWarnings = false) {
        if (!canEdit || !draft || stale) return
        setError(""); setNotice("")
        try {
            const result = prepareErdSql(source, document)
            if (result.warnings.length && !acceptWarnings) {setWarnings(result.warnings); return}
            onApply(result.document)
            setDraft(null); setWarnings(null)
            setNotice(`Applied SQL · ${result.document.tables.length} ${result.document.tables.length === 1 ? "table" : "tables"}`)
        } catch (failure) {setWarnings(null); setError(failure instanceof Error ? failure.message : "Could not apply SQL.")}
    }
    function useDiagramSql() {setDraft(null); setWarnings(null); setError(""); setNotice("")}
    function changeSqlTheme(theme: string) {
        setSqlTheme(theme)
        try {localStorage.setItem(sqlThemeStorageKey, theme)} catch { /* Keep the selection for this session when storage is unavailable. */ }
    }

    return <Tabs.Root className="erd-schema-tabs" value={tab} onValueChange={setTab}>
        <ErdPanel side="left" title="Schema" className="erd-schema-sidebar" style={{"--erd-sidebar-width": `${width}px`} as CSSProperties} collapsed={collapsed} onToggle={onToggle}
            heading={<Tabs.List className="erd-schema-tab-list" aria-label="Schema views">
                <Tabs.Trigger value="tables"><Database/>Tables<span className="erd-schema-table-count">{document.tables.length}</span></Tabs.Trigger>
                <Tabs.Trigger value="sql"><FileCode/>SQL{dirty && <i aria-label="Unapplied SQL changes"/>}</Tabs.Trigger>
            </Tabs.List>}>
            <Tabs.Content value="tables" className="erd-schema-tab erd-schema-tables">
                {!!schemaIssues.length && <details className="erd-schema-issues"><summary>{schemaIssues.length} SQL export {schemaIssues.length === 1 ? "issue" : "issues"}</summary><ul>{schemaIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
                <div className="tool-layer-list erd-schema-table-list">{document.tables.map(table => <button type="button" className={selectedIds.includes(table.id) ? "active" : ""} key={table.id} onClick={() => onSelect(table.id)}><span>{table.name}</span><small>{table.fields.length}</small></button>)}</div>
                <footer className="erd-schema-table-actions"><Button size="sm" variant="secondary" disabled={!canEdit || document.tables.length >= 500} onClick={onAddTable}><Plus/>Add Table</Button></footer>
            </Tabs.Content>
            <Tabs.Content value="sql" className="erd-schema-tab erd-schema-code">
                {stale && <div className="erd-sql-conflict" role="alert">The diagram changed. Your SQL draft is kept. <button type="button" onClick={useDiagramSql}>Use current diagram SQL</button></div>}
                {generated.error && !dirty && <p className="tool-inline-error" role="alert">{generated.error}</p>}
                <SqlSourceEditor source={source} theme={sqlTheme} onThemeChange={changeSqlTheme} readOnly={!canEdit} onChange={change} onApply={() => apply(warnings !== null)}/>
                {error && <p className="erd-sql-error" role="alert">{error}</p>}
                {warnings && <details className="erd-sql-warnings" open><summary>Review SQL notes before applying</summary><ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
                {notice && <p className="erd-sql-notice" role="status">{notice}</p>}
                <footer className="erd-schema-table-actions">
                    <Button size="sm" disabled={!canEdit || !dirty || stale} onClick={() => apply(warnings !== null)}><Check/>{warnings ? "Apply with notes" : "Apply SQL"}</Button>
                </footer>
            </Tabs.Content>
        <div className="erd-schema-resizer" role="separator" tabIndex={0} aria-label="Resize schema sidebar" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={resizeLimit()} aria-valuenow={Math.min(width, resizeLimit())}
            onPointerDown={event => {if (event.button !== 0) return; event.preventDefault(); drag.current = {x: event.clientX, width: event.currentTarget.closest("aside")!.getBoundingClientRect().width}; event.currentTarget.setPointerCapture(event.pointerId)}}
            onPointerMove={event => {if (drag.current) resize(drag.current.width + event.clientX - drag.current.x)}}
            onPointerUp={event => {drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)}}
            onPointerCancel={() => {drag.current = null}} onLostPointerCapture={() => {drag.current = null}}
            onKeyDown={event => {if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); resize(event.key === "Home" ? 280 : event.key === "End" ? resizeLimit() : width + (event.key === "ArrowRight" ? 24 : -24))}}/>
        </ErdPanel>
    </Tabs.Root>
}

function SqlSourceEditor({source, theme, onThemeChange, readOnly, onChange, onApply}: {source: string; theme: string; onThemeChange: (theme: string) => void; readOnly: boolean; onChange: (source: string) => void; onApply: () => void}) {
    const input = useRef<HTMLTextAreaElement>(null), pre = useRef<HTMLPreElement>(null)
    const caret = useRef<number | null>(null)
    const [themes, setThemes] = useState<Awaited<ReturnType<typeof loadNoteCodeOptions>>["themes"] | null>(null)
    const [themeLoadError, setThemeLoadError] = useState(false)
    const deferred = useDeferredValue(source)
    const selectedTheme = themes && !themes.some(item => item.id === theme) ? noteCodeTheme.id : theme
    const {tokens, palette} = useNoteCodeHighlight(deferred, source.length > 100_000 ? undefined : "sql", selectedTheme)
    useEffect(() => {
        let current = true
        void loadNoteCodeOptions().then(options => {if (current) setThemes(options.themes)}, () => {if (current) setThemeLoadError(true)})
        return () => {current = false}
    }, [])
    useEffect(() => {
        if (caret.current !== null && input.current) {input.current.setSelectionRange(caret.current, caret.current); caret.current = null}
    }, [source])
    function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        // Keep the document's existing save shortcut available.
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") return
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {event.preventDefault(); event.stopPropagation(); onApply()}
        if (event.key === "Tab" && !event.shiftKey && !readOnly) {
            event.preventDefault()
            const {selectionStart: start, selectionEnd: end} = event.currentTarget
            caret.current = start + 2; onChange(source.slice(0, start) + "  " + source.slice(end))
        }
    }
    return <>
        {themeLoadError && <p className="erd-sql-notice" role="status">Editor themes could not load. Your SQL is still available.</p>}
        <div className="erd-sql-source" data-theme={palette.id} style={{background: palette.background, color: palette.foreground, colorScheme: palette.type, "--erd-sql-ink": palette.foreground, "--erd-sql-paper": palette.background} as CSSProperties}>
        <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className="erd-sql-theme-button" aria-label="SQL editor theme" title={`Theme: ${palette.label}`} disabled={!themes}><Palette size={16}/></button></DropdownMenuTrigger>
            <DropdownMenuContent className="erd-sql-theme-menu" align="end">
                <DropdownMenuLabel>Editor theme</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={selectedTheme} onValueChange={onThemeChange}>
                    {themes?.map(item => <DropdownMenuRadioItem key={item.id} value={item.id}>{item.label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
        <pre ref={pre} aria-hidden="true"><code><NoteCodeTokens tokens={deferred === source ? tokens : null} source={source}/>{"\n"}</code></pre>
        <textarea ref={input} aria-label="SQL schema" readOnly={readOnly} value={source} placeholder={'CREATE TABLE "users" (\n  "id" UUID NOT NULL PRIMARY KEY\n);'} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" maxLength={4_000_000} onKeyDown={keyDown} onChange={event => onChange(event.target.value)}
            onScroll={event => {if (pre.current) {pre.current.scrollTop = event.currentTarget.scrollTop; pre.current.scrollLeft = event.currentTarget.scrollLeft}}}/>
        </div>
    </>
}
