import type {ColorScheme, ColorSchemeGradient, ColorSchemeMode, ColorSchemePalette} from "@/features/workshop/workshop-types"

export const defaultColorSchemeId = "default"
export const colorSchemeStyleId = "workshop-color-scheme"
export const colorSchemeAttribute = "data-workshop-scheme"

export const paletteFields = [
    {key: "accent", label: "Accent", hint: "Buttons, active states, and focus rings"},
    {key: "background", label: "Background", hint: "The main workspace canvas"},
    {key: "surface", label: "Surface", hint: "Cards, menus, and dialogs"},
    {key: "sidebar", label: "Sidebar", hint: "Navigation and member list"},
    {key: "text", label: "Text", hint: "Headings and body copy"},
] as const satisfies readonly { key: keyof ColorSchemePalette; label: string; hint: string }[]

export const gradientLayouts = [
    {value: "aurora", label: "Aurora", hint: "Overlapping pools of color"},
    {value: "horizon", label: "Horizon", hint: "A soft diagonal sweep"},
    {value: "corners", label: "Corners", hint: "Color blooms from the edges"},
] as const satisfies readonly {value: ColorSchemeGradient["layout"]; label: string; hint: string}[]

export const gradientTargets = [
    {value: "background", label: "Background"},
    {value: "buttons", label: "Buttons"},
    {value: "sidebars", label: "Sidebars"},
    {value: "containers", label: "Containers"},
    {value: "topbars", label: "Top bars"},
    {value: "switches", label: "Switches and tabs"},
] as const

export const allGradientTargets = gradientTargets.map(({value}) => value).join(",")

export function selectedGradientTargets(placement: unknown) {
    if (placement === "both") return ["background", "buttons"]
    return typeof placement === "string" && placement.length <= allGradientTargets.length ? placement.split(",") : []
}

export const gradientStops = ["first", "second", "third"] as const

const hexColorPattern = /^#[0-9a-f]{6}$/i
const lightForeground = "#ffffff"
const darkForeground = "#0a0a0a"

// Per-mode mix strengths tuned so derived tokens track the neutral shadcn palette.
const strengths: Record<ColorSchemeMode, Record<"secondary" | "muted" | "mutedText" | "hover" | "border" | "input", number>> = {
    light: {secondary: 8, muted: 4, mutedText: 68, hover: 10, border: 20, input: 22},
    dark: {secondary: 8, muted: 11, mutedText: 63, hover: 16, border: 11, input: 15},
}

export function isHexColor(value: unknown): value is string {
    return typeof value === "string" && value.length === 7 && hexColorPattern.test(value)
}

export function isValidPalette(palette: ColorSchemePalette | undefined): palette is ColorSchemePalette {
    if (!palette || !paletteFields.every(({key}) => isHexColor(palette[key]))) return false
    const {gradient} = palette
    if (gradient == null) return true
    const targets = selectedGradientTargets(gradient.placement)
    return gradientLayouts.some(({value}) => value === gradient.layout) &&
        targets.length > 0 && new Set(targets).size === targets.length &&
        targets.every((target) => gradientTargets.some(({value}) => value === target)) &&
        gradientStops.every((key) => isHexColor(gradient[key]))
}

export function relativeLuminance(hex: string) {
    const channels = [1, 3, 5].map((start) => {
        const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrastRatio(first: string, second: string) {
    const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a)
    return (lighter + 0.05) / (darker + 0.05)
}

/** Picks the text color that stays legible on top of a filled accent. */
export function readableForeground(background: string) {
    return contrastRatio(background, lightForeground) >= contrastRatio(background, darkForeground)
        ? lightForeground
        : darkForeground
}

function mix(color: string, percent: number, base: string) {
    return `color-mix(in oklab, ${color} ${percent}%, ${base})`
}

function blendHex(base: string, color: string, amount: number) {
    const channels = [1, 3, 5].map((start) => {
        const from = Number.parseInt(base.slice(start, start + 2), 16)
        const to = Number.parseInt(color.slice(start, start + 2), 16)
        return Math.round(from + (to - from) * amount).toString(16).padStart(2, "0")
    })
    return `#${channels.join("")}`
}

function contrastTint(base: string, color: string, amount: number, text: string, target: number) {
    const textLightness = relativeLuminance(text)
    const isLighterThanText = relativeLuminance(base) > textLightness
    const minimum = Math.min(target, contrastRatio(base, text))
    for (let strength = amount; strength >= .01; strength *= .8) {
        const tint = blendHex(base, color, strength)
        if ((relativeLuminance(tint) > textLightness) === isLighterThanText && contrastRatio(tint, text) >= minimum)
            return tint
    }
    return base
}

const gradientSurfaces = {
    background: {base: "background", light: .38, dark: .86},
    sidebar: {base: "sidebar", light: .22, dark: .48},
    surface: {base: "surface", light: .16, dark: .29},
    topbar: {base: "background", light: .21, dark: .42},
} as const

export function gradientBackground(
    palette: ColorSchemePalette,
    mode: ColorSchemeMode,
    gradient: ColorSchemeGradient,
    surface: keyof typeof gradientSurfaces = "background",
) {
    const style = gradientSurfaces[surface]
    const background = palette[style.base]
    const {text} = palette
    const strength = style[mode]
    const [first, second, third] = gradientStops.map((key) => contrastTint(background, gradient[key], strength, text, 5))
    const base = contrastTint(background, gradient.second, strength * (mode === "dark" ? .28 : .18), text, 5)

    switch (gradient.layout) {
        case "aurora":
            return `radial-gradient(ellipse at 60% -12%, ${first} 0%, transparent 58%), ` +
                `radial-gradient(ellipse at 82% 40%, ${second} 0%, transparent 55%), ` +
                `radial-gradient(ellipse at 72% 110%, ${third} 0%, transparent 65%), linear-gradient(${base}, ${base})`
        case "horizon":
            return `linear-gradient(152deg in srgb, ${base} 7%, ${first} 32%, ${second} 65%, ${third} 100%)`
        case "corners":
            return `radial-gradient(ellipse at 1% 4%, ${first} 0%, transparent 65%), ` +
                `radial-gradient(ellipse at 98% 3%, ${second} 0%, transparent 58%), ` +
                `radial-gradient(ellipse at 96% 100%, ${third} 0%, transparent 69%), linear-gradient(${base}, ${base})`
    }
}

function gradientTokens(palette: ColorSchemePalette, mode: ColorSchemeMode) {
    const {gradient} = palette
    const targets = selectedGradientTargets(gradient?.placement)
    const paintButtons = targets.includes("buttons")
    const paintSwitches = targets.includes("switches")
    let control = "none"
    let buttonHover = "none"
    let secondaryButton = "none"

    if (gradient && (paintButtons || paintSwitches)) {
        const angle = {aurora: 114, horizon: 148, corners: 73}[gradient.layout]
        const stops = gradientStops.map((key) =>
            contrastTint("#000000", blendHex(palette.accent, gradient[key], .82), 1, lightForeground, 5.2))
        const controlGradient = (colors: string[]) =>
            `linear-gradient(${angle}deg in srgb, ${colors[0]} 0%, ${colors[1]} 52%, ${colors[2]} 100%)`
        control = controlGradient(stops)
        if (paintButtons) {
            buttonHover = controlGradient(stops.map((color) => contrastTint(color, lightForeground, .10, lightForeground, 4.6)))
            secondaryButton = controlGradient(stops.map((color) => `${color}${mode === "dark" ? "5c" : "24"}`))
        }
    }

    return {
        "--workshop-gradient-background": gradient && targets.includes("background") ? gradientBackground(palette, mode, gradient) : "none",
        "--workshop-gradient-sidebar": gradient && targets.includes("sidebars") ? gradientBackground(palette, mode, gradient, "sidebar") : "none",
        "--workshop-gradient-container": gradient && targets.includes("containers") ? gradientBackground(palette, mode, gradient, "surface") : "none",
        "--workshop-gradient-topbar": gradient && targets.includes("topbars") ? gradientBackground(palette, mode, gradient, "topbar") : "none",
        "--workshop-gradient-button": paintButtons ? control : "none",
        "--workshop-gradient-button-hover": buttonHover,
        "--workshop-gradient-button-soft": secondaryButton,
        "--workshop-gradient-button-text": paintButtons ? lightForeground : "var(--primary-foreground)",
        "--workshop-gradient-switch": paintSwitches ? control : "none",
        "--workshop-gradient-switch-text": paintSwitches ? lightForeground : "initial",
    }
}

export function paletteTokens(palette: ColorSchemePalette, mode: ColorSchemeMode): Record<string, string> {
    // Bright presets need the same canvas/surface separation as the default light theme.
    // Keep deliberately dim custom colors and dark palettes as authored.
    const soften = (color: string, amount: number) =>
        mode === "light" && relativeLuminance(color) > .85 && relativeLuminance(palette.text) < .35
            ? blendHex(color, palette.text, amount)
            : color
    const effectivePalette = {
        ...palette,
        background: soften(palette.background, .10),
        surface: soften(palette.surface, .035),
        sidebar: soften(palette.sidebar, .065),
    }
    const {accent, background, surface, sidebar, text} = effectivePalette
    const strength = strengths[mode]
    const onAccent = readableForeground(accent)
    const border = mix(text, strength.border, "transparent")

    return {
        "--background": background,
        "--foreground": text,
        "--card": surface,
        "--card-foreground": text,
        "--popover": surface,
        "--popover-foreground": text,
        "--primary": accent,
        "--primary-foreground": onAccent,
        "--secondary": mix(text, strength.secondary, surface),
        "--secondary-foreground": text,
        "--muted": mix(text, strength.muted, background),
        "--muted-foreground": mix(text, strength.mutedText, background),
        "--accent": mix(accent, strength.hover, surface),
        "--accent-foreground": text,
        "--border": border,
        "--input": mix(text, strength.input, "transparent"),
        "--ring": accent,
        "--sidebar": sidebar,
        "--sidebar-foreground": text,
        "--sidebar-primary": text,
        "--sidebar-primary-foreground": readableForeground(text),
        "--sidebar-accent": mix(text, strength.hover, sidebar),
        "--sidebar-accent-foreground": text,
        "--sidebar-border": border,
        "--sidebar-ring": mix(text, 50, sidebar),
        ...gradientTokens(effectivePalette, mode),
    }
}

/**
 * Returns the stylesheet for an organization scheme, or an empty string when the workshop
 * should keep the stylesheet defaults. Colors are validated first because the result is
 * injected into a style element.
 */
export function buildColorSchemeCss(scheme: ColorScheme | undefined | null) {
    if (!scheme || !isValidPalette(scheme.light) || !isValidPalette(scheme.dark)) return ""
    const isDefault = scheme.id === defaultColorSchemeId
    if (isDefault && !scheme.light.gradient && !scheme.dark.gradient) return ""

    const declarations = (mode: ColorSchemeMode) => {
        const tokens = isDefault ? gradientTokens(scheme[mode], mode) : paletteTokens(scheme[mode], mode)
        return Object.entries(tokens).map(([name, value]) => `${name}:${value};`).join("")
    }

    return `:root[${colorSchemeAttribute}]{${declarations("light")}}` +
        `:root.dark[${colorSchemeAttribute}]{${declarations("dark")}}`
}

export type PaletteContrastIssue = { mode: ColorSchemeMode; message: string }

// Truncate so a failing 4.49:1 is never displayed as a passing-looking 4.5:1.
function formatRatio(ratio: number) {
    return (Math.floor(ratio * 10) / 10).toFixed(1)
}

export function paletteContrastIssues(scheme: Pick<ColorScheme, "light" | "dark">) {
    const issues: PaletteContrastIssue[] = []
    for (const mode of ["light", "dark"] as const) {
        const palette = scheme[mode]
        if (!isValidPalette(palette)) continue
        const weakest = (["background", "surface", "sidebar"] as const)
            .map((key) => ({key, ratio: contrastRatio(palette.text, palette[key])}))
            .sort((a, b) => a.ratio - b.ratio)[0]
        if (weakest.ratio < 4.5) {
            issues.push({
                mode,
                message: `Text is hard to read on the ${weakest.key} (${formatRatio(weakest.ratio)}:1, aim for 4.5:1).`
            })
        }
        const accentRatio = contrastRatio(palette.accent, readableForeground(palette.accent))
        if (accentRatio < 4.5 && !selectedGradientTargets(palette.gradient?.placement).includes("buttons")) {
            issues.push({
                mode,
                message: `Button labels are hard to read on the accent (${formatRatio(accentRatio)}:1).`
            })
        }
    }
    return issues
}

export function findColorScheme(
    appearance: { presets: ColorScheme[]; customSchemes: ColorScheme[] } | undefined,
    schemeId: string | undefined,
) {
    if (!appearance || !schemeId) return undefined
    return appearance.presets.find((scheme) => scheme.id === schemeId) ??
        appearance.customSchemes.find((scheme) => scheme.id === schemeId)
}
