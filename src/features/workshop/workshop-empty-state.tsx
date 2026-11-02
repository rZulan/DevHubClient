import {useId, type ReactNode} from "react"
import type {LucideIcon} from "lucide-react"
import {Link, useOutletContext} from "react-router-dom"
import {Button} from "@/components/ui/button"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "./workshop-empty-state.css"

type EmptyStateProps = {
    icon: LucideIcon
    title: string
    description: ReactNode
    action?: ReactNode
    children?: ReactNode
    className?: string
}

export function WorkshopEmptyState({icon: Icon, title, description, action, children, className = ""}: EmptyStateProps) {
    const titleId = useId()
    return <section className={`workshop-empty-state ${className}`} aria-labelledby={titleId}>
        <span className="workshop-empty-state-icon" aria-hidden="true"><Icon/></span>
        <h2 id={titleId}>{title}</h2>
        {description && <p>{description}</p>}
        {action && <div className="workshop-empty-state-actions">{action}</div>}
        {children}
    </section>
}

export function WorkshopEmptyPage(props: EmptyStateProps) {
    return <div className="workshop-page workshop-empty-page"><WorkshopEmptyState {...props}/></div>
}

export function WorkshopNoProject({icon}: {icon: LucideIcon}) {
    const {organization} = useOutletContext<WorkshopOutletContext>()
    return <WorkshopEmptyPage icon={icon} title="No project selected"
        description="Select a project from the menu above, or create one to get started."
        action={<Button asChild variant="outline"><Link to={`/workshop/${organization.id}/projects`}>View projects</Link></Button>}/>
}
