import {useRef, useState} from "react"

export function ErdEditableName({name, label, canEdit, onChange}: {name: string; label: string; canEdit: boolean; onChange: (name: string) => void}) {
    const [draft, setDraft] = useState<string | null>(null)
    const finished = useRef(false)
    function start() {if (canEdit) {finished.current = false; setDraft(name)}}
    function finish(cancel = false) {
        if (finished.current) return
        finished.current = true
        const value = draft?.trim()
        if (!cancel && value && value !== name) onChange(value)
        setDraft(null)
    }
    return <span className="erd-editable-name" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => {event.stopPropagation(); start()}}
        tabIndex={canEdit && draft === null ? 0 : undefined} onKeyDown={event => {
            if (draft === null && (event.key === "Enter" || event.key === "F2")) {event.preventDefault(); event.stopPropagation(); start()}
        }}>
        {draft === null ? name : <input aria-label={label} autoFocus maxLength={150} value={draft}
            onFocus={event => event.currentTarget.select()} onChange={event => setDraft(event.target.value)}
            onBlur={() => finish()} onClick={event => event.stopPropagation()} onKeyDown={event => {
                event.stopPropagation()
                if (event.key === "Enter") {event.preventDefault(); finish()}
                if (event.key === "Escape") {event.preventDefault(); finish(true)}
            }}/>}
    </span>
}
