import {Children, isValidElement, type ReactNode} from "react"
import {Link, useLocation} from "react-router-dom"
import type {Components} from "react-markdown"
import {NoteMarkdown} from "./note-markdown"
import {findWikiPage, wikiPageHref, type WikiPage} from "./wiki-document"

function textContent(children: ReactNode): string {
    return Children.toArray(children).map(child => isValidElement<{children?: ReactNode}>(child) ? textContent(child.props.children) : typeof child === "string" || typeof child === "number" ? String(child) : "").join("")
}

export function WikiMarkdown({body, pages, projectId}: {body: string; pages: WikiPage[]; projectId: string}) {
    const location = useLocation(), headings = new Map<string, number>()
    const heading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): Components["h2"] => ({node: _node, children, id, ...props}) => {
        const base = textContent(children).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section"
        const count = headings.get(base) ?? 0; headings.set(base, count + 1)
        return <Tag {...props} id={id ?? `${base}${count ? `-${count}` : ""}`}>{children}</Tag>
    }
    const components: Components = {
        h1: heading("h1"), h2: heading("h2"), h3: heading("h3"), h4: heading("h4"), h5: heading("h5"), h6: heading("h6"),
        a: ({node: _node, href, children, ...props}) => {
            if (!href) return <span>{children}</span>
            if (href.startsWith("#")) return <a {...props} href={href}>{children}</a>
            if (/^(https?:|mailto:|tel:|\/)/i.test(href)) return <a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>
            const [path, anchor] = href.split("#", 2)
            let target: string
            try {target = decodeURIComponent(path.replace(/^\.\//, "").replace(/\.md$/i, ""))} catch {return <span>{children}</span>}
            const page = findWikiPage(pages, target)
            return <Link {...props} className={page ? undefined : "wiki-missing-link"} to={`${wikiPageHref(location.search, projectId, page?.slug ?? target)}${anchor ? `#${anchor}` : ""}`} title={page ? props.title : "This wiki page does not exist yet"}>{children}</Link>
        },
    }
    return <NoteMarkdown body={body} components={components}/>
}
