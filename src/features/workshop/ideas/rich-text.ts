import type { CanvasItem, RichTextRun } from "../shape-clipboard"
import { isShapeFont, type ShapeFont } from "../shape-fonts.ts"

export type CharacterFormat = "bold" | "italic" | "underline" | "strikethrough"
export type CharacterStyleChanges = Partial<Pick<RichTextRun, CharacterFormat | "fontFamily" | "fontSize" | "textColor" | "letterSpacing">>
export type SelectedCharacterStyle = { fontFamily: ShapeFont | ""; fontSize: number | ""; textColor: string; letterSpacing: number | "" }

export type TextPart = "text" | "noteHeader" | "noteBody"
export type RunsField = "textRuns" | "noteHeaderRuns" | "noteBodyRuns"

export function runsField(part: TextPart): RunsField {
  return part === "text" ? "textRuns" : part === "noteHeader" ? "noteHeaderRuns" : "noteBodyRuns"
}

export function runsFor(item: CanvasItem, part: TextPart): RichTextRun[] {
  const saved = item[runsField(part)]
  if (saved?.length && saved.map((run) => run.text).join("") === item[part]) return saved
  const style = part === "noteHeader" ? item.noteHeaderStyle : part === "noteBody" ? item.noteBodyStyle : item
  return item[part] ? [{ text: item[part], bold: style.bold, italic: style.italic, underline: style.underline, strikethrough: style.strikethrough }] : []
}

export function parseRichText(root: HTMLElement, item: CanvasItem, maxLength: number) {
  const output: RichTextRun[] = []
  const part = root.dataset.notePart === "header" ? "noteHeader" : root.dataset.notePart === "body" ? "noteBody" : "text"
  const source = part === "noteHeader" ? item.noteHeaderStyle : part === "noteBody" ? item.noteBodyStyle : item
  const base: Omit<RichTextRun, "text"> = { bold: source.bold, italic: source.italic, underline: source.underline, strikethrough: source.strikethrough }

  function append(text: string, style: Omit<RichTextRun, "text">) {
    if (!text) return
    const previous = output.at(-1)
    if (previous && sameStyle(previous, style)) previous.text += text
    else output.push({ text, ...style })
  }

  function visit(node: Node, inherited: Omit<RichTextRun, "text">, block = false) {
    if (node.nodeType === Node.TEXT_NODE) { append(node.textContent ?? "", inherited); return }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === "BR") { append("\n", inherited); return }

    const style = styleFromElement(node, inherited)
    const isBlock = node.tagName === "DIV" || node.tagName === "P"
    if (isBlock && output.length && !output.at(-1)!.text.endsWith("\n")) append("\n", style)
    node.childNodes.forEach((child) => visit(child, style, isBlock))
    if (block && isBlock && node.nextSibling && !output.at(-1)?.text.endsWith("\n")) append("\n", style)
  }

  root.childNodes.forEach((node) => visit(node, base))
  let remaining = maxLength
  const runs = output.flatMap((run) => {
    if (remaining <= 0) return []
    const text = run.text.slice(0, remaining)
    remaining -= text.length
    return text ? [{ ...run, text }] : []
  })
  return { text: runs.map((run) => run.text).join(""), runs }
}

export function formatRunsRange(runs: RichTextRun[], start: number, end: number, format: CharacterFormat) {
  if (start < 0 || end <= start) return runs
  const selected: RichTextRun[] = []
  let cursor = 0
  for (const run of runs) {
    const runEnd = cursor + run.text.length
    if (runEnd > start && cursor < end) selected.push(run)
    cursor = runEnd
  }
  if (!selected.length) return runs

  const value = !selected.every((run) => run[format])
  const output: RichTextRun[] = []
  cursor = 0
  for (const run of runs) {
    const runStart = cursor
    const runEnd = cursor + run.text.length
    const selectionStart = Math.max(start, runStart)
    const selectionEnd = Math.min(end, runEnd)
    if (selectionStart >= selectionEnd) appendRun(output, run)
    else {
      appendRun(output, { ...run, text: run.text.slice(0, selectionStart - runStart) })
      appendRun(output, { ...run, [format]: value, text: run.text.slice(selectionStart - runStart, selectionEnd - runStart) })
      appendRun(output, { ...run, text: run.text.slice(selectionEnd - runStart) })
    }
    cursor = runEnd
  }
  return output
}

export function styleRunsRange(runs: RichTextRun[], start: number, end: number, changes: CharacterStyleChanges) {
  if (start < 0 || end <= start) return runs
  const output: RichTextRun[] = []
  let cursor = 0
  for (const run of runs) {
    const runStart = cursor
    const runEnd = cursor + run.text.length
    const selectionStart = Math.max(start, runStart)
    const selectionEnd = Math.min(end, runEnd)
    if (selectionStart >= selectionEnd) appendRun(output, run)
    else {
      appendRun(output, { ...run, text: run.text.slice(0, selectionStart - runStart) })
      appendRun(output, { ...run, ...changes, text: run.text.slice(selectionStart - runStart, selectionEnd - runStart) })
      appendRun(output, { ...run, text: run.text.slice(selectionEnd - runStart) })
    }
    cursor = runEnd
  }
  return output
}

export function selectedCharacterStyle(item: CanvasItem, part: TextPart, start: number, end: number): SelectedCharacterStyle | undefined {
  if (start < 0 || end < start) return undefined
  const base = part === "noteHeader" ? item.noteHeaderStyle : part === "noteBody" ? item.noteBodyStyle : item
  const runs = runsFor(item, part)
  if (!runs.length) return { fontFamily: base.fontFamily, fontSize: base.fontSize, textColor: base.textColor, letterSpacing: base.letterSpacing }
  const rangeStart = start === end ? Math.max(0, Math.min(start > 0 ? start - 1 : 0, item[part].length - 1)) : start
  const rangeEnd = start === end ? rangeStart + 1 : end
  const selected: RichTextRun[] = []
  let cursor = 0
  for (const run of runs) {
    const runEnd = cursor + run.text.length
    if (cursor < rangeEnd && runEnd > rangeStart) selected.push(run)
    cursor = runEnd
  }
  if (!selected.length) return undefined
  return {
    fontFamily: sharedValue(selected.map((run) => run.fontFamily ?? base.fontFamily)),
    fontSize: sharedValue(selected.map((run) => run.fontSize ?? base.fontSize)),
    textColor: sharedValue(selected.map((run) => run.textColor ?? base.textColor)),
    letterSpacing: sharedValue(selected.map((run) => run.letterSpacing ?? base.letterSpacing)),
  }
}

function appendRun(output: RichTextRun[], run: RichTextRun) {
  if (!run.text) return
  const previous = output.at(-1)
  if (previous && sameStyle(previous, run)) previous.text += run.text
  else output.push(run)
}

function styleFromElement(element: HTMLElement, inherited: Omit<RichTextRun, "text">) {
  const next = { ...inherited }
  const tag = element.tagName
  if (tag === "B" || tag === "STRONG") next.bold = true
  if (tag === "I" || tag === "EM") next.italic = true
  if (tag === "U") next.underline = true
  if (tag === "S" || tag === "STRIKE") next.strikethrough = true
  if (element.dataset.richRun === "true") {
    next.bold = element.dataset.bold === "true"
    next.italic = element.dataset.italic === "true"
    next.underline = element.dataset.underline === "true"
    next.strikethrough = element.dataset.strikethrough === "true"
    next.fontFamily = isShapeFont(element.dataset.fontFamily) ? element.dataset.fontFamily : undefined
    next.fontSize = optionalNumber(element.dataset.fontSize)
    next.textColor = element.dataset.textColor || undefined
    next.letterSpacing = optionalNumber(element.dataset.letterSpacing)
  }
  const weight = element.style.fontWeight
  if (weight) next.bold = weight === "bold" || Number.parseInt(weight, 10) >= 600
  if (element.style.fontStyle) next.italic = element.style.fontStyle === "italic"
  if (element.style.textDecoration) {
    next.underline = element.style.textDecoration.includes("underline")
    next.strikethrough = element.style.textDecoration.includes("line-through")
  }
  return next
}

function sameStyle(run: RichTextRun, style: Omit<RichTextRun, "text">) {
  return run.bold === style.bold && run.italic === style.italic && run.underline === style.underline && run.strikethrough === style.strikethrough
    && run.fontFamily === style.fontFamily && run.fontSize === style.fontSize && run.textColor === style.textColor && run.letterSpacing === style.letterSpacing
}

function optionalNumber(value: string | undefined) {
  if (!value) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function sharedValue<T extends string | number>(values: T[]): T | "" {
  return values.every((value) => value === values[0]) ? values[0] : ""
}
