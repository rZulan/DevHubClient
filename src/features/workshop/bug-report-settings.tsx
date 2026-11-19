import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {useRef, useState, type FormEvent, type Ref} from "react"
import {Check, Copy, Ellipsis, Link2, LoaderCircle, RefreshCw, Tags} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {bugError, bugReportLinkPaths, type BugCategory} from "./bug-reports"
import {useGetBugPortalQuery, useSaveBugCategoryMutation, useSaveBugPortalMutation, type BugScope} from "./bug-reports-api"
import {ConnectionLightning} from "./connections/connection-lightning"

export function BugPortalSettings({scope}: {scope: BugScope}) {
    const portal = useGetBugPortalQuery(scope), [save, mutation] = useSaveBugPortalMutation()
    const [error, setError] = useState("")
    const [copiedLink, setCopiedLink] = useState("")
    const [preferredLink, setPreferredLink] = useState("short")
    const [rotating, setRotating] = useState(false)
    const optionsButton = useRef<HTMLButtonElement>(null)
    const openingRotation = useRef(false)
    const url = portal.data?.token ? `${window.location.origin}${bugReportLinkPaths.full}/${portal.data.token}` : ""
    const shortUrl = portal.data?.shortCode ? `${window.location.origin}${bugReportLinkPaths.short}/${portal.data.shortCode}` : ""
    const showShort = Boolean(shortUrl && (preferredLink === "short" || !url))
    const link = showShort ? shortUrl : url
    const copied = Boolean(link && copiedLink === link)
    const enabled = portal.data?.enabled ?? false

    async function update(enabled: boolean, rotate = false) {
        if (!portal.data) return
        setError(""); setCopiedLink("")
        try {await save({...scope, enabled, rotate, revision: portal.data.revision}).unwrap(); setRotating(false)}
        catch (failure) {setError(bugError(failure)); void portal.refetch()}
    }

    async function copy() {
        setError(""); setCopiedLink("")
        try {await navigator.clipboard.writeText(link); setCopiedLink(link)}
        catch {setError("Select and copy the link from the field.")}
    }

    return <section className="bug-portal" aria-label="Public reporting link">
        <div className="bug-portal-heading">
            <span className="bug-portal-icon"><Link2 aria-hidden="true"/></span>
            <h3>Public reporting</h3>
            <button type="button" role="switch" aria-label="Enable public reporting link" aria-checked={enabled} aria-busy={mutation.isLoading}
                className="bug-portal-switch" disabled={!portal.data || mutation.isLoading || portal.isFetching}
                onClick={() => void update(!enabled)}>
                <span/>
            </button>
        </div>

        {portal.isLoading ? (
            <p className="bug-portal-loading" role="status"><LoaderCircle className="animate-spin"/>Loading link…</p>
        ) : !portal.error && link ? (
            <div className="bug-portal-link">
                <Input value={link} aria-label={showShort ? "Short public bug report URL" : "Public bug report URL"}
                    readOnly onFocus={event => event.currentTarget.select()}/>
                <Button className="bug-portal-copy" variant="outline" disabled={!enabled || mutation.isLoading}
                    onClick={() => void copy()} aria-label={copied ? "Link copied" : `Copy ${showShort ? "short" : "full"} link`}>
                    {copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy"}
                </Button>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button ref={optionsButton} variant="ghost" size="icon" aria-label="Reporting link options" title="Link options" disabled={mutation.isLoading}>
                            <Ellipsis/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-36" onCloseAutoFocus={event => {
                        if (openingRotation.current) {
                            event.preventDefault()
                            openingRotation.current = false
                        }
                    }}>
                        {url && shortUrl && <>
                            <DropdownMenuRadioGroup value={showShort ? "short" : "full"} onValueChange={value => {
                                setPreferredLink(value)
                                setCopiedLink("")
                            }}>
                                <DropdownMenuRadioItem value="short">Short link</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="full">Full link</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator/>
                        </>}
                        <DropdownMenuItem onSelect={() => {openingRotation.current = true; setRotating(true)}}>
                            <RefreshCw/>Replace link
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        ) : null}

        {portal.error && <div className="bug-portal-message">
            <WorkshopToast variant="error">Could not load link settings. <Button variant="outline" size="sm" onClick={() => void portal.refetch()}>Retry</Button></WorkshopToast>
        </div>}
        {error && <div className="bug-portal-message">
            <WorkshopToast variant="error" onDismiss={() => setError("")}>{error}</WorkshopToast>
        </div>}
        <Dialog open={rotating} onOpenChange={setRotating}>
            <DialogContent onCloseAutoFocus={event => {event.preventDefault(); optionsButton.current?.focus()}}>
                <DialogHeader>
                    <DialogTitle>Replace the public link?</DialogTitle>
                    <DialogDescription>The current URLs will stop accepting reports.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setRotating(false)}>Cancel</Button>
                    <Button disabled={mutation.isLoading} onClick={() => void update(enabled, true)}>Replace link</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </section>
}

export function BugCategoryManager({scope, categories, open, onOpenChange, focusedCategory}: {scope: BugScope; categories: BugCategory[]; open: boolean; onOpenChange: (open: boolean) => void; focusedCategory?: string}) {
    const [save, mutation] = useSaveBugCategoryMutation(), [name, setName] = useState(""), [error, setError] = useState("")
    const focusedInput = useRef<HTMLInputElement>(null)
    async function add(event: FormEvent) {
        event.preventDefault(); setError("")
        try {await save({...scope, name: name.trim(), archived: false}).unwrap(); setName("")}
        catch (failure) {setError(bugError(failure))}
    }
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="bug-categories-dialog sm:max-w-lg" onOpenAutoFocus={event => {
        const input = focusedInput.current
        if (!input) return
        event.preventDefault()
        input.scrollIntoView({block: "nearest"})
        input.focus({preventScroll: true})
    }}><DialogHeader><DialogTitle><Tags className="inline-block size-4 mr-2"/>Bug categories</DialogTitle><DialogDescription>Archived categories are hidden from new reports.</DialogDescription></DialogHeader>
        <form className="bug-category-add" onSubmit={add}><Input aria-label="New category name" placeholder="Category name" maxLength={50} value={name} onChange={event => setName(event.target.value)}/><Button type="submit" disabled={mutation.isLoading || !name.trim() || categories.length >= 100}>Add category</Button></form>
        {error && <WorkshopToast variant="error" onDismiss={() => setError("")}>{error}</WorkshopToast>}
        <div className="bug-category-list">{categories.length ? categories.map(category => <CategoryRow key={`${category.id}:${category.name}:${category.archived}`} scope={scope} category={category} nameRef={category.id === focusedCategory ? focusedInput : undefined}/>) : <p className="bug-field-help">No categories yet.</p>}</div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
    </DialogContent></Dialog>
}
function CategoryRow({scope, category, nameRef}: {scope: BugScope; category: BugCategory; nameRef?: Ref<HTMLInputElement>}) {
    const [name, setName] = useState(category.name), [error, setError] = useState(""), [save, mutation] = useSaveBugCategoryMutation()
    async function update(archived: boolean) {
        setError("")
        try {await save({...scope, id: category.id, name: name.trim(), archived}).unwrap()}
        catch (failure) {setError(bugError(failure))}
    }
    return <div className={`bug-category-row connection-node-anchor${category.archived ? " archived" : ""}`}>
        <div>
            <Input ref={nameRef} aria-label={`Category name: ${category.name}`} maxLength={50} value={name} disabled={mutation.isLoading} onChange={event => setName(event.target.value)}/>
            {category.archived && <small>Archived</small>}
            <Button variant="outline" size="sm" disabled={mutation.isLoading || !name.trim() || name.trim() === category.name} onClick={() => void update(category.archived)}>Rename</Button>
            <Button variant="ghost" size="sm" disabled={mutation.isLoading || !name.trim()} onClick={() => void update(!category.archived)}>{category.archived ? "Restore" : "Archive"}</Button>
            <ConnectionLightning className="ms-auto" node={{kind: "bug-category", id: category.id, label: category.name}}/>
        </div>
        {error && <WorkshopToast variant="error" onDismiss={() => setError("")}>{error}</WorkshopToast>}
    </div>
}
