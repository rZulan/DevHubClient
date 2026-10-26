import {useState, type FormEvent} from "react"
import {Check, Copy, ExternalLink, Link2, LoaderCircle, RefreshCw, Tags} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {bugError, type BugCategory} from "./bug-reports"
import {useGetBugPortalQuery, useSaveBugCategoryMutation, useSaveBugPortalMutation, type BugScope} from "./bug-reports-api"

export function BugPortalSettings({scope}: {scope: BugScope}) {
    const portal = useGetBugPortalQuery(scope), [save, mutation] = useSaveBugPortalMutation()
    const [error, setError] = useState(""), [copied, setCopied] = useState(false), [rotating, setRotating] = useState(false)
    const url = portal.data?.token ? `${window.location.origin}/report-bug/${portal.data.token}` : ""
    async function update(enabled: boolean, rotate = false) {
        if (!portal.data) return
        setError(""); setCopied(false)
        try {await save({...scope, enabled, rotate, revision: portal.data.revision}).unwrap(); setRotating(false)}
        catch (failure) {setError(bugError(failure)); void portal.refetch()}
    }
    async function copy() {
        try {await navigator.clipboard.writeText(url); setCopied(true)} catch {setError("Copy the link from the field below.")}
    }
    return <section className="bug-portal" aria-label="Public reporting link">
        <div className="bug-portal-heading"><span className="bug-portal-icon"><Link2/></span><div><h3>Public reporting link</h3><p>Let anyone report a bug with their email. No DevHub account needed.</p></div><button type="button" role="switch" aria-label="Enable public reporting link" aria-checked={portal.data?.enabled ?? false} className="bug-portal-switch" disabled={!portal.data || mutation.isLoading || portal.isFetching} onClick={() => void update(!portal.data?.enabled)}><span/></button></div>
        {portal.isLoading ? <p className="bug-field-help" role="status">Loading public link…</p> : portal.error ? <div className="bug-error" role="alert">Could not load link settings. <Button variant="outline" size="sm" onClick={() => void portal.refetch()}>Retry</Button></div> : <>
            <div className="bug-portal-state"><span className={portal.data?.enabled ? "enabled" : ""}/>{portal.data?.enabled ? "Accepting public reports" : "Public submissions are disabled"}{mutation.isLoading && <LoaderCircle className="animate-spin"/>}</div>
            {url && <div className="bug-portal-link"><Input aria-label="Public bug report URL" value={url} readOnly onFocus={event => event.currentTarget.select()}/><Button variant="outline" disabled={!portal.data?.enabled || mutation.isLoading} onClick={() => void copy()}>{copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy"}</Button>{portal.data?.enabled && <a href={url} target="_blank" rel="noreferrer" aria-label="Open public report form" title="Open public report form"><ExternalLink/></a>}</div>}
            {url && <button className="bug-replace-link" type="button" disabled={mutation.isLoading} onClick={() => setRotating(true)}><RefreshCw/>Replace link</button>}
        </>}
        {error && <p className="bug-error" role="alert">{error}</p>}
        <Dialog open={rotating} onOpenChange={setRotating}><DialogContent><DialogHeader><DialogTitle>Replace the public link?</DialogTitle><DialogDescription>The current URL will stop accepting reports. Share the new URL with your testers. Existing reports and attachments will stay in the inbox.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRotating(false)}>Cancel</Button><Button disabled={mutation.isLoading} onClick={() => void update(portal.data?.enabled ?? false, true)}>Replace link</Button></DialogFooter></DialogContent></Dialog>
    </section>
}

export function BugCategoryManager({scope, categories, open, onOpenChange}: {scope: BugScope; categories: BugCategory[]; open: boolean; onOpenChange: (open: boolean) => void}) {
    const [save, mutation] = useSaveBugCategoryMutation(), [name, setName] = useState(""), [error, setError] = useState("")
    async function add(event: FormEvent) {
        event.preventDefault(); setError("")
        try {await save({...scope, name: name.trim(), archived: false}).unwrap(); setName("")}
        catch (failure) {setError(bugError(failure))}
    }
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="bug-categories-dialog sm:max-w-lg"><DialogHeader><DialogTitle><Tags className="inline-block size-4 mr-2"/>Bug categories</DialogTitle><DialogDescription>Organize reports with project-specific categories. Archiving hides a category from new submissions and keeps existing reports intact.</DialogDescription></DialogHeader>
        <form className="bug-category-add" onSubmit={add}><Input aria-label="New category name" placeholder="e.g. Interface, Performance, Payments" maxLength={50} value={name} onChange={event => setName(event.target.value)}/><Button type="submit" disabled={mutation.isLoading || !name.trim() || categories.length >= 100}>Add category</Button></form>
        {error && <p className="bug-error" role="alert">{error}</p>}
        <div className="bug-category-list">{categories.length ? categories.map(category => <CategoryRow key={`${category.id}:${category.name}:${category.archived}`} scope={scope} category={category}/>) : <p className="bug-field-help">No categories yet. Reports can still be submitted as Uncategorized.</p>}</div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
    </DialogContent></Dialog>
}
function CategoryRow({scope, category}: {scope: BugScope; category: BugCategory}) {
    const [name, setName] = useState(category.name), [error, setError] = useState(""), [save, mutation] = useSaveBugCategoryMutation()
    async function update(archived: boolean) {
        setError("")
        try {await save({...scope, id: category.id, name: name.trim(), archived}).unwrap()}
        catch (failure) {setError(bugError(failure))}
    }
    return <div className={`bug-category-row${category.archived ? " archived" : ""}`}><div><Input aria-label={`Category name: ${category.name}`} maxLength={50} value={name} disabled={mutation.isLoading} onChange={event => setName(event.target.value)}/>{category.archived && <small>Archived</small>}<Button variant="outline" size="sm" disabled={mutation.isLoading || !name.trim() || name.trim() === category.name} onClick={() => void update(category.archived)}>Rename</Button><Button variant="ghost" size="sm" disabled={mutation.isLoading || !name.trim()} onClick={() => void update(!category.archived)}>{category.archived ? "Restore" : "Archive"}</Button></div>{error && <p role="alert" className="bug-error">{error}</p>}</div>
}
