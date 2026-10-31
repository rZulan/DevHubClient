// Only records form submissions in memory. No invitations or memberships are created.
import {useState, type FormEvent} from "react"
import {createRoot} from "react-dom/client"
import {Button} from "@/components/ui/button"
import {OrganizationSetupDialog} from "@/features/workshop/organization-setup-dialog"
import "@/index.css"

export function Preview() {
    const [open, setOpen] = useState(true), [submitted, setSubmitted] = useState("")
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSubmitted(String(new FormData(event.currentTarget).get("inviteCode") ?? "")); setOpen(false)
    }
    return <div className="dark min-h-screen bg-background p-8 text-foreground"><h1>Invite codes · isolated preview</h1><Button onClick={() => setOpen(true)}>Join organization</Button>{submitted && <p role="status">Submitted invite code: {submitted}</p>}<OrganizationSetupDialog busy={false} error="" inviteFromUrl={new URLSearchParams(location.search).get("invite") ?? ""} mode={open ? "join" : null} onClose={() => setOpen(false)} onSubmitCreate={submit} onSubmitJoin={submit}/></div>
}

document.documentElement.classList.add("dark")
const root = createRoot(document.getElementById("root")!)
root.render(<Preview/>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
