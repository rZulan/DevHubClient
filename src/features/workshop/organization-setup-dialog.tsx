import {useId, useState, type FormEvent} from "react"
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
    const fieldId = useId()

    return (
        <Dialog open={mode !== null} onOpenChange={(open) => {
            if (!open) onClose()
        }}>
            {mode && (
                <DialogContent className="workshop-modal gap-6 p-6 sm:max-w-md">
                    <div className="flex items-start gap-3 pr-4">
                        <span className="workshop-modal-icon shrink-0" aria-hidden="true">{mode === "create" ? <Building2/> : <Link2/>}</span>
                        <DialogHeader className="gap-1">
                            <DialogTitle className="mt-0 text-lg leading-6 font-semibold"
                                id="workshop-modal-title">{mode === "create" ? "Create an organization" : "Join an organization"}</DialogTitle>
                            <DialogDescription className="leading-relaxed">{mode === "create" ? "Give your team a place to plan, make, and ship." : "Enter an invite code or paste an invite link to join."}</DialogDescription>
                        </DialogHeader>
                    </div>

                    <form className="mt-0 gap-5" onSubmit={mode === "create" ? onSubmitCreate : onSubmitJoin}>
                        {mode === "create" ? (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor={`${fieldId}-name`}>Organization name</Label>
                                    <Input className="h-11" autoFocus id={`${fieldId}-name`} maxLength={150} name="name"
                                           placeholder="Acme Studio"/>
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <Label htmlFor={`${fieldId}-description`}>Description</Label>
                                        <span className="text-xs text-muted-foreground" id={`${fieldId}-description-hint`}>Optional</span>
                                    </div>
                                    <Textarea className="min-h-24" id={`${fieldId}-description`} aria-describedby={`${fieldId}-description-hint`}
                                              maxLength={1000} name="description" placeholder="What are you building together?" rows={3}/>
                                </div>
                            </>
                        ) : (
                            <InviteCodeInput initialValue={inviteFromUrl}/>
                        )}
                        {error && <p className="workshop-form-error" role="alert">{error}</p>}
                        <Button className="workshop-primary-action h-11 w-full" disabled={busy} type="submit">
                            {busy ? <LoaderCircle className="animate-spin"/> : mode === "create" ? <Plus/> :
                                <ArrowRight/>}
                            {mode === "create" ? "Create organization" : "Join organization"}
                        </Button>
                    </form>
                </DialogContent>
            )}
        </Dialog>
    )
}

function InviteCodeInput({initialValue = ""}: {initialValue?: string}) {
    const fieldId = useId()
    const [value, setValue] = useState(() => extractInviteToken(initialValue) ?? "")
    return <div className="grid gap-2"><Label htmlFor={fieldId}>Invite code</Label><Input className="h-11" id={fieldId} autoFocus name="inviteCode" placeholder="ABCD2345EFGH" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={value} onChange={event => setValue(extractInviteToken(event.target.value) ?? event.target.value)} onPaste={event => {const code = extractInviteToken(event.clipboardData.getData("text")); if (code) {event.preventDefault(); setValue(code)}}}/></div>
}
