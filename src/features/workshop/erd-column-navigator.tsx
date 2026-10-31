import {useEffect, useId, useRef, useState} from "react"
import {Check, ChevronLeft, ChevronRight, Search, X} from "lucide-react"
import type {ErdField} from "./tool-documents"
import {erdDisplayType} from "./erd-schema"

/** Keeps the editor compact; search expands in place only when choosing another column. */
export function ErdColumnNavigator({fields, selectedId, onSelect}: {fields: ErdField[]; selectedId?: string; onSelect: (id: string) => void}) {
    const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0)
    const input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null), results = useRef<HTMLDivElement>(null)
    const id = useId(), index = fields.findIndex(field => field.id === selectedId), selected = fields[index]
    const matches = fields.filter(field => `${field.name} ${erdDisplayType(field)}`.toLowerCase().includes(query.trim().toLowerCase()))
    const activeIndex = Math.min(active, matches.length - 1)
    useEffect(() => {if (open) input.current?.focus()}, [open])
    useEffect(() => {
        if (!open) return
        const list = results.current, item = list?.children[activeIndex] as HTMLElement | undefined
        if (!list || !item) return
        if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
        else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }, [activeIndex, open, query])
    function close() {setOpen(false); trigger.current?.focus()}
    function choose(field: ErdField) {onSelect(field.id); close()}
    return <div className="erd-column-navigator">
        <div className="erd-column-navigation">
            <button type="button" ref={trigger} className="erd-column-current" aria-label={`Find column${selected ? `, current: ${selected.name}` : ""}`} aria-expanded={open} aria-controls={`${id}-search`} disabled={!fields.length} onClick={() => {if (open) close(); else {setQuery(""); setActive(Math.max(0, index)); setOpen(true)}}}>
                <Search aria-hidden="true"/><span>{selected?.name ?? "No columns"}</span><small>{index < 0 ? "0" : index + 1}/{fields.length}</small>
            </button>
            <button type="button" aria-label="Previous column" disabled={index <= 0} onClick={() => {if (fields[index - 1]) {onSelect(fields[index - 1].id); setOpen(false)}}}><ChevronLeft aria-hidden="true"/></button>
            <button type="button" aria-label="Next column" disabled={index < 0 || index >= fields.length - 1} onClick={() => {if (fields[index + 1]) {onSelect(fields[index + 1].id); setOpen(false)}}}><ChevronRight aria-hidden="true"/></button>
        </div>
        {open && <div className="erd-column-search" id={`${id}-search`}>
            <div className="erd-column-search-input"><input ref={input} role="combobox" aria-label="Search columns" aria-expanded={open} aria-autocomplete="list" aria-controls={`${id}-results`} aria-activedescendant={matches[activeIndex] ? `${id}-option-${activeIndex}` : undefined} placeholder="Search columns…" value={query} onChange={event => {setQuery(event.target.value); setActive(0)}} onKeyDown={event => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {event.preventDefault(); setActive(current => Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))))}
                else if (event.key === "Enter" && matches[activeIndex]) {event.preventDefault(); choose(matches[activeIndex])}
                else if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); close()}
            }}/><button type="button" aria-label="Close column search" onClick={close}><X aria-hidden="true"/></button></div>
            <div className="erd-column-search-results" ref={results} role="listbox" aria-label="Matching columns" id={`${id}-results`}>
                {matches.map((field, position) => <button type="button" role="option" aria-selected={selectedId === field.id} tabIndex={-1} id={`${id}-option-${position}`} key={field.id} data-active={position === activeIndex} onPointerMove={() => setActive(position)} onClick={() => choose(field)}>
                    <span>{field.name}</span><small>{erdDisplayType(field)}</small>{selectedId === field.id && <Check aria-hidden="true"/>}
                </button>)}
            </div>
            {!matches.length && <p className="erd-column-search-empty" role="status">No matching columns</p>}
        </div>}
    </div>
}
