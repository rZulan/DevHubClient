import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {getApiErrorMessage} from "@/features/auth/api-error"
import type {WorkshopMember} from "./workshop-types"

export function OwnershipTransferDialog({member, organizationName, onClose, onConfirm}: {member: WorkshopMember | null; organizationName: string; onClose: () => void; onConfirm: () => Promise<void>}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState("")
    async function confirm() {
        if (busy || !member) return
        setBusy(true); setError("")
        try {await onConfirm(); onClose()}
        catch (failure) {setError(getApiErrorMessage(failure))}
        finally {setBusy(false)}
    }
    return <Dialog open={!!member} onOpenChange={open => {if (!open && !busy) {setError(""); onClose()}}}><DialogContent><DialogHeader><DialogTitle>Transfer ownership to {member?.name}?</DialogTitle><DialogDescription>@{member?.username} will become the only owner of {organizationName}, with full control over access and deletion. You will remain a member with your other roles, but lose owner privileges. Only the new owner can transfer ownership back.</DialogDescription></DialogHeader>{error && <p role="alert" className="workshop-form-error">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => {setError(""); onClose()}}>Cancel</Button><Button disabled={busy} onClick={() => void confirm()}>{busy ? "Transferring…" : "Transfer ownership"}</Button></DialogFooter></DialogContent></Dialog>
}
