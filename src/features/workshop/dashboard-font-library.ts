import {useEffect, useSyncExternalStore} from "react"

type ImportedFont = {id: string; name: string}
type StoredFont = ImportedFont & {data: ArrayBuffer}
const fontStore = "fonts"
const fontLimit = 16
const listeners = new Set<() => void>()
const emptyFonts: readonly ImportedFont[] = []
let fonts = emptyFonts
let initialization: Promise<void> | undefined

async function withFontStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("zevont-dashboard-fonts", 1)
        request.onupgradeneeded = () => request.result.createObjectStore(fontStore, {keyPath: "id"})
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(fontStore, mode)
            const request = run(transaction.objectStore(fontStore))
            transaction.oncomplete = () => resolve(request.result)
            transaction.onabort = () => reject(transaction.error ?? request.error)
        })
    } finally { db.close() }
}

function registerFont(font: ImportedFont, face: FontFace) {
    document.fonts.add(face)
    fonts = [...fonts.filter(item => item.id !== font.id), font].sort((a, b) => a.name.localeCompare(b.name))
    listeners.forEach(listener => listener())
}

function loadLibrary() {
    initialization ??= withFontStore<StoredFont[]>("readonly", store => store.getAll()).then(async records => {
        await Promise.allSettled(records.map(async ({id, name, data}) => {
            if (!/^dashboard-font-[a-f0-9]{24}$/.test(id) || !(data instanceof ArrayBuffer)) return
            registerFont({id, name}, await new FontFace(id, data).load())
        }))
    })
    return initialization
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

export function useDashboardFontLibrary() {
    useEffect(() => { void loadLibrary().catch(() => {}) }, [])
    return useSyncExternalStore(subscribe, () => fonts, () => emptyFonts)
}

export async function importDashboardFont(file: File) {
    if (!/\.(woff2?|otf|ttf)$/i.test(file.name)) throw new Error("Choose a WOFF2, WOFF, OTF, or TTF file.")
    if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("Choose a font file under 2 MB.")
    await loadLibrary()
    const data = await file.arrayBuffer()
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data), 0, 12)
    const id = `dashboard-font-${Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("")}`
    const existing = fonts.find(font => font.id === id)
    if (existing) return existing
    if (fonts.length >= fontLimit) throw new Error(`This browser can store up to ${fontLimit} imported fonts.`)
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Imported font"
    let face: FontFace
    try { face = await new FontFace(id, data).load() }
    catch { throw new Error("This font file could not be opened.") }
    await withFontStore("readwrite", store => store.put({id, name, data} satisfies StoredFont))
    const font = {id, name}
    registerFont(font, face)
    return font
}
