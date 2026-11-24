import {useEffect, useId, useRef, useState, type FormEvent} from "react"
import {Check, ChevronLeft, ChevronRight, LoaderCircle, Stars} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {sdlcModelIds, sdlcModels, type SdlcModel} from "./sdlc-models"
import {saveFailureDetail} from "./workshop-limits"
import "./project-create.css"
import "./sdlc-setup.css"

type SetupValues = {model: SdlcModel; connectToTodo: boolean}

const steps = [
    {label: "Model", title: "Choose an SDLC model"},
    {label: "Connections", title: "Connect to To-do"},
    {label: "Review", title: "Review roadmap setup"},
]

export function SdlcSetupDialog({projectName, replacing, opener, connectionUnavailable, onClose, onInitialize}: {
    projectName: string; replacing: boolean; opener: HTMLElement | null
    connectionUnavailable?: string
    onClose: () => void; onInitialize: (values: SetupValues) => Promise<void>
}) {
    const [step, setStep] = useState(0)
    const [model, setModel] = useState<SdlcModel | null>(null)
    const [connectToTodo, setConnectToTodo] = useState(!connectionUnavailable)
    const connectionEnabled = !connectionUnavailable && connectToTodo
    const [confirmed, setConfirmed] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const headingId = useId()
    const heading = useRef<HTMLHeadingElement>(null)
    const body = useRef<HTMLDivElement>(null)
    const lastStep = step === steps.length - 1
    const action = replacing ? "Reinitialize roadmap" : "Initialize roadmap"
    useEffect(() => {
        body.current?.scrollTo(0, 0)
        heading.current?.focus({preventScroll: true})
    }, [step])

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!model || saving) return
        if (!lastStep) {
            setStep(step + 1)
            return
        }
        if (replacing && !confirmed) return
        setSaving(true)
        setError("")
        try {
            await onInitialize({model, connectToTodo: connectionEnabled})
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : saveFailureDetail(failure, "The roadmap could not be initialized. Try again."))
        } finally {
            setSaving(false)
        }
    }

    return <Dialog open onOpenChange={open => {if (!open && !saving) onClose()}}>
        <DialogContent className="workshop-modal project-create-dialog sdlc-setup-dialog" aria-describedby={undefined} showCloseButton={!saving}
            onCloseAutoFocus={event => {if (opener?.isConnected) {event.preventDefault(); opener.focus({preventScroll: true})}}}>
            <DialogHeader className="project-create-header">
                <span className="workshop-modal-icon" aria-hidden="true"><Stars/></span>
                <DialogTitle>{action}</DialogTitle>
                <span className="project-create-step-count">{step + 1} / {steps.length}</span>
            </DialogHeader>
            <nav className="project-create-progress" aria-label="Roadmap setup progress">
                <ol>{steps.map(({label}, index) =>
                    <li key={label} aria-current={step === index ? "step" : undefined} data-complete={step > index}>
                        <span aria-hidden="true">{step > index ? <Check/> : index + 1}</span><span>{label}</span>
                    </li>)}</ol>
            </nav>
            <form className="project-create-form" onSubmit={submit} aria-busy={saving}>
                <div className="project-create-body" ref={body}>
                    <h3 ref={heading} tabIndex={-1} id={headingId}>{steps[step].title}</h3>
                    {step === 0 && <fieldset className="project-create-grid sdlc-setup-models" aria-labelledby={headingId}>
                        {sdlcModelIds.map(id => <label className="sdlc-setup-choice" key={id}>
                            <input type="radio" name="model" value={id} checked={model === id}
                                onChange={() => {setModel(id); setConfirmed(false)}}/>
                            <span><strong>{sdlcModels[id].title}</strong><small>{sdlcModels[id].summary}</small></span>
                        </label>)}
                    </fieldset>}
                    {step === 1 && <label className="sdlc-setup-choice">
                        <input type="checkbox" checked={connectionEnabled} disabled={!!connectionUnavailable}
                            onChange={event => {setConnectToTodo(event.target.checked); setConfirmed(false)}}/>
                        <span><strong>Connect deliverables to To-do</strong>
                            <small>{connectionUnavailable ?? "Create a To-do board for each phase with a task for each deliverable. Checking a deliverable moves its task to the board’s rightmost column."}</small>
                        </span>
                    </label>}
                    {lastStep && model && <div className="sdlc-setup-review">
                        <dl>
                            <div><dt>Project</dt><dd>{projectName}</dd></div>
                            <div><dt>SDLC model</dt><dd>{sdlcModels[model].title}</dd></div>
                            <div><dt>To-do connection</dt><dd>{connectionEnabled ? "Enabled" : "Disabled"}</dd></div>
                        </dl>
                        {replacing && <label className="sdlc-setup-choice sdlc-setup-confirm">
                            <input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)}/>
                            <span><strong>Replace the current roadmap</strong><small>Roadmap progress, dates, and deliverables will reset. Previously linked To-do boards become standalone boards.</small></span>
                        </label>}
                    </div>}
                    {error && <p className="workshop-form-error project-create-error" role="alert">{error}</p>}
                </div>
                <div className="project-create-footer">
                    <Button disabled={saving} onClick={onClose} type="button" variant="ghost">Cancel</Button>
                    <div>
                        {step > 0 && <Button disabled={saving} onClick={() => {setError(""); setStep(step - 1)}} type="button" variant="outline"><ChevronLeft/>Back</Button>}
                        <Button type="submit" disabled={!model || saving || lastStep && replacing && !confirmed} variant={lastStep && replacing ? "destructive" : "default"}>
                            {lastStep ? <>{saving ? <LoaderCircle className="animate-spin"/> : <Check/>}{saving ? "Initializing…" : action}</> : <>Next<ChevronRight/></>}
                        </Button>
                    </div>
                </div>
            </form>
        </DialogContent>
    </Dialog>
}
