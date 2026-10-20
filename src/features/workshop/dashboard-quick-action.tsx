import {ArrowUpRight} from "lucide-react"
import {Link} from "react-router-dom"

export function DashboardQuickAction({category, title, description, to, onClick}: {
    category: string; title: string; description: string; to?: string; onClick?: () => void
}) {
    const content = <>
        <div className="workshop-quick-action-topline"><span>{category}</span><ArrowUpRight aria-hidden="true"/></div>
        <div className="workshop-quick-action-copy"><h3>{title}</h3><p>{description}</p></div>
    </>
    return <section className="workshop-dashboard-section">
        <div className="workshop-quick-actions workshop-single-quick-action">{to
            ? <Link to={to} title={`${title} — ${description}`}>{content}</Link>
            : <button type="button" onClick={onClick} title={`${title} — ${description}`}>{content}</button>}
        </div>
    </section>
}
