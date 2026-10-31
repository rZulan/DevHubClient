import {useEffect, useRef, useState} from "react"
import {Check, Link2} from "lucide-react"

export function WikiCopyLink({href, title}: {href: string; title: string}) {
    const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => () => {if (resetTimer.current !== null) clearTimeout(resetTimer.current)}, [])
    const label = status === "copied" ? `Link to ${title} copied` : status === "error" ? "Could not copy link. Try again." : `Copy link to ${title}`
    async function copy() {
        try {
            await navigator.clipboard.writeText(new URL(href, window.location.origin).href)
            if (resetTimer.current !== null) clearTimeout(resetTimer.current)
            setStatus("copied")
            resetTimer.current = setTimeout(() => {setStatus("idle"); resetTimer.current = null}, 2000)
        } catch {setStatus("error")}
    }
    return <button type="button" className="wiki-copy-link" aria-label={label} title={label} onClick={() => void copy()} onBlur={() => setStatus("idle")}>
        {status === "copied" ? <Check aria-hidden="true"/> : <Link2 aria-hidden="true"/>}
        <span className="sr-only" role="status">{status === "copied" ? "Link copied" : status === "error" ? "Could not copy link. Try again." : ""}</span>
    </button>
}
