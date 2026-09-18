import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const shortcuts = [
  { keys: ["Ctrl/⌘", "S"], label: "Save changes" },
  { keys: ["Ctrl/⌘", "A"], label: "Select all shapes" },
  { keys: ["Ctrl/⌘", "C"], label: "Copy selected shapes" },
  { keys: ["Ctrl/⌘", "X"], label: "Cut selected shapes" },
  { keys: ["Ctrl/⌘", "V"], label: "Paste shapes" },
  { keys: ["Ctrl/⌘", "D"], label: "Duplicate selected shapes" },
  { keys: ["Ctrl/⌘", "G"], label: "Group selected shapes" },
  { keys: ["Ctrl/⌘", "Shift", "G"], label: "Ungroup selected shapes" },
  { keys: ["Delete"], label: "Delete selected shapes" },
  { keys: ["Arrow keys"], label: "Move selection by 1 px" },
  { keys: ["Shift", "Arrow keys"], label: "Move selection by 10 px" },
  { keys: ["Hold", "Space"], label: "Temporarily pan the canvas" },
  { keys: ["Esc"], label: "Exit text editing or clear selection" },
]

export function IdeasShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="workshop-hotkeys-dialog sm:max-w-md" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
        <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle></DialogHeader>
        <div className="workshop-hotkeys-list">
          {shortcuts.map(({ keys, label }) => <ShortcutRow keys={keys} label={label} key={label} />)}
        </div>
        <p className="workshop-hotkeys-tip">Double-click a shape to edit its text. Scroll to zoom, middle-drag or hold Space and drag to pan, and hold Alt while dragging to bypass snapping.</p>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return <div><span>{label}</span><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></div>
}
