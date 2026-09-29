import {type FormEvent, type ReactNode, useState} from "react"
import {Pencil, ShieldCheck, UserMinus, Users} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {
    ContextMenu,
    ContextMenuCheckboxItem,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {
    canManageWorkshopMember,
    canManageWorkshopRole,
    hasWorkshopPermission,
    highestWorkshopRole
} from "./workshop-access"
import type {WorkshopMember, WorkshopOrganization} from "./workshop-types"
import {
    useAddTeamMemberMutation,
    useAssignOrganizationRoleMutation,
    useChangeOrganizationMemberNicknameMutation,
    useRemoveOrganizationMemberMutation,
    useRemoveTeamMemberMutation,
} from "@/services/api"

export function MemberSidebarEntry({organization, member, children}: {
    organization: WorkshopOrganization;
    member: WorkshopMember;
    children: ReactNode
}) {
    const currentUserId = useAppSelector(state => state.auth.user?.id)
    const [nicknameOpen, setNicknameOpen] = useState(false)
    const [kickOpen, setKickOpen] = useState(false)
    const [error, setError] = useState("")
    const [assignRole, roleState] = useAssignOrganizationRoleMutation()
    const [addTeamMember, addTeamState] = useAddTeamMemberMutation()
    const [removeTeamMember, removeTeamState] = useRemoveTeamMemberMutation()
    const [changeNickname, nicknameState] = useChangeOrganizationMemberNicknameMutation()
    const [removeMember, kickState] = useRemoveOrganizationMemberMutation()

    const canManageMember = canManageWorkshopMember(organization, currentUserId, member.id)
    const actor = organization.members.find(candidate => candidate.id === currentUserId)
    const actorRole = highestWorkshopRole(organization, currentUserId)
    const targetRole = highestWorkshopRole(organization, member.id)
    const targetIsBelow = Boolean(currentUserId && currentUserId !== member.id && !member.isOwner && (actor?.isOwner || actorRole && targetRole && actorRole.order < targetRole.order))
    const canChangeRoles = targetIsBelow && hasWorkshopPermission(organization, currentUserId, "Manage roles")
    const canChangeTeams = hasWorkshopPermission(organization, currentUserId, "Manage teams")
    const canChangeNickname = hasWorkshopPermission(organization, currentUserId, "Change nicknames")
    const roles = organization.roles.filter(role => !role.isOwnerRole && !role.isDefaultRole && canManageWorkshopRole(organization, currentUserId, role))
    const teams = organization.teams
    const hasActions = canManageMember || canChangeRoles || canChangeTeams || canChangeNickname
    const busy = roleState.isLoading || addTeamState.isLoading || removeTeamState.isLoading || nicknameState.isLoading || kickState.isLoading

    async function toggleRole(roleId: string, assigned: boolean) {
        setError("")
        try {
            await assignRole({organizationId: organization.id, roleId, userId: member.id, assigned}).unwrap()
        } catch (failure) {
            setError(getApiErrorMessage(failure))
        }
    }

    async function toggleTeam(teamId: string, assigned: boolean) {
        setError("")
        try {
            if (assigned) await addTeamMember({organizationId: organization.id, teamId, userId: member.id}).unwrap()
            else await removeTeamMember({organizationId: organization.id, teamId, userId: member.id}).unwrap()
        } catch (failure) {
            setError(getApiErrorMessage(failure))
        }
    }

    async function saveNickname(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const nickname = String(new FormData(event.currentTarget).get("nickname") ?? "").trim()
        setError("")
        try {
            await changeNickname({
                organizationId: organization.id,
                userId: member.id,
                nickname: nickname || null
            }).unwrap()
            setNicknameOpen(false)
        } catch (failure) {
            setError(getApiErrorMessage(failure))
        }
    }

    async function kick() {
        setError("")
        try {
            await removeMember({organizationId: organization.id, userId: member.id}).unwrap();
            setKickOpen(false)
        } catch (failure) {
            setError(getApiErrorMessage(failure));
            setKickOpen(false)
        }
    }

    const trigger = <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
    return <>
        {hasActions ? <ContextMenu>{trigger}<ContextMenuContent className="w-60">
            <ContextMenuLabel>{member.name}</ContextMenuLabel>
            {canChangeRoles && roles.length > 0 && <ContextMenuSub>
                <ContextMenuSubTrigger><ShieldCheck className="mr-2 size-4"/> Assign/remove role</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                    {roles.map(role => <ContextMenuCheckboxItem
                        checked={(member.roleIds ?? [member.roleId]).includes(role.id)} disabled={busy} key={role.id}
                        onCheckedChange={checked => void toggleRole(role.id, checked === true)}
                        onSelect={event => event.preventDefault()}>
                        <i className="size-2 rounded-full" style={{background: role.color}}/>{role.name}
                    </ContextMenuCheckboxItem>)}
                </ContextMenuSubContent>
            </ContextMenuSub>}
            {canChangeTeams && teams.length > 0 && <ContextMenuSub>
                <ContextMenuSubTrigger><Users className="mr-2 size-4"/> Assign/remove team</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                    {teams.map(team => {
                        const assigned = team.memberIds.includes(member.id)
                        const isLeader = team.leaderId === member.id
                        return <ContextMenuCheckboxItem checked={assigned} disabled={busy || isLeader} key={team.id}
                                                        onCheckedChange={checked => void toggleTeam(team.id, checked === true)}
                                                        onSelect={event => event.preventDefault()}>
                            <i className="size-2 rounded-full" style={{background: team.color}}/>{team.name}{isLeader &&
                            <small className="ml-auto text-muted-foreground">Leader</small>}
                        </ContextMenuCheckboxItem>
                    })}
                </ContextMenuSubContent>
            </ContextMenuSub>}
            {canChangeNickname && <><ContextMenuSeparator/><ContextMenuItem onSelect={() => {
                setError("");
                setNicknameOpen(true)
            }}><Pencil/> Change nickname</ContextMenuItem></>}
            {canManageMember && <><ContextMenuSeparator/><ContextMenuItem variant="destructive" onSelect={() => {
                setError("");
                setKickOpen(true)
            }}><UserMinus/> Kick member</ContextMenuItem></>}
        </ContextMenuContent></ContextMenu> : children}

        <Dialog open={nicknameOpen} onOpenChange={setNicknameOpen}><DialogContent
            className="workshop-modal sm:max-w-md">
            <DialogHeader><DialogTitle>Change {member.name}’s nickname</DialogTitle><DialogDescription>This name is
                shown only inside {organization.name}. Leave it blank to use their profile
                name.</DialogDescription></DialogHeader>
            <form className="grid gap-4" onSubmit={saveNickname}><Label>Nickname<Input autoFocus
                                                                                       defaultValue={member.nickname ?? ""}
                                                                                       maxLength={80} name="nickname"
                                                                                       placeholder={member.profileName ?? member.name}/></Label>
                {error && <p className="workshop-form-error" role="alert">{error}</p>}
                <div className="flex justify-end gap-2"><Button type="button" variant="ghost"
                                                                onClick={() => setNicknameOpen(false)}>Cancel</Button><Button
                    disabled={nicknameState.isLoading} type="submit">Save nickname</Button></div>
            </form>
        </DialogContent></Dialog>

        <Dialog open={kickOpen} onOpenChange={setKickOpen}><DialogContent className="workshop-modal sm:max-w-md">
            <DialogHeader><DialogTitle>Kick {member.name}?</DialogTitle><DialogDescription>They will immediately lose
                access to {organization.name} and all of its teams. They can be invited again later.</DialogDescription></DialogHeader>
            {error && <p className="workshop-form-error" role="alert">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost"
                                                            onClick={() => setKickOpen(false)}>Cancel</Button><Button
                disabled={kickState.isLoading} type="button" variant="destructive"
                onClick={() => void kick()}><UserMinus/> Kick member</Button></div>
        </DialogContent></Dialog>

        {error && !nicknameOpen && !kickOpen && <Dialog open onOpenChange={() => setError("")}><DialogContent
            className="workshop-modal sm:max-w-sm"><DialogHeader><DialogTitle>Couldn’t update
            member</DialogTitle><DialogDescription>{error}</DialogDescription></DialogHeader><Button
            onClick={() => setError("")}>Close</Button></DialogContent></Dialog>}
    </>
}
