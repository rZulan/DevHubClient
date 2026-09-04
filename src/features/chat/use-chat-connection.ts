import { useCallback, useEffect, useRef, useState } from "react"
import {
  HubConnectionBuilder,
  HubConnectionState,
  type HubConnection,
} from "@microsoft/signalr"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { api } from "@/services/api"
import type { ChatMessage } from "@/features/chat/chat-types"

export function useChatConnection(
  organizationId: string,
  enabled: boolean,
  onMessage: (message: ChatMessage) => void,
) {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const connectionRef = useRef<HubConnection | null>(null)
  const onMessageRef = useRef(onMessage)
  const [connected, setConnected] = useState(false)

  onMessageRef.current = onMessage

  useEffect(() => {
    if (!enabled || !organizationId) return

    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const connection = new HubConnectionBuilder()
      .withUrl("/hubs/chat", {
        accessTokenFactory: () => accessToken ?? "",
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .build()
    connectionRef.current = connection

    connection.on("MessageReceived", (message: ChatMessage) => {
      onMessageRef.current(message)
    })
    connection.on("ConversationsChanged", (changedOrganizationId: string) => {
      if (changedOrganizationId.toLowerCase() === organizationId.toLowerCase()) {
        dispatch(api.util.invalidateTags([{ type: "Chats", id: organizationId }]))
      }
    })

    function scheduleConnect() {
      clearTimeout(retryTimer)
      if (!disposed) retryTimer = setTimeout(connect, 2_000)
    }

    async function connect() {
      if (disposed || connection.state !== HubConnectionState.Disconnected) return
      try {
        await connection.start()
        if (!disposed) setConnected(true)
      } catch {
        setConnected(false)
        if (connection.state !== HubConnectionState.Disconnected) {
          try {
            await connection.stop()
          } catch {
            // The retry below handles partially opened transports too.
          }
        }
        scheduleConnect()
      }
    }

    connection.onreconnecting(() => setConnected(false))
    connection.onreconnected(() => setConnected(true))
    connection.onclose(() => {
      setConnected(false)
      scheduleConnect()
    })
    void connect()

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      connectionRef.current = null
      if (connection.state !== HubConnectionState.Disconnected) void connection.stop()
    }
  }, [accessToken, dispatch, enabled, organizationId])

  const sendMessage = useCallback(async (
    conversationId: string,
    body: string,
    clientMessageId: string,
  ) => {
    const connection = connectionRef.current
    if (!connection || connection.state !== HubConnectionState.Connected) {
      throw new Error("Chat is reconnecting. Please try again in a moment.")
    }
    return connection.invoke<ChatMessage>(
      "SendMessage",
      organizationId,
      conversationId,
      clientMessageId,
      body,
    )
  }, [organizationId])

  return { connected, sendMessage }
}
