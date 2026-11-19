import {unzipSync, zipSync} from "fflate"
import {validWikiDocument, wikiAncestors, wikiLimits, wikiSlug, type WikiDocument, type WikiPage} from "./wiki-document.ts"

export const maxWikiArchiveBytes = wikiLimits.document * 3 + wikiLimits.pages * 4096
export const maxWikiMarkdownBytes = wikiLimits.body * 3 + 2048
const markdownExtension = /\.(md|markdown)$/i
const markdownMetadata = /^---\r?\ntitle: ("(?:[^"\\\r\n]|\\.)*")\r?\n(home: true\r?\n)?---(?:\r?\n|$)/
const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", {fatal: true})

export function wikiPageFileStem(slug: string) {
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug) ? `${slug}_` : slug
}

export function wikiPageMarkdown(page: Pick<WikiPage, "title" | "body">, home = false) {
    return `---\ntitle: ${JSON.stringify(page.title)}\n${home ? "home: true\n" : ""}---\n${page.body}`
}

export function readWikiMarkdown(source: string, filename: string) {
    source = source.replace(/^\ufeff/, "")
    const metadata = markdownMetadata.exec(source)
    let title = /^#\s+([^\r\n]+)/.exec(source.trimStart())?.[1] ?? filename.replace(markdownExtension, "").replace(/[-_]+/g, " ")
    let body = source
    if (metadata) {
        try {title = JSON.parse(metadata[1]) as string}
        catch {throw new Error("The Markdown file has an invalid page title.")}
        body = source.slice(metadata[0].length)
    }
    title = title.trim()
    if (!title || title.length > wikiLimits.title) throw new Error(`Page titles must be 1–${wikiLimits.title} characters.`)
    if (body.length > wikiLimits.body) throw new Error(`The page “${title}” exceeds the Markdown content limit.`)
    return {title, body, home: Boolean(metadata?.[2])}
}

export function exportWikiZip(document: WikiDocument) {
    const files = Object.fromEntries(document.pages.map(page => {
        const folders = [...wikiAncestors(document.pages, page.id), page].map(item => wikiPageFileStem(item.slug))
        const path = `${folders.join("/")}/README.md`
        return [path, encoder.encode(wikiPageMarkdown(page, page.id === document.homePageId))]
    }))
    return zipSync(files, {level: 3})
}

export function importWikiZip(data: Uint8Array, current: WikiDocument, authorId: string, updatedAt: string, createId: () => string): WikiDocument {
    if (data.length < 22) throw new Error("Choose a valid wiki ZIP file.")
    if (data.length > maxWikiArchiveBytes) throw new Error("The ZIP file is too large.")
    const filesByFolder = new Map<string, string>()
    let entryCount = 0, expandedBytes = 0
    const files = unzipSync(data, {filter: ({name, size, originalSize, compression}) => {
        if (++entryCount > wikiLimits.pages * 4) throw new Error("The ZIP file contains too many entries.")
        if (!markdownExtension.test(name) || name.startsWith("__MACOSX/")) return false
        const parts = name.split("/")
        if (parts.length < 2 || parts.length > wikiLimits.depth + 2 || /[\\:\x00-\x1f]/.test(name)
            || parts.some(part => !part.trim() || part === "." || part === "..")) {
            throw new Error("Put one Markdown file in each page folder, with up to two levels of subpages.")
        }
        const folder = parts.slice(0, -1).join("/")
        if (filesByFolder.has(folder)) throw new Error(`The folder “${folder}” contains more than one Markdown file.`)
        if (filesByFolder.size >= wikiLimits.pages) throw new Error(`A wiki can contain up to ${wikiLimits.pages} pages.`)
        expandedBytes += originalSize
        if (originalSize > maxWikiMarkdownBytes || expandedBytes > maxWikiArchiveBytes || (compression === 0 && size !== originalSize)) {
            throw new Error("The Markdown files in the ZIP exceed the wiki size limit.")
        }
        filesByFolder.set(folder, name)
        return true
    }})
    if (!filesByFolder.size) throw new Error("The ZIP contains no Markdown pages.")

    const previousIds = new Map(current.pages.map(page => [page.slug, page.id]))
    const idsByFolder = new Map([...filesByFolder.keys()].map(folder => {
        const slug = wikiSlug(folder.split("/").at(-1)!)
        return [folder, previousIds.get(slug) ?? createId()]
    }))
    let homePageId: string | null = null
    const pages = [...filesByFolder].map(([folder, path]): WikiPage => {
        const parts = folder.split("/")
        const folderName = parts.pop()!
        const parentId = parts.length ? idsByFolder.get(parts.join("/")) : null
        if (parentId === undefined) throw new Error(`The parent folder of “${folder}” needs its own Markdown file.`)
        const markdown = readWikiMarkdown(decoder.decode(files[path]), folderName)
        const id = idsByFolder.get(folder)!
        if (markdown.home) {
            if (homePageId !== null) throw new Error("The ZIP marks more than one page as home.")
            homePageId = id
        }
        return {
            id, parentId, slug: wikiSlug(folderName), title: markdown.title, body: markdown.body,
            authorId, updatedAt, message: "Imported from Markdown", history: [],
        }
    })
    const document = {pages, homePageId: homePageId ?? pages.find(page => page.parentId === null)!.id}
    if (!validWikiDocument(document)) throw new Error("The ZIP has duplicate page titles or slugs, or exceeds the wiki storage limit.")
    return document
}
