import { AlignCenter, AlignLeft, AlignRight, ChevronRight, Group, Ungroup } from "lucide-react"
import { createContext, useContext, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { googleFonts, systemFonts } from "../shape-fonts"
import type { CanvasItem, NoteTextStyle } from "../shape-clipboard"
import type { CharacterStyleChanges, SelectedCharacterStyle, TextPart } from "./rich-text"
import { groupMemberLabel, shapeTextColor } from "./shape-presentation"

export type ShapeStyleChanges = Partial<Pick<CanvasItem, "width" | "height" | "appearance" | "fillColor" | "outlineColor" | "outlineWidth" | "outlineStyle" | "cornerRadius" | "text" | "textAlign" | "verticalAlign" | "fontFamily" | "fontSize" | "bold" | "italic" | "underline" | "strikethrough" | "textColor" | "letterSpacing" | "lineHeight" | "textIndent" | "textRuns" | "noteHeaderRuns" | "noteBodyRuns" | "noteHeader" | "noteBody" | "noteHeaderStyle" | "noteBodyStyle">>

type ShapePropertiesPanelProps = {
  allItemsCount: number
  selectedGroupId?: string
  selectedIds: string[]
  selectedItem: CanvasItem
  selectedItems: CanvasItem[]
  propertyItems: CanvasItem[]
  onPropertyItemChange: (id: string) => void
  onUpdate: (changes: ShapeStyleChanges) => void
  activeTextPart?: TextPart
  selectedTextStyle?: SelectedCharacterStyle
  onTextStyleUpdate: (changes: CharacterStyleChanges) => void
  onChangeOrder: (position: "front" | "back") => void
  onGroup: () => void
  onUngroup: () => void
}

const PropertiesShapeContext = createContext("")

export function ShapePropertiesPanel({ allItemsCount, selectedGroupId, selectedIds, selectedItem, selectedItems, propertyItems, onPropertyItemChange, onUpdate, activeTextPart, selectedTextStyle, onTextStyleUpdate, onChangeOrder, onGroup, onUngroup }: ShapePropertiesPanelProps) {
  return (
    <PropertiesShapeContext.Provider value={selectedItem.id}><aside aria-label="Properties" className="workshop-shape-properties" data-shape-properties onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <strong>Properties{selectedGroupId ? " · Group" : selectedIds.length > 1 ? ` · ${selectedIds.length} selected` : ""}</strong>
      {selectedGroupId && <label className="workshop-property-field workshop-group-member-picker"><span>Shape</span><select aria-label="Group member properties" value={selectedItem.id} onChange={(event) => onPropertyItemChange(event.target.value)}>
        {selectedItems.map((item, index) => <option key={item.id} value={item.id}>{groupMemberLabel(item, index)}</option>)}
      </select></label>}

      <PropertySection title="Shape" defaultOpen>
        <div className="workshop-property-field"><span>Appearance</span><div className="workshop-shape-style-options" role="group" aria-label="Shape style">
          <Button aria-pressed={selectedItem.appearance === "fill"} onClick={() => onUpdate({ appearance: "fill" })} size="sm" type="button" variant={selectedItem.appearance === "fill" ? "secondary" : "ghost"}>Fill</Button>
          <Button aria-pressed={selectedItem.appearance === "outlined"} onClick={() => onUpdate({ appearance: "outlined" })} size="sm" type="button" variant={selectedItem.appearance === "outlined" ? "secondary" : "ghost"}>Outlined</Button>
        </div></div>
        <ColorField label="Fill color" value={selectedItem.fillColor} onChange={(fillColor) => onUpdate({ fillColor })} />
        <label className="workshop-property-field"><span>Width (px)</span><input aria-label="Shape width" type="number" min={24} step={0.01} value={roundToTwo(selectedItem.width)} onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value)) onUpdate({ width: roundToTwo(Math.max(24, value)) })
        }} /></label>
        <label className="workshop-property-field"><span>Height (px)</span><input aria-label="Shape height" type="number" min={24} step={0.01} value={roundToTwo(selectedItem.height)} onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value)) onUpdate({ height: roundToTwo(Math.max(24, value)) })
        }} /></label>
        <label className="workshop-property-field"><span>Radius (px)</span><input aria-label="Corner radius" type="number" min={0} step={1} value={selectedItem.cornerRadius} onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value)) onUpdate({ cornerRadius: Math.max(0, value) })
        }} /></label>
      </PropertySection>

      <PropertySection title="Outline">
        <ColorField label="Outline color" value={selectedItem.outlineColor} onChange={(outlineColor) => onUpdate({ outlineColor })} />
        <label className="workshop-property-field"><span>Thickness (px)</span><input aria-label="Outline thickness" type="number" min={1} max={20} step={1} value={selectedItem.outlineWidth} onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value)) onUpdate({ outlineWidth: Math.min(20, Math.max(1, Math.round(value))) })
        }} /></label>
        <label className="workshop-property-field"><span>Style</span><select aria-label="Outline style" value={selectedItem.outlineStyle} onChange={(event) => onUpdate({ outlineStyle: event.target.value as CanvasItem["outlineStyle"] })}>
          <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="double">Double</option><option value="none">None</option>
        </select></label>
      </PropertySection>

      {selectedItem.kind === "note" ? <>
        <NoteProperties item={selectedItem} onUpdate={onUpdate} />
        <NoteTypographyProperties item={selectedItem} activeTextPart={activeTextPart} selectedTextStyle={selectedTextStyle} onTextStyleUpdate={onTextStyleUpdate} onUpdate={onUpdate} />
      </> : <>
        <RectangleTextContent item={selectedItem} onUpdate={onUpdate} />
        <TypographyProperties item={selectedItem} propertyItems={propertyItems} selectedTextStyle={selectedTextStyle} useCharacterStyle={activeTextPart === "text"} onTextStyleUpdate={onTextStyleUpdate} onUpdate={onUpdate} />
      </>}

      <PropertySection title="Arrange">
        <div className="workshop-shape-layer-options">
          <Button disabled={selectedIds.length === allItemsCount} onClick={() => onChangeOrder("back")} size="sm" type="button" variant="outline">Send to back</Button>
          <Button disabled={selectedIds.length === allItemsCount} onClick={() => onChangeOrder("front")} size="sm" type="button" variant="outline">Send to front</Button>
        </div>
        <div className="workshop-shape-layer-options">
          <Button disabled={selectedItems.length < 2} title="Group selected shapes (Ctrl+G)" onClick={onGroup} size="sm" type="button" variant="outline"><Group /> Group</Button>
          <Button disabled={!selectedItems.some((item) => item.groupId)} title="Ungroup selected shapes (Ctrl+Shift+G)" onClick={onUngroup} size="sm" type="button" variant="outline"><Ungroup /> Ungroup</Button>
        </div>
      </PropertySection>
    </aside></PropertiesShapeContext.Provider>
  )
}

function NoteProperties({ item, onUpdate }: { item: CanvasItem; onUpdate: (changes: ShapeStyleChanges) => void }) {
  return <PropertySection title="Note content" defaultOpen>
    <label className="workshop-property-field"><span>Header</span><input aria-label="Note header" maxLength={10000} value={item.noteHeader} onChange={(event) => onUpdate({ noteHeader: event.target.value, noteHeaderRuns: undefined })} /></label>
    <label className="workshop-property-field"><span>Body</span><textarea aria-label="Note body" maxLength={100000} rows={6} value={item.noteBody} onChange={(event) => onUpdate({ noteBody: event.target.value, noteBodyRuns: undefined })} /></label>
  </PropertySection>
}

function RectangleTextContent({ item, onUpdate }: { item: CanvasItem; onUpdate: (changes: ShapeStyleChanges) => void }) {
  return <PropertySection title="Text" defaultOpen>
    <label className="workshop-property-field"><span>Content</span><textarea aria-label="Shape text" rows={4} value={item.text} onChange={(event) => onUpdate({ text: event.target.value, textRuns: undefined })} /></label>
  </PropertySection>
}

function NoteTypographyProperties({ item, activeTextPart, selectedTextStyle, onTextStyleUpdate, onUpdate }: { item: CanvasItem; activeTextPart?: TextPart; selectedTextStyle?: SelectedCharacterStyle; onTextStyleUpdate: (changes: CharacterStyleChanges) => void; onUpdate: (changes: ShapeStyleChanges) => void }) {
  return <>
    <NoteTextStyleProperties title="Header text" style={item.noteHeaderStyle} fillColor={item.fillColor} selectedTextStyle={selectedTextStyle} useCharacterStyle={activeTextPart === "noteHeader"} onTextStyleUpdate={onTextStyleUpdate} onChange={(style) => onUpdate({ noteHeaderStyle: style })} />
    <NoteTextStyleProperties title="Body text" style={item.noteBodyStyle} fillColor={item.fillColor} selectedTextStyle={selectedTextStyle} useCharacterStyle={activeTextPart === "noteBody"} onTextStyleUpdate={onTextStyleUpdate} onChange={(style) => onUpdate({ noteBodyStyle: style })} />
  </>
}

function NoteTextStyleProperties({ title, style, fillColor, useCharacterStyle, selectedTextStyle, onTextStyleUpdate, onChange }: { title: string; style: NoteTextStyle; fillColor: string; useCharacterStyle: boolean; selectedTextStyle?: SelectedCharacterStyle; onTextStyleUpdate: (changes: CharacterStyleChanges) => void; onChange: (style: NoteTextStyle) => void }) {
  const alignments = [{ value: "left", icon: AlignLeft }, { value: "center", icon: AlignCenter }, { value: "right", icon: AlignRight }] as const
  const update = (changes: Partial<NoteTextStyle>) => onChange({ ...style, ...changes })
  const updateCharactersOrStyle = (changes: CharacterStyleChanges) => useCharacterStyle ? onTextStyleUpdate(changes) : update(changes)
  const displayed = useCharacterStyle && selectedTextStyle ? selectedTextStyle : style
  return <PropertySection title={title}>
    <label className="workshop-property-field"><span>Font</span><select aria-label={`${title} font family`} value={displayed.fontFamily} onChange={(event) => updateCharactersOrStyle({ fontFamily: event.target.value as NoteTextStyle["fontFamily"] })}>
      <option disabled value=""></option>
      <optgroup label="System fonts">{systemFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
      <optgroup label="Google Fonts">{googleFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
    </select></label>
    <label className="workshop-property-field"><span>Size (px)</span><input aria-label={`${title} font size`} type="number" min={1} max={1000} value={displayed.fontSize} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateCharactersOrStyle({ fontSize: Math.min(1000, Math.max(1, value)) }) }} /></label>
    <label className="workshop-property-field"><span>Letter spacing</span><input aria-label={`${title} letter spacing`} type="number" min={-20} max={100} step={0.1} value={displayed.letterSpacing} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateCharactersOrStyle({ letterSpacing: Math.min(100, Math.max(-20, value)) }) }} /></label>
    <CharacterColorField label={`${title} color`} value={displayed.textColor} fallback={shapeTextColor(fillColor)} onChange={(textColor) => updateCharactersOrStyle({ textColor })} />
    <div className="workshop-property-field"><span>Alignment</span><div className="workshop-text-buttons" role="group" aria-label={`${title} alignment`}>
      {alignments.map(({ value, icon: Icon }) => <Button key={value} aria-label={`${title} align ${value}`} title={`Align ${value}`} aria-pressed={style.textAlign === value} onClick={() => update({ textAlign: value })} size="icon-sm" variant={style.textAlign === value ? "secondary" : "ghost"} type="button"><Icon /></Button>)}
    </div></div>
    <label className="workshop-property-field"><span>Line height</span><input aria-label={`${title} line height`} type="number" min={0.5} max={5} step={0.1} value={style.lineHeight} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) update({ lineHeight: Math.min(5, Math.max(0.5, value)) }) }} /></label>
    <label className="workshop-property-field"><span>First-line indent</span><input aria-label={`${title} first-line indent`} type="number" min={-500} max={500} step={1} value={style.textIndent} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) update({ textIndent: Math.min(500, Math.max(-500, value)) }) }} /></label>
  </PropertySection>
}

function TypographyProperties({ item, propertyItems, useCharacterStyle, selectedTextStyle, onTextStyleUpdate, onUpdate }: { item: CanvasItem; propertyItems: CanvasItem[]; useCharacterStyle: boolean; selectedTextStyle?: SelectedCharacterStyle; onTextStyleUpdate: (changes: CharacterStyleChanges) => void; onUpdate: (changes: ShapeStyleChanges) => void }) {
  const alignments = [{ value: "left", icon: AlignLeft }, { value: "center", icon: AlignCenter }, { value: "right", icon: AlignRight }] as const
  const updateCharactersOrShape = (changes: CharacterStyleChanges) => useCharacterStyle ? onTextStyleUpdate(changes) : onUpdate(changes)
  const displayed = useCharacterStyle && selectedTextStyle ? selectedTextStyle : item
  return <>
  <PropertySection title="Typography">
    <label className="workshop-property-field"><span>Font</span><select aria-label="Font family" value={displayed.fontFamily} onChange={(event) => updateCharactersOrShape({ fontFamily: event.target.value as CanvasItem["fontFamily"] })}>
      <option disabled value=""></option>
      <optgroup label="System fonts">{systemFonts.map((font) => <option key={font} value={font}>{font}</option>)}</optgroup>
      <optgroup label="Google Fonts">{googleFonts.map((font) => <option key={font} value={font}>{font}</option>)}</optgroup>
    </select></label>
    <label className="workshop-property-field"><span>Size (px)</span><input aria-label="Font size" type="number" min={1} max={1000} value={displayed.fontSize} onChange={(event) => { const size = event.target.valueAsNumber; if (Number.isFinite(size)) updateCharactersOrShape({ fontSize: Math.min(1000, Math.max(1, size)) }) }} /></label>
    <label className="workshop-property-field"><span>Letter spacing</span><input aria-label="Letter spacing" type="number" min={-20} max={100} step={0.1} value={displayed.letterSpacing} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateCharactersOrShape({ letterSpacing: Math.min(100, Math.max(-20, value)) }) }} /></label>
    <CharacterColorField label="Text color" value={displayed.textColor} fallback={item.appearance === "fill" ? shapeTextColor(item.fillColor) : "#ffffff"} onChange={(textColor) => updateCharactersOrShape({ textColor })} />
  </PropertySection>
  <PropertySection title="Paragraph">
    <div className="workshop-property-field"><span>Horizontal</span><div className="workshop-text-buttons" role="group" aria-label="Horizontal text alignment">
      {alignments.map(({ value, icon: Icon }) => <Button key={value} aria-label={`Align ${value}`} title={`Align ${value}`} aria-pressed={propertyItems.every((candidate) => candidate.textAlign === value)} onClick={() => onUpdate({ textAlign: value })} size="icon-sm" variant={propertyItems.every((candidate) => candidate.textAlign === value) ? "secondary" : "ghost"} type="button"><Icon /></Button>)}
    </div></div>
    <div className="workshop-property-field"><span>Vertical</span><div className="workshop-text-buttons" role="group" aria-label="Vertical text alignment">
      {(["top", "center", "bottom"] as const).map((value) => <Button key={value} aria-label={`Align ${value === "center" ? "middle" : value}`} title={`Align ${value === "center" ? "middle" : value}`} aria-pressed={propertyItems.every((candidate) => candidate.verticalAlign === value)} onClick={() => onUpdate({ verticalAlign: value })} size="icon-sm" variant={propertyItems.every((candidate) => candidate.verticalAlign === value) ? "secondary" : "ghost"} type="button"><VerticalAlignmentIcon value={value} /></Button>)}
    </div></div>
    <label className="workshop-property-field"><span>Line height</span><input aria-label="Line height" type="number" min={0.5} max={5} step={0.1} value={item.lineHeight} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) onUpdate({ lineHeight: Math.min(5, Math.max(0.5, value)) }) }} /></label>
    <label className="workshop-property-field"><span>First-line indent</span><input aria-label="First-line indent" type="number" min={-500} max={500} step={1} value={item.textIndent} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) onUpdate({ textIndent: Math.min(500, Math.max(-500, value)) }) }} /></label>
  </PropertySection>
  </>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="workshop-shape-color"><span>{label}</span><span className="workshop-color-value"><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><span>{value.toUpperCase()}</span></span></label>
}

function CharacterColorField({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (value: string) => void }) {
  const mixed = value === ""
  const color = !mixed && value !== "auto" ? value : fallback
  return <label className="workshop-shape-color"><span>Text color</span><span className="workshop-color-value">
    <span className={mixed ? "workshop-mixed-color" : undefined}><input aria-label={label} type="color" value={color} onChange={(event) => onChange(event.target.value)} /></span>
    <Button aria-pressed={value === "auto"} title="Automatic text contrast" size="sm" variant={value === "auto" ? "secondary" : "ghost"} type="button" onClick={(event) => { event.preventDefault(); onChange("auto") }}>Auto</Button>
  </span></label>
}

function VerticalAlignmentIcon({ value }: { value: CanvasItem["verticalAlign"] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{[0, 1, 2].map((line) => <path key={line} d={`M${line === 1 ? 7 : 4} ${(value === "top" ? 3 : value === "center" ? 8 : 13) + line * 4}h${line === 1 ? 10 : 16}`} />)}</svg>
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function PropertySection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const shapeId = useContext(PropertiesShapeContext)
  const storageKey = `devhub:ideas:property-section:${shapeId}:${title}`
  const [open, setOpen] = useState(() => readSectionState(storageKey, defaultOpen))
  return <details className="workshop-property-section" open={open} onToggle={(event) => {
    const next = event.currentTarget.open
    setOpen(next)
    try { localStorage.setItem(storageKey, next ? "open" : "closed") } catch { /* Storage can be unavailable in private or restricted contexts. */ }
  }}>
    <summary><ChevronRight aria-hidden="true" /><span>{title}</span></summary>
    <div className="workshop-property-content">{children}</div>
  </details>
}

function readSectionState(storageKey: string, fallback: boolean) {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === null ? fallback : saved === "open"
  } catch { return fallback }
}
