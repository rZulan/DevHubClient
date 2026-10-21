import {useEffect, useId, useState} from "react"
import {Popover} from "radix-ui"
import {ChevronDown} from "lucide-react"
import {Button} from "@/components/ui/button"
import {useTheme} from "@/components/theme-provider"

let fullPicker: Promise<typeof import("emoji-picker-react")> | undefined
function loadFullPicker() {
    return fullPicker ??= import("emoji-picker-react").catch(error => {fullPicker = undefined; throw error})
}

function NoteEmojiPalette({onChange}: {onChange: (emoji: string) => void}) {
    const {theme} = useTheme()
    const [Picker, setPicker] = useState<typeof import("emoji-picker-react").default | null>(null)
    const [failed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let active = true
        void loadFullPicker().then(module => {if (active) setPicker(() => module.default)}, () => {if (active) setFailed(true)})
        return () => {active = false}
    }, [attempt])
    if (!Picker) return <div className="note-emoji-loading" role="status">
        {failed ? <><p>Could not load emojis.</p><Button type="button" size="sm" variant="outline" onClick={() => {setFailed(false); setAttempt(value => value + 1)}}>Retry</Button></> : "Loading emojis…"}
    </div>
    // Image mode keeps the complete catalog visible, including newer emoji and
    // flags that the operating system's native emoji font may not support.
    return <Picker width="100%" height="100%" colorScheme={theme === "system" ? "auto" : theme}
        emojiStyle="google" lazyLoadEmojis searchPlaceholder="Search all emojis…" searchLabel="Search emoji"
        previewConfig={{showPreview: false}} onEmojiClick={data => onChange(data.emoji)}/>
}

export function NoteEmojiPicker({value, disabled, onChange}: {value: string | null; disabled: boolean; onChange: (emoji: string | null) => void}) {
    const [open, setOpen] = useState(false)
    const headingId = useId()
    function choose(emoji: string | null) {onChange(emoji); setOpen(false)}
    // The picker is portalled outside the note dialog. Its own modal scroll
    // scope lets wheel/touch events reach the list through the dialog's lock.
    return <Popover.Root modal open={open && !disabled} onOpenChange={setOpen}>
        <Popover.Trigger asChild><Button type="button" variant="outline" className="note-emoji-trigger" disabled={disabled} aria-label="Choose note emoji" title="Choose note emoji">
            {value ? <span className="note-emoji" aria-hidden="true">{value}</span> : <span>None</span>}<ChevronDown/>
        </Button></Popover.Trigger>
        <Popover.Portal><Popover.Content className="note-emoji-picker" aria-labelledby={headingId} align="start" sideOffset={8} collisionPadding={16}>
            <strong id={headingId}>Note emoji</strong>
            <button type="button" className="note-emoji-none" aria-pressed={value === null} onClick={() => choose(null)}>None <small>No emoji</small></button>
            <div className="note-emoji-palette"><NoteEmojiPalette onChange={choose}/></div>
        </Popover.Content></Popover.Portal>
    </Popover.Root>
}
