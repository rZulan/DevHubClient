// In-memory settings endpoints. This preview never writes to an organization or calls the API.
import {useState} from "react"
import {createRoot, type Root} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Outlet, Route, Routes} from "react-router-dom"
import {store} from "@/app/store"
import {setUser} from "@/features/auth/auth-slice"
import {useAppSelector} from "@/app/hooks"
import {api, useCreateOrganizationInviteMutation, useListOrganizationsQuery, useListOrganizationRolesQuery} from "@/services/api"
import {WorkshopContext} from "@/features/workshop/workshop-context"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {availablePermissions} from "@/features/workshop/workshop-permissions"
import {WorkshopSettingsLayout} from "@/pages/workshop/settings/workshop-settings-layout"
import {WorkshopRolesPage} from "@/pages/workshop/organization/workshop-roles-page"
import {GeneralSettingsPage} from "@/pages/workshop/settings/general-settings-page"
import {MembersSettingsPage} from "@/pages/workshop/settings/members-settings-page"
import {InvitesSettingsPage} from "@/pages/workshop/settings/invites-settings-page"
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog"
import type {ApiOrganization, ApiOrganizationRole, ActiveOrganizationInvite, WorkshopMember, WorkshopOrganization} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/index.css"

let profile: ApiOrganization = {id:"settings-preview",ownerUserId:"owner",name:"Atlas Workshop",description:"Shared project planning and delivery.",createdAtUtc:new Date().toISOString(),memberCount:3,teamCount:1}
let roles: ApiOrganizationRole[] = [
    {id:"owner-role",name:"Org Owner",color:"#f59e0b",position:0,isOwnerRole:true,isDefaultRole:false,permissions:[...availablePermissions],memberCount:1},
    {id:"manager-role",name:"Role manager",color:"#a78bfa",position:1,isOwnerRole:false,isDefaultRole:false,permissions:["Manage roles","Create invites","Edit UI designs"],memberCount:1},
    {id:"designer-role",name:"Designer",color:"#38bdf8",position:2,isOwnerRole:false,isDefaultRole:false,permissions:["Edit UI designs"],memberCount:0},
    {id:"member-role",name:"Member",color:"#86efac",position:1000,isOwnerRole:false,isDefaultRole:true,permissions:[],memberCount:3},
]
let members: WorkshopMember[] = [
    {id:"owner",name:"Alex Owner",username:"alex_owner",initials:"AO",roleId:"owner-role",roleIds:["owner-role","member-role"],isOwner:true,teamIds:["team"],online:true},
    {id:"manager",name:"Robin Manager",username:"robin_manager",initials:"RM",roleId:"manager-role",roleIds:["manager-role","member-role"],teamIds:["team"],online:true},
    {id:"member",name:"Sam Member",username:"sam_member",initials:"SM",roleId:"member-role",roleIds:["member-role"],teamIds:[],online:false},
]
const future = () => new Date(Date.now()+7*86400000).toISOString()
let invites: ActiveOrganizationInvite[] = ["owner","manager"].map((id,index)=>({id:`invite-${index}`,createdByUserId:id,createdAtUtc:new Date().toISOString(),expiresAtUtc:future()}))
const roleTag = [{type:"OrganizationRoles" as const,id:profile.id}]
const inviteTag = [{type:"OrganizationInvites" as const,id:profile.id}]
api.injectEndpoints({overrideExisting:true,endpoints:builder=>({
    listOrganizations:builder.query({queryFn:()=>({data:[structuredClone(profile)]}),providesTags:["Organizations"]}),
    updateOrganization:builder.mutation({queryFn:(input:{name:string;description:string})=>{profile={...profile,...input};return {data:structuredClone(profile)}},invalidatesTags:["Organizations"]}),
    listOrganizationRoles:builder.query({queryFn:()=>({data:structuredClone(roles)}),providesTags:roleTag}),
    createOrganizationRole:builder.mutation({queryFn:(input:{role:Omit<ApiOrganizationRole,"id"|"position"|"isOwnerRole"|"isDefaultRole"|"memberCount">})=>{
        if(roles.some(role=>role.name.toLowerCase()===input.role.name.toLowerCase())) return {error:{status:409,data:{detail:"A role with this name already exists."}}}
        const role={...input.role,id:crypto.randomUUID(),position:Math.max(...roles.filter(role=>!role.isDefaultRole).map(role=>role.position))+1,isOwnerRole:false,isDefaultRole:false,memberCount:0};roles.push(role);return {data:structuredClone(role)}
    },invalidatesTags:roleTag}),
    updateOrganizationRole:builder.mutation({queryFn:(input:{roleId:string;role:Partial<ApiOrganizationRole>})=>{roles=roles.map(role=>role.id===input.roleId?{...role,...input.role}:role);return {data:structuredClone(roles.find(role=>role.id===input.roleId)!)}},invalidatesTags:roleTag}),
    moveOrganizationRole:builder.mutation({queryFn:(input:{roleId:string;direction:number})=>{const ordered=roles.filter(role=>!role.isOwnerRole&&!role.isDefaultRole).sort((a,b)=>a.position-b.position),index=ordered.findIndex(role=>role.id===input.roleId),target=ordered[index+input.direction];if(target){const source=ordered[index],position=source.position;source.position=target.position;target.position=position}return {data:undefined}},invalidatesTags:roleTag}),
    deleteOrganizationRole:builder.mutation({queryFn:(input:{roleId:string})=>{roles=roles.filter(role=>role.id!==input.roleId);return {data:undefined}},invalidatesTags:roleTag}),
    assignOrganizationRole:builder.mutation({queryFn:(input:{roleId:string;userId:string;assigned:boolean})=>{members=members.map(member=>member.id===input.userId?{...member,roleIds:input.assigned?[...new Set([...member.roleIds??[],input.roleId])]:member.roleIds?.filter(id=>id!==input.roleId)}:member);return {data:undefined}},invalidatesTags:roleTag}),
    promoteOrganizationOwner:builder.mutation({queryFn:(input:{userId:string})=>{members=members.map(member=>member.id===input.userId?{...member,isOwner:true,roleIds:[...member.roleIds??[],"owner-role"]}:member);return {data:undefined}},invalidatesTags:roleTag}),
    removeOrganizationMember:builder.mutation({queryFn:(input:{userId:string})=>{members=members.filter(member=>member.id!==input.userId);return {data:undefined}},invalidatesTags:roleTag}),
    listOrganizationInvites:builder.query({queryFn:()=>({data:structuredClone(invites.filter(invite=>store.getState().auth.user?.id==="owner"||invite.createdByUserId===store.getState().auth.user?.id))}),providesTags:inviteTag}),
    revokeOrganizationInvite:builder.mutation({queryFn:(input:{inviteId:string})=>{invites=invites.filter(invite=>invite.id!==input.inviteId);return {data:undefined}},invalidatesTags:inviteTag}),
    createOrganizationInvite:builder.mutation({queryFn:()=>{const expiresAtUtc=future();invites.push({id:crypto.randomUUID(),createdByUserId:store.getState().auth.user!.id,createdAtUtc:new Date().toISOString(),expiresAtUtc});return {data:{token:"isolated-preview-link",expiresAtUtc}}},invalidatesTags:inviteTag}),
})})
store.dispatch(setUser({id:"owner",email:"owner@example.test",firstName:"Alex",lastName:"Owner",username:"alex_owner"}))
export function SettingsFixture() {
    const user=useAppSelector(state=>state.auth.user)!
    const roleQuery=useListOrganizationRolesQuery(profile.id), profileQuery=useListOrganizationsQuery()
    const [created,setCreated]=useState(false),[createInvite]=useCreateOrganizationInviteMutation()
    const saved=profileQuery.data?.[0]??profile
    const organization: WorkshopOrganization={id:profile.id,ownerUserId:"owner",name:saved.name,description:saved.description??"",initials:"AW",members,teams:[{id:"team",name:"Product team",description:"",color:"#a78bfa",leaderId:"manager",memberIds:["owner","manager"]}],projects:[],tasks:[],roles:(roleQuery.data??roles).map(role=>({...role,order:role.position}))}
    const noop=()=>{}
    const context:WorkshopOutletContext={organization,isPersistedOrganization:true,selectProject:noop,canInvite:hasWorkshopPermission(organization,user.id,"Create invites"),openInviteDialog:()=>{void createInvite(profile.id).unwrap().then(()=>setCreated(true))},previewColorScheme:noop}
    const workshop={organizations:[organization],isLoading:false,organizationById:()=>organization,addLocalOrganization:()=>organization,removeLocalOrganization:noop,moveTask:noop,addTask:noop,addTeam:noop,addProject:noop,updateProject:noop,saveRoles:noop}
    return <WorkshopContext value={workshop}><div className="min-h-screen bg-background text-foreground"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 text-sm"><span>Organization settings · isolated preview</span><label>Preview as <select aria-label="Preview as" className="ml-2 rounded border border-border bg-background p-2" value={user.id} onChange={event=>{const member=members.find(member=>member.id===event.target.value)!;store.dispatch(setUser({id:member.id,email:`${member.id}@example.test`,firstName:member.name,lastName:"",username:member.username}))}}><option value="owner">Owner</option><option value="manager">Role manager</option><option value="member">Member</option></select></label></header><Outlet context={context}/></div><Dialog open={created} onOpenChange={setCreated}><DialogContent><DialogTitle>Preview invitation created</DialogTitle><DialogDescription>The active invitation list is updated in this isolated preview.</DialogDescription></DialogContent></Dialog></WorkshopContext>
}
const root=(import.meta.hot?.data.root as Root | undefined) ?? createRoot(document.getElementById("root")!)
if(import.meta.hot) import.meta.hot.data.root=root
root.render(<Provider store={store}><MemoryRouter initialEntries={["/settings/roles"]}><Routes><Route element={<SettingsFixture/>}><Route path="settings" element={<WorkshopSettingsLayout/>}><Route path="general" element={<GeneralSettingsPage/>}/><Route path="members" element={<MembersSettingsPage/>}/><Route path="roles" element={<WorkshopRolesPage/>}/><Route path="invites" element={<InvitesSettingsPage/>}/></Route></Route></Routes></MemoryRouter></Provider>)
