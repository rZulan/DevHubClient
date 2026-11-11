import {useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode} from "react"
import {AlignCenter, AlignLeft, AlignRight, Bold, Check, Image, Italic, Pencil, RotateCcw, Strikethrough, Underline, Upload, X} from "lucide-react"
import {Popover} from "radix-ui"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {WorkshopSelect} from "./workshop-select"
import {ensureGoogleFont, googleFonts, isShapeFont, systemFonts} from "./shape-fonts"
import {importDashboardFont, useDashboardFontLibrary} from "./dashboard-font-library"
import {dashboardImageFit, dashboardImageFits, dashboardImageSource, prepareDashboardImage, type DashboardImageFit} from "./dashboard-image"
import {dashboardWidgetAppearanceStyle} from "./dashboard-widget-appearance"
import {dashboardEditorSelection, readDashboardEditor, selectDashboardEditorText, writeDashboardEditor} from "./dashboard-rich-text-dom"
import {cleanDashboardTextStyle, dashboardFontSizes, dashboardFormattingRange, dashboardTextRuns, dashboardTextStyle, editDashboardRowText, extraDashboardFonts, replaceDashboardRuns, resolveDashboardTextRuns, sliceDashboardRuns, type DashboardTextRow as TextRow, type DashboardTextStyle, type TextRange} from "./dashboard-text-format"
import {dashboardMemberTeams, dashboardPlaceholderValues, type DashboardDataContext} from "./dashboard-placeholders"
import {useListDashboardTodosQuery, type Todo, type TodoTask} from "./todo-api"
import type {DashboardWidget, DashboardWidgetAppearance} from "./workshop-types"

const textAlignments = [
    {value: "left", label: "Align left", icon: AlignLeft},
    {value: "center", label: "Align center", icon: AlignCenter},
    {value: "right", label: "Align right", icon: AlignRight},
] as const
type TextAlignment = (typeof textAlignments)[number]["value"]
export type DashboardWidgetSettings = {rows?: TextRow[]; teamId?: string; url?: string; alt?: string; caption?: string; captionFormat?: Omit<TextRow, "text">; fit?: DashboardImageFit}
const captionMaxLength = 250

export function dashboardWidgetStarterContent(type: DashboardWidget["type"]): string | null {
    if (type.startsWith("text-rows-")) {
        const count = Number(type.at(-1))
        const rows = [{text: "Your heading", bold: true, size: 20}, {text: "A short note goes here"}, {text: "Add another line", italic: true}]
        return JSON.stringify({rows: rows.slice(0, count)})
    }
    if (type.startsWith("image-") && type !== "image-full" && type !== "image-rounded") return JSON.stringify({caption: "Your caption"})
    return null
}

export function readDashboardWidgetSettings(content?: string | null): DashboardWidgetSettings {
    if (!content) return {}
    try {
        const data: unknown = JSON.parse(content)
        if (data && typeof data === "object" && !Array.isArray(data)) return data as DashboardWidgetSettings
    } catch { /* Older text widgets stored plain text. */ }
    return {}
}

export function useDashboardOrganizationTodos(context: DashboardDataContext, enabled: boolean) {
    const {organization, persisted} = context
    return useListDashboardTodosQuery({organizationId: organization.id, projectIds: organization.projects.map(project => project.id).sort()}, {
        skip: !enabled || !persisted, refetchOnFocus: true, refetchOnReconnect: true,
    })
}

export function todoTaskAssignedTo(task: TodoTask, userId: string) {
    return task.assigneeIds?.includes(userId) || task.assigneeId === userId
}

export function dashboardTodoFinished(todo: Todo) {
    const finished = todo.columns.at(-1)?.id ?? "done"
    return todo.tasks.length > 0 && todo.tasks.every(task => task.status === finished)
}

export function DashboardTeamSetting({context, value, onChange}: {context: DashboardDataContext; value?: string; onChange: (teamId: string) => void}) {
    const teams = dashboardMemberTeams(context)
    if (teams.length < 2) return null
    return <label className="dashboard-widget-field">Team
        <WorkshopSelect value={teams.some(team => team.id === value) ? value : ""} onValueChange={onChange}>
            <option value="">Choose a team</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </WorkshopSelect>
    </label>
}

function useWidgetPlaceholderValues(context: DashboardDataContext, content: string, teamId?: string) {
    const query = useDashboardOrganizationTodos(context, content.includes("%personal_open_task_count%"))
    const count = query.currentData?.reduce((sum, todo) => sum + todo.tasks.filter(task => task.status !== (todo.columns.at(-1)?.id ?? "done") && todoTaskAssignedTo(task, context.userId)).length, 0)
    const localCount = context.organization.tasks.filter(task => task.status !== "done" && (task.assigneeId === context.userId || task.assigneeId === "current")).length
    return dashboardPlaceholderValues(context, teamId, context.persisted ? count : localCount)
}

function rowAlignment(row: TextRow): TextAlignment {
    return row.align === "left" || row.align === "right" ? row.align : "center"
}

function displayDashboardRow(row: TextRow, values: Record<string, string>, placeholder = ""): TextRow {
    const runs = resolveDashboardTextRuns(row, values)
    return {...row, text: runs.map(run => run.text).join("") || placeholder, runs}
}

function DashboardRichText({row}: {row: TextRow}) {
    const runs = dashboardTextRuns(row)
    return <>{runs.map((run, index) => <span key={index} style={dashboardTextStyle(run)}>{run.text}</span>)}</>
}

function useDashboardTextFonts(rows: TextRow[]) {
    useEffect(() => {
        for (const row of rows) for (const run of dashboardTextRuns(row)) {
            if (isShapeFont(run.font)) ensureGoogleFont(run.font)
        }
    }, [rows])
}

export function DashboardTextFrame({rows, renderRow}: {rows: TextRow[]; renderRow?: (row: TextRow, index: number) => ReactNode}) {
    useDashboardTextFonts(rows)
    return <div className="dashboard-widget-face dashboard-text-frame" data-rows={rows.length}>
        {rows.map((row, index) => renderRow ? renderRow(row, index) : <p key={index} style={{textAlign: rowAlignment(row)}}><DashboardRichText row={row}/></p>)}
    </div>
}

const characterControls = [
    {key: "bold", label: "Bold", icon: Bold},
    {key: "italic", label: "Italic", icon: Italic},
    {key: "underline", label: "Underline", icon: Underline},
    {key: "strikethrough", label: "Strikethrough", icon: Strikethrough},
] as const

function InlineDashboardTextRow({row, label, displayRow, active, openOnDoubleClick, onOpen, onClose, onChange, maxLength, teamControl, importedFonts}: {
    row: TextRow; label: string; displayRow: TextRow; active: boolean; openOnDoubleClick?: boolean
    onOpen: () => void; onClose: () => void; onChange: (changes: Partial<TextRow>) => void
    maxLength: number; teamControl?: ReactNode; importedFonts: ReturnType<typeof useDashboardFontLibrary>
}) {
    const rowElement = useRef<HTMLDivElement>(null)
    const editor = useRef<HTMLDivElement>(null)
    const initializedEditor = useRef<HTMLDivElement>(null)
    const editButton = useRef<HTMLButtonElement>(null)
    const firstControl = useRef<HTMLButtonElement>(null)
    const fileInput = useRef<HTMLInputElement>(null)
    const restoreFocus = useRef(false)
    const lastSelection = useRef<TextRange | undefined>(undefined)
    const [selection, setSelection] = useState<TextRange>()
    const [fontNotice, setFontNotice] = useState("")
    const [importing, setImporting] = useState(false)

    function rememberSelection(range: TextRange) {
        lastSelection.current = range
        setSelection(previous => previous?.start === range.start && previous.end === range.end ? previous : range)
    }

    useLayoutEffect(() => {
        const field = editor.current
        if (active && field && initializedEditor.current !== field) {
            initializedEditor.current = field
            writeDashboardEditor(field, dashboardTextRuns(row))
            const end = row.text.length
            rememberSelection({start: end, end})
            selectDashboardEditorText(field, {start: end, end})
        } else if (!active && restoreFocus.current) {
            restoreFocus.current = false
            editButton.current?.focus({preventScroll: true})
        }
    }, [active, row])

    useEffect(() => {
        if (!active) return
        function capture() {
            const field = editor.current
            const range = field && document.activeElement === field && dashboardEditorSelection(field)
            if (range) rememberSelection(range)
        }
        document.addEventListener("selectionchange", capture)
        return () => document.removeEventListener("selectionchange", capture)
    }, [active])

    function finish() {
        restoreFocus.current = true
        onClose()
    }

    function readEdit() {
        const field = editor.current
        if (!field) return
        const runs = readDashboardEditor(field, row)
        const range = field.ownerDocument.activeElement === field ? dashboardEditorSelection(field) : undefined
        return {field, runs, text: runs.map(run => run.text).join(""), range: range ?? lastSelection.current}
    }

    function saveInput() {
        const edit = readEdit()
        if (!edit) return
        if (edit.text.length <= maxLength) {
            onChange({text: edit.text, runs: edit.runs})
            if (edit.range) rememberSelection(edit.range)
            return
        }
        const runs = sliceDashboardRuns(edit.runs, 0, maxLength)
        const end = Math.min(edit.range?.end ?? maxLength, maxLength)
        writeDashboardEditor(edit.field, runs)
        selectDashboardEditorText(edit.field, {start: end, end})
        onChange({text: runs.map(run => run.text).join(""), runs})
    }

    function insertText(value: string) {
        const edit = readEdit()
        if (!edit) return
        const range = edit.range ?? {start: edit.text.length, end: edit.text.length}
        const available = maxLength - (edit.text.length - range.end + range.start)
        const text = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").slice(0, Math.max(0, available)).replace(/[\uD800-\uDBFF]$/, "")
        if (!text) return
        const [previous] = sliceDashboardRuns(edit.runs, Math.max(0, range.start - 1), Math.max(1, range.start))
        const runs = replaceDashboardRuns(edit.runs, range, [{...cleanDashboardTextStyle(previous ?? row), text}])
        const end = range.start + text.length
        writeDashboardEditor(edit.field, runs)
        rememberSelection({start: end, end})
        selectDashboardEditorText(edit.field, {start: end, end})
        onChange({text: runs.map(run => run.text).join(""), runs})
    }

    function format(changes: DashboardTextStyle, refocus = true) {
        const edit = readEdit()
        if (!edit) return
        const target = dashboardFormattingRange(edit.text, edit.range)
        const replacement = sliceDashboardRuns(edit.runs, target.start, target.end).map(run => ({...run, ...changes}))
        const runs = replaceDashboardRuns(edit.runs, target, replacement)
        const wholeRow = target.start === 0 && target.end === edit.text.length
        onChange({text: edit.text, runs, ...(wholeRow ? changes : {})})
        writeDashboardEditor(edit.field, runs)
        const nextSelection = edit.range?.start === edit.range?.end && wholeRow ? edit.range ?? target : target
        rememberSelection(nextSelection)
        if (refocus) {
            if (edit.field.ownerDocument.activeElement === edit.field) selectDashboardEditorText(edit.field, nextSelection)
            else requestAnimationFrame(() => {
                if (editor.current === edit.field) selectDashboardEditorText(edit.field, nextSelection)
            })
        }
    }

    async function importFont(file?: File) {
        if (!file) return
        setFontNotice("")
        setImporting(true)
        try {
            const font = await importDashboardFont(file)
            setFontNotice(`Added ${font.name} to Imported fonts on this browser.`)
        } catch (error) {
            setFontNotice(error instanceof Error && !(error instanceof DOMException) ? error.message : "This browser could not store the font.")
        } finally { setImporting(false) }
    }

    const alignment = rowAlignment(row)
    const target = dashboardFormattingRange(row.text, selection)
    const selectedRuns = sliceDashboardRuns(dashboardTextRuns(row), target.start, target.end)
    const styles = selectedRuns.length ? selectedRuns : [row]
    const pressed = (key: (typeof characterControls)[number]["key"]) => styles.every(style => style[key])
    const common = <Key extends keyof DashboardTextStyle>(key: Key) => styles.every(style => style[key] === styles[0][key]) ? styles[0][key] : undefined
    const fontValue = common("font")
    const fontUnavailable = fontValue?.startsWith("dashboard-font-") && !importedFonts.some(font => font.id === fontValue)
    const anchor = active && <Popover.Anchor className="dashboard-text-toolbar-anchor" aria-hidden="true"/>
    return <Popover.Root open={active} onOpenChange={open => {if (!open) onClose()}}>
        {!openOnDoubleClick && anchor}
        <div ref={rowElement} className="dashboard-text-inline" data-dashboard-text-editor style={{textAlign: alignment}}>
            {openOnDoubleClick && anchor}
            {active ? <div ref={editor} contentEditable="plaintext-only" role="textbox" aria-multiline="true" aria-label={`${label} text`}
                           className="dashboard-text-editable" data-empty={!row.text || undefined} data-placeholder={`Enter ${label.toLowerCase()} text`}
                           onInput={event => { if (!(event.nativeEvent as InputEvent).isComposing) saveInput() }}
                           onCompositionEnd={saveInput}
                           onPaste={event => {event.preventDefault(); insertText(event.clipboardData.getData("text/plain"))}}
                           onDrop={event => {event.preventDefault(); insertText(event.dataTransfer.getData("text/plain"))}}
                           onKeyDown={event => {
                               if (event.nativeEvent.isComposing) return
                               if (event.key === "Tab" && !event.shiftKey && firstControl.current) {
                                   event.preventDefault()
                                   firstControl.current.focus()
                               } else if (event.key === "Enter") {
                                   event.preventDefault()
                                   insertText("\n")
                               } else if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
                                   const control = characterControls.find(control => control.key[0] === event.key.toLowerCase() && control.key !== "strikethrough")
                                   if (control) { event.preventDefault(); format({[control.key]: !pressed(control.key)}) }
                               }
                           }}/> : <button ref={editButton} type="button" aria-label={`Edit ${label.toLowerCase()}: ${displayRow.text}`}
                                title={openOnDoubleClick ? `Double-click to edit ${label.toLowerCase()}` : undefined}
                                onClick={event => { if (!openOnDoubleClick || event.detail === 0) onOpen() }}
                                onDoubleClick={openOnDoubleClick ? onOpen : undefined}><DashboardRichText row={displayRow}/></button>}
        </div>
        <Popover.Portal>
            <Popover.Content className="dashboard-text-toolbar" role="group" aria-label={`${label} formatting`} data-dashboard-text-editor
                             side="top" align="start" sideOffset={7} collisionPadding={8}
                             onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
                             onInteractOutside={event => {
                                 if (event.target instanceof Node && rowElement.current?.contains(event.target)) event.preventDefault()
                             }} onEscapeKeyDown={event => {
                                 event.preventDefault()
                                 finish()
                             }}>
                <div className="dashboard-text-toolbar-buttons" role="group" aria-label="Text style">
                    {characterControls.map(({key, label, icon: Icon}) =>
                        <Button key={key} ref={key === "bold" ? firstControl : undefined} type="button" size="icon-xs" variant="ghost"
                                title={label} aria-label={label} aria-pressed={pressed(key)} onMouseDown={event => event.preventDefault()}
                                onKeyDown={event => {
                                    if (key === "bold" && event.key === "Tab" && event.shiftKey) {
                                        event.preventDefault()
                                        editor.current?.focus()
                                    }
                                }} onClick={() => format({[key]: !pressed(key)})}><Icon aria-hidden="true"/></Button>)}
                </div>
                <div className="dashboard-text-toolbar-buttons" role="group" aria-label="Text alignment">
                    {textAlignments.map(({value, label, icon: Icon}) =>
                        <Button key={value} type="button" size="icon-xs" variant="ghost" title={label} aria-label={label}
                                aria-pressed={alignment === value} onMouseDown={event => event.preventDefault()}
                                onClick={() => onChange({align: value})}><Icon aria-hidden="true"/></Button>)}
                </div>
                <WorkshopSelect aria-label="Font size" value={String(common("size") ?? 16)} onValueChange={value => format({size: Number(value)})}>
                    {dashboardFontSizes.map(size => <option key={size} value={size}>{size} px</option>)}
                </WorkshopSelect>
                <WorkshopSelect aria-label="Font family" value={fontValue ?? "default"} onValueChange={value => format({font: value === "default" ? undefined : value})}>
                    <option value="default">Default</option><option value="serif">Serif</option><option value="mono">Monospace</option>
                    {[...systemFonts, ...Object.keys(extraDashboardFonts), ...googleFonts].map(font => <option key={font} value={font}>{font}</option>)}
                    {importedFonts.map(font => <option key={font.id} value={font.id}>{font.name} (imported)</option>)}
                    {fontUnavailable && <option value={fontValue} disabled>Imported font unavailable</option>}
                </WorkshopSelect>
                <div className="dashboard-text-toolbar-buttons" role="group" aria-label="Text color">
                    <input aria-label="Text color" title="Text color" type="color" className="dashboard-text-color"
                           value={common("color") ?? (typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "#f4f4f5" : "#171717")}
                           onChange={event => format({color: event.target.value}, false)}/>
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="Reset text color" title="Reset text color"
                            onMouseDown={event => event.preventDefault()} onClick={() => format({color: undefined})}><RotateCcw aria-hidden="true"/></Button>
                </div>
                <input ref={fileInput} type="file" hidden accept=".woff2,.woff,.otf,.ttf" onChange={event => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    void importFont(file)
                }}/>
                <Button type="button" size="icon-xs" variant="ghost" aria-label="Import font file" title="Import a font file to this browser"
                        disabled={importing} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true"/></Button>
                <Button type="button" size="icon-xs" variant="ghost" aria-label={`Finish editing ${label.toLowerCase()}`} title="Done" onClick={finish}><Check aria-hidden="true"/></Button>
                {fontNotice && <small className="dashboard-text-font-notice" role="status">{fontNotice}</small>}
                {teamControl}
            </Popover.Content>
        </Popover.Portal>
    </Popover.Root>
}

function DashboardInlineTextEditor({rows, displayRows, maxLength, changeRow, teamControl, importedFonts}: {
    rows: TextRow[]; displayRows: TextRow[]; maxLength: number
    changeRow: (index: number, changes: Partial<TextRow>) => void; teamControl?: ReactNode
    importedFonts: ReturnType<typeof useDashboardFontLibrary>
}) {
    const [activeRow, setActiveRow] = useState<number>()
    return <DashboardTextFrame rows={displayRows} renderRow={(displayRow, index) =>
        <InlineDashboardTextRow key={index} row={rows[index]} label={`Row ${index + 1}`} displayRow={displayRow} active={activeRow === index}
                                onOpen={() => setActiveRow(index)} onClose={() => setActiveRow(current => current === index ? undefined : current)}
                                onChange={changes => changeRow(index, changes)} maxLength={maxLength} teamControl={teamControl} importedFonts={importedFonts}/>}/>
}

export function DashboardTextWidget({widget, context, editing, onContentChange}: {
    widget: DashboardWidget; context: DashboardDataContext; editing: boolean; onContentChange: (value: string) => void
}) {
    const count = widget.type === "text" ? 1 : Number(widget.type.at(-1))
    const settings = readDashboardWidgetSettings(widget.content)
    const rows = Array.from({length: count}, (_, index): TextRow => {
        const saved = Array.isArray(settings.rows) ? settings.rows[index] : undefined
        if (saved && typeof saved.text === "string") return saved
        return {text: widget.type === "text" && !settings.rows ? widget.content ?? "" : ""}
    })
    const combined = rows.map(row => row.text).join("\n")
    const values = useWidgetPlaceholderValues(context, combined, settings.teamId)
    const update = (changes: DashboardWidgetSettings) => onContentChange(JSON.stringify({...settings, rows, ...changes}))
    function changeRow(index: number, changes: Partial<TextRow>) {
        update({rows: rows.map((row, i) => i === index ? {...row, ...changes} : row)})
    }
    const importedFonts = useDashboardFontLibrary()
    const displayRows = rows.map((row, index) => displayDashboardRow(row, values, editing && !row.text ? `Row ${index + 1}` : ""))
    if (!editing) return <DashboardTextFrame rows={displayRows}/>
    return <DashboardInlineTextEditor rows={rows} displayRows={displayRows} maxLength={widget.type === "text" ? 2000 : 250} changeRow={changeRow} importedFonts={importedFonts}
        teamControl={combined.includes("%personal_team_") && <DashboardTeamSetting context={context} value={settings.teamId} onChange={teamId => update({teamId})}/>}/>
}

export function DashboardImageFrame({variant, url, alt = "", caption, fit = "cover"}: {
    variant: string; url?: string; alt?: string; caption: ReactNode; fit?: DashboardImageFit
}) {
    const [failedUrl, setFailedUrl] = useState<string>()
    const showImage = url && failedUrl !== url
    return <div className="dashboard-widget-face dashboard-image-frame" data-frame={variant}>
        <div className="dashboard-image-media">{showImage ? <img src={url} alt={alt} style={{objectFit: fit}} loading="lazy" draggable={false} onError={() => setFailedUrl(url)}/> : <>
            <svg className="dashboard-image-placeholder" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect width="320" height="180" fill="currentColor" opacity=".08"/>
                <circle cx="239" cy="49" r="21" fill="currentColor" opacity=".38"/>
                <path d="M0 155 78 72l53 56 55-73 134 125H0z" fill="currentColor" opacity=".24"/>
                <path d="m0 177 100-50 50 33 61-39 109 59H0z" fill="currentColor" opacity=".32"/>
            </svg>
            {url && <span><Image aria-hidden="true"/>Image unavailable</span>}
        </>}</div>
        {variant !== "full" && <div className="dashboard-image-caption">{caption}</div>}
    </div>
}

function imageCaptionRow({caption, captionFormat}: DashboardWidgetSettings): TextRow {
    return {...captionFormat, text: typeof caption === "string" ? caption : ""}
}

function imageCaptionSettings({text, ...captionFormat}: TextRow) {
    return {caption: text, captionFormat}
}

function DashboardCaptionText({row}: {row: TextRow}) {
    return <p style={{textAlign: rowAlignment(row)}}><DashboardRichText row={row}/></p>
}

function DashboardInlineCaption({row, displayRow, onChange, teamControl, importedFonts}: {
    row: TextRow; displayRow: TextRow; onChange: (changes: Partial<TextRow>) => void
    teamControl?: ReactNode; importedFonts: ReturnType<typeof useDashboardFontLibrary>
}) {
    const [active, setActive] = useState(false)
    return <InlineDashboardTextRow label="Caption" {...{row, displayRow, active, onChange, teamControl, importedFonts}} openOnDoubleClick
        onOpen={() => setActive(true)} onClose={() => setActive(false)} maxLength={captionMaxLength}/>
}

function DashboardImageEditor({variant, settings, context, appearance, onApply, onCancel}: {
    variant: string; settings: DashboardWidgetSettings; context: DashboardDataContext; appearance?: DashboardWidgetAppearance | null
    onApply: (settings: DashboardWidgetSettings) => void; onCancel: () => void
}) {
    const [source, setSource] = useState(typeof settings.url === "string" ? settings.url : "")
    const [fit, setFit] = useState(dashboardImageFit(settings.fit))
    const [alt, setAlt] = useState(typeof settings.alt === "string" ? settings.alt : "")
    const [caption, setCaption] = useState(() => imageCaptionRow(settings))
    const [teamId, setTeamId] = useState(settings.teamId)
    const [filename, setFilename] = useState("")
    const [fileError, setFileError] = useState("")
    const [reading, setReading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const input = useRef<HTMLInputElement>(null)
    const request = useRef(0)
    const linkErrorId = useId()
    const url = dashboardImageSource(source)
    const uploaded = url?.startsWith("data:")
    const invalidLink = Boolean(source.trim() && !url)
    const hasCaption = variant !== "full"
    const values = useWidgetPlaceholderValues(context, hasCaption ? caption.text : "", teamId)
    const fitDescription = dashboardImageFits.find(option => option.id === fit)?.description

    useEffect(() => () => { request.current += 1 }, [])

    function changeSource(value: string) {
        setSource(value)
        setFilename("")
        setFileError("")
    }

    async function chooseFile(file?: File) {
        if (!file) return
        const current = ++request.current
        setReading(true)
        setFileError("")
        try {
            const image = await prepareDashboardImage(file)
            if (current !== request.current) return
            setSource(image)
            setFilename(file.name)
        } catch (error) {
            if (current === request.current) setFileError(error instanceof Error ? error.message : "This image could not be opened.")
        } finally {
            if (current === request.current) setReading(false)
        }
    }

    function dragOverFile(event: DragEvent<HTMLButtonElement>) {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
        setDragging(true)
    }

    return <>
        <div className="dashboard-image-editor">
            <div className="dashboard-image-editor-visual">
                <div className="dashboard-image-editor-preview-label">
                    <span>Preview</span>
                    {source && <Button type="button" size="xs" variant="ghost" disabled={reading} onClick={() => changeSource("")}><X/> Remove image</Button>}
                </div>
                <div className="dashboard-image-editor-preview" style={dashboardWidgetAppearanceStyle(appearance)}>
                    <DashboardImageFrame key={url} variant={variant} url={url} fit={fit} alt={alt}
                        caption={<DashboardCaptionText row={displayDashboardRow(caption, values, "Add caption")}/>}/>
                </div>
                <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
                    void chooseFile(event.currentTarget.files?.[0])
                    event.currentTarget.value = ""
                }}/>
                <button type="button" className="dashboard-image-editor-drop" data-dragging={dragging || undefined} aria-busy={reading} onClick={() => input.current?.click()}
                    onDragEnter={dragOverFile} onDragOver={dragOverFile} onDragLeave={() => setDragging(false)} onDrop={event => {
                        event.preventDefault()
                        setDragging(false)
                        void chooseFile(event.dataTransfer.files[0])
                    }}>
                    <Upload aria-hidden="true"/>
                    <span><strong>Drop an image or browse</strong><small>PNG, JPEG or WebP · up to 10 MB</small></span>
                </button>
                {reading && <small role="status">Preparing image…</small>}
                {uploaded && !reading && <small className="dashboard-image-editor-filename" title={filename}>{filename || "Uploaded image"}</small>}
                {fileError && <small className="dashboard-image-editor-error" role="alert">{fileError}</small>}
            </div>
            <div className="dashboard-image-editor-fields">
                <label className="dashboard-widget-field">Image link
                    <Input placeholder="https://" value={uploaded ? "" : source} maxLength={900} disabled={reading} aria-invalid={invalidLink || undefined}
                        aria-describedby={invalidLink ? linkErrorId : undefined} onChange={event => changeSource(event.target.value)}/>
                </label>
                {invalidLink && <small id={linkErrorId} className="dashboard-image-editor-error">Enter an HTTPS image link or a path on this site.</small>}
                <fieldset className="dashboard-image-editor-fit">
                    <legend>Image fit</legend>
                    <div>
                        {dashboardImageFits.map(option => <Button key={option.id} type="button" size="sm" variant="outline" aria-pressed={fit === option.id} onClick={() => setFit(option.id)}>{option.label}</Button>)}
                    </div>
                    <small>{fitDescription}</small>
                </fieldset>
                <label className="dashboard-widget-field">Image description
                    <Input placeholder="Describe the image for screen readers" value={alt} maxLength={150} onChange={event => setAlt(event.target.value)}/>
                </label>
                {hasCaption && <label className="dashboard-widget-field">Caption
                    <Textarea placeholder="Text shown with the image" value={caption.text} maxLength={captionMaxLength}
                        onChange={event => setCaption(editDashboardRowText(caption, event.target.value))}/>
                </label>}
                {hasCaption && caption.text.includes("%personal_team_") && <DashboardTeamSetting context={context} value={teamId} onChange={setTeamId}/>}
            </div>
        </div>
        <div className="dashboard-image-editor-actions">
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" size="sm" disabled={reading || invalidLink}
                onClick={() => onApply({...settings, url, fit, alt, ...imageCaptionSettings(caption), teamId})}>Apply changes</Button>
        </div>
    </>
}

export function DashboardImageWidget({widget, context, editing, onContentChange}: {
    widget: DashboardWidget; context: DashboardDataContext; editing: boolean; onContentChange: (value: string) => void
}) {
    const [open, setOpen] = useState(false)
    const settings = readDashboardWidgetSettings(widget.content)
    const variant = widget.type.slice("image-".length)
    const url = dashboardImageSource(settings.url)
    const caption = imageCaptionRow(settings)
    const values = useWidgetPlaceholderValues(context, caption.text, settings.teamId)
    const displayRow = displayDashboardRow(caption, values, editing ? "Add caption" : "")
    const importedFonts = useDashboardFontLibrary()
    useDashboardTextFonts([caption])
    const captionContent = editing ? <DashboardInlineCaption row={caption} displayRow={displayRow} importedFonts={importedFonts}
        onChange={changes => onContentChange(JSON.stringify({...settings, ...imageCaptionSettings({...caption, ...changes})}))}
        teamControl={caption.text.includes("%personal_team_") && <DashboardTeamSetting context={context} value={settings.teamId}
            onChange={teamId => onContentChange(JSON.stringify({...settings, teamId}))}/>}/> : <DashboardCaptionText row={displayRow}/>
    return <>
        <DashboardImageFrame {...{variant, url}} fit={dashboardImageFit(settings.fit)} alt={typeof settings.alt === "string" ? settings.alt : ""} caption={captionContent}/>
        {editing && <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="icon-sm" variant="secondary" className="dashboard-widget-config" aria-label="Edit image" title="Edit image"><Pencil/></Button>
            </DialogTrigger>
            <DialogContent className="dashboard-widget-settings dashboard-image-dialog"
                onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault() }}
                onDrop={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault() }}>
                <DialogHeader><DialogTitle>Edit image</DialogTitle><DialogDescription>Upload a file or use an image link, then choose how it fits the frame.</DialogDescription></DialogHeader>
                {open && <DashboardImageEditor {...{variant, settings, context}} appearance={widget.appearance} onCancel={() => setOpen(false)} onApply={updated => {
                    onContentChange(JSON.stringify(updated))
                    setOpen(false)
                }}/>}
            </DialogContent>
        </Dialog>}
    </>
}
