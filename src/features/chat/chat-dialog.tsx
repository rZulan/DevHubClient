import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Crown,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ChatConversation, ChatKind, ChatMessage } from "@/features/chat/chat-types"
import { useChatConnection } from "@/features/chat/use-chat-connection"
import { useChatLauncherPosition } from "@/features/chat/use-chat-launcher-position"
import type { WorkshopMember } from "@/features/workshop/workshop-types"
import {
  useAddChatMemberMutation,
  useCreateDirectChatMutation,
  useCreateGroupChatMutation,
  useLazyListChatMessagesQuery,
  useListChatsQuery,
  useMarkChatReadMutation,
  useRemoveChatMemberMutation,
  useSetChatAdminMutation,
} from "@/services/api"
import { cn } from "@/lib/utils"
import { createClientId } from "@/lib/create-client-id"

type ComposeMode = "dm" | "group" | null

type LiveChatMessage = {
  sequence: number
  message: ChatMessage
}

type ChatDialogProps = {
  organizationId: string
  currentUserId?: string
  members: WorkshopMember[]
}

const kindLabels: Record<ChatKind, string> = {
  organization: "Organization",
  team: "Team",
  direct: "Direct message",
  group: "Group",
}

const messageBatchSize = 10

function mergeMessages(...groups: ChatMessage[][]) {
  const messagesById = new Map<string, ChatMessage>()
  groups.flat().forEach((message) => messagesById.set(message.id, message))
  return Array.from(messagesById.values()).sort(
    (left, right) => new Date(left.sentAtUtc).getTime() - new Date(right.sentAtUtc).getTime(),
  )
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

function formatTime(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function ConversationIcon({ kind }: { kind: ChatKind }) {
  if (kind === "direct") return <MessageCircle />
  if (kind === "organization") return <MessagesSquare />
  return <Users />
}

export function ChatDialog({ organizationId, currentUserId, members }: ChatDialogProps) {
  const launcherPosition = useChatLauncherPosition()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()
  const [composeMode, setComposeMode] = useState<ComposeMode>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState("")
  const [formError, setFormError] = useState("")
  const [sending, setSending] = useState(false)
  const [liveMessages, setLiveMessages] = useState<LiveChatMessage[]>([])
  const {
    data: conversations = [],
    isError: conversationsFailed,
    isLoading: conversationsLoading,
    refetch,
  } = useListChatsQuery(organizationId, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })
  const active = conversations.find((conversation) => conversation.id === selectedId)
  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
  const [markRead] = useMarkChatReadMutation()

  const handleLiveMessage = useCallback((message: ChatMessage) => {
    setLiveMessages((current) => [
      ...current.slice(-49),
      { sequence: (current.at(-1)?.sequence ?? 0) + 1, message },
    ])
    if (open && message.conversationId === selectedId) {
      void markRead({ organizationId, conversationId: message.conversationId })
    }
    void refetch()
  }, [markRead, open, organizationId, refetch, selectedId])
  const { connected, sendMessage } = useChatConnection(organizationId, true, handleLiveMessage)

  useEffect(() => {
    if (open && !selectedId && conversations.length > 0) setSelectedId(conversations[0].id)
    if (selectedId && !conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(conversations[0]?.id)
    }
  }, [conversations, open, selectedId])

  useEffect(() => {
    setSettingsOpen(false)
    setComposeMode(null)
    setFormError("")
    if (open && selectedId) {
      void markRead({ organizationId, conversationId: selectedId }).then(() => refetch())
    }
  }, [markRead, open, organizationId, refetch, selectedId])

  const visibleConversations = conversations.filter((conversation) =>
    `${conversation.name} ${kindLabels[conversation.kind]}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <>
      <Button
        {...launcherPosition}
        aria-label="Open messages"
        className="workshop-messages-button"
        onClick={() => { setOpen(true); void refetch() }}
        size="icon"
        title="Messages (drag to move)"
        type="button"
      >
        <MessageCircle />
        {totalUnread > 0 && <Badge className="chat-unread-total">{totalUnread > 99 ? "99+" : totalUnread}</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="chat-modal">
          <DialogHeader className="sr-only">
            <DialogTitle>Messages</DialogTitle>
            <DialogDescription>Organization, team, group, and direct conversations.</DialogDescription>
          </DialogHeader>
          <div className="chat-shell">
            <aside className={cn("chat-conversations", (active || composeMode) && "chat-mobile-hidden")}>
              <header className="chat-list-header">
                <div>
                  <span className="chat-title-icon"><MessageCircle /></span>
                  <div><h2>Messages</h2><small>{connected ? "Live and encrypted" : "Reconnecting…"}</small></div>
                </div>
                <Button aria-label="New group chat" onClick={() => setComposeMode("group")} size="icon" type="button"><Plus /></Button>
              </header>
              <div className="chat-create-actions">
                <Button onClick={() => setComposeMode("dm")} type="button" variant="outline"><MessageCircle /> New DM</Button>
                <Button onClick={() => setComposeMode("group")} type="button" variant="outline"><Users /> New group</Button>
              </div>
              <label className="chat-search"><Search /><Input aria-label="Search conversations" onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" value={query} /></label>
              <div className="chat-conversation-list">
                {visibleConversations.map((conversation) => (
                  <button
                    className={cn("chat-conversation", selectedId === conversation.id && "active")}
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    type="button"
                  >
                    <span className={`chat-conversation-icon kind-${conversation.kind}`}><ConversationIcon kind={conversation.kind} /></span>
                    <span className="chat-conversation-copy">
                      <span><strong>{conversation.name}</strong><time>{formatTime(conversation.lastMessage?.sentAtUtc)}</time></span>
                      <small>{conversation.lastMessage?.body ?? kindLabels[conversation.kind]}</small>
                    </span>
                    {conversation.unreadCount > 0 && <Badge>{conversation.unreadCount}</Badge>}
                  </button>
                ))}
                {conversationsLoading && <p className="chat-empty-list">Loading conversations…</p>}
                {conversationsFailed && (
                  <div className="chat-empty-list">
                    <p>Conversations could not be loaded.</p>
                    <Button onClick={() => void refetch()} size="sm" type="button" variant="outline">Try again</Button>
                  </div>
                )}
                {!conversationsLoading && !conversationsFailed && visibleConversations.length === 0 && <p className="chat-empty-list">No conversations found.</p>}
              </div>
              <footer><LockKeyhole /> Messages are encrypted in transit and at rest.</footer>
            </aside>

            <section className={cn("chat-stage", !active && !composeMode && "chat-mobile-hidden")}>
              {composeMode ? (
                <CreateConversation
                  currentUserId={currentUserId}
                  members={members}
                  mode={composeMode}
                  onBack={() => setComposeMode(null)}
                  onCreated={(conversation) => {
                    setComposeMode(null)
                    setSelectedId(conversation.id)
                    void refetch()
                  }}
                  organizationId={organizationId}
                />
              ) : active ? (
                settingsOpen ? (
                  <ConversationSettings
                    conversation={active}
                    currentUserId={currentUserId}
                    members={members}
                    onBack={() => setSettingsOpen(false)}
                    organizationId={organizationId}
                  />
                ) : (
                  <ConversationView
                    connected={connected}
                    conversation={active}
                    currentUserId={currentUserId}
                    draft={draft}
                    error={formError}
                    onBack={() => setSelectedId(undefined)}
                    onDraftChange={setDraft}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onSend={async () => {
                      if (!draft.trim() || sending) return
                      setSending(true)
                      setFormError("")
                      const body = draft.trim()
                      setDraft("")
                      try {
                        await sendMessage(active.id, body, createClientId())
                      } catch (error) {
                        setDraft(body)
                        setFormError(error instanceof Error ? error.message : "The message could not be sent.")
                      } finally {
                        setSending(false)
                      }
                    }}
                    organizationId={organizationId}
                    sending={sending}
                    liveMessages={liveMessages}
                  />
                )
              ) : (
                <div className="chat-welcome"><MessagesSquare /><h2>Your conversations</h2><p>Select a chat or start a new one.</p></div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConversationView({
  connected,
  conversation,
  currentUserId,
  draft,
  error,
  onBack,
  onDraftChange,
  onOpenSettings,
  onSend,
  organizationId,
  sending,
  liveMessages,
}: {
  connected: boolean
  conversation: ChatConversation
  currentUserId?: string
  draft: string
  error: string
  onBack: () => void
  onDraftChange: (value: string) => void
  onOpenSettings: () => void
  onSend: () => Promise<void>
  organizationId: string
  sending: boolean
  liveMessages: LiveChatMessage[]
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)
  const loadingOlderRef = useRef(false)
  const lastLiveSequenceRef = useRef(liveMessages.at(-1)?.sequence ?? 0)
  const requestGenerationRef = useRef(0)
  const pendingScrollRef = useRef<
    "bottom" | { anchorId: string; anchorTop: number; scrollHeight: number; scrollTop: number } | undefined
  >(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [loadMessages] = useLazyListChatMessagesQuery()

  const loadNewestMessages = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current
    setMessages([])
    setHasMore(true)
    setLoadingInitial(true)
    setLoadingOlder(false)
    loadingOlderRef.current = false
    setLoadError("")
    pendingScrollRef.current = "bottom"

    try {
      const page = await loadMessages({
        organizationId,
        conversationId: conversation.id,
        take: messageBatchSize,
      }, false).unwrap()
      if (requestGeneration !== requestGenerationRef.current) return
      pendingScrollRef.current = "bottom"
      setMessages((current) => mergeMessages(page, current))
      setHasMore(page.length === messageBatchSize)
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setLoadError("Messages could not be loaded.")
      }
    } finally {
      if (requestGeneration === requestGenerationRef.current) setLoadingInitial(false)
    }
  }, [conversation.id, loadMessages, organizationId])

  useEffect(() => {
    void loadNewestMessages()
    return () => {
      requestGenerationRef.current += 1
    }
  }, [loadNewestMessages])

  useEffect(() => {
    const newEvents = liveMessages.filter((event) => event.sequence > lastLiveSequenceRef.current)
    lastLiveSequenceRef.current = liveMessages.at(-1)?.sequence ?? lastLiveSequenceRef.current
    const incoming = newEvents
      .map((event) => event.message)
      .filter((message) => message.conversationId === conversation.id)
    if (incoming.length === 0) return
    const list = listRef.current
    const isNearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80
    if (isNearBottom) pendingScrollRef.current = "bottom"
    setMessages((current) => mergeMessages(current, incoming))
  }, [conversation.id, liveMessages])

  useLayoutEffect(() => {
    const list = listRef.current
    const pendingScroll = pendingScrollRef.current
    if (!list || !pendingScroll) return

    if (pendingScroll === "bottom") {
      list.scrollTop = list.scrollHeight
    } else {
      const anchor = list.querySelector<HTMLElement>(`[data-message-id="${pendingScroll.anchorId}"]`)
      if (anchor) {
        const nextAnchorTop = anchor.getBoundingClientRect().top - list.getBoundingClientRect().top
        list.scrollTop += nextAnchorTop - pendingScroll.anchorTop
      } else {
        list.scrollTop = list.scrollHeight - pendingScroll.scrollHeight + pendingScroll.scrollTop
      }
    }
    lastScrollTopRef.current = list.scrollTop
    pendingScrollRef.current = undefined
  }, [messages])

  const loadOlderMessages = useCallback(async () => {
    const list = listRef.current
    const oldestMessage = messages[0]
    if (!list || !oldestMessage || loadingInitial || loadingOlderRef.current || !hasMore) return

    const requestGeneration = requestGenerationRef.current
    const anchor = list.querySelector<HTMLElement>(`[data-message-id="${oldestMessage.id}"]`)
    const previousPosition = {
      anchorId: oldestMessage.id,
      anchorTop: anchor ? anchor.getBoundingClientRect().top - list.getBoundingClientRect().top : 0,
      scrollHeight: list.scrollHeight,
      scrollTop: list.scrollTop,
    }
    loadingOlderRef.current = true
    setLoadingOlder(true)
    setLoadError("")

    try {
      const page = await loadMessages({
        organizationId,
        conversationId: conversation.id,
        take: messageBatchSize,
        before: oldestMessage.sentAtUtc,
      }, false).unwrap()
      if (requestGeneration !== requestGenerationRef.current) return
      if (page.length > 0) {
        pendingScrollRef.current = previousPosition
        setMessages((current) => mergeMessages(page, current))
      }
      setHasMore(page.length === messageBatchSize)
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setLoadError("Older messages could not be loaded. Scroll up to try again.")
      }
    } finally {
      if (requestGeneration === requestGenerationRef.current) {
        loadingOlderRef.current = false
        setLoadingOlder(false)
      }
    }
  }, [conversation.id, hasMore, loadMessages, loadingInitial, messages, organizationId])

  const handleMessageScroll = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const scrollingUp = list.scrollTop < lastScrollTopRef.current
    lastScrollTopRef.current = list.scrollTop
    if (scrollingUp && list.scrollTop <= 80) void loadOlderMessages()
  }, [loadOlderMessages])

  return (
    <>
      <header className="chat-room-header">
        <Button aria-label="Back to conversations" className="chat-mobile-back" onClick={onBack} size="icon" type="button" variant="ghost"><ArrowLeft /></Button>
        <span className={`chat-conversation-icon kind-${conversation.kind}`}><ConversationIcon kind={conversation.kind} /></span>
        <div><h2>{conversation.name}</h2><small>{kindLabels[conversation.kind]} · {conversation.members.length} member{conversation.members.length === 1 ? "" : "s"}</small></div>
        <Button aria-label="Conversation settings" onClick={onOpenSettings} size="icon" type="button" variant="ghost"><Settings /></Button>
      </header>
      <div
        className="chat-message-list"
        onScroll={handleMessageScroll}
        onWheel={(event) => {
          if (event.deltaY < 0 && event.currentTarget.scrollTop <= 80) void loadOlderMessages()
        }}
        ref={listRef}
      >
        {loadingInitial && <p className="chat-status-message">Loading encrypted messages…</p>}
        {loadingOlder && <p className="chat-status-message">Loading 10 older messages…</p>}
        {loadError && (
          <div className="chat-status-message">
            <span>{loadError}</span>
            {messages.length === 0 && <Button onClick={() => void loadNewestMessages()} size="sm" type="button" variant="outline">Try again</Button>}
          </div>
        )}
        {!loadingInitial && messages.length === 0 && !loadError && <div className="chat-first-message"><MessageCircle /><strong>Start the conversation</strong><span>Messages here are private to the people in this chat.</span></div>}
        {messages.map((message) => {
          const mine = message.senderUserId.toLowerCase() === currentUserId?.toLowerCase()
          const sender = conversation.members.find(
            (member) => member.userId.toLowerCase() === message.senderUserId.toLowerCase(),
          )
          const senderName = sender?.name ?? (mine ? "You" : "Member")
          const senderAvatar = (
            <Avatar className="chat-message-avatar" title={senderName}>
              {sender?.avatarUrl && <AvatarImage alt={senderName} src={sender.avatarUrl} />}
              <AvatarFallback>{initials(senderName)}</AvatarFallback>
            </Avatar>
          )
          return (
            <article className={cn("chat-message", mine && "mine")} data-message-id={message.id} key={message.id}>
              {!mine && senderAvatar}
              <div>
                {!mine && <strong>{senderName}</strong>}
                <p>{message.body}</p>
                <time>{formatTime(message.sentAtUtc)}</time>
              </div>
              {mine && senderAvatar}
            </article>
          )
        })}
      </div>
      <div className="chat-composer">
        {error && <p>{error}</p>}
        <div>
          <Textarea
            aria-label="Message"
            disabled={!connected || sending}
            maxLength={4000}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void onSend()
              }
            }}
            placeholder={connected ? `Message ${conversation.name}` : "Reconnecting…"}
            value={draft}
          />
          <Button aria-label="Send message" disabled={!connected || sending || !draft.trim()} onClick={() => void onSend()} size="icon" type="button"><Send /></Button>
        </div>
      </div>
    </>
  )
}

function CreateConversation({
  currentUserId,
  members,
  mode,
  onBack,
  onCreated,
  organizationId,
}: {
  currentUserId?: string
  members: WorkshopMember[]
  mode: Exclude<ComposeMode, null>
  onBack: () => void
  onCreated: (conversation: ChatConversation) => void
  organizationId: string
}) {
  const selectableMembers = members.filter((member) => member.id !== currentUserId)
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState("")
  const [createDirect, { isLoading: creatingDirect }] = useCreateDirectChatMutation()
  const [createGroup, { isLoading: creatingGroup }] = useCreateGroupChatMutation()
  const busy = creatingDirect || creatingGroup

  async function submit() {
    setError("")
    try {
      const conversation = mode === "dm"
        ? await createDirect({ organizationId, userId: selected[0] }).unwrap()
        : await createGroup({ organizationId, name: name.trim(), memberUserIds: selected }).unwrap()
      onCreated(conversation)
    } catch {
      setError("The conversation could not be created. Check your selections and try again.")
    }
  }

  return (
    <div className="chat-create-view">
      <header className="chat-room-header">
        <Button aria-label="Back" onClick={onBack} size="icon" type="button" variant="ghost"><ArrowLeft /></Button>
        <span className="chat-title-icon">{mode === "dm" ? <MessageCircle /> : <Users />}</span>
        <div><h2>{mode === "dm" ? "New direct message" : "Create group chat"}</h2><small>{mode === "dm" ? "Private between exactly two people" : "Choose the people to invite"}</small></div>
      </header>
      <div className="chat-create-form">
        {mode === "group" && <label><span>Group name</span><Input maxLength={150} onChange={(event) => setName(event.target.value)} placeholder="e.g. Launch crew" value={name} /></label>}
        <div className="chat-member-picker">
          <h3>{mode === "dm" ? "Choose a person" : "Select members"}</h3>
          {selectableMembers.map((member) => {
            const checked = selected.includes(member.id)
            return (
              <label key={member.id}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => setSelected((current) => mode === "dm"
                    ? (next ? [member.id] : [])
                    : (next ? [...current, member.id] : current.filter((id) => id !== member.id)))}
                />
                <Avatar className="size-9"><AvatarImage src={member.avatarUrl} /><AvatarFallback>{member.initials}</AvatarFallback></Avatar>
                <span><strong>{member.name}</strong><small>@{member.username}</small></span>
              </label>
            )
          })}
        </div>
        {error && <p className="chat-form-error">{error}</p>}
        <Button disabled={busy || selected.length === 0 || (mode === "group" && !name.trim())} onClick={() => void submit()} type="button">
          {mode === "dm" ? <MessageCircle /> : <UserPlus />}{busy ? "Creating…" : mode === "dm" ? "Open DM" : "Create group"}
        </Button>
      </div>
    </div>
  )
}

function ConversationSettings({
  conversation,
  currentUserId,
  members,
  onBack,
  organizationId,
}: {
  conversation: ChatConversation
  currentUserId?: string
  members: WorkshopMember[]
  onBack: () => void
  organizationId: string
}) {
  const currentMember = conversation.members.find((member) => member.userId === currentUserId)
  const isAdmin = currentMember?.role === "admin"
  const isCreator = conversation.creatorUserId === currentUserId
  const available = members.filter((member) => !conversation.members.some((chatMember) => chatMember.userId === member.id))
  const [memberToAdd, setMemberToAdd] = useState(available[0]?.id ?? "")
  const [addMember, { isLoading: adding }] = useAddChatMemberMutation()
  const [removeMember] = useRemoveChatMemberMutation()
  const [setAdmin] = useSetChatAdminMutation()

  useEffect(() => {
    if (!available.some((member) => member.id === memberToAdd)) {
      setMemberToAdd(available[0]?.id ?? "")
    }
  }, [available, memberToAdd])

  return (
    <div className="chat-settings-view">
      <header className="chat-room-header">
        <Button aria-label="Back to chat" onClick={onBack} size="icon" type="button" variant="ghost"><ArrowLeft /></Button>
        <span className="chat-title-icon"><Settings /></span>
        <div><h2>Conversation details</h2><small>{conversation.name}</small></div>
      </header>
      <div className="chat-settings-content">
        {conversation.isSpecial && <div className="chat-locked-note"><LockKeyhole /><span><strong>Membership is automatic</strong><small>This chat mirrors {conversation.kind === "team" ? "the team" : "the organization"}. It cannot be changed here.</small></span></div>}
        {conversation.kind === "direct" && <div className="chat-locked-note"><ShieldCheck /><span><strong>Private direct message</strong><small>Only these two participants can access its messages. Organization owners have no override.</small></span></div>}
        <h3>Members · {conversation.members.length}</h3>
        <div className="chat-settings-members">
          {conversation.members.map((member) => {
            const canRemove = conversation.kind === "group" && isAdmin && !member.isCreator && (member.role !== "admin" || isCreator)
            return (
              <div key={member.userId}>
                <Avatar className="size-9"><AvatarImage src={member.avatarUrl ?? undefined} /><AvatarFallback>{initials(member.name)}</AvatarFallback></Avatar>
                <span><strong>{member.name}</strong><small>@{member.username}</small></span>
                {member.isCreator && <Badge><Crown /> Creator</Badge>}
                {!member.isCreator && member.role === "admin" && <Badge variant="secondary"><ShieldCheck /> Admin</Badge>}
                {isCreator && !member.isCreator && (
                  <Button onClick={() => void setAdmin({ organizationId, conversationId: conversation.id, userId: member.userId, isAdmin: member.role !== "admin" })} size="sm" type="button" variant="ghost">
                    {member.role === "admin" ? "Remove admin" : "Make admin"}
                  </Button>
                )}
                {canRemove && <Button onClick={() => void removeMember({ organizationId, conversationId: conversation.id, userId: member.userId })} size="sm" type="button" variant="destructive">Remove</Button>}
              </div>
            )
          })}
        </div>
        {conversation.kind === "group" && isAdmin && available.length > 0 && (
          <div className="chat-add-member">
            <select aria-label="Member to add" onChange={(event) => setMemberToAdd(event.target.value)} value={memberToAdd}>
              {available.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <Button disabled={adding || !memberToAdd} onClick={() => void addMember({ organizationId, conversationId: conversation.id, userId: memberToAdd })} type="button"><UserPlus /> Add member</Button>
          </div>
        )}
      </div>
    </div>
  )
}
