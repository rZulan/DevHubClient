export type WikiRevision = {id: string; title: string; body: string; message: string; authorId: string; updatedAt: string}
export type WikiPage = WikiRevision & {slug: string; history: WikiRevision[]}
export type WikiDocument = {pages: WikiPage[]; homePageId: string | null}

export const wikiLimits = {pages: 100, title: 150, body: 100000, history: 20, document: 4000000} as const

// Slugs are assigned once. Renaming a page keeps existing links working.
export function wikiSlug(title: string) {
    return title.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/, "") || "page"
}
export function uniqueWikiSlug(title: string, pages: WikiPage[]) {
    const base = wikiSlug(title), used = new Set(pages.map(page => page.slug))
    let slug = base, suffix = 2
    while (used.has(slug)) slug = `${base.slice(0, 90)}-${suffix++}`
    return slug
}
export function findWikiPage(pages: WikiPage[], target: string) {
    return pages.find(page => page.slug === target.toLowerCase()) ?? pages.find(page => page.title.toLowerCase() === target.toLowerCase()) ?? pages.find(page => page.slug === wikiSlug(target))
}
export function wikiPageHref(search: string, projectId: string, slug: string) {
    const params = new URLSearchParams(search)
    params.set("project", projectId); params.set("page", slug)
    return `?${params.toString()}`
}

export function validWikiDocument(value: unknown): value is WikiDocument {
    const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)
    const text = (item: Record<string, unknown>, key: string, max: number, required = false) => typeof item[key] === "string" && item[key].length <= max && (!required || !!item[key].trim())
    const revision = (item: unknown): boolean => record(item) && text(item, "id", 100, true) && text(item, "title", wikiLimits.title, true)
        && text(item, "body", wikiLimits.body) && text(item, "message", 500) && text(item, "authorId", 100, true)
        && text(item, "updatedAt", 100, true) && Number.isFinite(Date.parse(item.updatedAt as string))
    if (!record(value) || !Array.isArray(value.pages) || value.pages.length > wikiLimits.pages || JSON.stringify(value).length > wikiLimits.document) return false
    const ids = new Set<string>(), slugs = new Set<string>(), titles = new Set<string>()
    for (const page of value.pages) {
        if (!record(page) || !revision(page) || typeof page.slug !== "string" || page.slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)
            || ids.has(page.id as string) || slugs.has(page.slug) || titles.has((page.title as string).trim().toLowerCase())
            || !Array.isArray(page.history) || page.history.length > wikiLimits.history || !page.history.every(revision)
            || new Set(page.history.map(item => item.id)).size !== page.history.length) return false
        ids.add(page.id as string); slugs.add(page.slug); titles.add((page.title as string).trim().toLowerCase())
    }
    return value.pages.length === 0 ? value.homePageId === null : typeof value.homePageId === "string" && ids.has(value.homePageId)
}

export function saveWikiPage(document: WikiDocument, draft: Pick<WikiRevision, "id" | "title" | "body" | "message">, authorId: string, revisionId: string, updatedAt: string): WikiDocument {
    const existing = document.pages.find(page => page.id === draft.id), title = draft.title.trim()
    if (!title) throw new Error("Give this page a title.")
    if (document.pages.some(page => page.id !== draft.id && page.title.toLowerCase() === title.toLowerCase())) throw new Error("A page with this title already exists. Choose a different title.")
    if (!existing && document.pages.length >= wikiLimits.pages) throw new Error("This wiki has reached its 100-page limit.")
    const previous: WikiRevision | undefined = existing && {id: revisionId, title: existing.title, body: existing.body, message: existing.message, authorId: existing.authorId, updatedAt: existing.updatedAt}
    const page: WikiPage = {id: draft.id, title, body: draft.body, message: draft.message.trim(), authorId, updatedAt,
        slug: existing?.slug ?? uniqueWikiSlug(title, document.pages), history: previous ? [previous, ...existing!.history].slice(0, wikiLimits.history) : []}
    const next = {...document, homePageId: document.homePageId ?? page.id, pages: existing ? document.pages.map(item => item.id === page.id ? page : item) : [...document.pages, page]}
    if (!validWikiDocument(next)) throw new Error("This wiki exceeds its storage limit. Download a backup, then shorten a page or remove older pages before saving.")
    return next
}

export function deleteWikiPage(document: WikiDocument, id: string): WikiDocument {
    const pages = document.pages.filter(page => page.id !== id)
    return {pages, homePageId: document.homePageId === id ? pages[0]?.id ?? null : document.homePageId}
}
