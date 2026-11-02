import {useEffect, useId, useState} from "react"
import {NavLink} from "react-router-dom"
import {CaretRightIcon} from "@phosphor-icons/react/dist/csr/CaretRight"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"
import {cn} from "@/lib/utils"
import type {WorkshopNavigationItem} from "./workshop-navigation"
import {DashboardNavigationLink} from "./dashboard-navigation-link"

export function WorkshopNavigationGroup({title, items, activePath, underConstruction = false, dashboardEditing = false}: {
    title: string; items: readonly WorkshopNavigationItem[]; activePath: string; underConstruction?: boolean; dashboardEditing?: boolean
}) {
    const [expanded, setExpanded] = useState(true)
    const submenuId = useId()
    useEffect(() => {if (items.some(item => item.path === activePath)) setExpanded(true)}, [activePath, items])
    return <div className={cn("workshop-nav-group", expanded && "open")}>
        <button type="button" className="workshop-nav-group-trigger" aria-expanded={expanded} aria-controls={submenuId} onClick={() => setExpanded(value => !value)}>
            <span className="workshop-construction-label">{title}{underConstruction && <UnderConstructionIndicator/>}</span><CaretRightIcon className="workshop-nav-chevron"/>
        </button>
        <div className="workshop-nav-submenu" id={submenuId}>
            {items.map(({label, path, underConstruction: pending}) => path === "dashboard"
                ? <DashboardNavigationLink key={path} label={label} underConstruction={pending} switchDisabled={dashboardEditing}/>
                : <NavLink key={path} to={path} className={({isActive}) => cn("workshop-nav-link", isActive && "active")}>
                <span className="workshop-construction-label">{label}{pending && <UnderConstructionIndicator/>}</span>
            </NavLink>)}
        </div>
    </div>
}
