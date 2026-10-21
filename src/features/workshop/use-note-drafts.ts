import {useCallback, useEffect, useRef, useState} from "react"
import type {StickyNote} from "./tool-documents"
import {keepNoteDraft, readNoteDrafts, withoutSavedNoteDrafts, writeNoteDrafts, type NoteDraft} from "./note-drafts"

export function useNoteDrafts(storageKey: string, savedNotes: StickyNote[], saved: boolean) {
    const [initial] = useState(() => {
        try {return {drafts: readNoteDrafts(localStorage, storageKey), error: false}}
        catch {return {drafts: [] as NoteDraft[], error: true}}
    })
    const [drafts, setDrafts] = useState(initial.drafts)
    const [storageError, setStorageError] = useState(initial.error)
    const current = useRef(drafts)
    const change = useCallback((update: (drafts: NoteDraft[]) => NoteDraft[]) => {
        let next: NoteDraft[]
        try {
            // Merge against storage so another tab's drafts are preserved.
            next = update(readNoteDrafts(localStorage, storageKey))
            writeNoteDrafts(localStorage, storageKey, next)
            setStorageError(false)
        } catch {
            next = update(current.current)
            setStorageError(true)
        }
        current.current = next
        setDrafts(next)
    }, [storageKey])

    useEffect(() => {
        // The shared document has its own pending-save backup. Keep the editor
        // draft as well until the note has actually finished saving.
        if (saved && withoutSavedNoteDrafts(current.current, savedNotes).length !== current.current.length) {
            change(items => withoutSavedNoteDrafts(items, savedNotes))
        }
    }, [saved, savedNotes, change])

    function keep(note: StickyNote, creating: boolean) {change(items => keepNoteDraft(items, note, creating))}
    function discard(id: string) {change(items => items.filter(item => item.note.id !== id))}
    return {drafts, storageError, keep, discard}
}
