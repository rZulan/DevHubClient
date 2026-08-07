import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"

export function ProtectedLayout() {
  const user = useAppSelector((state) => state.auth.user)
  const location = useLocation()

  if (!user) {
    const requestedPath = `${location.pathname}${location.search}`
    return (
      <Navigate
        replace
        to={`/login?redirectTo=${encodeURIComponent(requestedPath)}`}
      />
    )
  }

  return <Outlet />
}
