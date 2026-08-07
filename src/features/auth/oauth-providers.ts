import { Code2, Search } from "lucide-react"

import type { ExternalProvider } from "@/features/auth/auth-types"

export const oauthProviders = [
  { id: "google", label: "Google", Icon: Search },
  { id: "github", label: "GitHub", Icon: Code2 },
] satisfies Array<{
  id: ExternalProvider
  label: string
  Icon: typeof Search
}>

export const isOAuthEnabled = import.meta.env.VITE_OAUTH_ENABLED === "true"
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api"
export const oauthApiBaseUrl =
  import.meta.env.VITE_OAUTH_API_BASE_URL ?? apiBaseUrl
