import {type FormEvent, useEffect, useMemo, useState} from "react"
import {AlertTriangle, Check, Eye, LoaderCircle, Moon, Palette, Plus, Sun} from "lucide-react"

import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {ColorSchemePreview} from "@/features/workshop/appearance/color-scheme-preview"
import {
    allGradientTargets,
    defaultColorSchemeId,
    gradientBackground,
    gradientLayouts,
    gradientStops,
    gradientTargets,
    isHexColor,
    isValidPalette,
    paletteContrastIssues,
    paletteFields,
    selectedGradientTargets,
} from "@/features/workshop/appearance/color-schemes"
import type {
    ColorScheme,
    ColorSchemeGradient,
    ColorSchemeMode,
    ColorSchemePalette,
    SaveColorSchemeInput,
} from "@/features/workshop/workshop-types"
import {cn} from "@/lib/utils"

const nameMaxLength = 40
const layoutChoices = [{value: "flat", label: "Flat", hint: "Solid colors"}, ...gradientLayouts] as const
const stopLabels = {first: "Color 1", second: "Color 2", third: "Color 3"}

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
        <Dialog open={Boolean(editor)} onOpenChange={(open) => {
            if (!open) onClose()
        }}>
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
    const [lastGradients, setLastGradients] = useState<Partial<Record<ColorSchemeMode, ColorSchemeGradient>>>({})
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
        onPreview({id: "preview", name: visible.name, isPreset: false, light: visible.light, dark: visible.dark})
    }, [onPreview, previewWorkshop, visible])

    useEffect(() => () => onPreview(undefined), [onPreview])

    function setColor(key: (typeof paletteFields)[number]["key"], value: string) {
        setDraft((current) => ({...current, [mode]: {...current[mode], [key]: value}}))
    }

    function setGradient(gradient: ColorSchemeGradient | null) {
        if (gradient) setLastGradients((current) => ({...current, [mode]: gradient}))
        setDraft((current) => ({...current, [mode]: {...current[mode], gradient}}))
    }

    function applyTemplate(schemeId: string) {
        const template = templates.find((candidate) => candidate.id === schemeId)
        if (!template) return
        setLastGradients({})
        setDraft((current) => ({...current, light: {...template.light}, dark: {...template.dark}}))
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (canSave) onSave({...draft, name: draft.name.trim()})
    }

    const startingGradient: ColorSchemeGradient = templates.find(({id}) => id === defaultColorSchemeId)?.[mode].gradient ?? {
        layout: "aurora", placement: allGradientTargets, first: visible[mode].accent, second: "#7959dc", third: "#b54cca",
    }

    return (
        <>
            <span className="workshop-modal-icon"><Palette/></span>
            <DialogHeader>
                <DialogTitle>{editor.scheme ? `Edit ${editor.scheme.name}` : "New color scheme"}</DialogTitle>
                <DialogDescription>
                    Customize your colors and gradients separately for light and dark mode.
                </DialogDescription>
            </DialogHeader>

            <form className="workshop-scheme-editor-form" onSubmit={submit}>
                <div className="workshop-scheme-editor-fields">
                    <Label>Name
                        <Input autoFocus maxLength={nameMaxLength}
                               onChange={(event) => setDraft((current) => ({...current, name: event.target.value}))}
                               placeholder="Brand colors" required value={draft.name}/>
                    </Label>

                    {!editor.scheme && templates.length > 0 && (
                        <Label>Start from
                            <Select onValueChange={applyTemplate}>
                                <SelectTrigger className="w-full"><SelectValue
                                    placeholder="Choose a scheme to copy"/></SelectTrigger>
                                <SelectContent>
                                    {templates.map((template) => <SelectItem key={template.id}
                                                                             value={template.id}>{template.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Label>
                    )}

                    <div className="workshop-scheme-mode-tabs" role="tablist" aria-label="Palette mode">
                        {(["light", "dark"] as const).map((candidate) => (
                            <button aria-selected={mode === candidate} className={cn(mode === candidate && "active")}
                                    key={candidate} onClick={() => setMode(candidate)} role="tab" type="button">
                                {candidate === "light" ? <Sun/> :
                                    <Moon/>} {candidate === "light" ? "Light mode" : "Dark mode"}
                            </button>
                        ))}
                    </div>

                    <GradientEditor
                        gradient={draft[mode].gradient}
                        mode={mode}
                        onChange={setGradient}
                        startingGradient={lastGradients[mode] ?? startingGradient}
                        visibleGradient={visible[mode].gradient ?? startingGradient}
                        visiblePalette={visible[mode]}
                    />

                    <div className="workshop-scheme-color-list">
                        {paletteFields.map(({hint, key, label}) => (
                            <ColorField key={key} label={label} hint={hint} value={draft[mode][key]}
                                        fallback={visible[mode][key]} onChange={(value) => setColor(key, value)}/>
                        ))}
                    </div>
                </div>

                <div className="workshop-scheme-editor-aside">
                    <ColorSchemePreview className="large" mode={mode} palette={visible[mode]}/>
                    <label className="workshop-scheme-preview-toggle">
                        <Checkbox checked={previewWorkshop}
                                  onCheckedChange={(checked) => setPreviewWorkshop(checked === true)}/>
                        <span><strong><Eye/> Preview on the workshop</strong><small>Try the colors before saving.</small></span>
                    </label>
                    {issues.length > 0 && (
                        <ul className="workshop-scheme-issues">
                            {issues.map((issue) => <li key={`${issue.mode}-${issue.message}`}>
                                <AlertTriangle/><span><b>{issue.mode === "light" ? "Light" : "Dark"}:</b> {issue.message}</span>
                            </li>)}
                        </ul>
                    )}
                </div>

                {error && <p className="workshop-form-error" role="alert">{error}</p>}

                <footer className="workshop-settings-dialog-actions">
                    <Button onClick={onClose} type="button" variant="ghost">Cancel</Button>
                    <Button disabled={!canSave} type="submit">
                        {busy ? <LoaderCircle className="animate-spin"/> : editor.scheme ? <Check/> : <Plus/>}
                        {editor.scheme ? "Save changes" : "Create scheme"}
                    </Button>
                </footer>
            </form>
        </>
    )
}

function GradientEditor({gradient, mode, onChange, startingGradient, visibleGradient, visiblePalette}: {
    gradient: ColorSchemeGradient | null | undefined
    mode: ColorSchemeMode
    onChange: (gradient: ColorSchemeGradient | null) => void
    startingGradient: ColorSchemeGradient
    visibleGradient: ColorSchemeGradient
    visiblePalette: ColorSchemePalette
}) {
    const targets = selectedGradientTargets(gradient?.placement)

    return (
        <div className="workshop-gradient-editor">
            <fieldset>
                <legend>Gradient design</legend>
                <div className="workshop-gradient-choices">
                    {layoutChoices.map(({hint, label, value}) => (
                        <label className="workshop-gradient-choice" key={value} title={hint}>
                            <input checked={(gradient?.layout ?? "flat") === value} className="sr-only"
                                   name="gradient-layout" onChange={() => onChange(value === "flat"
                                       ? null : {...(gradient ?? startingGradient), layout: value})}
                                   type="radio" value={value}/>
                            <span className="workshop-gradient-thumbnail" aria-hidden="true" style={{
                                backgroundColor: visiblePalette.background,
                                backgroundImage: value === "flat" ? "none" : gradientBackground(
                                    visiblePalette, mode, {...visibleGradient, layout: value},
                                ),
                            }}/>
                            <span>{label}</span>
                        </label>
                    ))}
                </div>
            </fieldset>
            {gradient && (
                <>
                    <fieldset>
                        <legend>Apply gradient to</legend>
                        <div className="workshop-gradient-targets">
                            {gradientTargets.map(({label, value}) => (
                                <label key={value}>
                                    <Checkbox checked={targets.includes(value)} onCheckedChange={(checked) => {
                                        const placement = gradientTargets
                                            .filter((target) => target.value === value ? checked === true : targets.includes(target.value))
                                            .map((target) => target.value).join(",")
                                        onChange(placement ? {...gradient, placement} : null)
                                    }}/>
                                    {label}
                                </label>
                            ))}
                        </div>
                        {targets.length < gradientTargets.length && (
                            <button className="workshop-gradient-select-all"
                                    onClick={() => onChange({...gradient, placement: allGradientTargets})} type="button">
                                Select all surfaces
                            </button>
                        )}
                    </fieldset>
                    <div className="workshop-gradient-stops">
                        {gradientStops.map((key) => (
                            <ColorField key={key} label={stopLabels[key]} value={gradient[key]}
                                        fallback={visibleGradient[key]} onChange={(value) => onChange({...gradient, [key]: value})}/>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

function ColorField({fallback, hint, label, onChange, value}: {
    fallback: string
    hint?: string
    label: string
    onChange: (value: string) => void
    value: string
}) {
    const valid = isHexColor(value)
    return (
        <div className="workshop-scheme-color-field">
            <input aria-label={`${label} color picker`} onChange={(event) => onChange(event.target.value)}
                   type="color" value={valid ? value : fallback}/>
            <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
            <Input aria-invalid={!valid} aria-label={`${label} hex value`} maxLength={7}
                   onChange={(event) => onChange(`#${event.target.value.trim().replace(/^#/, "").toLowerCase()}`)}
                   spellCheck={false} value={value}/>
        </div>
    )
}
