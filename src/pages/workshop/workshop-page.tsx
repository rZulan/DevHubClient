import {useEffect, useState} from "react"
import {ArrowLeft, ArrowRight, Building2, Check, LayoutGrid, Link2, ListTodo, LoaderCircle, MousePointer2, Network, Plus, Users} from "lucide-react"
import {Link, useNavigate, useSearchParams} from "react-router-dom"

import {ThemeToggle} from "@/components/theme-toggle"
import {BrandMark} from "@/components/brand-mark"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {OrganizationSetupDialog} from "@/features/workshop/organization-setup-dialog"
import {useCreateOrJoinOrganization} from "@/features/workshop/use-create-or-join-organization"
import {useWorkshop} from "@/features/workshop/workshop-context"
import {
    clearWorkshopResumePath,
    getSelectedOrganizationId,
    setSelectedOrganizationId,
} from "@/features/workshop/workshop-storage"
import type {WorkshopOrganization} from "@/features/workshop/workshop-types"

export function WorkshopPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const {isLoading, organizations} = useWorkshop()
    const inviteFromUrl = searchParams.get("invite") ?? ""
    const showOrganizationSelector = searchParams.get("choose") === "1"
    const setup = useCreateOrJoinOrganization(openOrganization)
    const openJoin = setup.openJoin
    const [search, setSearch] = useState("")
    const [lastOpenedId] = useState(() => {
        try {return getSelectedOrganizationId()} catch {return null}
    })

    useEffect(() => {
        if (inviteFromUrl) openJoin()
    }, [inviteFromUrl, openJoin])

    useEffect(() => {
        if (isLoading || inviteFromUrl || showOrganizationSelector) return

        const selectedId = getSelectedOrganizationId()
        const target = organizations.find((organization) => organization.id === selectedId)?.id
            ?? organizations[0]?.id

        if (target) navigate(`/workshop/${target}/dashboard`, {replace: true})
    }, [inviteFromUrl, isLoading, navigate, organizations, showOrganizationSelector])

    function openOrganization(organizationId: string) {
        setSelectedOrganizationId(organizationId)
        navigate(`/workshop/${organizationId}/dashboard`)
    }

    const isRedirecting = !isLoading && !inviteFromUrl && !showOrganizationSelector && organizations.length > 0
    const visibleOrganizations = organizations.filter(organization => organization.name.toLowerCase().includes(search.trim().toLowerCase()))

    return (
        <main className="workshop-welcome workshop-entry">
            <header className="workshop-entry-header">
                <Link className="workshop-entry-brand" onClick={clearWorkshopResumePath} to="/">
                    <BrandMark/>
                    <span>DevHub <b>Workshop</b></span>
                </Link>
                <div className="workshop-entry-header-actions">
                    <Link onClick={clearWorkshopResumePath} to="/"><ArrowLeft/>Back to DevHub</Link>
                    <ThemeToggle/>
                </div>
            </header>

            <div className="workshop-entry-main">
                <section className="workshop-entry-intro">
                    <h1>Back to the<br/><em>workbench.</em></h1>
                    <p>Bring your people, projects, and ideas together.<br className="workshop-entry-desktop-break"/> Pick a space and make a little progress.</p>
                    <div className="workshop-entry-sketch" aria-hidden="true">
                        <div className="workshop-entry-paper"><span className="workshop-entry-tape"/><span>✦ a note to ourselves</span><strong>Big ideas.<br/>Small steps.</strong><span>Let’s build something good.</span></div>
                        <svg className="workshop-entry-connector" viewBox="0 0 440 280" fill="none"><path d="M186 159 H239 Q251 159 251 147 V93 Q251 81 263 81 H291"/><circle cx="186" cy="159" r="4"/><path d="m283 74 8 7-8 7"/></svg>
                        <div className="workshop-entry-plan"><header><ListTodo/>THE PLAN<span>03</span></header><span><i><Check/></i>Collect the ideas</span><span><i><Check/></i>Connect the dots</span><span><i/>Build it together</span><div><span/><span/><span/></div></div>
                        <span className="workshop-entry-cursor"><MousePointer2/>You’re in good company</span>
                    </div>
                </section>

                <section className="workshop-entry-panel" aria-labelledby="workshop-entry-title" aria-busy={isLoading || isRedirecting}>
                    <div className="workshop-entry-panel-label"><LayoutGrid/><span>YOUR WORKSHOP</span>{!isLoading && <span className="workshop-entry-panel-count">{organizations.length} {organizations.length === 1 ? "organization" : "organizations"}</span>}</div>
                    <header className="workshop-entry-panel-heading"><h2 id="workshop-entry-title">{organizations.length ? "Choose an organization" : "Find your people"}</h2></header>
                    {isLoading || isRedirecting ? <div className="workshop-entry-loading" role="status"><LoaderCircle className="animate-spin"/>Loading your workshops…</div> : <>
                        {organizations.length > 4 && <Input className="workshop-entry-search" aria-label="Search organizations" placeholder="Find an organization…" value={search} onChange={event => setSearch(event.target.value)}/>}
                        {organizations.length > 0 ? <div className="workshop-entry-organizations" aria-label="Your organizations">
                            {visibleOrganizations.map((organization, index) => <button className="workshop-entry-organization" data-recent={organization.id === lastOpenedId} key={organization.id} type="button" onClick={() => openOrganization(organization.id)}>
                                <span className="workshop-entry-avatar" data-tone={index % 4}>{organization.initials}</span>
                                <span className="workshop-entry-org-copy"><span><strong>{organization.name}</strong>{organization.id === lastOpenedId && <small>Last opened</small>}</span>
                                    <span className="workshop-entry-org-meta"><span><Users/>{memberCount(organization)} {memberCount(organization) === 1 ? "member" : "members"}</span><span><Network/>{teamCount(organization)} {teamCount(organization) === 1 ? "team" : "teams"}</span></span>
                                </span><span className="workshop-entry-open"><ArrowRight/></span>
                            </button>)}
                            {!visibleOrganizations.length && <p className="workshop-entry-no-results" role="status">No organizations match “{search}”.</p>}
                        </div> : <div className="workshop-entry-empty"><Building2/><strong>A fresh start, together.</strong><p>Create an organization for your team, or join one with an invite.</p></div>}
                        <div className="workshop-entry-new"><span>{organizations.length ? "Or make a new connection" : "Make yourself at home"}</span><div>
                            <Button onClick={setup.openCreate} type="button" variant="ghost"><span className="workshop-entry-action-icon"><Plus/></span><span><strong>Create an organization</strong></span><ArrowRight/></Button>
                            <Button onClick={setup.openJoin} type="button" variant="ghost"><span className="workshop-entry-action-icon"><Link2/></span><span><strong>Join with an invite</strong></span><ArrowRight/></Button>
                        </div></div>
                    </>}
                </section>
            </div>
            <footer className="workshop-entry-footer"><span>From the first idea to the finishing touches.</span><span>NOTES <i/> DIAGRAMS <i/> TASKS</span></footer>

            <OrganizationSetupDialog
                busy={setup.isCreating || setup.isJoining}
                error={setup.error}
                inviteFromUrl={inviteFromUrl}
                mode={setup.mode}
                onClose={setup.close}
                onSubmitCreate={setup.handleCreate}
                onSubmitJoin={setup.handleJoin}
            />
        </main>
    )
}

function memberCount(organization: WorkshopOrganization) {
    return organization.memberCount ?? organization.members.length
}

function teamCount(organization: WorkshopOrganization) {
    return organization.teamCount ?? organization.teams.length
}
