import { Building2, Palette, ShieldCheck, Users } from "lucide-react"
import { NavLink, Outlet, useOutletContext } from "react-router-dom"

import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { cn } from "@/lib/utils"

const sections = [
  { path: "general", label: "General", icon: Building2 },
  { path: "appearance", label: "Appearance", icon: Palette },
  { path: "members", label: "Members", icon: Users },
  { path: "roles", label: "Roles & access", icon: ShieldCheck },
]

export function WorkshopSettingsLayout() {
  const context = useOutletContext<WorkshopOutletContext>()
  const { organization } = context

  return (
    <div className="workshop-settings">
      <aside className="workshop-settings-sidebar">
        <header>
          <span className="workshop-org-mark">{organization.initials}</span>
          <span><strong>{organization.name}</strong><small>{organization.members.length} member{organization.members.length === 1 ? "" : "s"}</small></span>
        </header>
        <nav aria-label="Organization settings">
          {sections.map(({ icon: Icon, label, path }) => (
            <NavLink className={({ isActive }) => cn("workshop-settings-link", isActive && "active")} key={path} to={path}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="workshop-settings-content">
        <Outlet context={context} />
      </div>
    </div>
  )
}
