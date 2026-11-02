import {useId} from "react"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"

export function DeleteConfirmationField({name, value, onChange, disabled = false}: {
    name: string
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}) {
    const id = useId()
    return <div className="grid gap-2">
        <Label htmlFor={id} className="block text-sm leading-relaxed">
            <span>Type <strong className="font-semibold text-foreground wrap-anywhere">{name}</strong> to confirm.</span>
        </Label>
        <Input id={id} className="h-11" autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off"
            spellCheck={false} disabled={disabled} value={value} onChange={event => onChange(event.target.value)}/>
    </div>
}
