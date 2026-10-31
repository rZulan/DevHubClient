import {useEffect, useRef, useState, type RefObject} from "react"
import {ChevronRight, ChevronsDownUp, ChevronsUpDown, List} from "lucide-react"
import {activeWikiHeading, type WikiHeadingNavigation, type WikiHeadingSelection} from "./wiki-active-heading"

type Heading = {id: string; title: string; level: number; bodyId?: string}
type HeadingBranch = Heading & {children: HeadingBranch[]}

/** Read the rendered headings so links always match Markdown's actual anchor IDs. */
export function WikiTableOfContents({article, contentKey, body, id, expanded, onAvailableChange, onWideChange, collapsedSections, onToggleSection, onExpandAll, onCollapseAll, onRevealSection, headingNavigation}: {
    article: RefObject<HTMLElement | null>; contentKey: string; body: string; id: string; expanded: boolean
    onAvailableChange: (available: boolean) => void; onWideChange: (wide: boolean) => void
    collapsedSections: ReadonlySet<string>; onToggleSection: (id: string) => void
    onExpandAll: () => void; onCollapseAll: () => void; onRevealSection: (id: string) => void
    headingNavigation: WikiHeadingNavigation | null
}) {
    const [headings, setHeadings] = useState<Heading[]>([])
    const [activeId, setActiveId] = useState("")
    const selection = useRef<WikiHeadingSelection | null>(null)
    const lastNavigation = useRef<WikiHeadingNavigation | null>(null)
    useEffect(() => {
        selection.current = null
        if (!headingNavigation || headingNavigation.contentKey !== contentKey || lastNavigation.current === headingNavigation) return
        lastNavigation.current = headingNavigation
        const selected: WikiHeadingSelection = {id: headingNavigation.id, scrollTop: null}
        selection.current = selected
        setActiveId(selected.id)
        // Let the article reveal collapsed ancestors and finish its anchor scroll first.
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                if (selection.current === selected) selected.scrollTop = article.current?.closest(".wiki-main-content")?.scrollTop ?? 0
            })
        })
        return () => cancelAnimationFrame(frame)
    }, [article, contentKey, headingNavigation])
    useEffect(() => {
        const workspace = article.current?.closest(".wiki-page")
        if (!workspace) return
        let wasWide: boolean | undefined
        const observer = new ResizeObserver(([entry]) => {
            const wide = entry.contentRect.width > 1000
            if (wide !== wasWide) {wasWide = wide; onWideChange(wide)}
        })
        observer.observe(workspace)
        return () => observer.disconnect()
    }, [article, onWideChange])
    useEffect(() => {
        const element = article.current
        if (!element) return
        const scroller = element.closest(".wiki-main-content")
        let elements: HTMLHeadingElement[] = []
        function highlight() {
            const visible = elements.filter(heading => heading.getClientRects().length > 0)
                .map(heading => ({id: heading.id, top: heading.getBoundingClientRect().top}))
            const active = activeWikiHeading(visible, {top: scroller?.getBoundingClientRect().top ?? 0,
                height: scroller?.clientHeight ?? window.innerHeight, scrollTop: scroller?.scrollTop ?? 0,
                scrollHeight: scroller?.scrollHeight ?? 0}, selection.current)
            if (selection.current && selection.current.id !== active) selection.current = null
            setActiveId(active)
        }
        function resumeScrollHighlight(event: Event) {
            if (event.target instanceof Element && event.target.closest(".wiki-toc")) return
            selection.current = null; highlight()
        }
        function onKeyDown(event: Event) {
            const key = (event as KeyboardEvent).key
            if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(key)) return
            if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return
            resumeScrollHighlight(event)
        }
        function collect() {
            elements = [...element!.querySelectorAll<HTMLHeadingElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")]
            onAvailableChange(elements.length > 0)
            setHeadings(elements.map(heading => ({id: heading.id, title: (heading.querySelector(".wiki-heading-text") ?? heading).textContent?.trim() || "Untitled section", level: Number(heading.tagName.slice(1)), bodyId: heading.nextElementSibling?.id})))
            highlight()
        }
        collect()
        const observer = new MutationObserver(collect)
        observer.observe(element, {childList: true, subtree: true, characterData: true})
        scroller?.addEventListener("scroll", highlight, {passive: true})
        scroller?.addEventListener("wheel", resumeScrollHighlight, {passive: true})
        scroller?.addEventListener("touchmove", resumeScrollHighlight, {passive: true})
        scroller?.addEventListener("keydown", onKeyDown)
        window.addEventListener("resize", highlight)
        return () => {
            observer.disconnect(); scroller?.removeEventListener("scroll", highlight)
            scroller?.removeEventListener("wheel", resumeScrollHighlight); scroller?.removeEventListener("touchmove", resumeScrollHighlight)
            scroller?.removeEventListener("keydown", onKeyDown); window.removeEventListener("resize", highlight)
        }
    }, [article, contentKey, body, onAvailableChange, collapsedSections, headingNavigation])

    if (!headings.length) return null
    const tree: HeadingBranch[] = [], ancestors: HeadingBranch[] = []
    for (const heading of headings) {
        while (ancestors.length && ancestors[ancestors.length - 1].level >= heading.level) ancestors.pop()
        const branch: HeadingBranch = {...heading, children: []}
        const parent = ancestors[ancestors.length - 1]
        const siblings = parent ? parent.children : tree
        siblings.push(branch)
        ancestors.push(branch)
    }
    function hasActiveChild(heading: HeadingBranch): boolean {
        return heading.children.some(child => child.id === activeId || hasActiveChild(child))
    }
    function renderBranch(branches: HeadingBranch[], parentId?: string, hidden = false) {
        return <ol className={parentId ? "wiki-toc-children" : "wiki-toc-tree"} id={parentId} hidden={hidden}>{branches.map(heading => {
            const isCollapsed = collapsedSections.has(heading.id), active = activeId === heading.id
            return <li key={heading.id}><div className="wiki-toc-row" data-active={active || undefined} data-active-branch={isCollapsed && hasActiveChild(heading) || undefined}>
                {!parentId || heading.children.length > 0 ? <button type="button" className="wiki-toc-branch-toggle" aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${heading.title} section in contents`} aria-expanded={!isCollapsed} aria-controls={[heading.bodyId, heading.children.length ? `${id}-${heading.id}` : ""].filter(Boolean).join(" ")} onClick={() => onToggleSection(heading.id)}><ChevronRight aria-hidden="true"/></button> : <span className="wiki-toc-leaf" aria-hidden="true"/>}
                <a href={`#${encodeURIComponent(heading.id)}`} aria-current={active ? "location" : undefined} onClick={() => onRevealSection(heading.id)}>{heading.title}</a>
            </div>{heading.children.length > 0 && renderBranch(heading.children, `${id}-${heading.id}`, isCollapsed)}</li>
        })}</ol>
    }
    return <nav id={id} className="wiki-toc" aria-label="On this page" hidden={!expanded}>
        <div className="wiki-toc-header"><div className="wiki-toc-heading"><List/>On this page</div>
            <div className="wiki-toc-actions" role="group" aria-label="Wiki section visibility"><button type="button" aria-label="Expand all sections" title="Expand all sections" onClick={onExpandAll} disabled={!collapsedSections.size}><ChevronsUpDown aria-hidden="true"/></button><button type="button" aria-label="Collapse all sections" title="Collapse all sections" onClick={onCollapseAll} disabled={headings.every(heading => collapsedSections.has(heading.id))}><ChevronsDownUp aria-hidden="true"/></button></div>
        </div>
        {renderBranch(tree)}
    </nav>
}
