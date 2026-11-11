import type {Root, RootContent} from "hast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import {unified} from "unified"
import type {WikiPage} from "./wiki-document"
import {rehypeWikiSections, wikiHeadingText} from "./wiki-sections.ts"

type Entry = {slug: string; title: string; text: string; anchor?: string; pageTitle?: string}
type IndexedEntry = Entry & {searchTitle: string; searchPage: string; searchText: string}
export type WikiSearchResult = Pick<Entry, "slug" | "title" | "anchor" | "pageTitle"> & {excerpt?: string}

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeWikiSections)
const cache = new WeakMap<WikiPage, IndexedEntry[]>()

function fold(value: string) {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

export function wikiSearchTerms(query: string) {
    return [...new Set(fold(query).match(/[\p{L}\p{N}]+/gu) ?? [])]
}

function indexPage(page: WikiPage) {
    const cached = cache.get(page)
    if (cached) return cached

    const root = markdown.runSync(markdown.parse(page.body)) as Root
    const sections: Entry[] = []
    let entry: Entry = {slug: page.slug, title: page.title, text: ""}
    let text: string[] = []
    function finish() {
        sections.push({...entry, text: text.join("").replace(/\s+/g, " ").trim()})
        text = []
    }
    function walk(node: RootContent) {
        if (node.type === "text") text.push(node.value)
        if (node.type !== "element") return
        if (/^h[1-6]$/.test(node.tagName)) {
            finish()
            entry = {slug: page.slug, title: wikiHeadingText(node).trim() || "Section", pageTitle: page.title, anchor: String(node.properties.id), text: ""}
            return
        }
        if (node.tagName === "img") text.push(String(node.properties.alt ?? ""))
        node.children.forEach(walk)
        if (/^(br|div|li|p|pre|section|td|th)$/.test(node.tagName)) text.push(" ")
    }
    root.children.forEach(walk)
    finish()

    const entries = sections.map(section => ({...section, searchTitle: fold(section.title), searchPage: fold(section.pageTitle ?? ""), searchText: fold(section.text)}))
    cache.set(page, entries)
    return entries
}

export function searchWiki(pages: WikiPage[], terms: string[], limit = 12): WikiSearchResult[] {
    if (!terms.length) return []
    const phrase = terms.join(" ")
    return pages.flatMap(indexPage).flatMap(entry => {
        const {searchTitle, searchPage, searchText} = entry
        if (!terms.every(term => searchTitle.includes(term) || searchPage.includes(term) || searchText.includes(term))) return []
        // Avoid returning every section when the query only matches their shared page title.
        if (entry.anchor && !terms.some(term => searchTitle.includes(term) || searchText.includes(term))) return []
        let score = searchTitle === phrase ? 60 : searchTitle.includes(phrase) ? 28 : 0
        if (searchText.includes(phrase)) score += 4
        for (const term of terms) score += searchTitle.includes(term) ? 12 : searchPage.includes(term) ? 4 : 1
        return [{entry, score}]
    }).sort((a, b) => b.score - a.score).slice(0, limit).map(({entry}) => {
        const {slug, title, pageTitle, anchor, text, searchText} = entry
        const hit = terms.map(term => searchText.indexOf(term)).filter(index => index >= 0)
        const start = hit.length ? Math.max(0, Math.min(...hit) - 38) : 0
        const end = Math.min(text.length, start + 148)
        const excerpt = text && `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
        return {slug, title, pageTitle, anchor, excerpt}
    })
}
