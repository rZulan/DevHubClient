import {useEffect, useRef, useState} from "react"
import {Camera, Check, LoaderCircle, Trash2} from "lucide-react"
import {Button} from "@/components/ui/button"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {prepareAvatarImage} from "./avatar-image"
import {WorkspaceAvatar} from "./workspace-avatar"

export function WorkspaceAvatarEditor({name, avatarUrl, label, disabled = false, onSave, kind}: {
    name: string; avatarUrl?: string | null; label: string; disabled?: boolean; onSave: (avatarUrl: string | null) => Promise<unknown>; kind?: "organization" | "team"
}) {
    const [draft, setDraft] = useState<string | null | undefined>(undefined)
    const [reading, setReading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("")
    const input = useRef<HTMLInputElement>(null), generation = useRef(0)
    const current = draft === undefined ? avatarUrl : draft
    const dirty = draft !== undefined && draft !== (avatarUrl ?? null)
    const busy = disabled || reading || saving
    useEffect(() => () => {generation.current++}, [])
    async function choose(file?: File) {
        if (!file || busy) return
        const ticket = ++generation.current
        setReading(true); setError("")
        try {const image = await prepareAvatarImage(file); if (ticket === generation.current) setDraft(image)}
        catch (failure) {if (ticket === generation.current) setError(failure instanceof Error ? failure.message : "Could not read this image.")}
        finally {if (ticket === generation.current) setReading(false)}
    }
    async function save() {
        if (!dirty || busy) return
        setSaving(true); setError("")
        try {await onSave(draft ?? null); setDraft(undefined)}
        catch (failure) {setError(getApiErrorMessage(failure))}
        finally {setSaving(false)}
    }
    return <section className="workspace-avatar-editor" aria-label={label}>
        <div className="workspace-avatar-editor-main"><WorkspaceAvatar className="workspace-avatar-preview" name={name} avatarUrl={current} kind={kind}/>
            <div><strong>{label}</strong><p>PNG, JPEG or WebP · up to 10 MB. Images are cropped to a square.</p>
                <div className="workspace-avatar-actions"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>{reading ? <LoaderCircle className="animate-spin"/> : <Camera/>}Upload image</Button>
                    {current && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => {setDraft(null); setError("")}}><Trash2/>Remove</Button>}
                </div>
            </div>
        </div>
        <input ref={input} className="workspace-avatar-input" type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Upload ${label.toLowerCase()}`} disabled={busy} onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void choose(file)}}/>
        {dirty && <div className="workspace-avatar-actions"><Button type="button" size="sm" disabled={busy} onClick={() => void save()}>{saving ? <LoaderCircle className="animate-spin"/> : <Check/>}Save icon</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => {generation.current++; setDraft(undefined); setError("")}}>Cancel icon change</Button></div>}
        {error && <p className="workshop-form-error" role="alert">{error}</p>}
    </section>
}
