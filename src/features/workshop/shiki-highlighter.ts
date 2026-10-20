import type {BundledLanguage, BundledTheme, ThemedToken} from "shiki"

export type CodeTokens = ThemedToken[][]
export const noteCodeTheme = {id: "material-theme-darker", label: "Material Theme Darker"} as const
let shiki: Promise<typeof import("shiki")> | undefined
const cache = new Map<string, Promise<CodeTokens | null>>()
const plainText = new Set(["text", "txt", "plaintext", "plain", "none"])

function loadShiki() {
    // Shiki's shared highlighter loads and reuses grammars and the theme on demand.
    return shiki ??= import("shiki").catch(error => {shiki = undefined; throw error})
}

export async function loadNoteCodeOptions() {
    const {bundledLanguagesInfo, bundledThemesInfo} = await loadShiki()
    return {
        languages: bundledLanguagesInfo.map(item => ({id: item.id, label: item.name, aliases: item.aliases ?? []})).sort((a, b) => a.label.localeCompare(b.label)),
        themes: bundledThemesInfo.map(item => ({id: item.id, label: item.displayName})).sort((a, b) => a.label.localeCompare(b.label)),
    }
}

export async function getNoteCodeTheme(requested = noteCodeTheme.id as string) {
    const {bundledThemes, getSingletonHighlighter} = await loadShiki()
    const id = Object.hasOwn(bundledThemes, requested) ? requested as BundledTheme : noteCodeTheme.id
    const highlighter = await getSingletonHighlighter({themes: [id]})
    const theme = highlighter.getTheme(id)
    return {id, label: theme.displayName ?? id, background: theme.bg, foreground: theme.fg, type: theme.type}
}

export function noteCodeThemeFromMeta(meta: unknown): string {
    return typeof meta === "string" ? /(?:^|\s)theme=([\w-]+)(?:\s|$)/.exec(meta)?.[1] ?? noteCodeTheme.id : noteCodeTheme.id
}

export function highlightNoteCode(source: string, language?: string, theme = noteCodeTheme.id as string): Promise<CodeTokens | null> {
    const lang = language?.toLowerCase()
    if (!lang || plainText.has(lang)) return Promise.resolve(null)
    const key = `${lang}\0${theme}\0${source}`
    const existing = cache.get(key)
    if (existing) {cache.delete(key); cache.set(key, existing); return existing}
    const result = loadShiki().then(async ({bundledLanguages, codeToTokens}) => {
        if (!Object.hasOwn(bundledLanguages, lang)) return null
        const resolvedTheme = await getNoteCodeTheme(theme)
        return (await codeToTokens(source, {lang: lang as BundledLanguage, theme: resolvedTheme.id})).tokens
    }).catch(error => {cache.delete(key); throw error})
    cache.set(key, result)
    // Share results between cards and reading views without retaining every edited draft.
    if (cache.size > 100) cache.delete(cache.keys().next().value!)
    return result
}
