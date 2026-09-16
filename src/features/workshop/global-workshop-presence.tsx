import type { ReactNode } from "react"
import { useAppSelector } from "@/app/hooks"
import { WorkshopPresenceContext, useWorkshopPresenceSession } from "@/features/workshop/use-workshop-presence"
import { useListOrganizationsQuery } from "@/services/api"

export function GlobalWorkshopPresence({ children }: { children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user)
  const { data: organizations } = useListOrganizationsQuery(undefined, { skip: !user })
  const session = useWorkshopPresenceSession(user ? (organizations ?? []).map(organization => organization.id) : [])
  return <WorkshopPresenceContext.Provider value={session}>{children}</WorkshopPresenceContext.Provider>
}
