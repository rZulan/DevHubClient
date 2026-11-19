import assert from "node:assert/strict"
import test from "node:test"
import {unzipSync, zipSync} from "fflate"
import {exportWikiZip, importWikiZip, maxWikiMarkdownBytes, readWikiMarkdown, wikiPageMarkdown} from "../src/features/workshop/wiki-files.ts"

const timestamp = "2026-11-19T00:00:00Z"
const emptyWiki = {pages: [], homePageId: null}
const makePage = (id, slug, title, parentId = null) => ({
    id, slug, title, parentId, body: "## Getting started\n\nSee [Setup](setup.md).\n", authorId: "author",
    updatedAt: timestamp, message: "", history: [],
})
const pack = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) =>
    [path, typeof content === "string" ? new TextEncoder().encode(content) : content],
)))
const restore = (archive, current = emptyWiki) => {
    let nextId = 0
    return importWikiZip(archive, current, "author", timestamp, () => `imported-${++nextId}`)
}

test("whole-wiki ZIP round trips nested Markdown, slugs, the home page, and matching page IDs", () => {
    const pages = [
        makePage("guide", "guide", "Guide"),
        makePage("setup", "setup", "Setup / first run", "guide"),
        makePage("tool", "aux", 'Aux "tool" ✨', "setup"),
    ]
    const original = {pages, homePageId: "setup"}
    const archive = exportWikiZip(original)
    assert.deepEqual(Object.keys(unzipSync(archive)), ["guide/README.md", "guide/setup/README.md", "guide/setup/aux_/README.md"])
    const restored = restore(archive, original)
    assert.equal(restored.homePageId, "setup")
    assert.deepEqual(restored.pages.map(({id, slug, title, parentId, body}) => ({id, slug, title, parentId, body})),
        pages.map(({id, slug, title, parentId, body}) => ({id, slug, title, parentId, body})))
})

test("Markdown page files preserve the exact body and recognize an ordinary page heading", () => {
    const body = "---\ncustom: data\n---\n\n# The first section\n\n**日本語**\n"
    assert.deepEqual(readWikiMarkdown(wikiPageMarkdown({title: 'A "quoted" title', body}), "anything.md"),
        {title: 'A "quoted" title', body, home: false})
    assert.deepEqual(readWikiMarkdown("# Setup guide\n\nInstructions", "setup.md"),
        {title: "Setup guide", body: "# Setup guide\n\nInstructions", home: false})
    assert.equal(readWikiMarkdown("content", "meeting-notes.markdown").title, "meeting notes")
})

test("ZIP imports reject missing parents, ambiguous page folders, and oversized Markdown", () => {
    assert.throws(() => restore(pack({"guide/setup/README.md": "# Setup"})), /parent folder/)
    assert.throws(() => restore(pack({"guide/README.md": "# Guide", "guide/other.md": "# Other"})), /more than one Markdown/)
    assert.throws(() => restore(pack({"../README.md": "# Invalid"})), /page folder/)
    assert.throws(() => restore(pack({"guide/README.md": new Uint8Array(maxWikiMarkdownBytes + 1)})), /size limit/)
})
