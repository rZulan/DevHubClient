import {Children, isValidElement, useId, type ReactNode} from "react"
import {ChevronDown} from "lucide-react"
import {Link, useLocation} from "react-router-dom"
import type {Components} from "react-markdown"
import {NoteMarkdown} from "./note-markdown"
import {WikiCopyLink} from "./wiki-copy-link"
import {rehypeWikiSections} from "./wiki-sections"
import {rehypeWikiImages} from "./wiki-images"
import {findWikiPage, wikiPageHref, type WikiPage} from "./wiki-document"

function textContent(children: ReactNode): string {
    return Children.toArray(children).map(child => isValidElement<{children?: ReactNode}>(child) ? textContent(child.props.children) : typeof child === "string" || typeof child === "number" ? String(child) : "").join("")
}

export function WikiMarkdown({body, pages, projectId, pageSlug, collapsedSections, onToggleSection, onRevealSection}: {
    body: string; pages: WikiPage[]; projectId: string; pageSlug?: string; collapsedSections?: ReadonlySet<string>
    onToggleSection?: (id: string) => void; onRevealSection?: (id: string) => void
}) {
    const location = useLocation(), prefix = useId()
    const heading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): Components["h2"] => ({node: _node, children, id, ...props}) => {
        const anchor = id!, title = textContent(children), isCollapsed = collapsedSections?.has(anchor) ?? false
        const search = pageSlug ? wikiPageHref(location.search, projectId, pageSlug) : location.search
        return <Tag {...props} id={anchor} className="wiki-section-heading"><span className="wiki-heading-label"><a className="wiki-heading-anchor" href={`#${encodeURIComponent(anchor)}`} onClick={() => onRevealSection?.(anchor)}><span className="wiki-heading-text">{children}</span></a><WikiCopyLink href={`${location.pathname}${search}#${encodeURIComponent(anchor)}`} title={title}/></span>{onToggleSection && <button type="button" className="wiki-section-toggle" aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${title} section`} title={`${isCollapsed ? "Expand" : "Collapse"} section`} aria-expanded={!isCollapsed} aria-controls={`${prefix}-${anchor}`} onClick={() => onToggleSection(anchor)}><ChevronDown aria-hidden="true"/></button>}</Tag>
    }
    const components: Components = {
        img: ({node: _node, src, alt, width, height, ...props}) => src ? <img {...props} src={src} alt={alt ?? ""} loading="lazy" width={width} height={height} style={{width: width ? `${width}px` : undefined, height: height ? `${height}px` : "auto", maxWidth: "100%", objectFit: "contain"}}/> : <span>{alt}</span>,
        h1: heading("h1"), h2: heading("h2"), h3: heading("h3"), h4: heading("h4"), h5: heading("h5"), h6: heading("h6"),
        a: ({node: _node, href, children, ...props}) => {
            if (!href) return <span>{children}</span>
            if (href.startsWith("#")) return <a {...props} href={href} onClick={() => {
                try {onRevealSection?.(decodeURIComponent(href.slice(1)))} catch {return}
            }}>{children}</a>
            if (/^(https?:|mailto:|tel:|\/)/i.test(href)) return <a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>
            const [path, anchor] = href.split("#", 2)
            let target: string
            try {target = decodeURIComponent(path.replace(/^\.\//, "").replace(/\.md$/i, ""))} catch {return <span>{children}</span>}
            const page = findWikiPage(pages, target)
            return <Link {...props} className={page ? undefined : "wiki-missing-link"} to={`${wikiPageHref(location.search, projectId, page?.slug ?? target)}${anchor ? `#${anchor}` : ""}`} title={page ? props.title : "This wiki page does not exist yet"}>{children}</Link>
        },
    }
    return <NoteMarkdown body={body} components={components} rehypePlugins={[rehypeWikiImages, [rehypeWikiSections, {collapsedSections, prefix}]]}/>
}
