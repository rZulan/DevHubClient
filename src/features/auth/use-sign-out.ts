import { useNavigate } from "react-router-dom"

import { useAppDispatch } from "@/app/hooks"
import { clearSession } from "@/features/auth/auth-slice"
import { clearStoredRefreshToken } from "@/features/auth/auth-storage"
import { announceBeforeSignOut } from "@/features/auth/sign-out-events"
import { api, useLogoutMutation } from "@/services/api"

export function useSignOut() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout, { isLoading }] = useLogoutMutation()

  async function signOut() {
    try {
      await announceBeforeSignOut()
      await logout().unwrap()
    } finally {
      clearStoredRefreshToken()
      dispatch(clearSession())
      dispatch(api.util.resetApiState())
      navigate("/login", { replace: true })
    }
  }

  return { isSigningOut: isLoading, signOut }
}
