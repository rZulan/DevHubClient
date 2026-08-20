import { Outlet } from "react-router-dom"

import { WorkshopProvider } from "@/features/workshop/workshop-context"

export function WorkshopProviderLayout() {
  return (
    <WorkshopProvider>
      <Outlet />
    </WorkshopProvider>
  )
}
