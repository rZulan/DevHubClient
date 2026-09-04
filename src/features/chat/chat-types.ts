export type ChatKind = "organization" | "team" | "direct" | "group"

export type ChatMember = {
  userId: string
  name: string
  username: string
  avatarUrl?: string | null
  role: "admin" | "member"
  isCreator: boolean
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderUserId: string
  clientMessageId: string
  body: string
  sentAtUtc: string
}

export type ChatConversation = {
  id: string
  organizationId: string
  kind: ChatKind
  name: string
  teamId?: string | null
  creatorUserId?: string | null
  isSpecial: boolean
  unreadCount: number
  lastMessage?: ChatMessage | null
  members: ChatMember[]
}
