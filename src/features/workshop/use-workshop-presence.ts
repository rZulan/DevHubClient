import { useEffect, useMemo, useState } from "react"
import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { api } from "@/services/api"
import {
  beforeSignOutEvent,
  type BeforeSignOutDetail,
} from "@/features/auth/sign-out-events"
import type { WorkshopPresenceStatus } from "@/features/workshop/workshop-types"

type PublicPresenceStatus = Exclude<WorkshopPresenceStatus, "invisible">
type PresenceMember = { userId: string; status: PublicPresenceStatus }

const awayDelay = 15 * 60 * 1_000
const fallbackHeartbeatDelay = 45_000
const fallbackHeartbeatJitter = 5_000
const reconnectBaseDelay = 2_000
const reconnectMaxDelay = 30_000
const statusChangedEvent = "devhub-workshop-status-changed"

function getFallbackHeartbeatDelay() {
  return fallbackHeartbeatDelay + (Math.random() * 2 - 1) * fallbackHeartbeatJitter
}

function getReconnectDelay(attempt: number) {
  const delay = Math.min(reconnectBaseDelay * 2 ** attempt, reconnectMaxDelay)
  return delay * (0.8 + Math.random() * 0.4)
}

function getStatusStorageKey(userId?: string) {
  return `devhub-workshop-status:${userId?.toLowerCase() ?? "guest"}`
}

function readSavedStatus(userId?: string): Exclude<WorkshopPresenceStatus, "offline"> {
  const saved = localStorage.getItem(getStatusStorageKey(userId))
  return saved === "away" || saved === "dnd" || saved === "invisible" ? saved : "online"
}

function toPresenceMap(members: PresenceMember[]) {
  return new Map(members.map((member) => [member.userId.toLowerCase(), member.status]))
}

export function useWorkshopPresence(organizationId: string, enabled: boolean) {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const [manualStatus, setManualStatusState] = useState(() => readSavedStatus(currentUserId))
  const [automaticallyAway, setAutomaticallyAway] = useState(false)
  const [livePresence, setLivePresence] = useState<Map<string, PublicPresenceStatus>>(() => new Map())
  const [heartbeatPresence, setHeartbeatPresence] = useState<Map<string, PublicPresenceStatus>>(() => new Map())
  const effectiveStatus: Exclude<WorkshopPresenceStatus, "offline"> =
    manualStatus === "online" && automaticallyAway ? "away" : manualStatus

  useEffect(() => {
    setManualStatusState(readSavedStatus(currentUserId))
  }, [currentUserId])

  useEffect(() => {
    const syncStatus = (event: Event) => {
      const status = (event as CustomEvent<Exclude<WorkshopPresenceStatus, "offline">>).detail
      if (status) setManualStatusState(status)
    }

    window.addEventListener(statusChangedEvent, syncStatus)
    return () => window.removeEventListener(statusChangedEvent, syncStatus)
  }, [])

  useEffect(() => {
    if (manualStatus !== "online") {
      setAutomaticallyAway(false)
      return
    }

    let awayTimer: ReturnType<typeof setTimeout> | undefined
    const regainFocus = () => {
      setAutomaticallyAway(false)
      clearTimeout(awayTimer)
    }
    const loseFocus = () => {
      clearTimeout(awayTimer)
      awayTimer = setTimeout(() => setAutomaticallyAway(true), awayDelay)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") loseFocus()
      else regainFocus()
    }

    if (document.visibilityState === "hidden" || !document.hasFocus()) loseFocus()
    else regainFocus()

    window.addEventListener("blur", loseFocus)
    window.addEventListener("focus", regainFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearTimeout(awayTimer)
      window.removeEventListener("blur", loseFocus)
      window.removeEventListener("focus", regainFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [manualStatus])

  useEffect(() => {
    if (!enabled || !organizationId) return

    let disposed = false
    let realtimeReady = false
    let reconnectAttempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined

    const connection = new HubConnectionBuilder()
      .withUrl("/hubs/workshop", {
        accessTokenFactory: () => accessToken ?? "",
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .build()

    connection.on("MemberStatusChanged", (userId: string, status: PublicPresenceStatus) => {
      setLivePresence((current) => {
        const next = new Map(current)
        if (status === "offline") next.delete(userId.toLowerCase())
        else next.set(userId.toLowerCase(), status)
        return next
      })
    })
    connection.on("MemberOffline", (userId: string) => {
      setLivePresence((current) => {
        const next = new Map(current)
        next.delete(userId.toLowerCase())
        return next
      })
    })
    connection.on("DashboardPublished", (changedOrganizationId: string) => {
      if (changedOrganizationId.toLowerCase() === organizationId.toLowerCase()) {
        dispatch(api.util.invalidateTags([{ type: "OrganizationDashboard", id: organizationId }]))
      }
    })

    async function joinOrganization() {
      const members = await connection.invoke<PresenceMember[]>("JoinOrganization", organizationId, effectiveStatus)
      if (!disposed) setLivePresence(toPresenceMap(members))
    }

    async function startConnection() {
      if (disposed || connection.state !== HubConnectionState.Disconnected) return

      try {
        await connection.start()
        await joinOrganization()
        realtimeReady = true
        reconnectAttempt = 0
        clearTimeout(heartbeatTimer)
        setHeartbeatPresence(new Map())
      } catch {
        realtimeReady = false
        startFallbackHeartbeat(true)
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      clearTimeout(retryTimer)
      if (disposed) return

      const delay = getReconnectDelay(reconnectAttempt)
      reconnectAttempt += 1
      retryTimer = setTimeout(startConnection, delay)
    }

    async function sendHeartbeat() {
      try {
        const response = await fetch(`/api/organizations/${organizationId}/presence`, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ status: effectiveStatus }),
        })
        if (!response.ok) return

        const members = await response.json() as PresenceMember[]
        if (!disposed) {
          setHeartbeatPresence(toPresenceMap(members))
        }
      } catch {
        // SignalR remains the primary path; the next heartbeat will try again.
      }
    }

    function scheduleFallbackHeartbeat() {
      clearTimeout(heartbeatTimer)
      if (disposed || realtimeReady) return

      heartbeatTimer = setTimeout(async () => {
        await sendHeartbeat()
        scheduleFallbackHeartbeat()
      }, getFallbackHeartbeatDelay())
    }

    function startFallbackHeartbeat(sendImmediately = false) {
      if (disposed) return
      realtimeReady = false
      if (sendImmediately) void sendHeartbeat()
      scheduleFallbackHeartbeat()
    }

    async function announceOffline() {
      clearTimeout(heartbeatTimer)

      if (connection.state === HubConnectionState.Connected) {
        try {
          await connection.invoke("SetStatus", organizationId, "invisible")
        } catch {
          // The authenticated heartbeat below is the fallback path.
        }
      }

      try {
        await fetch(`/api/organizations/${organizationId}/presence`, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ status: "invisible" }),
        })
      } catch {
        // Signing out must continue even if presence cannot be announced.
      }
    }

    const handleBeforeSignOut = (event: Event) => {
      const detail = (event as CustomEvent<BeforeSignOutDetail>).detail
      detail.pending.push(announceOffline())
    }

    connection.onreconnecting(() => {
      if (disposed) return
      setLivePresence(new Map())
      startFallbackHeartbeat(true)
    })
    connection.onreconnected(async () => {
      if (disposed) return
      try {
        await joinOrganization()
        realtimeReady = true
        reconnectAttempt = 0
        clearTimeout(heartbeatTimer)
        setHeartbeatPresence(new Map())
      } catch {
        startFallbackHeartbeat(true)
      }
    })
    connection.onclose(() => {
      if (disposed) return
      setLivePresence(new Map())
      startFallbackHeartbeat(true)
      scheduleReconnect()
    })
    window.addEventListener(beforeSignOutEvent, handleBeforeSignOut)

    void startConnection()

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      clearTimeout(heartbeatTimer)
      window.removeEventListener(beforeSignOutEvent, handleBeforeSignOut)
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop()
      }
    }
  }, [accessToken, dispatch, effectiveStatus, enabled, organizationId])

  const presenceByUserId = useMemo(() => {
    const result = new Map<string, WorkshopPresenceStatus>([
      ...heartbeatPresence,
      ...livePresence,
    ])
    if (enabled && currentUserId) result.set(currentUserId.toLowerCase(), effectiveStatus)
    return result
  }, [currentUserId, effectiveStatus, enabled, heartbeatPresence, livePresence])

  function setStatus(status: Exclude<WorkshopPresenceStatus, "offline">) {
    localStorage.setItem(getStatusStorageKey(currentUserId), status)
    setManualStatusState(status)
    window.dispatchEvent(new CustomEvent(statusChangedEvent, { detail: status }))
  }

  return { presenceByUserId, status: effectiveStatus, setStatus }
}
