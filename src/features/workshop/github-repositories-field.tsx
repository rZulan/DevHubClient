import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {useEffect, useRef, useState} from "react"
import {ExternalLink, LoaderCircle, Plus, RefreshCw, X} from "lucide-react"
import {GitHubIcon as Github} from "@/features/auth/oauth-provider-icons"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {useAuthorizeGitHubMutation, useDisconnectGitHubMutation, useGithubInstallationsQuery, useGithubRepositoriesQuery, useGithubStatusQuery, type GitHubRepository} from "./github-api"
import "./github-repositories.css"

export function GitHubRepositoriesField({initial = [], disabled = false}: {initial?: GitHubRepository[]; disabled?: boolean}) {
    const [selected, setSelected] = useState(initial)
    const [open, setOpen] = useState(false)
    return <div className="github-repositories-field">
        <input type="hidden" name="githubRepositories" value={JSON.stringify(selected.map(({installationId, repositoryId, label}) => ({installationId, repositoryId, label})))}/>
        <div className="github-repositories-heading"><span><Github aria-hidden="true"/>GitHub repositories</span><Button type="button" variant="outline" size="sm" disabled={disabled || selected.length >= 10} onClick={() => setOpen(true)}><Plus/>Add repositories</Button></div>
        {selected.map(repo => <div className="github-linked-repository" key={repo.repositoryId}>
            <Input aria-label={`Label for ${repo.fullName}`} value={repo.label} maxLength={80} disabled={disabled} placeholder="Frontend, Backend, API…" onChange={event => setSelected(items => items.map(item => item.repositoryId === repo.repositoryId ? {...item, label: event.target.value} : item))}/>
            <a href={repo.url} target="_blank" rel="noreferrer">{repo.fullName}<ExternalLink aria-hidden="true"/></a>
            <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Remove ${repo.fullName}`} onClick={() => setSelected(items => items.filter(item => item.repositoryId !== repo.repositoryId))}><X/></Button>
        </div>)}
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="github-repository-picker sm:max-w-2xl">
                <DialogHeader><DialogTitle>Connect GitHub repositories</DialogTitle><DialogDescription>Choose up to 10 repositories. Connected repository names and links will be visible to people who can access this Zevont project.</DialogDescription></DialogHeader>
                {open && <GitHubPicker selected={selected} disabled={disabled} onAdd={repo => setSelected(items => items.some(item => item.repositoryId === repo.repositoryId) || items.length >= 10 ? items : [...items, {...repo, label: repo.fullName.split("/").at(-1) ?? "Repository"}])}/>}
                <Button type="button" onClick={() => setOpen(false)}>Done · {selected.length} selected</Button>
            </DialogContent>
        </Dialog>
    </div>
}

function GitHubPicker({selected, onAdd, disabled}: {selected: GitHubRepository[]; onAdd: (repo: GitHubRepository) => void; disabled: boolean}) {
    const userId = useAppSelector(state => state.auth.user?.id ?? "current")
    const status = useGithubStatusQuery(userId, {refetchOnMountOrArgChange: true})
    const installations = useGithubInstallationsQuery(userId, {skip: !status.data?.connected, refetchOnMountOrArgChange: true})
    const [chosen, setChosen] = useState<number>()
    const installationId = installations.currentData?.some(item => item.id === chosen) ? chosen! : installations.currentData?.[0]?.id ?? 0
    const [page, setPage] = useState(1)
    const repos = useGithubRepositoriesQuery({userId, installationId, page}, {skip: !installationId || !status.data?.connected, refetchOnMountOrArgChange: true})
    const [term, setTerm] = useState("")
    const [error, setError] = useState("")
    const [waiting, setWaiting] = useState(false)
    const popup = useRef<Window | null>(null)
    const [authorize, authorizing] = useAuthorizeGitHubMutation()
    const [disconnect, disconnecting] = useDisconnectGitHubMutation()
    const refresh = useRef(() => {})
    refresh.current = () => {
        void status.refetch()
        if (status.data?.connected) void installations.refetch()
        if (installationId && status.data?.connected) void repos.refetch()
    }
    useEffect(() => {
        const finished = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== "devhub-github-connected") return
            setWaiting(false)
            if (event.data.status !== "connected") setError("GitHub connection was not completed. Retry and make sure you are still signed into Zevont.")
            refresh.current()
        }
        window.addEventListener("message", finished)
        const timer = window.setInterval(() => {
            if (popup.current?.closed) {popup.current = null; setWaiting(false); refresh.current()}
        }, 600)
        return () => {window.removeEventListener("message", finished); window.clearInterval(timer)}
    }, [])

    async function connect(install = false) {
        setError("")
        popup.current = window.open("about:blank", "devhub-github-integration", "popup,width=800,height=760")
        if (!popup.current) {setError("Allow pop-ups for Zevont, then try again."); return}
        setWaiting(true)
        try {const result = await authorize(install).unwrap(); popup.current.location.href = result.url}
        catch (failure) {popup.current?.close(); popup.current = null; setWaiting(false); setError(getApiErrorMessage(failure))}
    }
    function manageAccess() {
        const settingsUrl = installations.currentData?.find(item => item.id === installationId)?.settingsUrl
        if (!settingsUrl) {void connect(true); return}
        setError("")
        popup.current = window.open(settingsUrl, "devhub-github-integration", "popup,width=800,height=760")
        if (!popup.current) {setError("Allow pop-ups for Zevont, then try again."); return}
        setWaiting(true)
    }
    const failure = error || (status.error ? getApiErrorMessage(status.error) : status.data?.connected && installations.error ? getApiErrorMessage(installations.error) : status.data?.connected && repos.error ? getApiErrorMessage(repos.error) : "")
    const busy = disabled || waiting || authorizing.isLoading || disconnecting.isLoading
    return <div className="github-picker-body">
        {status.isLoading ? <p role="status"><LoaderCircle className="animate-spin"/>Checking GitHub connection…</p>
            : status.data?.configured === false ? <p>GitHub repository connections are not configured on this server.</p>
            : <>
                <div className="github-picker-actions">
                    <span>{status.data?.connected ? `Connected as ${status.data.login}` : "Authorize GitHub to browse your repositories."}</span>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void connect(false)}>{waiting ? "Waiting for GitHub…" : status.data?.connected ? "Reconnect" : "Connect GitHub"}</Button>
                    {status.data?.connected && <Button type="button" variant="ghost" disabled={busy} onClick={async () => {try {await disconnect().unwrap(); refresh.current()} catch (e) {setError(getApiErrorMessage(e))}}}>Disconnect account</Button>}
                </div>
                {status.data?.connected && <>
                    <div className="github-picker-actions"><Button type="button" variant="outline" disabled={busy} onClick={manageAccess}><ExternalLink/>Manage repository access</Button><Button type="button" variant="ghost" disabled={disabled || authorizing.isLoading} onClick={() => {setError(""); refresh.current()}}><RefreshCw/>Refresh</Button></div>
                    {waiting && <p role="status">Finish on GitHub, then close that window to refresh repository access.</p>}
                    {installations.isFetching && <p role="status">Loading GitHub accounts…</p>}
                    {!installations.isFetching && !installations.error && installations.currentData?.length === 0 && <p>Install the GitHub app on your GitHub account or organization using “Manage repository access,” then choose the repositories it can access.</p>}
                    {!!installations.currentData?.length && <>
                        <label className="github-account-select">GitHub account<select aria-label="GitHub repository owner" value={installationId} disabled={busy} onChange={e => {setChosen(Number(e.target.value)); setPage(1); setTerm("")}}>{installations.currentData.map(item => <option key={item.id} value={item.id}>{item.account}</option>)}</select></label>
                        <Input aria-label="Filter repositories on this page" placeholder="Filter repositories on this page…" value={term} onChange={e => setTerm(e.target.value)}/>
                        <div className="github-picker-list" aria-busy={repos.isFetching}>
                            {repos.isFetching ? <p role="status">Loading repositories…</p> : repos.currentData?.repositories.filter(repo => repo.fullName.toLowerCase().includes(term.toLowerCase())).map(repo => {
                                const added = selected.some(item => item.repositoryId === repo.repositoryId)
                                return <button type="button" key={repo.repositoryId} disabled={busy || added || selected.length >= 10} onClick={() => onAdd(repo)}><Github aria-hidden="true"/><span><strong>{repo.fullName}</strong><small>{repo.private ? "Private" : "Public"} · {repo.defaultBranch || "Empty repository"}</small></span><span>{added ? "Added" : "Add"}</span></button>
                            })}
                            {!repos.isFetching && !repos.error && repos.currentData?.repositories.filter(repo => repo.fullName.toLowerCase().includes(term.toLowerCase())).length === 0 && <p>{term.trim() ? "No repositories on this page match your search." : page === 1 ? "No repositories are accessible to Zevont in this GitHub account. Use Manage repository access to approve repository permissions and select your repositories, then refresh." : "No repositories on this page. Go back to the previous page."}</p>}
                        </div>
                        <div className="github-picker-pagination"><Button type="button" variant="outline" disabled={page <= 1 || repos.isFetching} onClick={() => {setPage(value => value - 1); setTerm("")}}>Previous</Button><span>Page {page}</span><Button type="button" variant="outline" disabled={!repos.currentData?.hasMore || repos.isFetching} onClick={() => {setPage(value => value + 1); setTerm("")}}>Next</Button></div>
                    </>}
                </>}
            </>}
        {failure && <WorkshopToast variant="error">{failure}</WorkshopToast>}
    </div>
}
