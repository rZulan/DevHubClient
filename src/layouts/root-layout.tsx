import { memo } from "react"
import { Outlet } from "react-router-dom"

import { AppFooter } from "@/components/app-footer"
import { AppHeader } from "@/components/app-header"
import { MeshSurface } from "@/components/mesh-surface"

export const RootLayout = memo(function RootLayout() {
  return (
    <MeshSurface className="mesh-page" contentClassName="flex min-h-svh flex-col">
      <AppHeader />
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:py-16">
        <Outlet />
      </main>
      <AppFooter />
    </MeshSurface>
  )
})
