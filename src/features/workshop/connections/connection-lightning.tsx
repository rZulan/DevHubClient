import {createContext, useContext, useMemo, useState, type ReactNode} from "react"
import {skipToken} from "@reduxjs/toolkit/query"
import {useOutletContext} from "react-router-dom"
import {Zap} from "lucide-react"
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {cn} from "@/lib/utils"
import {useListConnectionsQuery, type ConnectionAnchor, type ConnectionScope} from "./connections-api"
import {ConnectionLibrary} from "./connection-library"
import {nodeKey} from "./connections-model"

const LinkedNodesContext = createContext<(ConnectionScope & {keys: Set<string>}) | null>(null)

export function ConnectionLightningProvider({organizationId, projectId, children}: {
    organizationId: string; projectId?: string; children: ReactNode
}) {
    const {currentData} = useListConnectionsQuery(projectId ? {organizationId, projectId} : skipToken, {refetchOnFocus: true})
    const linked = useMemo(() => projectId ? {
        organizationId, projectId,
        keys: new Set(currentData?.flatMap(connection => connection.nodes.map(item => nodeKey(item.reference)))),
    } : null, [currentData, organizationId, projectId])

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
    if (!organizationId || !projectId || !persisted) return null
    const hasConnection = linked?.organizationId === organizationId && linked.projectId === projectId && linked.keys.has(nodeKey(node))

    return <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className={cn("connection-lightning-trigger", className)} aria-label={`Connections for ${node.label}`}
            aria-description={hasConnection ? "Has a saved connection" : undefined}
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
            <ConnectionLibrary scope={{organizationId, projectId}} anchor={node} onClose={() => setOpen(false)}/>
        </DialogContent>}
    </Dialog>
}
