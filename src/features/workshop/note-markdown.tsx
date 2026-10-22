import {Children, isValidElement, useId, useState, type ComponentProps, type ReactNode} from "react"
import Markdown, {type Components} from "react-markdown"
import remarkGfm from "remark-gfm"
import {noteCodeTheme, noteCodeThemeFromMeta} from "./shiki-highlighter.ts"
import {NoteCodeTokens} from "./note-code-highlight.tsx"
import {useNoteCodeHighlight} from "./use-note-code-highlight.ts"

function codeText(children: ReactNode): string {
    return Children.toArray(children).map(child => {
        if (typeof child === "string" || typeof child === "number") return String(child)
        return isValidElement<{children?: ReactNode}>(child) ? codeText(child.props.children) : ""
    }).join("")
}

function NoteCodeBlock({children, compact = false}: {children: ReactNode; compact?: boolean}) {
    const language = isValidElement<ComponentProps<"code">>(children)
        ? /(?:^|\s)language-([^\s]+)/.exec(children.props.className ?? "")?.[1] : undefined
    const source = codeText(children)
    const theme = isValidElement<{node?: {data?: {meta?: unknown}}}>(children) ? noteCodeThemeFromMeta(children.props.node?.data?.meta) : noteCodeTheme.id
    const [copyStatus, setCopyStatus] = useState("Copy")
    const {tokens, palette} = useNoteCodeHighlight(source, language, theme)
    async function copy() {
        try {await navigator.clipboard.writeText(source); setCopyStatus("Copied")}
        catch {setCopyStatus("Copy unavailable")}
    }
    return <div className="note-code-block" data-theme={palette.id} style={{background: palette.background, color: palette.foreground, colorScheme: palette.type}}>
        <div className="note-code-header"><div className="note-code-labels"><span>{language ?? "Plain text"}</span>{!compact && <span className="note-code-theme">{palette.label}</span>}</div>
            {!compact && <button type="button" aria-label="Copy code" onClick={() => void copy()} onBlur={() => setCopyStatus("Copy")}><span aria-live="polite">{copyStatus}</span></button>}
        </div>
        <pre tabIndex={compact ? undefined : 0} aria-label={`${language ?? "Plain text"} code block`}><code className={language ? `language-${language}` : undefined} data-highlighter={tokens ? "shiki" : undefined}>
            <NoteCodeTokens tokens={tokens} source={source}/>
        </code></pre>
    </div>
}

function MarkdownLink({href, children, ...props}: ComponentProps<"a">) {
    if (!href) return <span>{children}</span>
    const internal = href.startsWith("#")
    return <a {...props} href={href} target={internal ? undefined : "_blank"} rel={internal ? undefined : "noreferrer"}>{children}</a>
}

const components: Components = {
    code: ({node: _node, ...props}) => <code {...props}/>,
    pre: ({children}) => <NoteCodeBlock>{children}</NoteCodeBlock>,
    img: ({node: _node, src, ...props}) => src ? <img {...props} src={src} alt={props.alt ?? ""} loading="lazy"/> : <span>{props.alt}</span>,
    input: ({checked}) => <span className="note-task-checkbox" role="img" aria-label={checked ? "Completed task" : "Incomplete task"}>{checked ? "☑" : "☐"}</span>,
    table: ({children}) => <div className="note-markdown-table"><table>{children}</table></div>,
}
const compactComponents: Components = {
    ...components,
    // Card previews open the note; links become interactive in the reading view.
    a: ({children}) => <span className="note-markdown-link">{children}</span>,
    img: ({alt}) => <span>{alt || "Image"}</span>,
    pre: ({children}) => <NoteCodeBlock compact>{children}</NoteCodeBlock>,
}

export function NoteMarkdown({body, compact = false}: {body: string; compact?: boolean}) {
    const prefix = `note-${useId().replaceAll(":", "")}-`
    const heading: Components["h2"] = ({node: _node, id, ...props}) => <h2 {...props} id={id === "footnote-label" ? `${prefix}footnote-label` : id}/>
    const link: Components["a"] = ({node: _node, ...props}) => <MarkdownLink {...props} aria-describedby={props["aria-describedby"] === "footnote-label" ? `${prefix}footnote-label` : props["aria-describedby"]}/>
    return <div className={`note-markdown${compact ? " note-markdown-compact" : ""}`}>
        <Markdown remarkPlugins={[remarkGfm]} remarkRehypeOptions={{clobberPrefix: prefix}} skipHtml components={{...components, a: link, ...(compact ? compactComponents : {}), h2: heading}}>{body}</Markdown>
    </div>
}

export function NoteMarkdownGuide() {
    return <details className="notes-markdown-guide">
        <summary>Markdown formatting guide</summary>
        <dl>
            <div><dt>Heading levels 1–6</dt><dd><pre>{"# Heading 1\n## Heading 2\n### Heading 3\n#### Heading 4\n##### Heading 5\n###### Heading 6"}</pre></dd></div>
            <div><dt>Text formatting</dt><dd><code>{"**bold**, *italic*, ~~strikethrough~~, `inline code`"}</code></dd></div>
            <div><dt>Lists and checklists</dt><dd><pre>{"- Bullet\n  - Nested bullet\n1. Numbered item\n- [ ] Task\n- [x] Completed task"}</pre></dd></div>
            <div><dt>Links and images</dt><dd><pre>{'[Link text](https://example.com "Title")\n![Image description](image-url "Caption")'}</pre></dd></div>
            <div><dt>Quotes and dividers</dt><dd><pre>{"> A quote\n>\n> Another paragraph\n\n---"}</pre></dd></div>
            <div><dt>Code blocks</dt><dd>
                <p>Type <code>{"```"}</code> on a new line to open a code block editor.</p>
                <p>Choose a language from <strong>Grammar</strong> (or Plain text) and a color scheme from <strong>Theme</strong>, then type or paste your code.</p>
                <p>Tab inserts four spaces. Shift+Tab moves focus. Continue your note in the blank area below the block, or select <strong>Remove</strong> to delete it.</p>
            </dd></div>
            <div><dt>Tables and alignment</dt><dd><pre>{"| Left | Center | Right |\n| :--- | :---: | ---: |\n| One | Two | Three |"}</pre></dd></div>
            <div><dt>Footnotes and reference links</dt><dd><pre>{"A detail[^1] and a [reference link][docs].\n\n[^1]: More information.\n[docs]: https://example.com"}</pre></dd></div>
            <div><dt>Paragraphs and line breaks</dt><dd>Leave a blank line for a new paragraph. End a line with two spaces or a backslash for a line break.</dd></div>
            <div><dt>Literal punctuation</dt><dd><code>{"\\*text without emphasis\\*"}</code></dd></div>
        </dl>
    </details>
}
