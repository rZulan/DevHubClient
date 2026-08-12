import { memo } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"

export const ProtectedLayout = memo(function ProtectedLayout() {
  const user = useAppSelector((state) => state.auth.user)

  if (!user) {
    return <ProtectedRedirect />
  }

  return <Outlet />
})

function ProtectedRedirect() {
  const location = useLocation()
  const requestedPath = `${location.pathname}${location.search}`

  return (
    <Navigate replace to={`/login?redirectTo=${encodeURIComponent(requestedPath)}`} />
  )
}
