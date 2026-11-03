import {useEffect, useRef, useState} from "react"
import {X} from "lucide-react"
import "./project-chip-input.css"

function entries(values: readonly string[]) {
    const seen = new Set<string>()
    return values.flatMap(value => value.split(",")).map(value => value.trim()).filter(value => {
        const key = value.toLocaleLowerCase()
        if (!value || seen.has(key)) return false
        seen.add(key); return true
    })
}

export function ProjectChipInput({id, name, label, initial = [], placeholder, maxLength, disabled = false}: {
    id: string; name: string; label: string; initial?: readonly string[]; placeholder: string; maxLength?: number; disabled?: boolean
}) {
    const [value, setValue] = useState(() => ({chips: entries(initial), draft: ""}))
    const input = useRef<HTMLInputElement>(null), composing = useRef(false)
    // Include the unfinished entry so saving without a trailing comma never loses it.
    const serialized = entries([...value.chips, value.draft]).join(", ")
    useEffect(() => {
        input.current?.setCustomValidity(maxLength && serialized.length > maxLength ? `Keep ${label.toLowerCase()} within ${maxLength} characters in total.` : "")
    }, [label, maxLength, serialized])

    function change(draft: string) {
        const parts = draft.split(",")
        setValue(current => composing.current ? {...current, draft} : {chips: entries([...current.chips, ...parts.slice(0, -1)]), draft: parts.at(-1) ?? ""})
    }
    function commit() {setValue(current => ({chips: entries([...current.chips, current.draft]), draft: ""}))}

    return <div className="project-chip-input" data-disabled={disabled}>
        {value.chips.map(chip => <span className="project-input-chip" key={chip}><span>{chip}</span><button type="button" disabled={disabled} aria-label={`Remove ${chip} from ${label}`} onClick={() => setValue(current => ({...current, chips: current.chips.filter(item => item !== chip)}))}><X aria-hidden="true"/></button></span>)}
        <input id={id} ref={input} type="text" value={value.draft} disabled={disabled} maxLength={maxLength} placeholder={value.chips.length ? "Add another…" : placeholder} aria-describedby={`${id}-hint`} autoComplete="off"
            onChange={event => change(event.target.value)}
            onCompositionStart={() => {composing.current = true}} onCompositionEnd={event => {composing.current = false; change(event.currentTarget.value)}}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing || composing.current) return
                if (event.key === "Enter") {event.preventDefault(); commit()}
                else if (event.key === "Backspace" && !value.draft && value.chips.length) {
                    event.preventDefault(); setValue(current => ({chips: current.chips.slice(0, -1), draft: current.chips.at(-1) ?? ""}))
                }
            }}/>
        <input type="hidden" name={name} value={serialized} disabled={disabled}/>
        <span id={`${id}-hint`} className="sr-only">Type a comma or press Enter to add an item. Use Backspace in the empty input to edit the last item.</span>
    </div>
}
