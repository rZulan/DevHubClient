import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {getApiErrorMessage} from "@/features/auth/api-error"
import type {WorkshopMember} from "./workshop-types"

export function OwnerPromotionDialog({member, organizationName, onClose, onConfirm}: {member: WorkshopMember | null; organizationName: string; onClose: () => void; onConfirm: () => Promise<void>}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState("")
    async function confirm() {
        if (busy || !member) return
        setBusy(true); setError("")
        try {await onConfirm(); onClose()}
        catch (failure) {setError(getApiErrorMessage(failure))}
        finally {setBusy(false)}
    }
    return <Dialog open={!!member} onOpenChange={open => {if (!open && !busy) {setError(""); onClose()}}}><DialogContent><DialogHeader><DialogTitle>Promote {member?.name} to owner?</DialogTitle><DialogDescription>They will have full control over {organizationName}, including managing access and deleting the organization. Ownership cannot be removed from settings; an owner can leave once another owner remains.</DialogDescription></DialogHeader>{error && <p role="alert" className="workshop-form-error">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => {setError(""); onClose()}}>Cancel</Button><Button disabled={busy} onClick={() => void confirm()}>{busy ? "Promoting…" : "Promote to owner"}</Button></DialogFooter></DialogContent></Dialog>
}
