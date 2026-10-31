import {useState, type FormEvent} from "react"
import {ArrowRight, Building2, Link2, LoaderCircle, Plus} from "lucide-react"

import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import type {OrganizationSetupMode} from "@/features/workshop/use-create-or-join-organization"
import {extractInviteToken} from "./organization-invite-code"

export function OrganizationSetupDialog({
                                            busy,
                                            error,
                                            inviteFromUrl,
                                            mode,
                                            onClose,
                                            onSubmitCreate,
                                            onSubmitJoin,
                                        }: {
    busy: boolean
    error: string
    inviteFromUrl?: string
    mode: OrganizationSetupMode
    onClose: () => void
    onSubmitCreate: (event: FormEvent<HTMLFormElement>) => void
    onSubmitJoin: (event: FormEvent<HTMLFormElement>) => void
}) {
    return (
        <Dialog open={mode !== null} onOpenChange={(open) => {
            if (!open) onClose()
        }}>
            {mode && (
                <DialogContent className="workshop-modal sm:max-w-md">
                    <span className="workshop-modal-icon">{mode === "create" ? <Building2/> : <Link2/>}</span>
                    <DialogHeader>
                        <DialogTitle
                            id="workshop-modal-title">{mode === "create" ? "Create an organization" : "Join a workshop"}</DialogTitle>
                        <DialogDescription>{mode === "create" ? "Give your team a place to plan, make, and ship." : "Enter an invite code or paste an invite link to join."}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={mode === "create" ? onSubmitCreate : onSubmitJoin}>
                        {mode === "create" ? (
                            <>
                                <Label>Organization name<Input autoFocus maxLength={150} name="name"
                                                               placeholder="Acme Studio"/></Label>
                                <Label>Description <span>Optional</span><Textarea maxLength={1000} name="description"
                                                                                  placeholder="What are you building together?"
                                                                                  rows={3}/></Label>
                            </>
                        ) : (
                            <InviteCodeInput initialValue={inviteFromUrl}/>
                        )}
                        {error && <p className="workshop-form-error">{error}</p>}
                        <Button className="workshop-primary-action" disabled={busy} type="submit">
                            {busy ? <LoaderCircle className="animate-spin"/> : mode === "create" ? <Plus/> :
                                <ArrowRight/>}
                            {mode === "create" ? "Create workshop" : "Join organization"}
                        </Button>
                    </form>
                </DialogContent>
            )}
        </Dialog>
    )
}

function InviteCodeInput({initialValue = ""}: {initialValue?: string}) {
    const [value, setValue] = useState(() => extractInviteToken(initialValue) ?? "")
    return <Label className="flex-col items-stretch">Invite code<Input autoFocus name="inviteCode" placeholder="ABCD2345EFGH" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={value} onChange={event => setValue(extractInviteToken(event.target.value) ?? event.target.value)} onPaste={event => {const code = extractInviteToken(event.clipboardData.getData("text")); if (code) {event.preventDefault(); setValue(code)}}}/></Label>
}
