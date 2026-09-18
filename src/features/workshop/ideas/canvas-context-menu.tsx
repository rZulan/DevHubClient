import { Clipboard, ClipboardPaste, Copy, Group, Layers, Maximize2, Plus, SendToBack, Trash2, Ungroup } from "lucide-react"
import type { ReactNode } from "react"

type CanvasContextMenuProps = {
  canEdit: boolean
  hasClipboard: boolean
  hasGroupedItems: boolean
  selectionCount: number
  target: "canvas" | "selection"
  x: number
  y: number
  onAction: (action: CanvasContextAction) => void
}

export type CanvasContextAction = "add-note" | "add-rectangle" | "back" | "copy" | "cut" | "delete" | "duplicate" | "fit" | "front" | "group" | "paste" | "select-all" | "ungroup"

export function CanvasContextMenu({ canEdit, hasClipboard, hasGroupedItems, selectionCount, target, x, y, onAction }: CanvasContextMenuProps) {
  return <div aria-label={target === "selection" ? "Shape actions" : "Canvas actions"} className="workshop-canvas-context-menu" role="menu" style={{ left: x, top: y }} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => event.stopPropagation()}>
    {target === "canvas" ? <>
      {canEdit && <MenuButton icon={<ClipboardPaste />} label="Paste" shortcut="Ctrl+V" disabled={!hasClipboard && !navigator.clipboard} onClick={() => onAction("paste")} />}
      <MenuButton icon={<Layers />} label="Select all" shortcut="Ctrl+A" onClick={() => onAction("select-all")} />
      <MenuButton icon={<Maximize2 />} label="Fit canvas" onClick={() => onAction("fit")} />
      {canEdit && <><MenuSeparator /><MenuButton icon={<Plus />} label="Add rectangle" onClick={() => onAction("add-rectangle")} /><MenuButton icon={<Plus />} label="Add note" onClick={() => onAction("add-note")} /></>}
    </> : <>
      <MenuButton icon={<Copy />} label="Copy" shortcut="Ctrl+C" onClick={() => onAction("copy")} />
      {canEdit && <>
        <MenuButton icon={<Clipboard />} label="Cut" shortcut="Ctrl+X" onClick={() => onAction("cut")} />
        <MenuButton icon={<Copy />} label="Duplicate" shortcut="Ctrl+D" onClick={() => onAction("duplicate")} />
        <MenuSeparator />
        <MenuButton icon={<Group />} label="Group" shortcut="Ctrl+G" disabled={selectionCount < 2} onClick={() => onAction("group")} />
        <MenuButton icon={<Ungroup />} label="Ungroup" shortcut="Ctrl+Shift+G" disabled={!hasGroupedItems} onClick={() => onAction("ungroup")} />
        <MenuSeparator />
        <MenuButton icon={<SendToBack />} label="Send to back" onClick={() => onAction("back")} />
        <MenuButton icon={<Layers />} label="Bring to front" onClick={() => onAction("front")} />
        <MenuSeparator />
        <MenuButton destructive icon={<Trash2 />} label="Delete" shortcut="Delete" onClick={() => onAction("delete")} />
      </>}
    </>}
  </div>
}

function MenuButton({ destructive = false, disabled = false, icon, label, shortcut, onClick }: { destructive?: boolean; disabled?: boolean; icon: ReactNode; label: string; shortcut?: string; onClick: () => void }) {
  return <button className={destructive ? "destructive" : undefined} disabled={disabled} onClick={onClick} role="menuitem" type="button"><span>{icon}{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>
}

function MenuSeparator() {
  return <span aria-hidden="true" className="workshop-canvas-context-separator" />
}
