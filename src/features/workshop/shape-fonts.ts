export const systemFonts = ["Geist", "Arial", "Verdana", "Georgia", "Times New Roman", "Courier New"] as const

export const googleFonts = [
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Inter",
  "Nunito",
  "Raleway",
  "Oswald",
  "Ubuntu",
  "Source Sans 3",
  "Noto Sans",
  "Merriweather",
  "Playfair Display",
  "Roboto Slab",
  "Noto Serif",
  "Libre Baskerville",
  "Roboto Mono",
  "Dancing Script",
  "Pacifico",
  "Bebas Neue",
] as const

export const shapeFonts = [...systemFonts, ...googleFonts] as const
export type ShapeFont = typeof shapeFonts[number]

const googleFontSet = new Set<string>(googleFonts)
const serifFonts = new Set<string>(["Georgia", "Times New Roman", "Merriweather", "Playfair Display", "Roboto Slab", "Noto Serif", "Libre Baskerville"])
const monospaceFonts = new Set<string>(["Courier New", "Roboto Mono"])

export function isShapeFont(value: unknown): value is ShapeFont {
  return typeof value === "string" && (shapeFonts as readonly string[]).includes(value)
}

export function isGoogleFont(font: ShapeFont) {
  return googleFontSet.has(font)
}

export function googleFontStylesheet(font: ShapeFont) {
  if (!isGoogleFont(font)) return undefined
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replaceAll("%20", "+")}&display=swap`
}

export function ensureGoogleFont(font: ShapeFont) {
  const href = googleFontStylesheet(font)
  if (!href || typeof document === "undefined") return
  const id = `google-font-${font.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  if (document.getElementById(id)) return
  const link = document.createElement("link")
  link.id = id
  link.rel = "stylesheet"
  link.href = href
  document.head.append(link)
}

export function shapeFontStack(font: ShapeFont) {
  const fallback = monospaceFonts.has(font) ? "monospace" : serifFonts.has(font) ? "serif" : "sans-serif"
  return `"${font}", ${fallback}`
}
