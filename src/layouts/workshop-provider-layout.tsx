import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { WorkshopProvider } from "@/features/workshop/workshop-context"
import { setWorkshopResumePath } from "@/features/workshop/workshop-storage"

export function WorkshopProviderLayout() {
  const location = useLocation()
  const userId = useAppSelector((state) => state.auth.user?.id)

  useEffect(() => {
    if (userId) setWorkshopResumePath(userId, location.pathname)
  }, [location.pathname, userId])

  return (
    <WorkshopProvider>
      <Outlet />
    </WorkshopProvider>
  )
}
