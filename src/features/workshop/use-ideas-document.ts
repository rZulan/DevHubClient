import { useEffect, useEffectEvent, useRef, useState, type SetStateAction } from "react"
import { useAppDispatch } from "@/app/hooks"
import { ideasApi, type IdeasKey } from "./ideas-api"
import { decodeShapes, encodeShapes, normalizeCanvasItem, type CanvasItem } from "./shape-clipboard"

type Status = "loading" | "saved" | "unsaved" | "saving" | "error" | "conflict" | "load-error"

// The page is keyed by user, organization and project so each instance owns one save queue.
export function useIdeasDocument(key: IdeasKey, userId: string, canWrite: boolean) {
  const dispatch = useAppDispatch()
  const [items, renderItems] = useState<CanvasItem[]>([])
  const [status, renderStatus] = useState<Status>("loading")
  const current = useRef<CanvasItem[]>([])
  const revision = useRef(0)
  const state = useRef<Status>("loading")
  const pending = useRef(false)
  const saving = useRef(false)
  const dirtyIds = useRef(new Set<string>())
  const alive = useRef(true)
  const loadGeneration = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const storageKey = `devhub.ideas-draft:${userId}:${key.organizationId}:${key.projectId}`

  function setStatus(next: Status) { state.current = next; if (alive.current) renderStatus(next) }
  function backup() {
    try { localStorage.setItem(storageKey, JSON.stringify({ revision: revision.current, document: encodeShapes(current.current) })) } catch { /* Backend saving still works without local storage. */ }
  }
  function removeBackup() { try { localStorage.removeItem(storageKey) } catch { /* Storage can be unavailable. */ } }

  async function flush() {
    clearTimeout(timer.current)
    timer.current = undefined
    if (saving.current || !pending.current || !canWrite || ["loading", "load-error", "conflict"].includes(state.current)) return
    saving.current = true
    try {
      while (pending.current) {
        const snapshot = current.current
        const requestRevision = revision.current
        const snapshotDirty = new Set(dirtyIds.current)
        pending.current = false
        setStatus("saving")
        const request = dispatch(ideasApi.endpoints.saveIdeas.initiate({ ...key, revision: requestRevision, items: snapshot }))
        try {
          const saved = await request.unwrap()
          revision.current = Math.max(revision.current, saved.revision)
          for (const id of snapshotDirty) {
            if (sameShape(current.current.find(item => item.id === id), snapshot.find(item => item.id === id))) dirtyIds.current.delete(id)
          }
          pending.current ||= dirtyIds.current.size > 0
          if (pending.current) backup()
          else { removeBackup(); setStatus("saved") }
        } catch (error) {
          pending.current = true
          backup()
          if ((error as { status?: number }).status === 409 && revision.current > requestRevision) {
            setStatus("unsaved")
            continue
          }
          setStatus((error as { status?: number }).status === 409 ? "conflict" : "error")
          break
        } finally { request.reset() }
      }
    } finally { saving.current = false }
  }

  async function load(discardDraft = false) {
    if (saving.current) return
    const generation = ++loadGeneration.current
    setStatus("loading")
    try {
      const saved = await dispatch(ideasApi.endpoints.getIdeas.initiate(key, { forceRefetch: true, subscribe: false })).unwrap()
      if (!alive.current || generation !== loadGeneration.current) return
      revision.current = saved.revision
      current.current = saved.items.map(normalizeCanvasItem)
      dirtyIds.current.clear()
      pending.current = false
      let restored = false
      let conflict = false
      if (discardDraft) removeBackup()
      else if (canWrite) {
        try {
          const draft = JSON.parse(localStorage.getItem(storageKey) ?? "null")
          if (draft && typeof draft.document === "string" && Number.isInteger(draft.revision)) {
            const parsed = JSON.parse(draft.document)
            const restoredItems = decodeShapes(draft.document)
            if (parsed.type === "devhub/ideas-shapes" && Array.isArray(parsed.items) && restoredItems.length === parsed.items.length) {
              if (JSON.stringify(restoredItems) === JSON.stringify(current.current)) removeBackup()
              else {
                current.current = restoredItems
                pending.current = true
                restored = true
                conflict = draft.revision !== saved.revision
                revision.current = draft.revision
              }
            }
          }
        } catch { /* Ignore malformed local recovery data. */ }
      }
      renderItems(current.current)
      setStatus(conflict ? "conflict" : restored ? "unsaved" : "saved")
      if (restored && !conflict) void flush()
    } catch { if (alive.current && generation === loadGeneration.current) setStatus("load-error") }
  }

  function setItems(action: SetStateAction<CanvasItem[]>) {
    if (!canWrite || ["loading", "load-error", "conflict"].includes(state.current)) return
    const next = typeof action === "function" ? action(current.current) : action
    if (next === current.current) return
    markDirtyShapes(current.current, next, dirtyIds.current)
    current.current = next
    renderItems(next)
    pending.current = true
    backup()
    if (!saving.current) setStatus("unsaved")
    if (!timer.current) timer.current = setTimeout(() => void flush(), 300)
  }

  function applyRemote(saved: { revision: number; items: CanvasItem[] }) {
    if (saved.revision <= revision.current) return
    const remote = saved.items.map(normalizeCanvasItem)
    revision.current = saved.revision
    if (!dirtyIds.current.size) current.current = remote
    else {
      const localById = new Map(current.current.map(item => [item.id, item]))
      const remoteIds = new Set(remote.map(item => item.id))
      current.current = remote.flatMap(item => dirtyIds.current.has(item.id)
        ? localById.has(item.id) ? [localById.get(item.id)!] : []
        : [item])
      for (const item of current.current === remote ? [] : localById.values()) {
        if (dirtyIds.current.has(item.id) && !remoteIds.has(item.id)) current.current.push(item)
      }
    }
    renderItems(current.current)
    pending.current = dirtyIds.current.size > 0
    if (pending.current) {
      backup()
      setStatus("unsaved")
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), 100)
    } else {
      removeBackup()
      setStatus("saved")
    }
  }

  const loadLatest = useEffectEvent(() => void load())
  const flushLatest = useEffectEvent(() => void flush())
  const backupLatest = useEffectEvent(backup)
  const stopLatest = useEffectEvent(() => {
    alive.current = false
    loadGeneration.current++
    clearTimeout(timer.current)
    void flush()
  })
  useEffect(() => {
    alive.current = true
    loadLatest()
    function beforeUnload(event: BeforeUnloadEvent) {
      if (pending.current || saving.current) { backupLatest(); event.preventDefault(); event.returnValue = "" }
    }
    function visibility() { if (document.visibilityState === "hidden") flushLatest() }
    function online() { if (state.current === "error") flushLatest() }
    window.addEventListener("beforeunload", beforeUnload)
    window.addEventListener("online", online)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      stopLatest()
      window.removeEventListener("beforeunload", beforeUnload)
      window.removeEventListener("online", online)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])

  return { items, setItems, status, applyRemote, save: () => void flush(), retry: () => state.current === "load-error" ? void load() : void flush(), reload: () => void load(true) }
}

function sameShape(first: CanvasItem | undefined, second: CanvasItem | undefined) {
  return first === second || JSON.stringify(first) === JSON.stringify(second)
}

function markDirtyShapes(previous: CanvasItem[], next: CanvasItem[], dirty: Set<string>) {
  const previousById = new Map(previous.map(item => [item.id, item]))
  const nextById = new Map(next.map(item => [item.id, item]))
  for (const id of new Set([...previousById.keys(), ...nextById.keys()])) {
    if (!sameShape(previousById.get(id), nextById.get(id))) dirty.add(id)
  }
  const previousIds = previous.map(item => item.id)
  const nextIds = next.map(item => item.id)
  if (previousIds.length === nextIds.length && nextIds.every(id => previousById.has(id)) && previousIds.join("\0") !== nextIds.join("\0")) {
    previous.forEach(item => dirty.add(item.id))
    next.forEach(item => dirty.add(item.id))
  }
}
