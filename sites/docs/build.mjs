import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises"
import {createElement as h} from "react"
import {renderToStaticMarkup} from "react-dom/server"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

const pages = [
    {path: "", title: "Getting started", source: "getting-started.md"},
    {path: "workshop/", title: "Workshop tools", source: "workshop.md"},
    {path: "erd/", title: "ERD import and export", source: "erd.md"},
]

for (const page of pages) {
    const markdown = await readFile(new URL(page.source, import.meta.url), "utf8")
    const content = h("html", {lang: "en"},
        h("head", null,
            h("meta", {charSet: "UTF-8"}),
            h("meta", {name: "viewport", content: "width=device-width, initial-scale=1.0"}),
            h("title", null, page.title + " | Zevont Docs"),
            h("link", {rel: "stylesheet", href: "/docs.css"})),
        h("body", null,
            h("header", null, h("a", {href: "/", className: "brand"}, "Zevont Docs"),
                h("a", {href: "https://dev-hub.site"}, "Open Zevont")),
            h("div", {className: "layout"},
                h("nav", {"aria-label": "Guides"}, h("strong", null, "Guides"),
                    pages.map(item => h("a", {key: item.path, href: "/" + item.path, "aria-current": item === page ? "page" : undefined}, item.title))),
                h("main", null, h(Markdown, {remarkPlugins: [remarkGfm]}, markdown)))))
    const directory = new URL("dist/" + page.path, import.meta.url)
    await mkdir(directory, {recursive: true})
    await writeFile(new URL("index.html", directory), "<!doctype html>\n" + renderToStaticMarkup(content) + "\n")
}

await copyFile(new URL("docs.css", import.meta.url), new URL("dist/docs.css", import.meta.url))
console.log("Built " + pages.length + " pages in sites/docs/dist.")
