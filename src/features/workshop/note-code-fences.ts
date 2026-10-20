export type NoteTextSegment = {type: "text"; start: number; end: number; text: string}
export type NoteCodeSegment = {type: "code"; start: number; end: number; source: string; language: string; theme: string; indent: string; closed: boolean}
export type NoteSegment = NoteTextSegment | NoteCodeSegment

// Match Markdown fences, not inline backticks. Offsets always refer to the original note.
export function splitNoteBody(body: string): NoteSegment[] {
    const segments: NoteSegment[] = []
    const lines = [...body.matchAll(/[^\n]*(?:\n|$)/g)].filter(match => match[0].length)
    let textStart = 0
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const opening = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)\r?\n?$/.exec(line[0])
        if (!opening || opening[2][0] === "`" && opening[3].includes("`")) continue
        const start = line.index!
        segments.push({type: "text", start: textStart, end: start, text: body.slice(textStart, start)})
        const contentStart = start + line[0].length
        let closing = i + 1
        const closePattern = new RegExp(`^ {0,3}${opening[2][0]}{${opening[2].length},}[ \\t]*\\r?\\n?$`)
        while (closing < lines.length && !closePattern.test(lines[closing][0])) closing++
        const closed = closing < lines.length
        const contentEnd = closed ? lines[closing].index! : body.length
        const end = closed ? lines[closing].index! + lines[closing][0].length : body.length
        let source = body.slice(contentStart, contentEnd)
        if (closed) source = source.replace(/\r?\n$/, "")
        if (opening[1]) source = source.split("\n").map(line => line.startsWith(opening[1]) ? line.slice(opening[1].length) : line).join("\n")
        const info = opening[3].trim()
        const language = info.split(/\s/)[0] || "text"
        const theme = /(?:^|\s)theme=([\w-]+)(?:\s|$)/.exec(info)?.[1] ?? "material-theme-darker"
        segments.push({type: "code", start, end, source, language, theme, indent: opening[1], closed})
        textStart = end
        i = closed ? closing : lines.length
    }
    segments.push({type: "text", start: textStart, end: body.length, text: body.slice(textStart)})
    return segments
}

export function replaceNoteCode(body: string, block: NoteCodeSegment, source: string, language: string, theme: string): string {
    // A longer fence keeps literal backticks inside snippets from ending the block.
    const longestRun = Math.max(2, ...[...source.matchAll(/`+/g)].map(match => match[0].length))
    const fence = "`".repeat(longestRun + 1)
    const content = source.split("\n").map(line => block.indent + line).join("\n")
    const replacement = `${block.indent}${fence}${language} theme=${theme}\n${content}\n${block.indent}${fence}${body.slice(block.start, block.end).endsWith("\n") ? "\n" : ""}`
    return body.slice(0, block.start) + replacement + body.slice(block.end)
}
