import {useEffect, useId, useState} from "react"
import {Link, useLocation} from "react-router-dom"
import {ChevronRight, FileText, Home, Plus} from "lucide-react"
import {wikiAncestors, wikiCanAddSubpage, wikiPageHref, type WikiPage} from "./wiki-document"

export function WikiPageNavigation({pages, homePageId, currentId, projectId, query, canAdd, onAdd, onNavigate}: {
    pages: WikiPage[]; homePageId: string | null; currentId?: string; projectId: string; query: string
    canAdd: boolean; onAdd: (parentId: string) => void; onNavigate: () => void
}) {
    const location = useLocation(), prefix = useId()
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
    useEffect(() => {
        if (!currentId) return
        const ancestors = wikiAncestors(pages, currentId)
        setCollapsed(current => {
            if (!ancestors.some(page => current.has(page.id))) return current
            const next = new Set(current)
            ancestors.forEach(page => next.delete(page.id))
            return next
        })
    }, [currentId, pages])
    const search = query.trim().toLowerCase(), visible = new Set<string>()
    for (const page of pages) {
        if (!search || `${page.title}\n${page.body}`.toLowerCase().includes(search)) {
            visible.add(page.id)
            wikiAncestors(pages, page.id).forEach(parent => visible.add(parent.id))
        }
    }
    function branch(parentId: string | null) {
        return pages.filter(page => (page.parentId ?? null) === parentId && visible.has(page.id))
            .sort((a, b) => a.id === homePageId ? -1 : b.id === homePageId ? 1 : a.title.localeCompare(b.title))
            .map(page => {
                const children = pages.some(child => child.parentId === page.id && visible.has(child.id))
                const expanded = !!search || !collapsed.has(page.id), listId = `${prefix}-${page.id}`
                return <li key={page.id}>
                    <div className="wiki-page-row">
                        {children ? <button type="button" className="wiki-page-branch" disabled={!!search} title={search ? "Matching branches stay expanded during search" : undefined} aria-label={`${expanded ? "Collapse" : "Expand"} ${page.title} pages`} aria-expanded={expanded} aria-controls={listId} onClick={() => setCollapsed(current => {const next = new Set(current); if (next.has(page.id)) next.delete(page.id); else next.add(page.id); return next})}><ChevronRight/></button> : <span className="wiki-page-leaf"/>}
                        <Link to={wikiPageHref(location.search, projectId, page.slug)} onClick={onNavigate} aria-current={currentId === page.id ? "page" : undefined}>{page.id === homePageId ? <Home/> : <FileText/>}<span>{page.title}</span></Link>
                        {canAdd && <button type="button" className="wiki-page-add" disabled={!wikiCanAddSubpage(pages, page.id)} aria-label={`Add subpage to ${page.title}`} title={wikiCanAddSubpage(pages, page.id) ? "Add subpage" : "Maximum of 2 subpages reached"} onClick={() => onAdd(page.id)}><Plus/></button>}
                    </div>
                    {children && <ol id={listId} hidden={!expanded}>{branch(page.id)}</ol>}
                </li>
            })
    }
    return <nav aria-label="Wiki page navigation"><ol className="wiki-page-tree">{branch(null)}</ol>{!visible.size && <p className="wiki-sidebar-empty">{search ? "No pages match your search." : "Your pages will appear here."}</p>}</nav>
}
