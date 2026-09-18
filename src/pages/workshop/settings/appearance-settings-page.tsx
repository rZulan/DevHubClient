import { useState } from "react"
import { Check, Copy, EyeOff, LoaderCircle, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useOutletContext } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getApiErrorMessage } from "@/features/auth/api-error"
import {
  ColorSchemeEditorDialog,
  type ColorSchemeEditorState,
} from "@/features/workshop/appearance/color-scheme-editor-dialog"
import { ColorSchemePreview } from "@/features/workshop/appearance/color-scheme-preview"
import {
  defaultColorSchemeId,
  findColorScheme,
  paletteFields,
} from "@/features/workshop/appearance/color-schemes"
import { useResolvedColorMode } from "@/features/workshop/appearance/use-resolved-color-mode"
import type { ColorScheme, ColorSchemeMode, SaveColorSchemeInput } from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { cn } from "@/lib/utils"
import {
  useCreateColorSchemeMutation,
  useDeleteColorSchemeMutation,
  useGetOrganizationAppearanceQuery,
  useSetActiveColorSchemeMutation,
  useUpdateColorSchemeMutation,
} from "@/services/api"

export function AppearanceSettingsPage() {
  const { organization, isPersistedOrganization, previewColorScheme } = useOutletContext<WorkshopOutletContext>()
  const mode = useResolvedColorMode()
  const { data: appearance, isLoading, isError } = useGetOrganizationAppearanceQuery(organization.id, { skip: !isPersistedOrganization })
  const [setActive] = useSetActiveColorSchemeMutation()
  const [createScheme, { isLoading: isCreating }] = useCreateColorSchemeMutation()
  const [updateScheme, { isLoading: isUpdating }] = useUpdateColorSchemeMutation()
  const [deleteScheme, { isLoading: isDeleting }] = useDeleteColorSchemeMutation()
  const [editor, setEditor] = useState<ColorSchemeEditorState | null>(null)
  const [editorError, setEditorError] = useState("")
  const [deleting, setDeleting] = useState<ColorScheme | null>(null)
  const [error, setError] = useState("")

  if (!isPersistedOrganization) {
    return (
      <div className="workshop-settings-page">
        <header className="workshop-settings-heading"><h2>Appearance</h2></header>
        <p className="workshop-settings-footnote">Color schemes are available for organizations saved to your account.</p>
      </div>
    )
  }

  if (isLoading || !appearance) {
    return (
      <div className="workshop-settings-page">
        <header className="workshop-settings-heading"><h2>Appearance</h2></header>
        {isError
          ? <p className="workshop-form-error">Your color schemes could not be loaded. Check that the API is running and try again.</p>
          : <div className="workshop-loading"><LoaderCircle className="animate-spin" /> Loading color schemes…</div>}
      </div>
    )
  }

  const activeScheme = findColorScheme(appearance, appearance.activeSchemeId) ?? appearance.presets[0]
  const atLimit = appearance.customSchemes.length >= appearance.maxCustomSchemes
  const takenNames = new Set([...appearance.presets, ...appearance.customSchemes].map((candidate) => candidate.name.toLowerCase()))

  async function apply(scheme: ColorScheme) {
    setError("")
    try {
      await setActive({ organizationId: organization.id, schemeId: scheme.id }).unwrap()
    } catch (applyError) {
      setError(getApiErrorMessage(applyError))
    }
  }

  function openEditor(scheme: ColorScheme | undefined, template: ColorScheme, name: string) {
    setEditorError("")
    setEditor({ scheme, draft: { name, light: { ...template.light }, dark: { ...template.dark } } })
  }

  function copyName(scheme: ColorScheme) {
    const base = `${scheme.name} copy`.slice(0, 36)
    let name = base
    for (let index = 2; takenNames.has(name.toLowerCase()); index++) name = `${base} ${index}`
    return name
  }

  async function save(draft: SaveColorSchemeInput) {
    setEditorError("")
    try {
      if (editor?.scheme) await updateScheme({ organizationId: organization.id, schemeId: editor.scheme.id, scheme: draft }).unwrap()
      else await createScheme({ organizationId: organization.id, scheme: draft }).unwrap()
      setEditor(null)
    } catch (saveError) {
      setEditorError(getApiErrorMessage(saveError))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setError("")
    try {
      await deleteScheme({ organizationId: organization.id, schemeId: deleting.id }).unwrap()
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError))
    } finally {
      setDeleting(null)
    }
  }

  const cardProps = {
    activeSchemeId: appearance.activeSchemeId,
    mode,
    onApply: (scheme: ColorScheme) => void apply(scheme),
    onDuplicate: atLimit ? undefined : (scheme: ColorScheme) => openEditor(undefined, scheme, copyName(scheme)),
  }

  return (
    <div className="workshop-settings-page">
      <header className="workshop-settings-heading">
        <h2>Appearance</h2>
      </header>

      <section className="workshop-appearance-live">
        <ColorSchemePreview mode={mode} palette={activeScheme[mode]} />
        <div className="workshop-appearance-live-copy">
          <small>Your color scheme</small>
          <strong>{activeScheme.name}</strong>
          <p className="workshop-appearance-disclaimer"><EyeOff /> Only you can see this. Other members keep their own colors.</p>
        </div>
      </section>

      {error && <p className="workshop-form-error">{error}</p>}

      <section className="workshop-appearance-section">
        <header>
          <h3>Built-in schemes</h3>
        </header>
        <div className="workshop-scheme-grid">
          {appearance.presets.map((scheme) => (
            <SchemeCard {...cardProps} isDefault={scheme.id === defaultColorSchemeId} key={scheme.id} scheme={scheme} />
          ))}
        </div>
      </section>

      <section className="workshop-appearance-section">
        <header>
          <div>
            <h3>Your custom schemes</h3>
            <p>{appearance.customSchemes.length} of {appearance.maxCustomSchemes} used</p>
          </div>
          <Button disabled={atLimit} onClick={() => openEditor(undefined, activeScheme, "")} type="button" variant="outline">
            <Plus /> New scheme
          </Button>
        </header>
        {appearance.customSchemes.length > 0 ? (
          <div className="workshop-scheme-grid">
            {appearance.customSchemes.map((scheme) => (
              <SchemeCard
                {...cardProps}
                key={scheme.id}
                onDelete={setDeleting}
                onEdit={(target) => openEditor(target, target, target.name)}
                scheme={scheme}
              />
            ))}
          </div>
        ) : (
          <div className="workshop-settings-empty-card">
            <strong>No custom schemes yet</strong>
            <p>Duplicate a built-in scheme or start a new one to use your own colors.</p>
          </div>
        )}
      </section>

      <ColorSchemeEditorDialog
        busy={isCreating || isUpdating}
        editor={editor}
        error={editorError}
        initialMode={mode}
        onClose={() => setEditor(null)}
        onPreview={previewColorScheme}
        onSave={(draft) => void save(draft)}
        templates={[...appearance.presets, ...appearance.customSchemes]}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        {deleting && (
          <DialogContent className="workshop-modal sm:max-w-md">
            <span className="workshop-modal-icon danger"><Trash2 /></span>
            <DialogHeader>
              <DialogTitle>Delete {deleting.name}?</DialogTitle>
              <DialogDescription>
                {deleting.id === appearance.activeSchemeId
                  ? "You're using this scheme, so the workshop will switch back to Graphite."
                  : "This scheme will be removed from your custom schemes."}
              </DialogDescription>
            </DialogHeader>
            <div className="workshop-settings-dialog-actions">
              <Button onClick={() => setDeleting(null)} type="button" variant="ghost">Cancel</Button>
              <Button disabled={isDeleting} onClick={() => void confirmDelete()} type="button" variant="destructive">
                {isDeleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Delete scheme
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function SchemeCard({
  activeSchemeId,
  isDefault,
  mode,
  onApply,
  onDelete,
  onDuplicate,
  onEdit,
  scheme,
}: {
  activeSchemeId: string
  isDefault?: boolean
  mode: ColorSchemeMode
  onApply: (scheme: ColorScheme) => void
  onDelete?: (scheme: ColorScheme) => void
  onDuplicate?: (scheme: ColorScheme) => void
  onEdit?: (scheme: ColorScheme) => void
  scheme: ColorScheme
}) {
  const isActive = scheme.id === activeSchemeId
  const hasMenu = Boolean(onDuplicate || onEdit || onDelete)

  return (
    <article className={cn("workshop-scheme-card", isActive && "active")}>
      <ColorSchemePreview mode={mode} palette={scheme[mode]} />
      <footer>
        <div className="workshop-scheme-card-copy">
          <strong>{scheme.name}{isDefault && <em>Default</em>}</strong>
          <span className="workshop-scheme-swatches" aria-label={`${scheme.name} colors`}>
            {paletteFields.map(({ key, label }) => <i key={key} style={{ background: scheme[mode][key] }} title={`${label} ${scheme[mode][key]}`} />)}
          </span>
        </div>
        {isActive
          ? <span className="workshop-scheme-active"><Check /> In use</span>
          : <Button onClick={() => onApply(scheme)} size="sm" type="button" variant="outline">Use</Button>}
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`More actions for ${scheme.name}`} size="icon-sm" type="button" variant="ghost"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && <DropdownMenuItem onSelect={() => onEdit(scheme)}><Pencil /> Edit colors</DropdownMenuItem>}
              {onDuplicate && <DropdownMenuItem onSelect={() => onDuplicate(scheme)}><Copy /> Duplicate</DropdownMenuItem>}
              {onDelete && <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(scheme)} variant="destructive"><Trash2 /> Delete</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </footer>
    </article>
  )
}
