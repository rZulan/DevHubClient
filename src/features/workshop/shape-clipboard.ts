import { isShapeFont, type ShapeFont } from "./shape-fonts.ts"

export { shapeFonts } from "./shape-fonts.ts"
export const defaultTextStyle = { fontFamily: "Geist", fontSize: 16, bold: false, italic: false, underline: false, strikethrough: false, textColor: "auto", letterSpacing: 0, lineHeight: 1.4, textIndent: 0 } as const

export type NoteTextStyle = {
  fontFamily: ShapeFont
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textColor: string
  letterSpacing: number
  lineHeight: number
  textIndent: number
  textAlign: "left" | "center" | "right"
}

export type RichTextRun = {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  fontFamily?: ShapeFont
  fontSize?: number
  textColor?: string
  letterSpacing?: number
}

export type CanvasItem = {
  id: string
  kind: "rectangle" | "note"
  groupId?: string
  x: number
  y: number
  width: number
  height: number
  appearance: "fill" | "outlined"
  fillColor: string
  outlineColor: string
  cornerRadius: number
  outlineWidth: number
  outlineStyle: "solid" | "dashed" | "dotted" | "double" | "none"
  text: string
  textAlign: "left" | "center" | "right"
  verticalAlign: "top" | "center" | "bottom"
  fontFamily: ShapeFont
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textColor: string
  letterSpacing: number
  lineHeight: number
  textIndent: number
  textRuns?: RichTextRun[]
  noteHeaderRuns?: RichTextRun[]
  noteBodyRuns?: RichTextRun[]
  noteHeader: string
  noteBody: string
  noteHeaderStyle: NoteTextStyle
  noteBodyStyle: NoteTextStyle
}

export function encodeShapes(items: CanvasItem[]) {
  return JSON.stringify({ type: "devhub/ideas-shapes", version: 1, items })
}

export function decodeShapes(text: string): CanvasItem[] {
  try {
    const data = JSON.parse(text)
    if (data?.type !== "devhub/ideas-shapes" || data.version !== 1 || !Array.isArray(data.items)) return []
    data.items = data.items.map(normalizeCanvasItem)
    const color = /^#[0-9a-f]{6}$/i
    if (!data.items.every((item: CanvasItem) => item && typeof item.id === "string"
      && [item.x, item.y, item.width, item.height, item.cornerRadius, item.outlineWidth].every((value) => typeof value === "number" && Number.isFinite(value))
      && item.width >= 24 && item.height >= 24 && item.cornerRadius >= 0 && item.outlineWidth >= 1 && item.outlineWidth <= 20
      && ["rectangle", "note"].includes(item.kind) && (item.groupId === undefined || (typeof item.groupId === "string" && item.groupId.length > 0 && item.groupId.length <= 100))
      && ["fill", "outlined"].includes(item.appearance) && ["solid", "dashed", "dotted", "double", "none"].includes(item.outlineStyle)
      && typeof item.text === "string" && typeof item.noteHeader === "string" && typeof item.noteBody === "string"
      && item.text.length <= 100000 && item.noteHeader.length <= 10000 && item.noteBody.length <= 100000
      && ["left", "center", "right"].includes(item.textAlign) && ["top", "center", "bottom"].includes(item.verticalAlign)
      && isShapeFont(item.fontFamily) && Number.isFinite(item.fontSize) && item.fontSize >= 1 && item.fontSize <= 1000
      && Number.isFinite(item.letterSpacing) && item.letterSpacing >= -20 && item.letterSpacing <= 100
      && Number.isFinite(item.lineHeight) && item.lineHeight >= 0.5 && item.lineHeight <= 5
      && Number.isFinite(item.textIndent) && item.textIndent >= -500 && item.textIndent <= 500
      && [item.bold, item.italic, item.underline, item.strikethrough].every((value) => typeof value === "boolean")
      && (item.textColor === "auto" || color.test(item.textColor))
      && [item.textRuns, item.noteHeaderRuns, item.noteBodyRuns].every((runs) => runs === undefined || validRuns(runs))
      && validNoteTextStyle(item.noteHeaderStyle) && validNoteTextStyle(item.noteBodyStyle)
      && color.test(item.fillColor) && color.test(item.outlineColor))) return []
    return data.items
  } catch { return [] }
}

export function normalizeCanvasItem(item: Partial<CanvasItem>): CanvasItem {
  const normalized = { ...defaultTextStyle, kind: "rectangle", text: "", textAlign: "center", verticalAlign: "center", noteHeader: "", noteBody: "", ...item } as CanvasItem
  const shared = noteTextStyleFromItem(normalized)
  normalized.noteHeaderStyle = { ...shared, ...item.noteHeaderStyle }
  normalized.noteBodyStyle = { ...shared, ...item.noteBodyStyle }
  return normalized
}

export function noteTextStyleFromItem(item: Pick<CanvasItem, "fontFamily" | "fontSize" | "bold" | "italic" | "underline" | "strikethrough" | "textColor" | "letterSpacing" | "lineHeight" | "textIndent" | "textAlign">): NoteTextStyle {
  return { fontFamily: item.fontFamily, fontSize: item.fontSize, bold: item.bold, italic: item.italic, underline: item.underline, strikethrough: item.strikethrough, textColor: item.textColor, letterSpacing: item.letterSpacing, lineHeight: item.lineHeight, textIndent: item.textIndent, textAlign: item.textAlign }
}

function validRuns(value: unknown): value is RichTextRun[] {
  const color = /^#[0-9a-f]{6}$/i
  return Array.isArray(value) && value.length <= 5000 && value.every((run) => run && typeof run === "object"
    && typeof run.text === "string" && run.text.length <= 100000
    && [run.bold, run.italic, run.underline, run.strikethrough].every((flag) => typeof flag === "boolean")
    && (run.fontFamily === undefined || isShapeFont(run.fontFamily))
    && (run.fontSize === undefined || Number.isFinite(run.fontSize) && run.fontSize >= 1 && run.fontSize <= 1000)
    && (run.textColor === undefined || run.textColor === "auto" || color.test(run.textColor))
    && (run.letterSpacing === undefined || Number.isFinite(run.letterSpacing) && run.letterSpacing >= -20 && run.letterSpacing <= 100))
}

function validNoteTextStyle(style: NoteTextStyle) {
  const color = /^#[0-9a-f]{6}$/i
  return !!style && isShapeFont(style.fontFamily) && Number.isFinite(style.fontSize) && style.fontSize >= 1 && style.fontSize <= 1000
    && Number.isFinite(style.letterSpacing) && style.letterSpacing >= -20 && style.letterSpacing <= 100
    && Number.isFinite(style.lineHeight) && style.lineHeight >= 0.5 && style.lineHeight <= 5
    && Number.isFinite(style.textIndent) && style.textIndent >= -500 && style.textIndent <= 500
    && [style.bold, style.italic, style.underline, style.strikethrough].every(value => typeof value === "boolean")
    && (style.textColor === "auto" || color.test(style.textColor)) && ["left", "center", "right"].includes(style.textAlign)
}

export function cloneShapes(items: CanvasItem[], offset: number, createId: () => string): CanvasItem[] {
  const groupIds = new Map<string, string>()
  return items.map((item) => {
    const copy = { ...item, id: createId(), x: item.x + offset, y: item.y + offset }
    if (item.groupId) {
      copy.groupId = groupIds.get(item.groupId) ?? (() => { const id = createId(); groupIds.set(item.groupId!, id); return id })()
    }
    return copy
  })
}
