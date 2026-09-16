import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { api } from "@/services/api"
import { beforeSignOutEvent, type BeforeSignOutDetail } from "@/features/auth/sign-out-events"
import type { WorkshopPresenceStatus } from "@/features/workshop/workshop-types"

type Status = Exclude<WorkshopPresenceStatus, "offline">
type PresenceMember = { userId: string; status: WorkshopPresenceStatus }
type PresenceMap = Map<string, WorkshopPresenceStatus>
const emptyPresence: PresenceMap = new Map()
const awayDelay = 15 * 60 * 1_000
const statusChangedEvent = "devhub-workshop-status-changed"
function getStatusStorageKey(userId?: string) { return `devhub-workshop-status:${userId?.toLowerCase() ?? "guest"}` }
function readSavedStatus(userId?: string): Status {
  try {
    const saved = localStorage.getItem(getStatusStorageKey(userId))
    return saved === "away" || saved === "dnd" || saved === "invisible" ? saved : "online"
  } catch { return "online" }
}
export const WorkshopPresenceContext = createContext<ReturnType<typeof useWorkshopPresenceSession> | null>(null)

export function useWorkshopPresenceSession(organizationIds: string[]) {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const [manualStatus, setManualStatusState] = useState(() => readSavedStatus(currentUserId))
  const [automaticallyAway, setAutomaticallyAway] = useState(false)
  const [presence, setPresence] = useState<Map<string, PresenceMap>>(() => new Map())
  const effectiveStatus: Status = manualStatus === "online" && automaticallyAway ? "away" : manualStatus
  const credentials = useRef({ accessToken, status: effectiveStatus })
  const sendStatus = useRef<(() => void) | null>(null)
  const organizationKey = [...new Set(organizationIds.map(id => id.toLowerCase()))].sort().join(",")

  useEffect(() => {
    credentials.current = { accessToken, status: effectiveStatus }
    sendStatus.current?.()
  }, [accessToken, effectiveStatus])
  useEffect(() => { setManualStatusState(readSavedStatus(currentUserId)) }, [currentUserId])
  useEffect(() => {
    const syncStatus = (event?: Event) => setManualStatusState(
      (event as CustomEvent<Status> | undefined)?.detail ?? readSavedStatus(currentUserId),
    )
    const syncStorage = (event: StorageEvent) => {
      if (event.key === getStatusStorageKey(currentUserId)) syncStatus()
    }
    window.addEventListener(statusChangedEvent, syncStatus)
    window.addEventListener("storage", syncStorage)
    return () => {
      window.removeEventListener(statusChangedEvent, syncStatus)
      window.removeEventListener("storage", syncStorage)
    }
  }, [currentUserId])

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
    setPresence(new Map())
    if (!currentUserId || !organizationKey) return
    const ids = organizationKey.split(",")
    const allowedIds = new Set(ids)
    const joined = new Set<string>()
    const sentStatuses = new Map<string, Status>()
    const abort = new AbortController()
    let disposed = false
    let signingOut = false
    let ready = false
    let starting = false
    let attempt = 0
    let heartbeatRunning = false
    let statusRunning = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
    let dashboardTimer: ReturnType<typeof setTimeout> | undefined
    const pendingDashboards = new Set<string>()
    const connection = new HubConnectionBuilder().withUrl("/hubs/workshop", {
      accessTokenFactory: () => credentials.current.accessToken ?? "",
      withCredentials: true,
    }).build()
    const stopped = () => disposed || signingOut

    function replaceMembers(id: string, members: PresenceMember[]) {
      if (stopped()) return
      const next = new Map(members.filter(m => m.status !== "offline" && m.status !== "invisible")
        .map(m => [m.userId.toLowerCase(), m.status]))
      setPresence(current => {
        const previous = current.get(id)
        if (previous?.size === next.size && [...next].every(([key, value]) => previous.get(key) === value)) return current
        return new Map(current).set(id, next)
      })
    }
    function updateMember(userId: string, status: WorkshopPresenceStatus, organizationId: string) {
      if (stopped() || !organizationId) return
      const id = organizationId.toLowerCase()
      if (!allowedIds.has(id)) return
      const key = userId.toLowerCase()
      const offline = status === "offline" || status === "invisible"
      setPresence(current => {
        const previous = current.get(id) ?? emptyPresence
        if (offline ? !previous.has(key) : previous.get(key) === status) return current
        const members = new Map(previous)
        if (offline) members.delete(key)
        else members.set(key, status)
        return new Map(current).set(id, members)
      })
    }
    function refreshDashboard(id: string) {
      if (stopped()) return
      pendingDashboards.add(id)
      clearTimeout(dashboardTimer)
      dashboardTimer = setTimeout(() => {
        dispatch(api.util.invalidateTags([...pendingDashboards].map(id => ({ type: "OrganizationDashboard" as const, id }))))
        pendingDashboards.clear()
      }, 200)
    }
    connection.on("MemberStatusChanged", updateMember)
    connection.on("MemberOffline", (userId: string, id: string) => updateMember(userId, "offline", id))
    connection.on("DashboardPublished", (id: string) => {
      if (allowedIds.has(id.toLowerCase())) refreshDashboard(id.toLowerCase())
    })

    async function heartbeat(id: string, status: Status) {
      // Use the shared API client so fallback requests participate in token refresh.
      const request = dispatch(api.endpoints.updateWorkshopPresence.initiate({ organizationId: id, status }))
      const cancel = () => request.abort()
      const timeout = setTimeout(cancel, 10_000)
      abort.signal.addEventListener("abort", cancel, { once: true })
      try {
        return await request.unwrap()
      } finally {
        clearTimeout(timeout)
        abort.signal.removeEventListener("abort", cancel)
        request.reset()
      }
    }
    async function runHeartbeat() {
      if (stopped() || ready || heartbeatRunning) return
      heartbeatRunning = true
      clearTimeout(heartbeatTimer)
      try {
        // Sequential requests bound outage traffic even for users in many organizations.
        for (const id of ids) {
          if (stopped() || ready) break
          try {
            const members = await heartbeat(id, credentials.current.status)
            if (!ready && members) replaceMembers(id, members)
          } catch { /* Retry on the next scheduled fallback. */ }
          if (!ready && document.visibilityState === "visible") refreshDashboard(id)
        }
      } finally {
        heartbeatRunning = false
        if (!stopped() && !ready) heartbeatTimer = setTimeout(() => void runHeartbeat(), 40_000 + Math.random() * 10_000)
      }
    }
    async function updateStatus() {
      if (stopped() || statusRunning) return
      if (!ready) { void runHeartbeat(); return }
      statusRunning = true
      try {
        let sent: Status
        do {
          sent = credentials.current.status
          for (const id of joined) {
            if (stopped() || !ready) break
            if (sentStatuses.get(id) === sent) continue
            await connection.invoke("SetStatus", id, sent)
            sentStatuses.set(id, sent)
          }
        } while (!stopped() && ready && sent !== credentials.current.status)
      } catch {
        ready = false
        await connection.stop()
      } finally { statusRunning = false }
    }
    sendStatus.current = () => void updateStatus()
    function scheduleReconnect() {
      clearTimeout(retryTimer)
      if (stopped()) return
      const delay = Math.min(2_000 * 2 ** Math.min(attempt++, 4), 30_000) * (0.8 + Math.random() * 0.4)
      retryTimer = setTimeout(() => void start(), delay)
    }
    async function start() {
      if (stopped() || starting || connection.state !== HubConnectionState.Disconnected) return
      starting = true
      try {
        await connection.start()
        joined.clear()
        sentStatuses.clear()
        for (const id of ids) {
          if (stopped()) return
          try {
            const joinedStatus = credentials.current.status
            const members = await connection.invoke<PresenceMember[]>("JoinOrganization", id, joinedStatus)
            joined.add(id)
            sentStatuses.set(id, joinedStatus)
            replaceMembers(id, members)
            refreshDashboard(id) // Recover publications missed while disconnected.
          } catch (error) {
            if (!String(error).includes("You are not a member of this organization.")) throw error
            // An organization may have been removed since the cached list was read.
            replaceMembers(id, [])
          }
        }
        if (stopped()) return
        ready = true
        attempt = 0
        clearTimeout(heartbeatTimer)
        void updateStatus()
      } catch {
        ready = false
        if (!stopped()) {
          await connection.stop()
          void runHeartbeat()
          scheduleReconnect()
        }
      } finally { starting = false }
    }
    connection.onclose(() => {
      if (stopped()) return
      ready = false
      joined.clear()
      setPresence(new Map())
      void runHeartbeat()
      scheduleReconnect()
    })
    async function announceOffline() {
      signingOut = true
      clearTimeout(retryTimer)
      clearTimeout(heartbeatTimer)
      for (const id of ids) {
        if (disposed) break
        let delivered = false
        try {
          if (connection.state === HubConnectionState.Connected && joined.has(id)) {
            await connection.invoke("SetStatus", id, "invisible")
            delivered = true
          }
        } catch { /* Fall back to HTTP if the socket failed during sign-out. */ }
        if (!delivered && !disposed) {
          try { await heartbeat(id, "invisible") } catch { /* Sign-out remains available during an outage. */ }
        }
      }
    }
    const beforeSignOut = (event: Event) => {
      (event as CustomEvent<BeforeSignOutDetail>).detail.pending.push(announceOffline())
    }
    window.addEventListener(beforeSignOutEvent, beforeSignOut)
    void start()
    return () => {
      disposed = true
      sendStatus.current = null
      abort.abort()
      clearTimeout(retryTimer)
      clearTimeout(heartbeatTimer)
      clearTimeout(dashboardTimer)
      window.removeEventListener(beforeSignOutEvent, beforeSignOut)
      void connection.stop()
    }
  }, [currentUserId, dispatch, organizationKey])

  function setStatus(status: Status) {
    try { localStorage.setItem(getStatusStorageKey(currentUserId), status) } catch { /* Session-only preference. */ }
    setManualStatusState(status)
    window.dispatchEvent(new CustomEvent(statusChangedEvent, { detail: status }))
  }
  return { presence, currentUserId, status: effectiveStatus, setStatus }
}

export function useWorkshopPresence(organizationId: string, enabled: boolean) {
  const session = useContext(WorkshopPresenceContext)
  if (!session) throw new Error("Workshop presence provider is missing")
  const { presence, currentUserId, status, setStatus } = session
  const members = enabled ? presence.get(organizationId.toLowerCase()) ?? emptyPresence : emptyPresence
  const presenceByUserId = useMemo(() => {
    if (!enabled || !currentUserId) return members
    return new Map(members).set(currentUserId.toLowerCase(), status)
  }, [members, currentUserId, status, enabled])
  return { presenceByUserId, status, setStatus }
}
