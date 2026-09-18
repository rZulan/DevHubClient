import { HubConnectionBuilder, HubConnectionState, type HubConnection } from "@microsoft/signalr"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"

import { useAppSelector } from "@/app/hooks"
import type { IdeasDocument, IdeasKey } from "./ideas-api"

export type RemoteIdeasSelection = { userId: string; username: string; shapeIds: string[] }

export function useIdeasCollaboration(key: IdeasKey, selectedIds: string[], onDocument: (document: IdeasDocument) => void) {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const [remoteSelections, setRemoteSelections] = useState<Map<string, RemoteIdeasSelection>>(() => new Map())
  const connection = useRef<HubConnection | null>(null)
  const pendingSelection = useRef(selectedIds)
  const publishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const receiveDocument = useEffectEvent(onDocument)
  const projectId = key.projectId.toLowerCase()

  useEffect(() => {
    setRemoteSelections(new Map())
    if (!accessToken || !currentUserId) return
    const currentUserKey = currentUserId.toLowerCase()
    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    const hub = new HubConnectionBuilder().withUrl("/hubs/workshop", {
      accessTokenFactory: () => accessToken,
      withCredentials: true,
    }).build()
    connection.current = hub

    function updateSelection(eventProjectId: string, remoteUserId: string, username: string, shapeIds: string[]) {
      if (disposed || eventProjectId.toLowerCase() !== projectId || remoteUserId.toLowerCase() === currentUserKey) return
      setRemoteSelections(current => {
        const next = new Map(current)
        if (!shapeIds.length) next.delete(remoteUserId.toLowerCase())
        else next.set(remoteUserId.toLowerCase(), { userId: remoteUserId, username, shapeIds })
        return next
      })
    }
    hub.on("IdeasSelectionChanged", updateSelection)
    hub.on("IdeasDocumentChanged", (eventProjectId: string, document: IdeasDocument, actorUserId: string) => {
      if (!disposed && eventProjectId.toLowerCase() === projectId && actorUserId.toLowerCase() !== currentUserKey) receiveDocument(document)
    })

    async function join() {
      const selections = await hub.invoke<RemoteIdeasSelection[]>("JoinIdeas", key.organizationId, key.projectId)
      if (disposed) return
      setRemoteSelections(new Map(selections.map(selection => [selection.userId.toLowerCase(), selection])))
      await hub.invoke("SetIdeasSelection", pendingSelection.current)
    }
    function scheduleStart() {
      clearTimeout(retryTimer)
      if (disposed) return
      const delay = Math.min(1_000 * 2 ** Math.min(attempt++, 5), 30_000)
      retryTimer = setTimeout(() => void start(), delay)
    }
    async function start() {
      if (disposed || hub.state !== HubConnectionState.Disconnected) return
      try {
        await hub.start()
        await join()
        attempt = 0
      } catch {
        if (hub.state !== HubConnectionState.Disconnected) await hub.stop()
        scheduleStart()
      }
    }
    hub.onclose(() => {
      if (disposed) return
      setRemoteSelections(new Map())
      scheduleStart()
    })
    void start()
    return () => {
      disposed = true
      clearTimeout(retryTimer)
      clearTimeout(publishTimer.current)
      connection.current = null
      void hub.stop()
    }
  }, [accessToken, currentUserId, key.organizationId, key.projectId, projectId])

  useEffect(() => {
    pendingSelection.current = selectedIds
    clearTimeout(publishTimer.current)
    publishTimer.current = setTimeout(() => {
      const hub = connection.current
      if (hub?.state === HubConnectionState.Connected) void hub.invoke("SetIdeasSelection", pendingSelection.current).catch(() => undefined)
    }, 50)
    return () => clearTimeout(publishTimer.current)
  }, [selectedIds])

  const selectorsByShape = useMemo(() => {
    const result = new Map<string, string[]>()
    for (const selection of remoteSelections.values()) {
      for (const shapeId of selection.shapeIds) result.set(shapeId, [...(result.get(shapeId) ?? []), selection.username])
    }
    return result
  }, [remoteSelections])
  return { remoteSelections, selectorsByShape }
}
