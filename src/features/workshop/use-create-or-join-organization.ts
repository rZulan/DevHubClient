import {type FormEvent, useCallback, useState} from "react"

import {useWorkshop} from "@/features/workshop/workshop-context"
import {useAcceptOrganizationInviteMutation, useCreateOrganizationMutation} from "@/services/api"
import {extractInviteToken} from "./organization-invite-code"

export type OrganizationSetupMode = "create" | "join" | null

export function useCreateOrJoinOrganization(onReady: (organizationId: string) => void) {
    const {addLocalOrganization} = useWorkshop()
    const [mode, setMode] = useState<OrganizationSetupMode>(null)
    const [error, setError] = useState("")
    const [createOrganization, {isLoading: isCreating}] = useCreateOrganizationMutation()
    const [acceptOrganizationInvite, {isLoading: isJoining}] = useAcceptOrganizationInviteMutation()

    const openCreate = useCallback(() => {
        setError("")
        setMode("create")
    }, [])

    const openJoin = useCallback(() => {
        setError("")
        setMode("join")
    }, [])

    const close = useCallback(() => {
        setMode(null)
    }, [])

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
            const organization = await createOrganization({name, description}).unwrap()
            addLocalOrganization(organization)
            setMode(null)
            onReady(organization.id)
        } catch {
            setError("The organization could not be created. Make sure the API is running and try again.")
        }
    }

    async function handleJoin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError("")
        const form = new FormData(event.currentTarget)
        const inviteLink = String(form.get("inviteCode") ?? "").trim()

        const inviteToken = extractInviteToken(inviteLink)
        if (!inviteToken) {
            setError("Enter a valid invite code or paste an invite link.")
            return
        }

        try {
            const joined = await acceptOrganizationInvite(inviteToken).unwrap()
            addLocalOrganization(joined)
            setMode(null)
            onReady(joined.id)
        } catch {
            setError("This invite code is invalid or has expired.")
        }
    }

    return {close, error, handleCreate, handleJoin, isCreating, isJoining, mode, openCreate, openJoin}
}
