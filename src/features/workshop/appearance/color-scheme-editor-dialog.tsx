import { useEffect, useMemo, useState, type FormEvent } from "react"
import { AlertTriangle, Check, Eye, LoaderCircle, Moon, Palette, Plus, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorSchemePreview } from "@/features/workshop/appearance/color-scheme-preview"
import {
  isHexColor,
  isValidPalette,
  paletteContrastIssues,
  paletteFields,
} from "@/features/workshop/appearance/color-schemes"
import type {
  ColorScheme,
  ColorSchemeMode,
  SaveColorSchemeInput,
} from "@/features/workshop/workshop-types"
import { cn } from "@/lib/utils"

const nameMaxLength = 40

export type ColorSchemeEditorState = {
  /** The scheme being edited; omitted when creating a new one. */
  scheme?: ColorScheme
  draft: SaveColorSchemeInput
}

export function ColorSchemeEditorDialog({
  busy,
  editor,
  error,
  initialMode,
  onClose,
  onPreview,
  onSave,
  templates,
}: {
  busy: boolean
  editor: ColorSchemeEditorState | null
  error: string
  initialMode: ColorSchemeMode
  onClose: () => void
  onPreview: (scheme?: ColorScheme) => void
  onSave: (draft: SaveColorSchemeInput) => void
  templates: ColorScheme[]
}) {
  return (
    <Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open) onClose() }}>
      {editor && (
        <DialogContent className="workshop-modal workshop-scheme-editor sm:max-w-3xl">
          <EditorForm
            busy={busy}
            editor={editor}
            error={error}
            initialMode={initialMode}
            onClose={onClose}
            onPreview={onPreview}
            onSave={onSave}
            templates={templates}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}

function EditorForm({
  busy,
  editor,
  error,
  initialMode,
  onClose,
  onPreview,
  onSave,
  templates,
}: {
  busy: boolean
  editor: ColorSchemeEditorState
  error: string
  initialMode: ColorSchemeMode
  onClose: () => void
  onPreview: (scheme?: ColorScheme) => void
  onSave: (draft: SaveColorSchemeInput) => void
  templates: ColorScheme[]
}) {
  const [draft, setDraft] = useState(editor.draft)
  const [mode, setMode] = useState<ColorSchemeMode>(initialMode)
  const [previewWorkshop, setPreviewWorkshop] = useState(true)
  // Keep previews on the last fully valid draft while a hex value is mid-edit.
  const [visible, setVisible] = useState(editor.draft)

  const palettesValid = isValidPalette(draft.light) && isValidPalette(draft.dark)
  if (palettesValid && visible !== draft) setVisible(draft)
  const issues = useMemo(() => paletteContrastIssues(visible), [visible])
  const canSave = palettesValid && draft.name.trim().length > 0 && !busy

  useEffect(() => {
    if (!previewWorkshop) {
      onPreview(undefined)
      return
    }
    onPreview({ id: "preview", name: visible.name, isPreset: false, light: visible.light, dark: visible.dark })
  }, [onPreview, previewWorkshop, visible])

  useEffect(() => () => onPreview(undefined), [onPreview])

  function setColor(key: (typeof paletteFields)[number]["key"], value: string) {
    const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`
    setDraft((current) => ({ ...current, [mode]: { ...current[mode], [key]: normalized.toLowerCase() } }))
  }

  function applyTemplate(schemeId: string) {
    const template = templates.find((candidate) => candidate.id === schemeId)
    if (template) setDraft((current) => ({ ...current, light: { ...template.light }, dark: { ...template.dark } }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSave) onSave({ ...draft, name: draft.name.trim() })
  }

  return (
    <>
      <span className="workshop-modal-icon"><Palette /></span>
      <DialogHeader>
        <DialogTitle>{editor.scheme ? `Edit ${editor.scheme.name}` : "New color scheme"}</DialogTitle>
        <DialogDescription>
          Pick five key colors for light and dark mode. Only you can see your color schemes.
        </DialogDescription>
      </DialogHeader>

      <form className="workshop-scheme-editor-form" onSubmit={submit}>
        <div className="workshop-scheme-editor-fields">
          <Label>Name
            <Input autoFocus maxLength={nameMaxLength} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Brand colors" required value={draft.name} />
          </Label>

          {!editor.scheme && templates.length > 0 && (
            <Label>Start from
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a scheme to copy" /></SelectTrigger>
                <SelectContent>
                  {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
          )}

          <div className="workshop-scheme-mode-tabs" role="tablist" aria-label="Palette mode">
            {(["light", "dark"] as const).map((candidate) => (
              <button aria-selected={mode === candidate} className={cn(mode === candidate && "active")} key={candidate} onClick={() => setMode(candidate)} role="tab" type="button">
                {candidate === "light" ? <Sun /> : <Moon />} {candidate === "light" ? "Light mode" : "Dark mode"}
              </button>
            ))}
          </div>

          <div className="workshop-scheme-color-list">
            {paletteFields.map(({ hint, key, label }) => {
              const value = draft[mode][key]
              const valid = isHexColor(value)
              return (
                <div className="workshop-scheme-color-field" key={key}>
                  <input aria-label={`${label} color picker`} onChange={(event) => setColor(key, event.target.value)} type="color" value={valid ? value : visible[mode][key]} />
                  <span><strong>{label}</strong><small>{hint}</small></span>
                  <Input aria-invalid={!valid} aria-label={`${label} hex value`} maxLength={7} onChange={(event) => setColor(key, event.target.value)} spellCheck={false} value={value} />
                </div>
              )
            })}
          </div>
        </div>

        <div className="workshop-scheme-editor-aside">
          <ColorSchemePreview className="large" mode={mode} palette={visible[mode]} />
          <label className="workshop-scheme-preview-toggle">
            <Checkbox checked={previewWorkshop} onCheckedChange={(checked) => setPreviewWorkshop(checked === true)} />
            <span><strong><Eye /> Preview on the workshop</strong><small>Try the colors before saving.</small></span>
          </label>
          {issues.length > 0 && (
            <ul className="workshop-scheme-issues">
              {issues.map((issue) => <li key={`${issue.mode}-${issue.message}`}><AlertTriangle /><span><b>{issue.mode === "light" ? "Light" : "Dark"}:</b> {issue.message}</span></li>)}
            </ul>
          )}
        </div>

        {error && <p className="workshop-form-error">{error}</p>}

        <footer className="workshop-settings-dialog-actions">
          <Button onClick={onClose} type="button" variant="ghost">Cancel</Button>
          <Button disabled={!canSave} type="submit">
            {busy ? <LoaderCircle className="animate-spin" /> : editor.scheme ? <Check /> : <Plus />}
            {editor.scheme ? "Save changes" : "Create scheme"}
          </Button>
        </footer>
      </form>
    </>
  )
}
