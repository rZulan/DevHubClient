import { useEffect, useState, type FormEvent } from "react"
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Link2,
  LoaderCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWorkshop } from "@/features/workshop/workshop-context"
import { seedOrganizations } from "@/features/workshop/workshop-data"
import {
  getSelectedOrganizationId,
  setSelectedOrganizationId,
} from "@/features/workshop/workshop-storage"
import type { ApiOrganization } from "@/features/workshop/workshop-types"
import { useCreateOrganizationMutation } from "@/services/api"

type SetupMode = "create" | "join" | null

export function WorkshopPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addLocalOrganization, isLoading, organizations } = useWorkshop()
  const [mode, setMode] = useState<SetupMode>(null)
  const [createOrganization, { isLoading: isCreating }] = useCreateOrganizationMutation()
  const [error, setError] = useState("")

  useEffect(() => {
    if (isLoading || searchParams.get("choose") === "1") return

    const selectedId = getSelectedOrganizationId()
    const exists = organizations.some((organization) => organization.id === selectedId)
      || seedOrganizations.some((organization) => organization.id === selectedId)

    if (selectedId && exists) {
      navigate(`/workshop/${selectedId}/lobby`, { replace: true })
    }
  }, [isLoading, navigate, organizations, searchParams])

  function openOrganization(organizationId: string) {
    setSelectedOrganizationId(organizationId)
    navigate(`/workshop/${organizationId}/lobby`)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const description = String(form.get("description") ?? "").trim()

    if (name.length < 2) {
      setError("Give your organization a name with at least 2 characters.")
      return
    }

    try {
      const organization = await createOrganization({ name, description }).unwrap()
      addLocalOrganization(organization)
      openOrganization(organization.id)
    } catch {
      setError("The organization could not be created. Make sure the API is running and try again.")
    }
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = new FormData(event.currentTarget)
    const inviteLink = String(form.get("inviteLink") ?? "").trim()

    if (!inviteLink || !inviteLink.includes("/invite/")) {
      setError("Paste a valid Workshop invite link.")
      return
    }

    const inviteCode = inviteLink.split("/").filter(Boolean).at(-1) ?? crypto.randomUUID()
    const joined: ApiOrganization = {
      id: `joined-${inviteCode}`,
      ownerUserId: "invite-owner",
      name: "Joined Workshop",
      description: "Organization joined through an invite link. Invite verification will be connected to the backend next.",
      createdAtUtc: new Date().toISOString(),
      memberCount: 1,
      teamCount: 0,
    }
    addLocalOrganization(joined)
    openOrganization(joined.id)
  }

  return (
    <main className="workshop-welcome">
      <div className="workshop-welcome-glow" aria-hidden="true" />
      <header className="workshop-welcome-header">
        <Link className="workshop-brand" to="/">
          <span><Building2 /></span>
          <span>DevHub <b>Workshop</b></span>
        </Link>
        <div className="workshop-welcome-header-actions">
          <Link className="workshop-text-link" to="/">Back to DevHub</Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="workshop-welcome-content">
        <div className="workshop-eyebrow"><Sparkles /> Build together, clearly</div>
        <h1>Your teams, projects, and ideas—under one roof.</h1>
        <p>
          Choose an organization to continue, or start a new workspace for your team.
          Your last selection is remembered on this device.
        </p>

        {isLoading ? (
          <div className="workshop-loading"><LoaderCircle className="animate-spin" /> Loading your workshops…</div>
        ) : (
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
                    <small>{organization.members.length} member{organization.members.length === 1 ? "" : "s"} · {organization.teams.length} teams</small>
                  </span>
                  <ChevronRight />
                </Button>
              </Card>
            ))}
          </div>
        )}

        <div className="workshop-setup-actions">
          <Button className="h-auto" onClick={() => { setError(""); setMode("create") }} type="button" variant="outline">
            <span><Plus /></span>
            <span><strong>Create an organization</strong><small>Start fresh and invite your team later</small></span>
            <ArrowRight />
          </Button>
          <Button className="h-auto" onClick={() => { setError(""); setMode("join") }} type="button" variant="outline">
            <span><Link2 /></span>
            <span><strong>Join with an invite</strong><small>Paste an invite link from an organization</small></span>
            <ArrowRight />
          </Button>
        </div>

        <Button className="workshop-sample-link" onClick={() => openOrganization(seedOrganizations[0].id)} type="button" variant="link">
          <Users /> Explore the sample Atlas Studio workshop
        </Button>
      </section>

      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null) }}>
        {mode && (
          <DialogContent className="workshop-modal sm:max-w-md">
            <span className="workshop-modal-icon">{mode === "create" ? <Building2 /> : <Link2 />}</span>
            <DialogHeader>
              <DialogTitle id="workshop-modal-title">{mode === "create" ? "Create an organization" : "Join a workshop"}</DialogTitle>
              <DialogDescription>{mode === "create" ? "Give your team a place to plan, make, and ship." : "Ask an organization member for their Workshop invite link."}</DialogDescription>
            </DialogHeader>

            <form onSubmit={mode === "create" ? handleCreate : handleJoin}>
              {mode === "create" ? (
                <>
                  <Label>Organization name<Input autoFocus maxLength={150} name="name" placeholder="Acme Studio" /></Label>
                  <Label>Description <span>Optional</span><Textarea maxLength={1000} name="description" placeholder="What are you building together?" rows={3} /></Label>
                </>
              ) : (
                <Label>Invite link<Input autoFocus name="inviteLink" placeholder="https://devhub.app/invite/…" /></Label>
              )}
              {error && <p className="workshop-form-error">{error}</p>}
              <Button className="workshop-primary-action" disabled={isCreating} type="submit">
                {isCreating ? <LoaderCircle className="animate-spin" /> : mode === "create" ? <Plus /> : <ArrowRight />}
                {mode === "create" ? "Create workshop" : "Join organization"}
              </Button>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </main>
  )
}
