import { useEffect } from "react"
import { ArrowRight, Building2, ChevronRight, Link2, LoaderCircle, Plus, Sparkles } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { OrganizationSetupDialog } from "@/features/workshop/organization-setup-dialog"
import { useCreateOrJoinOrganization } from "@/features/workshop/use-create-or-join-organization"
import { useWorkshop } from "@/features/workshop/workshop-context"
import {
  clearWorkshopResumePath,
  getSelectedOrganizationId,
  setSelectedOrganizationId,
} from "@/features/workshop/workshop-storage"
import type { WorkshopOrganization } from "@/features/workshop/workshop-types"

export function WorkshopPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isLoading, organizations } = useWorkshop()
  const inviteFromUrl = searchParams.get("invite") ?? ""
  const showOrganizationSelector = searchParams.get("choose") === "1"
  const setup = useCreateOrJoinOrganization(openOrganization)
  const openJoin = setup.openJoin

  useEffect(() => {
    if (inviteFromUrl) openJoin()
  }, [inviteFromUrl, openJoin])

  useEffect(() => {
    if (isLoading || inviteFromUrl || showOrganizationSelector) return

    const selectedId = getSelectedOrganizationId()
    const target = organizations.find((organization) => organization.id === selectedId)?.id
      ?? organizations[0]?.id

    if (target) navigate(`/workshop/${target}/dashboard`, { replace: true })
  }, [inviteFromUrl, isLoading, navigate, organizations, showOrganizationSelector])

  function openOrganization(organizationId: string) {
    setSelectedOrganizationId(organizationId)
    navigate(`/workshop/${organizationId}/dashboard`)
  }

  const isRedirecting = !isLoading && !inviteFromUrl && !showOrganizationSelector && organizations.length > 0

  return (
    <main className="workshop-welcome">
      <div className="workshop-welcome-glow" aria-hidden="true" />
      <header className="workshop-welcome-header">
        <Link className="workshop-brand" onClick={clearWorkshopResumePath} to="/">
          <span><Building2 /></span>
          <span>DevHub <b>Workshop</b></span>
        </Link>
        <div className="workshop-welcome-header-actions">
          <Link className="workshop-text-link" onClick={clearWorkshopResumePath} to="/">Back to DevHub</Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="workshop-welcome-content">
        {isLoading || isRedirecting ? (
          <div className="workshop-loading"><LoaderCircle className="animate-spin" /> Loading your workshops…</div>
        ) : (
          <>
            <div className="workshop-eyebrow"><Sparkles /> Build together, clearly</div>
            <h1>{organizations.length > 0 ? "Choose an organization." : "Your teams, projects, and ideas—under one roof."}</h1>
            <p>{organizations.length > 0 ? "Select a workspace to continue, or create and join organizations below." : "Create a workspace for your team, or join one with an invite link."}</p>

            {organizations.length > 0 && (
              <div className="workshop-org-grid">
                {organizations.map((organization) => (
                  <Card className="p-0" key={organization.id}>
                    <Button
                      className="workshop-org-card h-auto w-full"
                      onClick={() => openOrganization(organization.id)}
                      type="button"
                      variant="ghost"
                    >
                      <span className="workshop-org-avatar">{organization.initials}</span>
                      <span className="workshop-org-card-copy">
                        <strong>{organization.name}</strong>
                        <small>{memberCount(organization)} member{memberCount(organization) === 1 ? "" : "s"} · {teamCount(organization)} teams</small>
                      </span>
                      <ChevronRight />
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            <div className="workshop-setup-actions">
              <Button className="h-auto" onClick={setup.openCreate} type="button" variant="outline">
                <span><Plus /></span>
                <span><strong>Create an organization</strong><small>Start fresh and invite your team later</small></span>
                <ArrowRight />
              </Button>
              <Button className="h-auto" onClick={setup.openJoin} type="button" variant="outline">
                <span><Link2 /></span>
                <span><strong>Join with an invite</strong><small>Paste an invite link from an organization</small></span>
                <ArrowRight />
              </Button>
            </div>
          </>
        )}
      </section>

      <OrganizationSetupDialog
        busy={setup.isCreating || setup.isJoining}
        error={setup.error}
        inviteFromUrl={inviteFromUrl}
        mode={setup.mode}
        onClose={setup.close}
        onSubmitCreate={setup.handleCreate}
        onSubmitJoin={setup.handleJoin}
      />
    </main>
  )
}

function memberCount(organization: WorkshopOrganization) {
  return organization.memberCount ?? organization.members.length
}

function teamCount(organization: WorkshopOrganization) {
  return organization.teamCount ?? organization.teams.length
}
