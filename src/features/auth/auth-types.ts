export type ExternalProvider = "github" | "google"

export type ConnectedAccount = {
  provider: ExternalProvider
  providerUsername?: string
}

export type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAtUtc?: string
  username?: string
  dateOfBirth?: string | null
  avatarUrl?: string
  connectedAccounts?: ConnectedAccount[]
}

export type AuthenticationResponse = {
  userId: string
  email: string
  firstName: string
  lastName: string
  username?: string
  dateOfBirth?: string | null
  avatarUrl?: string
  connectedAccounts?: ConnectedAccount[]
  accessToken: string
  accessTokenExpiresAtUtc: string
  refreshTokenExpiresAtUtc: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type RegisterRequest = LoginRequest & {
  firstName: string
  lastName: string
  username?: string
}

export type UserResponse = AuthUser & {
  createdAtUtc: string
}

export type UpdateProfileRequest = {
  username: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
}

export type ApiProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  code?: string
  traceId?: string
  errors?: Record<string, string[]>
}
