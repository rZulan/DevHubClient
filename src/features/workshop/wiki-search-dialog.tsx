import {useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent} from "react"
import {Search} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import type {WikiPage} from "./wiki-document"
import {searchWiki, wikiSearchTerms, type WikiSearchResult} from "./wiki-search"

export function WikiSearchDialog({pages, currentId, homePageId, canNavigate, shortcutEnabled, onNavigate}: {
    pages: WikiPage[]; currentId?: string; homePageId: string | null; canNavigate: boolean; shortcutEnabled: boolean
    onNavigate: (result: WikiSearchResult) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [active, setActive] = useState(0)
    const [recentIds, setRecentIds] = useState<string[]>([])
    const listId = useId()
    const input = useRef<HTMLInputElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const shortcut = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘ K" : "Ctrl K"

    useEffect(() => {
        if (currentId) setRecentIds(ids => [currentId, ...ids.filter(id => id !== currentId)].slice(0, 5))
    }, [currentId])

    const changeOpen = useCallback((next: boolean) => {
        if (next) {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            setQuery("")
            setActive(0)
        }
        setOpen(next)
    }, [])

    useEffect(() => {
        if (!shortcutEnabled) return
        function keyDown(event: KeyboardEvent) {
            if (event.defaultPrevented || event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "k") return
            event.preventDefault()
            if (event.repeat) return
            if (open) input.current?.focus()
            else changeOpen(true)
        }
        window.addEventListener("keydown", keyDown)
        return () => window.removeEventListener("keydown", keyDown)
    }, [changeOpen, open, shortcutEnabled])

    const terms = useMemo(() => wikiSearchTerms(query), [query])
    const groups = useMemo<{label: string; items: WikiSearchResult[]; offset: number}[]>(() => {
        if (terms.length) return [{label: "Results", items: searchWiki(pages, terms), offset: 0}]

        const recent = recentIds.filter(id => id !== currentId).flatMap(id => {
            const page = pages.find(item => item.id === id)
            return page ? [page] : []
        })
        const browse = pages.filter(page => !recent.includes(page)).sort((a, b) =>
            Number(b.id === homePageId) - Number(a.id === homePageId) || a.title.localeCompare(b.title))
        return [{label: "Recently viewed", items: recent, offset: 0}, {label: "Browse pages", items: browse, offset: recent.length}]
    }, [currentId, homePageId, pages, recentIds, terms])
    const results = groups.flatMap(group => group.items)
    const selected = Math.min(active, results.length - 1)
    const optionId = (index: number) => `${listId}-${index}`

    function openResult(result: WikiSearchResult | undefined) {
        if (!result || !canNavigate) return
        setOpen(false)
        onNavigate(result)
    }

    function keyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.nativeEvent.isComposing || !results.length) return
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            const direction = event.key === "ArrowDown" ? 1 : -1
            const index = (selected + direction + results.length) % results.length
            setActive(index)
            document.getElementById(optionId(index))?.scrollIntoView({block: "nearest"})
        } else if (event.key === "Enter") {
            event.preventDefault()
            openResult(results[selected])
        }
    }

    return <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="wiki-search-trigger" aria-label="Search project wiki" aria-keyshortcuts="Control+K Meta+K" title={`Search project wiki (${shortcut})`}><Search aria-hidden="true"/><span>Search</span><kbd aria-hidden="true">{shortcut}</kbd></Button></DialogTrigger>
        <DialogContent className="wiki-search-dialog sm:max-w-xl" onOpenAutoFocus={event => {event.preventDefault(); input.current?.focus()}} onCloseAutoFocus={event => {
            if (returnFocus.current?.isConnected) {event.preventDefault(); returnFocus.current.focus({preventScroll: true})}
        }}>
            <DialogTitle className="sr-only">Search project wiki</DialogTitle>
            <DialogDescription className="sr-only">Find pages, headings, and text in this project.</DialogDescription>
            <div className="wiki-search-field">
                <Search aria-hidden="true"/>
                <input ref={input} type="search" role="combobox" aria-label="Search wiki pages" aria-controls={listId} aria-expanded={results.length > 0} aria-autocomplete="list" aria-activedescendant={selected >= 0 ? optionId(selected) : undefined} autoComplete="off" spellCheck={false} placeholder="Search the project wiki…" value={query} onChange={event => {setQuery(event.target.value); setActive(0)}} onKeyDown={keyDown}/>
            </div>
            {(!results.length || !canNavigate) && <p className="wiki-search-message" role="status">{!canNavigate ? "Save or cancel your edits before opening a result." : terms.length ? "No matches found. Try another word or phrase." : "There are no wiki pages in this project yet."}</p>}
            <div id={listId} className="wiki-search-results" role="listbox" aria-label="Wiki search results" hidden={!results.length}>
                {groups.map(group => group.items.length > 0 && <div key={group.label} role="group" aria-label={group.label}>
                    <div className="wiki-search-group" aria-hidden="true">{group.label}</div>
                    {group.items.map((item, position) => {
                        const index = group.offset + position
                        return <button key={`${item.slug}#${item.anchor ?? ""}`} id={optionId(index)} type="button" role="option" tabIndex={-1} aria-selected={selected === index} aria-disabled={!canNavigate} className="wiki-search-result" onPointerMove={() => setActive(index)} onClick={() => openResult(item)}>
                            <strong>{item.title}</strong>
                            {item.pageTitle && <span>{item.pageTitle}</span>}
                            {item.excerpt && <span className="wiki-search-excerpt">{item.excerpt}</span>}
                        </button>
                    })}
                </div>)}
            </div>
            <div className="wiki-search-keys" aria-hidden="true"><span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
        </DialogContent>
    </Dialog>
}
