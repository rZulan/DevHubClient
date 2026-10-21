import type {StickyNote} from "./tool-documents.ts"
import {noteEmoji, validNoteEmoji} from "./note-emojis.ts"

export type NoteDraft = {note: StickyNote; creating: boolean; savedAt: string}
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function noteDraftKey(userId: string, organizationId: string, projectId: string) {
    return `devhub.note-drafts:${userId}:${organizationId}:${projectId}`
}

function validDraft(value: unknown): value is NoteDraft {
    if (!value || typeof value !== "object") return false
    const {note, creating, savedAt} = value as NoteDraft
    return typeof creating === "boolean" && typeof savedAt === "string" && Number.isFinite(Date.parse(savedAt))
        && !!note && typeof note.id === "string" && !!note.id.trim() && note.id.length <= 100
        && typeof note.title === "string" && note.title.length <= 150
        && typeof note.body === "string" && note.body.length <= 10000
        && typeof note.color === "string" && /^#[a-fA-F0-9]{6}$/.test(note.color)
        && validNoteEmoji(note.emoji)
        && typeof note.updatedAt === "string" && Number.isFinite(Date.parse(note.updatedAt))
}

export function readNoteDrafts(storage: DraftStorage, key: string): NoteDraft[] {
    const raw = storage.getItem(key)
    let value
    try {value = JSON.parse(raw ?? "null")} catch {return []}
    if (value?.version !== 1 || !Array.isArray(value.drafts)) return []
    const unique = new Map<string, NoteDraft>()
    for (const draft of value.drafts.filter(validDraft) as NoteDraft[]) unique.set(draft.note.id, draft)
    return [...unique.values()].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
}

export function writeNoteDrafts(storage: DraftStorage, key: string, drafts: NoteDraft[]) {
    if (drafts.length) storage.setItem(key, JSON.stringify({version: 1, drafts}))
    else storage.removeItem(key)
}

export function keepNoteDraft(drafts: NoteDraft[], note: StickyNote, creating: boolean): NoteDraft[] {
    return [{note, creating, savedAt: new Date().toISOString()}, ...drafts.filter(draft => draft.note.id !== note.id)]
}

export function withoutSavedNoteDrafts(drafts: NoteDraft[], notes: StickyNote[]) {
    return drafts.filter(({note}) => !notes.some(saved => saved.id === note.id && saved.title === note.title.trim() && saved.body === note.body && saved.color === note.color && noteEmoji(saved) === noteEmoji(note)))
}
