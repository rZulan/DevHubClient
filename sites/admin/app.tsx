import {useEffect, useState, type FormEvent, type ReactNode} from "react"
import {Building2, Bug, Fingerprint, Users} from "lucide-react"
import "./admin.css"

type RecentUser = {id: string; username: string; createdAtUtc: string}
type RecentOrganization = {id: string; name: string; createdAtUtc: string}
type RecentReport = {reference: string; title: string; status: string; priority: string; createdAtUtc: string}
type Overview = {
    userCount: number; organizationCount: number; bugReportCount: number
    recentUsers: RecentUser[]; recentOrganizations: RecentOrganization[]; recentBugReports: RecentReport[]
}
type Screen = "loading" | "login" | "denied" | "ready" | "unavailable"

const dates = new Intl.DateTimeFormat(undefined, {dateStyle: "medium"})
const date = (value: string) => dates.format(new Date(value))
const request = (path: string, options?: RequestInit) =>
    fetch("/api/" + path, {...options, credentials: "same-origin", cache: "no-store"})
const session = (action: "login" | "refresh" | "logout", credentials?: object) =>
    request("auth/" + action, {
        method: "POST",
        ...(credentials ? {headers: {"Content-Type": "application/json"}, body: JSON.stringify(credentials)} : {}),
    })

function RecentTable({title, headings, rows}: {title: string; headings: string[]; rows: {key: string; cells: ReactNode[]}[]}) {
    return <section className="panel">
        <h2>{title}</h2>
        {rows.length ? <div className="table-scroll"><table aria-label={title}>
            <thead><tr>{headings.map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={headings[index]}>{cell}</td>)}</tr>)}</tbody>
        </table></div> : <p className="empty">Nothing to show yet.</p>}
    </section>
}

async function loadOverview(renew: boolean) {
    let response = await request("admin/overview")
    if (response.status === 401 && renew) {
        const refreshed = await session("refresh")
        if (refreshed.ok) response = await request("admin/overview")
        else if (refreshed.status !== 401) throw new Error("Could not restore the session.")
    }
    if (response.status === 401) return {screen: "login"} as const
    if (response.status === 403) return {screen: "denied"} as const
    if (!response.ok) throw new Error("The admin API could not load the overview.")
    return {screen: "ready", overview: await response.json() as Overview} as const
}

export function App() {
    const [screen, setScreen] = useState<Screen>("loading")
    const [overview, setOverview] = useState<Overview>()
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    function show(result: Awaited<ReturnType<typeof loadOverview>>) {
        setOverview(result.screen === "ready" ? result.overview : undefined)
        setScreen(result.screen)
    }

    useEffect(() => {
        let current = true
        void loadOverview(true).then(result => {
            if (current) show(result)
        }).catch(() => {if (current) setScreen("unavailable")})
        return () => {current = false}
    }, [])

    async function login(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        setError(""); setBusy(true)
        try {
            const response = await session("login", {email: data.get("email"), password: data.get("password")})
            if (!response.ok) {
                setError(response.status === 401 ? "The email address or password is incorrect."
                    : response.status === 429 ? "Too many sign-in attempts. Try again shortly."
                    : "Sign-in is currently unavailable.")
                return
            }
            form.reset()
            show(await loadOverview(false))
        } catch {
            setError("Could not connect to the admin API.")
        } finally {
            setBusy(false)
        }
    }

    async function logout() {
        setBusy(true); setError("")
        try {
            let response = await session("logout")
            if (response.status === 401 && (await session("refresh")).ok) response = await session("logout")
            if (!response.ok && response.status !== 401) throw new Error()
            setOverview(undefined); setScreen("login")
        } catch {
            setError("Could not sign out. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    return <>
        <header className="masthead">
            <a href="/" className="brand"><Fingerprint aria-hidden="true"/> Zevont <span>Admin</span></a>
            {(screen === "ready" || screen === "denied") && <button type="button" disabled={busy} onClick={() => void logout()}>Sign out</button>}
        </header>
        <main className={screen === "ready" ? "dashboard" : "gate"}>
            {error && <p className="error" role="alert">{error}</p>}
            {screen === "loading" && <section className="panel" role="status">Checking your session…</section>}
            {screen === "login" && <section className="panel sign-in">
                <p className="eyebrow">Platform administration</p>
                <h1>Sign in</h1>
                <p>Use your approved Zevont account.</p>
                <form onSubmit={login}>
                    <label>Email<input name="email" type="email" autoComplete="username" maxLength={320} required/></label>
                    <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required/></label>
                    <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
                </form>
            </section>}
            {screen === "denied" && <section className="panel sign-in"><p className="eyebrow">Platform administration</p><h1>Access restricted</h1><p>This account hasn’t been granted platform admin access.</p></section>}
            {screen === "unavailable" && <section className="panel sign-in"><h1>Admin panel unavailable</h1><p>Check that the API is running and try again.</p><button type="button" onClick={() => location.reload()}>Retry</button></section>}
            {screen === "ready" && overview && <>
                <div className="intro"><p className="eyebrow">Platform administration</p><h1>Overview</h1><p>Read-only activity across Zevont.</p></div>
                <div className="metrics">
                    <section className="panel"><Users aria-hidden="true"/><span>Users</span><strong>{overview.userCount.toLocaleString()}</strong></section>
                    <section className="panel"><Building2 aria-hidden="true"/><span>Organizations</span><strong>{overview.organizationCount.toLocaleString()}</strong></section>
                    <section className="panel"><Bug aria-hidden="true"/><span>Bug reports</span><strong>{overview.bugReportCount.toLocaleString()}</strong></section>
                </div>
                <div className="recent">
                    <RecentTable title="Recent users" headings={["Username", "Joined"]} rows={overview.recentUsers.map(user => ({key: user.id, cells: [user.username, date(user.createdAtUtc)]}))}/>
                    <RecentTable title="Recent organizations" headings={["Organization", "Created"]} rows={overview.recentOrganizations.map(org => ({key: org.id, cells: [org.name, date(org.createdAtUtc)]}))}/>
                </div>
                <RecentTable title="Recent bug reports" headings={["Reference", "Title", "Status", "Priority", "Submitted"]}
                    rows={overview.recentBugReports.map(report => ({key: report.reference, cells: [report.reference, report.title, report.status, report.priority, date(report.createdAtUtc)]}))}/>
            </>}
        </main>
    </>
}
