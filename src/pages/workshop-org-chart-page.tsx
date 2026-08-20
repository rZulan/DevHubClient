import { Network, Users } from "lucide-react"
import { useOutletContext } from "react-router-dom"

import type { WorkshopOutletContext } from "@/layouts/workshop-layout"

export function WorkshopOrgChartPage() {
  const { organization } = useOutletContext<WorkshopOutletContext>()
  const sortedRoles = [...organization.roles].sort((a, b) => a.order - b.order)

  return (
    <div className="workshop-page workshop-chart-page">
      <section className="workshop-page-heading compact">
        <div><span className="workshop-page-kicker">Role-based structure</span><h2>Organization chart</h2><p>The chart follows role order. Change role placement to reshape the hierarchy.</p></div>
      </section>
      <div className="workshop-chart-canvas">
        <div className="workshop-chart-toolbar"><Network /> {sortedRoles.length} levels <span /> <Users /> {organization.members.length} people</div>
        <div className="workshop-chart-tree">
          {sortedRoles.map((role, index) => {
            const members = organization.members.filter((member) => member.roleId === role.id)
            if (!members.length) return null
            return (
              <section key={role.id} style={{ "--role-color": role.color } as React.CSSProperties}>
                {index > 0 && <i className="workshop-chart-line" />}
                <h3><span />{role.name}<small>Level {role.order + 1}</small></h3>
                <div>
                  {members.map((member) => (
                    <article key={member.id}>
                      <span>{member.initials}<i className={member.online ? "online" : ""} /></span>
                      <div><strong>{member.name}</strong><small>@{member.username}</small></div>
                      <p>{member.teamIds.length ? member.teamIds.map((teamId) => organization.teams.find((team) => team.id === teamId)?.name).filter(Boolean).join(" · ") : "Organization-wide"}</p>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
