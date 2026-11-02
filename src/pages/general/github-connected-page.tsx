import {useEffect} from "react"
import {useSearchParams} from "react-router-dom"
import {Button} from "@/components/ui/button"

export function GitHubConnectedPage() {
    const [params] = useSearchParams()
    const success = params.get("status") === "connected"
    useEffect(() => {
        if (window.opener) {
            window.opener.postMessage({type: "devhub-github-connected", status: success ? "connected" : "failed"}, window.location.origin)
            window.close()
        }
    }, [success])
    return <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">{success ? "GitHub connected" : "GitHub connection was not completed"}</h1>
        <p className="text-sm text-muted-foreground">{success ? "Return to your project to choose repositories." : "Return to your project and reconnect GitHub. Make sure you are signed into Zevont."}</p>
        <Button type="button" onClick={() => window.close()}>Close this window</Button>
    </main>
}
