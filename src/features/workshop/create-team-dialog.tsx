import { useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, Plus, UserRound, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { useWorkshop } from "@/features/workshop/workshop-context"
import { createClientId } from "@/lib/create-client-id"
import type {
  WorkshopMember,
  WorkshopOrganization,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import {
  useAddTeamMemberMutation,
  useCreateTeamMutation,
} from "@/services/api"

const teamColors = ["#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24"]
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function CreateTeamDialog({
  defaultLeaderId,
  members,
  onOpenChange,
  open,
  organization,
  teams,
}: {
  defaultLeaderId?: string
  members: WorkshopMember[]
  onOpenChange: (open: boolean) => void
  open: boolean
  organization: WorkshopOrganization
  teams: WorkshopTeam[]
}) {
  const { addTeam } = useWorkshop()
  const [selectedLeaderId, setSelectedLeaderId] = useState("")
  const [error, setError] = useState("")
  const [createTeam, { isLoading: isCreating }] = useCreateTeamMutation()
  const [addTeamMember] = useAddTeamMemberMutation()
  const isPersistedOrganization = guidPattern.test(organization.id)

  useEffect(() => {
    if (!open) return
    setError("")
    setSelectedLeaderId(defaultLeaderId ?? members[0]?.id ?? "")
  }, [defaultLeaderId, members, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const description = String(form.get("description") ?? "").trim()
    const leaderId = String(form.get("leaderId") ?? selectedLeaderId)
    const memberIds = [...new Set([
      leaderId,
      ...form.getAll("memberIds").map(String),
    ])].filter(Boolean)

    if (name.length < 2 || !leaderId) {
      setError("Add a team name and choose one team leader.")
      return
    }

    try {
      if (isPersistedOrganization) {
        const created = await createTeam({
          organizationId: organization.id,
          name,
          description,
          leaderUserId: leaderId,
        }).unwrap()

        await Promise.all(
          memberIds
            .filter((memberId) => memberId !== leaderId)
            .map((memberId) => addTeamMember({
              organizationId: organization.id,
              teamId: created.id,
              userId: memberId,
            }).unwrap()),
        )
      } else {
        addTeam(organization.id, {
          id: createClientId(),
          name,
          description,
          color: teamColors[teams.length % teamColors.length],
          leaderId,
          memberIds,
          memberCount: memberIds.length,
        })
      }

      onOpenChange(false)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="workshop-modal workshop-team-modal sm:max-w-lg">
          <span className="workshop-modal-icon"><Users /></span>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>Choose one leader. Everyone else joins as a team member.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Label>Team name<Input autoFocus maxLength={150} name="name" placeholder="Platform Engineering" /></Label>
            <Label>Description <span>Optional</span><Textarea maxLength={1000} name="description" placeholder="What is this team responsible for?" rows={2} /></Label>
            <Label>
              Team leader
              <Select name="leaderId" onValueChange={setSelectedLeaderId} value={selectedLeaderId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a team leader" /></SelectTrigger>
                <SelectContent>
                  {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · @{member.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
            <fieldset className="workshop-member-picker">
              <legend>Team members <span>Optional</span></legend>
              {members.filter((member) => member.id !== selectedLeaderId).map((member) => (
                <Label key={member.id}>
                  <Checkbox name="memberIds" value={member.id} />
                  <span><UserRound /></span>
                  <span><strong>{member.name}</strong><small>@{member.username}</small></span>
                </Label>
              ))}
            </fieldset>
            {error && <p className="workshop-form-error">{error}</p>}
            <Button className="workshop-primary-action" disabled={isCreating} type="submit">
              {isCreating ? <LoaderCircle className="animate-spin" /> : <Plus />}
              Create team
            </Button>
          </form>
        </DialogContent>
      )}
    </Dialog>
  )
}
