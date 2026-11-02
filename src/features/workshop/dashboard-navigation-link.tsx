import {Building2, UserRound} from "lucide-react"
import {NavLink, useLocation, useNavigate, useParams} from "react-router-dom"
import {useAppSelector} from "@/app/hooks"
import {getDashboardView, setDashboardView} from "./dashboard-view"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"
import {cn} from "@/lib/utils"

export function DashboardNavigationLink({label, underConstruction, switchDisabled = false}: {
    label: string; underConstruction?: boolean; switchDisabled?: boolean
}) {
    const location = useLocation()
    const navigate = useNavigate()
    const {organizationId = ""} = useParams()
    const userId = useAppSelector(state => state.auth.user?.id ?? "current")
    const onDashboard = location.pathname.endsWith("/dashboard")
    const params = new URLSearchParams(onDashboard ? location.search : "")
    const view = getDashboardView(userId, organizationId, params.get("view"))
    const personal = view === "personal"
    params.set("view", view)
    const destination = {pathname: "dashboard", search: params.toString()}
    return <div className={cn("workshop-dashboard-nav-row", onDashboard && "active")}>
        <NavLink to={destination} className={({isActive}) => cn("workshop-nav-link", isActive && "active")}>
            <span className="workshop-construction-label">{label}{underConstruction && <UnderConstructionIndicator/>}</span>
        </NavLink>
        <button type="button" role="switch" aria-label="Personal dashboard" aria-checked={personal}
            className="workshop-dashboard-nav-switch" data-view={view} disabled={switchDisabled}
            title={switchDisabled ? "Save or discard dashboard changes to switch" : `${personal ? "Personal" : "Org"} Dashboard · Switch to ${personal ? "Org" : "Personal"}`}
            onClick={() => {
                if (switchDisabled) return
                const next = personal ? "organization" : "personal"
                setDashboardView(userId, organizationId, next)
                params.set("view", next)
                navigate({pathname: "dashboard", search: params.toString()})
            }}>
            <span className="workshop-dashboard-switch-thumb" aria-hidden="true"/>
            <Building2 aria-hidden="true" className="dashboard-org-icon"/>
            <UserRound aria-hidden="true" className="dashboard-personal-icon"/>
        </button>
    </div>
}
