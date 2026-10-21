export const defaultNoteEmoji = "📝"

// Missing values belong to older notes; null is an explicit choice of None.
export function noteEmoji(note: {emoji?: string | null}) {
    return note.emoji === undefined ? defaultNoteEmoji : note.emoji
}

export function validNoteEmoji(value: unknown) {
    return value === undefined || value === null || typeof value === "string" && value.length > 0 && value.length <= 32
}
