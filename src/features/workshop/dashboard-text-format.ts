import type {CSSProperties} from "react"
import {isShapeFont, shapeFontStack} from "./shape-fonts.ts"

export const dashboardFontSizes = [12, 14, 16, 20, 24, 30]
export const extraDashboardFonts = {
    Manrope: '"Manrope Variable", sans-serif',
    "IBM Plex Mono": '"IBM Plex Mono", monospace',
    "Segoe UI": '"Segoe UI", sans-serif',
    Tahoma: 'Tahoma, sans-serif',
    "Trebuchet MS": '"Trebuchet MS", sans-serif',
    Garamond: 'Garamond, serif',
    "Palatino Linotype": '"Palatino Linotype", serif',
    Consolas: 'Consolas, monospace',
} as const

export type DashboardTextStyle = {
    bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean
    size?: number; font?: string; color?: string
}
export type DashboardTextRun = DashboardTextStyle & {text: string}
export type DashboardTextRow = DashboardTextRun & {align?: "left" | "center" | "right"; runs?: DashboardTextRun[]}
export type TextRange = {start: number; end: number}

const importedFontId = /^dashboard-font-[a-f0-9]{24}$/
const colorPattern = /^#[0-9a-f]{6}$/i
const segmenter = new Intl.Segmenter(undefined, {granularity: "grapheme"})

export function dashboardFontStack(font?: string) {
    if (font === "serif") return "Georgia, serif"
    if (font === "mono") return "ui-monospace, monospace"
    if (font && Object.hasOwn(extraDashboardFonts, font)) return extraDashboardFonts[font as keyof typeof extraDashboardFonts]
    if (isShapeFont(font)) return shapeFontStack(font)
    if (font && importedFontId.test(font)) return `"${font}", sans-serif`
    return undefined
}

export function cleanDashboardTextStyle(style: DashboardTextStyle): DashboardTextStyle {
    return {
        bold: style.bold === true || undefined,
        italic: style.italic === true || undefined,
        underline: style.underline === true || undefined,
        strikethrough: style.strikethrough === true || undefined,
        size: style.size && dashboardFontSizes.includes(style.size) ? style.size : undefined,
        font: dashboardFontStack(style.font) ? style.font : undefined,
        color: typeof style.color === "string" && colorPattern.test(style.color) ? style.color.toLowerCase() : undefined,
    }
}

export function dashboardTextStyle(style: DashboardTextStyle): CSSProperties {
    return {
        fontFamily: dashboardFontStack(style.font), fontSize: style.size,
        fontWeight: style.bold ? 700 : undefined,
        fontStyle: style.italic ? "italic" : undefined,
        textDecoration: [style.underline ? "underline" : "", style.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
        color: style.color,
    }
}

export function appendDashboardRun(runs: DashboardTextRun[], text: string, style: DashboardTextStyle) {
    if (!text) return
    const clean = cleanDashboardTextStyle(style)
    const previous = runs.at(-1)
    if (previous && Object.keys(clean).every(key => previous[key as keyof DashboardTextStyle] === clean[key as keyof DashboardTextStyle])) previous.text += text
    else runs.push({text, ...clean})
}

export function dashboardTextRuns(row: DashboardTextRow) {
    const runs: DashboardTextRun[] = []
    if (Array.isArray(row.runs) && row.runs.length <= row.text.length && row.runs.every(run => run && typeof run.text === "string") && row.runs.map(run => run.text).join("") === row.text) {
        for (const run of row.runs) appendDashboardRun(runs, run.text, run)
    } else appendDashboardRun(runs, row.text, row)
    return runs
}

export function sliceDashboardRuns(runs: DashboardTextRun[], start: number, end: number) {
    let offset = 0
    return runs.flatMap(run => {
        const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset)
        offset += run.text.length
        return from < to ? [{...run, text: run.text.slice(from, to)}] : []
    })
}

export function dashboardFormattingRange(text: string, selection?: TextRange): TextRange {
    let {start, end} = selection ?? {start: 0, end: text.length}
    for (const match of text.matchAll(/%[a-z_]+%/g)) {
        const from = match.index, to = from + match[0].length
        const touches = start === end ? start >= from && start < to : start < to && end > from
        if (touches) { start = Math.min(start, from); end = Math.max(end, to) }
    }
    if (start === end) return {start: 0, end: text.length}
    const graphemes = segmenter.segment(text)
    const first = graphemes.containing(start), last = graphemes.containing(end - 1)
    return {start: first?.index ?? start, end: last ? last.index + last.segment.length : end}
}

export function replaceDashboardRuns(runs: DashboardTextRun[], {start, end}: TextRange, replacement: DashboardTextRun[]) {
    const result: DashboardTextRun[] = []
    for (const run of [...sliceDashboardRuns(runs, 0, start), ...replacement, ...sliceDashboardRuns(runs, end, Infinity)]) {
        appendDashboardRun(result, run.text, run)
    }
    return result
}

export function editDashboardRowText(row: DashboardTextRow, text: string): DashboardTextRow {
    if (text === row.text) return row
    const before = [...segmenter.segment(row.text)]
    const after = [...segmenter.segment(text)]
    let first = 0
    let beforeEnd = before.length
    let afterEnd = after.length
    while (first < beforeEnd && first < afterEnd && before[first].segment === after[first].segment) first++
    while (first < beforeEnd && first < afterEnd && before[beforeEnd - 1].segment === after[afterEnd - 1].segment) {
        beforeEnd--
        afterEnd--
    }
    const start = before[first]?.index ?? row.text.length
    const end = before[beforeEnd]?.index ?? row.text.length
    const inserted = text.slice(after[first]?.index ?? text.length, after[afterEnd]?.index ?? text.length)
    const runs = dashboardTextRuns(row)
    const styleOffset = start === end ? Math.max(0, start - 1) : start
    const [style] = sliceDashboardRuns(runs, styleOffset, styleOffset + 1)
    return {...row, text, runs: replaceDashboardRuns(runs, {start, end}, [{...cleanDashboardTextStyle(style ?? row), text: inserted}])}
}

export function resolveDashboardTextRuns(row: DashboardTextRow, values: Record<string, string>) {
    const runs = dashboardTextRuns(row)
    const result: DashboardTextRun[] = []
    let cursor = 0
    for (const match of row.text.matchAll(/%([a-z_]+)%/g)) {
        for (const run of sliceDashboardRuns(runs, cursor, match.index)) appendDashboardRun(result, run.text, run)
        const [style] = sliceDashboardRuns(runs, match.index, match.index + 1)
        appendDashboardRun(result, Object.hasOwn(values, match[1]) ? values[match[1]] : match[0], style ?? row)
        cursor = match.index + match[0].length
    }
    for (const run of sliceDashboardRuns(runs, cursor, Infinity)) appendDashboardRun(result, run.text, run)
    return result
}
