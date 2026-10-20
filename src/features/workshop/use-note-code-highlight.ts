import {useEffect, useState} from "react"
import {getNoteCodeTheme, highlightNoteCode, noteCodeTheme, type CodeTokens} from "./shiki-highlighter.ts"

export function useNoteCodeHighlight(source: string, language: string | undefined, theme: string) {
    const [result, setResult] = useState<{source: string; language?: string; requestedTheme: string; tokens: CodeTokens | null; palette: Awaited<ReturnType<typeof getNoteCodeTheme>>} | null>(null)
    useEffect(() => {
        let current = true
        void Promise.all([highlightNoteCode(source, language, theme), getNoteCodeTheme(theme)]).then(([tokens, palette]) => {
            if (current) setResult({source, language, requestedTheme: theme, tokens, palette})
        }, () => {if (current) setResult(null)})
        return () => {current = false}
    }, [source, language, theme])
    const palette = result?.requestedTheme === theme ? result.palette : {id: theme, label: theme === noteCodeTheme.id ? noteCodeTheme.label : theme, background: "#212121", foreground: "#eeffff", type: "dark"}
    return {palette, tokens: result?.source === source && result.language === language && result.requestedTheme === theme ? result.tokens : null}
}
