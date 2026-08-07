import type { AppDispatch } from "@/app/store"
import { setCredentials } from "@/features/auth/auth-slice"
import { clearStoredRefreshToken } from "@/features/auth/auth-storage"
import type { AuthenticationResponse } from "@/features/auth/auth-types"

export function acceptAuthentication(
  dispatch: AppDispatch,
  response: AuthenticationResponse,
) {
  clearStoredRefreshToken()
  dispatch(setCredentials(response))
}
