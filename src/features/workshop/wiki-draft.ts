import {useEffect, useState} from "react"
import type {WikiPage} from "./wiki-document"

export type WikiDraft = {id: string; title: string; body: string; message: string; baseVersion: string | null}
export function wikiPageVersion(page: WikiPage | undefined) {return page ? JSON.stringify([page.title, page.body, page.updatedAt, page.history.map(revision => revision.id)]) : null}

export function useWikiDraft(storageKey: string) {
    const [draft, setDraft] = useState<WikiDraft | null>(() => {
        try {
            const value = JSON.parse(localStorage.getItem(storageKey) ?? "null")
            return value && ["id", "title", "body", "message"].every(key => typeof value[key] === "string") && (value.baseVersion === null || typeof value.baseVersion === "string") ? value : null
        } catch {return null}
    })
    const [storageError, setStorageError] = useState(false)
    useEffect(() => {
        function leaving(event: BeforeUnloadEvent) {if (draft) event.preventDefault()}
        window.addEventListener("beforeunload", leaving)
        return () => window.removeEventListener("beforeunload", leaving)
    }, [draft])
    function update(next: WikiDraft | null) {
        setDraft(next)
        try {if (next) localStorage.setItem(storageKey, JSON.stringify(next)); else localStorage.removeItem(storageKey); setStorageError(false)}
        catch {setStorageError(true)}
    }
    return {draft, update, storageError}
}
