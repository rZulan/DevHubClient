import type {
  ColorScheme,
  ColorSchemeMode,
  ColorSchemePalette,
} from "@/features/workshop/workshop-types"

export const defaultColorSchemeId = "default"
export const colorSchemeStyleId = "workshop-color-scheme"
export const colorSchemeAttribute = "data-workshop-scheme"

export const paletteFields = [
  { key: "accent", label: "Accent", hint: "Buttons, active states, and focus rings" },
  { key: "background", label: "Background", hint: "The main workspace canvas" },
  { key: "surface", label: "Surface", hint: "Cards, menus, and dialogs" },
  { key: "sidebar", label: "Sidebar", hint: "Navigation and member list" },
  { key: "text", label: "Text", hint: "Headings and body copy" },
] as const satisfies readonly { key: keyof ColorSchemePalette; label: string; hint: string }[]

const hexColorPattern = /^#[0-9a-f]{6}$/i
const lightForeground = "#ffffff"
const darkForeground = "#0a0a0a"

// Per-mode mix strengths tuned so derived tokens track the neutral shadcn palette.
const strengths: Record<ColorSchemeMode, Record<"secondary" | "muted" | "mutedText" | "hover" | "border" | "input", number>> = {
  light: { secondary: 6, muted: 4, mutedText: 57, hover: 10, border: 11, input: 14 },
  dark: { secondary: 8, muted: 11, mutedText: 63, hover: 16, border: 11, input: 15 },
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && hexColorPattern.test(value)
}

export function isValidPalette(palette: ColorSchemePalette | undefined): palette is ColorSchemePalette {
  return Boolean(palette && paletteFields.every(({ key }) => isHexColor(palette[key])))
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

export function paletteTokens(palette: ColorSchemePalette, mode: ColorSchemeMode): Record<string, string> {
  const { accent, background, surface, sidebar, text } = palette
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
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": onAccent,
    "--sidebar-accent": mix(accent, strength.hover, sidebar),
    "--sidebar-accent-foreground": text,
    "--sidebar-border": border,
    "--sidebar-ring": accent,
  }
}

/**
 * Returns the stylesheet for an organization scheme, or an empty string when the workshop
 * should keep the stylesheet defaults. Colors are validated first because the result is
 * injected into a style element.
 */
export function buildColorSchemeCss(scheme: ColorScheme | undefined | null) {
  if (!scheme || scheme.id === defaultColorSchemeId) return ""
  if (!isValidPalette(scheme.light) || !isValidPalette(scheme.dark)) return ""

  const declarations = (mode: ColorSchemeMode) =>
    Object.entries(paletteTokens(scheme[mode], mode)).map(([name, value]) => `${name}:${value};`).join("")

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
      .map((key) => ({ key, ratio: contrastRatio(palette.text, palette[key]) }))
      .sort((a, b) => a.ratio - b.ratio)[0]
    if (weakest.ratio < 4.5) {
      issues.push({ mode, message: `Text is hard to read on the ${weakest.key} (${formatRatio(weakest.ratio)}:1, aim for 4.5:1).` })
    }
    const accentRatio = contrastRatio(palette.accent, readableForeground(palette.accent))
    if (accentRatio < 4.5) {
      issues.push({ mode, message: `Button labels are hard to read on the accent (${formatRatio(accentRatio)}:1).` })
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
