import { useAppSelector } from "@/app/hooks"
import { useWorkshopPresence } from "@/features/workshop/use-workshop-presence"
import { useListOrganizationsQuery } from "@/services/api"

export function GlobalWorkshopPresence() {
  const user = useAppSelector((state) => state.auth.user)
  const { data: organizations = [] } = useListOrganizationsQuery(undefined, {
    skip: !user,
  })

  if (!user) return null

  return organizations.map((organization) => (
    <OrganizationPresenceConnection
      key={organization.id}
      organizationId={organization.id}
    />
  ))
}

function OrganizationPresenceConnection({ organizationId }: { organizationId: string }) {
  useWorkshopPresence(organizationId, true)
  return null
}
