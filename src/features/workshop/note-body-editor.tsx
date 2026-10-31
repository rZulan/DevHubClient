import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent} from "react"
import {Textarea} from "@/components/ui/textarea"
import {splitNoteBody, replaceNoteCode, type NoteCodeSegment} from "./note-code-fences.ts"
import {loadNoteCodeOptions, noteCodeTheme} from "./shiki-highlighter.ts"
import {NoteCodeTokens} from "./note-code-highlight.tsx"
import {useNoteCodeHighlight} from "./use-note-code-highlight.ts"

function InlineCodeEditor({block, readOnly, onChange, onRemove}: {block: NoteCodeSegment; readOnly: boolean; onChange: (source: string, language: string, theme: string) => void; onRemove: () => void}) {
    const [options, setOptions] = useState<Awaited<ReturnType<typeof loadNoteCodeOptions>> | null>(null)
    const [loadError, setLoadError] = useState(false)
    const textarea = useRef<HTMLTextAreaElement>(null)
    const highlighted = useRef<HTMLPreElement>(null)
    const pendingCaret = useRef<number | null>(null)
    const {tokens, palette} = useNoteCodeHighlight(block.source, block.language, block.theme)
    useEffect(() => {
        let current = true
        void loadNoteCodeOptions().then(value => {if (current) {setOptions(value); setLoadError(false)}}, () => {if (current) setLoadError(true)})
        return () => {current = false}
    }, [])
    useEffect(() => {
        if (pendingCaret.current !== null && textarea.current) {
            textarea.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
            pendingCaret.current = null
        }
    }, [block.source])
    function indent(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== "Tab" || event.shiftKey || readOnly) return
        event.preventDefault()
        const {selectionStart, selectionEnd} = event.currentTarget
        pendingCaret.current = selectionStart + 4
        onChange(block.source.slice(0, selectionStart) + "    " + block.source.slice(selectionEnd), block.language, block.theme)
    }
    const selectedLanguage = options?.languages.find(item => item.id === block.language || item.aliases.includes(block.language))?.id ?? block.language
    return <section className="note-code-block note-code-editor" aria-label="Code block editor" style={{background: palette.background, color: palette.foreground, colorScheme: palette.type, "--code-ink": palette.foreground, "--code-paper": palette.background} as CSSProperties} data-theme={palette.id}>
        <div className="note-code-header">
            <div className="note-code-selectors">
                <label>Grammar<WorkshopSelect aria-label="Code grammar" value={selectedLanguage} disabled={readOnly || !options} onValueChange={selectedValue => onChange(block.source, selectedValue, block.theme)}>
                    <option value="text">Plain text</option>
                    {selectedLanguage !== "text" && !options?.languages.some(item => item.id === selectedLanguage) && <option value={selectedLanguage}>{selectedLanguage}</option>}
                    {options?.languages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </WorkshopSelect></label>
                <label>Theme<WorkshopSelect aria-label="Code theme" value={block.theme} disabled={readOnly || !options} onValueChange={selectedValue => onChange(block.source, block.language, selectedValue)}>
                    {!options?.themes.some(item => item.id === block.theme) && <option value={block.theme}>{block.theme === noteCodeTheme.id ? noteCodeTheme.label : block.theme}</option>}
                    {options?.themes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </WorkshopSelect></label>
            </div>
            {!readOnly && <button type="button" aria-label="Remove code block" onClick={onRemove}>Remove</button>}
        </div>
        {loadError && <p className="note-code-load-error" role="status">Highlighting options could not load. Your code is still editable.</p>}
        <div className="note-code-input">
            <pre ref={highlighted} aria-hidden="true"><code><NoteCodeTokens tokens={tokens} source={block.source}/>{"\n"}</code></pre>
            <textarea ref={textarea} aria-label="Code source" autoFocus={!block.closed} readOnly={readOnly} value={block.source} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" onKeyDown={indent}
                onChange={event => onChange(event.target.value, block.language, block.theme)} onScroll={event => {if (highlighted.current) {highlighted.current.scrollTop = event.currentTarget.scrollTop; highlighted.current.scrollLeft = event.currentTarget.scrollLeft}}}/>
        </div>
        <div className="note-code-editor-hint">Tab indents · Shift+Tab moves focus · Continue your note below</div>
    </section>
}

export function NoteBodyEditor({body, onChange, readOnly}: {body: string; onChange: (body: string) => void; readOnly: boolean}) {
    const [atLimit, setAtLimit] = useState(false)
    const segments = splitNoteBody(body)
    function update(next: string) {
        setAtLimit(next.length > 10000)
        if (next.length <= 10000) onChange(next)
    }
    return <div className="note-body-editor">
        {segments.map((segment, index) => segment.type === "code"
            ? <InlineCodeEditor key={index} block={segment} readOnly={readOnly} onChange={(source, language, theme) => update(replaceNoteCode(body, segment, source, language, theme))} onRemove={() => update(body.slice(0, segment.start) + body.slice(segment.end))}/>
            : <Textarea key={index} id={index === 0 ? "sticky-note-body" : undefined} aria-label={index === 0 ? "Note content" : `Note content after code block ${Math.ceil(index / 2)}`} readOnly={readOnly} maxLength={Math.max(segment.text.length, 10000 - body.length + segment.text.length)} rows={segments.length > 1 ? 2 : 9}
                className={segments.length > 1 ? "note-body-text-segment" : undefined} value={segment.text}
                onChange={event => {
                    const text = event.target.value
                    // Keep prose added after an unfinished fence outside the code block.
                    if (index > 0 && segments[index - 1].type === "code" && !(segments[index - 1] as NoteCodeSegment).closed && text) {
                        const previous = segments[index - 1] as NoteCodeSegment
                        const closed = replaceNoteCode(body, previous, previous.source, previous.language, previous.theme)
                        update(closed + "\n\n" + text)
                    } else if (index > 0 && !segment.text && text) update(body.slice(0, segment.start) + (body[segment.start - 1] === "\n" ? "" : "\n") + text + body.slice(segment.end))
                    else update(body.slice(0, segment.start) + text + body.slice(segment.end))
                }}/>) }
        {atLimit && <p role="alert">Notes can contain up to 10,000 characters, including code formatting.</p>}
    </div>
}
