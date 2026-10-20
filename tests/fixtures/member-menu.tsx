// Local visual fixture. Open menus only; no organization data is loaded or saved.
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {store} from "@/app/store"
import {setUser} from "@/features/auth/auth-slice"
import {MemberSidebarEntry} from "@/features/workshop/member-sidebar-entry"
import type {WorkshopOrganization} from "@/features/workshop/workshop-types"
import "@/index.css"

store.dispatch(setUser({id: "current", email: "preview@example.test", firstName: "Preview", lastName: "Owner", createdAtUtc: ""}))
document.documentElement.classList.add("dark")
const member = {id: "member", name: "Alex Morgan", username: "alex", initials: "AM", roleId: "member", teamIds: ["design"], online: true}
const organization: WorkshopOrganization = {
    id: "member-menu-preview", name: "Preview", description: "", initials: "PV", ownerUserId: "current",
    members: [{...member, id: "current", isOwner: true}, member],
    roles: [{id: "owner", name: "Owner", color: "#fbbf24", order: 0, permissions: [], isOwnerRole: true}, {id: "member", name: "Member", color: "#a78bfa", order: 1, permissions: []}],
    teams: [{id: "design", name: "Product design", description: "", color: "#a78bfa", leaderId: "member", memberIds: ["member"]}, {id: "engineering", name: "Engineering", description: "", color: "#34d399", leaderId: "current", memberIds: ["current"]}],
    projects: [], tasks: [],
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><main style={{minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", padding: 20}}>
    <h1 style={{fontSize: 18}}>Member menu preview</h1><p style={{color: "var(--muted-foreground)", marginTop: 8}}>Right-click either member to check submenu placement at both screen edges.</p>
    <div style={{display: "flex", justifyContent: "space-between", marginTop: 80, gap: 20}}>{["left", "right"].map(side => <MemberSidebarEntry key={side} organization={organization} member={member}><button aria-label={`${side} member menu`} style={{padding: "12px 16px", borderRadius: 8, background: "var(--accent)"}}>Alex Morgan</button></MemberSidebarEntry>)}</div>
</main></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
