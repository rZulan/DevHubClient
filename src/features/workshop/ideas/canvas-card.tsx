import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react"
import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"

import { resizeRectangle, type ResizeDirection } from "../resize-rectangle"
import type { CanvasItem } from "../shape-clipboard"
import { ensureGoogleFont, shapeFontStack } from "../shape-fonts"
import { RichTextContent } from "./rich-text-content"
import { formatRunsRange, parseRichText, runsField, runsFor, styleRunsRange, type CharacterFormat, type CharacterStyleChanges, type TextPart } from "./rich-text"
import { shapeTextColor } from "./shape-presentation"

type CanvasCardProps = {
  selectionBox?: boolean
  showResizeHandles?: boolean
  canDrag: boolean
  item: CanvasItem
  onChange: (next: CanvasItem) => void
  onDragChange: (next: CanvasItem, direction: ResizeDirection | undefined, bypass: boolean) => void
  onDragEnd: () => void
  onSelect: (toggle: boolean, resizing: boolean) => boolean
  selected: boolean
  layer: number
  zoom: number
  remoteSelectors?: string[]
  textStyleCommand?: TextStyleCommand
  onTextSelectionChange?: (selection: TextSelection | undefined) => void
}

export type TextSelection = { itemId: string; part: TextPart; start: number; end: number }
export type TextStyleCommand = TextSelection & { id: number; changes: CharacterStyleChanges }

export function CanvasCard({ selectionBox = false, showResizeHandles = true, canDrag, item, onChange, onDragChange, onDragEnd, onSelect, selected, layer, zoom, remoteSelectors = [], textStyleCommand, onTextSelectionChange }: CanvasCardProps) {
  const dragStart = useRef<{ pointerId: number; pointerX: number; pointerY: number; item: CanvasItem; zoom: number; direction?: ResizeDirection } | null>(null)
  const editRef = useRef<HTMLElement | null>(null)
  const editingInitialRuns = useRef(runsFor(item, "text"))
  const savedSelection = useRef<TextSelection | undefined>(undefined)
  const appliedTextStyleCommand = useRef(0)
  const [resizing, setResizing] = useState<ResizeDirection>()
  const [editingPart, setEditingPart] = useState<TextPart>()
  const screenScale = 1 / zoom

  useEffect(() => ensureGoogleFont(item.fontFamily), [item.fontFamily])
  useEffect(() => {
    if (item.kind !== "note") return
    ensureGoogleFont(item.noteHeaderStyle.fontFamily)
    ensureGoogleFont(item.noteBodyStyle.fontFamily)
  }, [item.kind, item.noteHeaderStyle.fontFamily, item.noteBodyStyle.fontFamily])
  useEffect(() => {
    for (const run of [...(item.textRuns ?? []), ...(item.noteHeaderRuns ?? []), ...(item.noteBodyRuns ?? [])]) {
      if (run.fontFamily) ensureGoogleFont(run.fontFamily)
    }
  }, [item.textRuns, item.noteHeaderRuns, item.noteBodyRuns])

  useLayoutEffect(() => {
    const editor = editRef.current
    if (!editingPart || !editor) return
    editor.focus({ preventScroll: true })
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [editingPart])

  useEffect(() => {
    if (!editingPart) return
    function captureSelection() {
      const editor = editRef.current
      const selection = window.getSelection()
      if (!editor || !selection?.rangeCount) return
      const offsets = textSelectionOffsets(editor, selection.getRangeAt(0))
      if (!offsets) return
      const next = { itemId: item.id, part: editingPart!, ...offsets }
      savedSelection.current = next
      onTextSelectionChange?.(next)
    }
    function closeWhenLeaving(event: globalThis.PointerEvent) {
      const target = event.target
      if (!(target instanceof Element) || target.closest("[data-shape-properties], .workshop-inline-text-toolbar") || editRef.current?.contains(target)) return
      setEditingPart(undefined)
      savedSelection.current = undefined
      onTextSelectionChange?.(undefined)
    }
    document.addEventListener("selectionchange", captureSelection)
    document.addEventListener("pointerdown", closeWhenLeaving, true)
    return () => {
      document.removeEventListener("selectionchange", captureSelection)
      document.removeEventListener("pointerdown", closeWhenLeaving, true)
    }
  }, [editingPart, item.id, onTextSelectionChange])

  useLayoutEffect(() => {
    const editor = editRef.current
    if (!editor || !editingPart || !textStyleCommand || textStyleCommand.id === appliedTextStyleCommand.current
      || textStyleCommand.itemId !== item.id || textStyleCommand.part !== editingPart) return
    appliedTextStyleCommand.current = textStyleCommand.id
    const parsed = parseRichText(editor, item, editingPart === "noteHeader" ? 10000 : 100000)
    const runs = styleRunsRange(parsed.runs, textStyleCommand.start, textStyleCommand.end, textStyleCommand.changes)
    editingInitialRuns.current = runs
    onChange({ ...item, [editingPart]: parsed.text, [runsField(editingPart)]: runs })
    requestAnimationFrame(() => restoreTextSelection(editor, textStyleCommand.start, textStyleCommand.end))
  }, [editingPart, item, onChange, textStyleCommand])

  function beginDrag(event: PointerEvent<HTMLElement>, direction?: ResizeDirection) {
    if (editingPart || event.button !== 0 || !event.isPrimary || !canDrag || dragStart.current) return
    event.preventDefault()
    event.stopPropagation()
    if (!onSelect(!direction && (event.shiftKey || event.ctrlKey || event.metaKey), !!direction)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, item, zoom, direction }
    setResizing(direction)
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    event.stopPropagation()
    const dx = (event.clientX - start.pointerX) / start.zoom
    const dy = (event.clientY - start.pointerY) / start.zoom
    onDragChange(start.direction
      ? { ...start.item, ...resizeRectangle(start.item, start.direction, dx, dy) }
      : { ...start.item, x: start.item.x + dx, y: start.item.y + dy }, start.direction, event.altKey)
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) return
    event.stopPropagation()
    dragStart.current = null
    setResizing(undefined)
    onDragEnd()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const dragHandlers = {
    onLostPointerCapture: endDrag,
    onPointerCancel: endDrag,
    onPointerDown: (event: PointerEvent<HTMLElement>) => beginDrag(event),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
  }

  function beginEditing(part: TextPart, event: MouseEvent<HTMLElement>) {
    if (selectionBox || !canDrag) return
    event.preventDefault()
    event.stopPropagation()
    onSelect(false, false)
    onDragEnd()
    editingInitialRuns.current = runsFor(item, part).map((run) => ({ ...run }))
    savedSelection.current = undefined
    onTextSelectionChange?.(undefined)
    setEditingPart(part)
  }

  function beginEditingAtPoint(event: MouseEvent<HTMLElement>) {
    if (item.kind !== "note") {
      beginEditing("text", event)
      return
    }
    const header = event.currentTarget.querySelector<HTMLElement>("[data-note-part=header]")
    const shape = event.currentTarget.getBoundingClientRect()
    const headerBottom = header?.getBoundingClientRect().bottom ?? shape.top + shape.height * .3
    beginEditing(event.clientY <= headerBottom ? "noteHeader" : "noteBody", event)
  }

  function formatSelection(format: CharacterFormat) {
    if (!editingPart || !editRef.current) return
    const editor = editRef.current
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return

    const before = range.cloneRange()
    before.selectNodeContents(editor)
    before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length
    const end = start + range.toString().length
    const parsed = parseRichText(editor, item, editingPart === "noteHeader" ? 10000 : 100000)
    const runs = formatRunsRange(parsed.runs, start, end, format)
    editingInitialRuns.current = runs
    onChange({ ...item, [editingPart]: parsed.text, [runsField(editingPart)]: runs })
    requestAnimationFrame(() => restoreTextSelection(editor, start, end))
  }

  function editorProps(part: TextPart, maxLength: number) {
    const active = editingPart === part
    return {
      ref: active ? (element: HTMLElement | null) => { editRef.current = element } : undefined,
      contentEditable: active,
      suppressContentEditableWarning: true,
      "data-editing": active,
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!active || event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-shape-properties]")) return
        setEditingPart(undefined)
        savedSelection.current = undefined
        onTextSelectionChange?.(undefined)
      },
      onPointerDown: (event: PointerEvent<HTMLElement>) => { if (active) event.stopPropagation() },
      onBeforeInput: () => {
        if (!active || !editRef.current) return
        const selection = window.getSelection()
        if (!selection?.rangeCount || !selection.getRangeAt(0).collapsed) return
        const offsets = textSelectionOffsets(editRef.current, selection.getRangeAt(0))
        if (offsets) restoreTextSelection(editRef.current, offsets.start, offsets.start)
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (!active) return
        event.stopPropagation()
        if (event.key === "Escape") { event.preventDefault(); event.currentTarget.blur() }
        if (part === "noteHeader" && event.key === "Enter") { event.preventDefault(); event.currentTarget.blur() }
      },
      onInput: (event: FormEvent<HTMLElement>) => {
        if (!active) return
        const richText = parseRichText(event.currentTarget, item, maxLength)
        onChange({ ...item, [part]: richText.text, [runsField(part)]: richText.runs })
      },
    }
  }

  const style = {
    left: item.x,
    top: item.y,
    width: item.width,
    height: item.height,
    borderRadius: item.cornerRadius,
    border: 0,
    background: item.appearance === "fill" ? item.fillColor : "transparent",
    boxShadow: "none",
    zIndex: layer,
  }

  return (
    <section aria-label={selectionBox ? "Selection bounds" : item.kind === "note" ? "Note" : "Rectangle shape"} aria-description={!selectionBox ? "Double-click text to edit" : undefined} className={`workshop-diagram-node${selectionBox ? " workshop-group-bounds" : ""}${item.kind === "note" ? " workshop-note-shape" : ""}${editingPart ? " editing-text" : ""}`} data-canvas-item-id={selectionBox ? undefined : item.id} data-canvas-selection={selectionBox || undefined} data-shape="process" data-selected={selected && canDrag} {...dragHandlers} style={style} onDoubleClick={beginEditingAtPoint} onWheel={(event) => { if (dragStart.current) event.stopPropagation() }}>
      {editingPart && <div aria-label="Selected text formatting" className="workshop-inline-text-toolbar" role="toolbar" style={{ "--canvas-ui-scale": screenScale } as CSSProperties} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }}>
        {([{ format: "bold", label: "Bold", icon: Bold }, { format: "italic", label: "Italic", icon: Italic }, { format: "underline", label: "Underline", icon: Underline }, { format: "strikethrough", label: "Strikethrough", icon: Strikethrough }] as const).map(({ format, label, icon: Icon }) => <button
          aria-label={`${label} selected text`}
          key={format}
          onClick={(event) => { if (event.detail === 0) formatSelection(format) }}
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); formatSelection(format) }}
          title={`${label} selected text`}
          type="button"
        ><Icon /></button>)}
      </div>}
      <span aria-hidden="true" className="workshop-shape-outline" style={{ borderColor: item.outlineColor, borderWidth: item.outlineWidth, borderStyle: item.outlineStyle }} />
      {!selectionBox && remoteSelectors.length > 0 && <div className="workshop-remote-selectors" style={{ "--canvas-ui-scale": screenScale } as CSSProperties}>
        {remoteSelectors.map(username => <span key={username}>{username}</span>)}
      </div>}
      {!selectionBox && item.kind === "note" && <div className="workshop-note-content">
        <strong data-note-part="header" style={noteTextCss(item.noteHeaderStyle, item.fillColor)} onDoubleClick={(event) => beginEditing("noteHeader", event)} {...editorProps("noteHeader", 10000)}><RichTextContent runs={editingPart === "noteHeader" ? editingInitialRuns.current : runsFor(item, "noteHeader")} /></strong>
        <p data-note-part="body" style={{ ...noteTextCss(item.noteBodyStyle, item.fillColor), opacity: 1 }} onDoubleClick={(event) => beginEditing("noteBody", event)} {...editorProps("noteBody", 100000)}><RichTextContent runs={editingPart === "noteBody" ? editingInitialRuns.current : runsFor(item, "noteBody")} /></p>
      </div>}
      {!selectionBox && item.kind !== "note" && (item.text || editingPart === "text") && <div className="workshop-shape-text" style={{
        textAlign: item.textAlign,
        justifyContent: item.verticalAlign === "top" ? "flex-start" : item.verticalAlign === "bottom" ? "flex-end" : "center",
        color: item.textColor !== "auto" ? item.textColor : item.appearance === "fill" ? shapeTextColor(item.fillColor) : "var(--foreground)",
        fontFamily: shapeFontStack(item.fontFamily),
        fontSize: item.fontSize,
        letterSpacing: item.letterSpacing,
        lineHeight: item.lineHeight,
        textIndent: item.textIndent,
        fontWeight: item.bold ? 700 : 400,
        fontStyle: item.italic ? "italic" : "normal",
        textDecoration: [item.underline ? "underline" : "", item.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || "none",
        padding: Math.max(8, item.outlineStyle === "none" ? 0 : item.outlineWidth + 4),
      }}><span {...editorProps("text", 100000)}><RichTextContent runs={editingPart === "text" ? editingInitialRuns.current : runsFor(item, "text")} /></span></div>}
      {selected && canDrag && !editingPart && showResizeHandles && resizeHandles.map(({ direction, label }) => (
        <button aria-label={`Resize ${selectionBox ? "selection" : "rectangle"} ${label}`} className="workshop-resize-handle" data-direction={direction} key={direction} type="button" style={{ "--canvas-ui-scale": screenScale } as CSSProperties} {...dragHandlers} onPointerDown={(event) => beginDrag(event, direction)} onKeyDown={(event) => {
          const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
          const offset = offsets[event.key]
          if (!offset) return
          event.preventDefault()
          event.stopPropagation()
          const step = event.shiftKey ? 10 : 1
          onChange({ ...item, ...resizeRectangle(item, direction, offset[0] * step, offset[1] * step) })
        }} />
      ))}
      {resizing && <span className="workshop-resize-size" style={{ "--canvas-ui-scale": screenScale } as CSSProperties}>{Math.round(item.width)} × {Math.round(item.height)}</span>}
    </section>
  )
}

const resizeHandles: { direction: ResizeDirection; label: string }[] = [
  { direction: "n", label: "top" }, { direction: "s", label: "bottom" },
  { direction: "e", label: "right" }, { direction: "w", label: "left" },
  { direction: "nw", label: "top left" }, { direction: "ne", label: "top right" },
  { direction: "sw", label: "bottom left" }, { direction: "se", label: "bottom right" },
]

function restoreTextSelection(root: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let cursor = 0
  let startNode: Node | undefined
  let endNode: Node | undefined
  let startOffset = 0
  let endOffset = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0
    if (!startNode && start <= cursor + length) { startNode = node; startOffset = start - cursor }
    if (end <= cursor + length) { endNode = node; endOffset = end - cursor; break }
    cursor += length
  }
  if (!startNode || !endNode) return
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function textSelectionOffsets(root: HTMLElement, range: Range) {
  if (!root.contains(range.commonAncestorContainer)) return undefined
  const before = range.cloneRange()
  before.selectNodeContents(root)
  before.setEnd(range.startContainer, range.startOffset)
  const start = before.toString().length
  return { start, end: start + range.toString().length }
}

function noteTextCss(style: CanvasItem["noteHeaderStyle"], fillColor: string): CSSProperties {
  return {
    color: style.textColor === "auto" ? shapeTextColor(fillColor) : style.textColor,
    fontFamily: shapeFontStack(style.fontFamily),
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: [style.underline ? "underline" : "", style.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || "none",
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    textIndent: style.textIndent,
    textAlign: style.textAlign,
  }
}
