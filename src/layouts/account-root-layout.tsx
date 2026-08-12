import { memo } from "react"
import { Outlet } from "react-router-dom"

import { AppFooter } from "@/components/app-footer"
import { AppHeader } from "@/components/app-header"
import { MeshSurface } from "@/components/mesh-surface"

export const AccountRootLayout = memo(function AccountRootLayout() {
  return (
    <MeshSurface
      className="mesh-page"
      contentClassName="grid min-h-[calc(100svh+12rem)] grid-rows-[auto_1fr_auto]"
    >
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <Outlet />
      </main>
      <AppFooter />
    </MeshSurface>
  )
})
