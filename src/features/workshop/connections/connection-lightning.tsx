import {createContext, useContext, useMemo, useState, type ReactNode} from "react"
import {skipToken} from "@reduxjs/toolkit/query"
import {useOutletContext} from "react-router-dom"
import {Zap} from "lucide-react"
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {cn} from "@/lib/utils"
import {useGetToolDocumentQuery} from "../tool-documents-api"
import {useListConnectionsQuery, type ConnectionAnchor, type ConnectionScope} from "./connections-api"
import {ConnectionLibrary} from "./connection-library"
import {isSdlcTodoConnected, nodeKey, sameNode, sdlcTodoConnection, todoCalendarConnection} from "./connections-model"

const LinkedNodesContext = createContext<(ConnectionScope & {keys: Set<string>; todoCalendarEnabled: boolean}) | null>(null)

export function ConnectionLightningProvider({organizationId, projectId, todoCalendarEnabled, children}: {
    organizationId: string; projectId?: string; todoCalendarEnabled: boolean; children: ReactNode
}) {
    const {currentData} = useListConnectionsQuery(projectId ? {organizationId, projectId} : skipToken, {refetchOnFocus: true})
    const linked = useMemo(() => projectId ? {
        organizationId, projectId,
        keys: new Set(currentData?.flatMap(connection => connection.nodes.map(item => nodeKey(item.reference)))),
        todoCalendarEnabled,
    } : null, [currentData, organizationId, projectId, todoCalendarEnabled])

    return <LinkedNodesContext value={linked}>{children}</LinkedNodesContext>
}

export function ConnectionLightning({node, scope, className}: {
    node: ConnectionAnchor; scope?: {organizationId: string; projectId?: string; isPersistedOrganization: boolean}; className?: string
}) {
    const context = useOutletContext<WorkshopOutletContext | null>()
    const linked = useContext(LinkedNodesContext)
    const [open, setOpen] = useState(false)
    const organizationId = scope?.organizationId ?? context?.organization.id
    const projectId = scope ? scope.projectId : context?.project?.id
    const persisted = scope?.isPersistedOrganization ?? context?.isPersistedOrganization
    const sdlcTodoNode = sdlcTodoConnection.nodes.some(item => sameNode(item.reference, node))
    const roadmap = useGetToolDocumentQuery(organizationId && projectId && persisted && sdlcTodoNode
        ? {organizationId, projectId, tool: "sdlc"} : skipToken, {refetchOnFocus: true, refetchOnMountOrArgChange: true})
    if (!organizationId || !projectId || !persisted) return null
    const projectLinks = linked?.organizationId === organizationId && linked.projectId === projectId ? linked : null
    const todoCalendarEnabled = projectLinks?.todoCalendarEnabled === true
    const hasConnection = projectLinks?.keys.has(nodeKey(node)) || (todoCalendarEnabled && todoCalendarConnection.nodes.some(item => sameNode(item.reference, node))) ||
        (sdlcTodoNode && isSdlcTodoConnected(roadmap.currentData?.document))

    return <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className={cn("connection-lightning-trigger", className)} aria-label={`Connections for ${node.label}`}
            aria-description={hasConnection ? "Has a connection" : undefined}
            title={`Connections for ${node.label}`} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => {if (event.key === "Enter" || event.key === " ") event.stopPropagation()}}><Zap aria-hidden="true" fill={hasConnection ? "currentColor" : "none"}/></button></DialogTrigger>
        {open && <DialogContent className="connection-dialog"
            onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
            overlayProps={{
                onPointerDown: event => event.stopPropagation(),
                // Handle the backdrop directly because the modal isolates pointer events from the host tool.
                onClick: event => {
                    event.stopPropagation()
                    if (event.target === event.currentTarget && event.button === 0 && !event.ctrlKey) setOpen(false)
                },
            }}>
            <DialogTitle className="sr-only">Connections for {node.label}</DialogTitle>
            <DialogDescription className="sr-only">View linked project items and manage their connections and rules.</DialogDescription>
            <ConnectionLibrary scope={{organizationId, projectId}} anchor={node} onClose={() => setOpen(false)} todoCalendarEnabled={todoCalendarEnabled}/>
        </DialogContent>}
    </Dialog>
}
