import type { ComponentType, SVGProps } from "react"

import type { ExternalProvider } from "@/features/auth/auth-types"
import { GitHubIcon, GoogleIcon } from "@/features/auth/oauth-provider-icons"

export const oauthProviders = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
] satisfies Array<{
  id: ExternalProvider
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}>

export const isOAuthEnabled = import.meta.env.VITE_OAUTH_ENABLED === "true"
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api"
export const oauthApiBaseUrl =
  import.meta.env.VITE_OAUTH_API_BASE_URL ?? apiBaseUrl
