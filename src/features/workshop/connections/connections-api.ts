import {api} from "@/services/api"

export type ConnectionScope = {organizationId: string; projectId: string}
export type ConnectionNodeRef = {kind: string; id?: string | null; parentId?: string | null}
export type ConnectionOption = {value: string; label: string}
export type ConnectionNode = {reference: ConnectionNodeRef; label: string; path: string; options?: Record<string, ConnectionOption[]> | null; unavailable?: boolean}
export type ConnectionAnchor = ConnectionNodeRef & {label: string}
export type ConnectionArguments = Record<string, string>
export type ConnectionBindings = Record<string, {eventField: string}>
export type ConnectionCondition = {node: ConnectionNodeRef; kind: string; arguments: ConnectionArguments}
export type ConnectionAction = {
    id: string; target: ConnectionNodeRef; kind: string; arguments: ConnectionArguments
    targetFromStepId?: string | null; argumentBindings?: ConnectionBindings | null
}
export type ConnectionRule = {
    id: string; title: string; enabled: boolean; includeAutomation: boolean; source: ConnectionNodeRef; event: string
    eventArguments: ConnectionArguments; matchAny: boolean; conditions: ConnectionCondition[]; actions: ConnectionAction[]; runOnce?: boolean
}
export type ConnectionDefinition = {
    id: string; title: string; revision: number; ownerUserId: string; nodes: ConnectionNode[]; rules: ConnectionRule[]; updatedAtUtc: string
    triggeredRuleIds?: string[]
}
export type ConnectionDraft = Pick<ConnectionDefinition, "title" | "revision" | "nodes" | "rules" | "triggeredRuleIds"> & {id?: string}
export type ConnectionField = {key: string; label: string; type: string; required: boolean; options?: ConnectionOption[] | null}
export type ConnectionChoice = {kind: string; label: string; fields: ConnectionField[]; createdNodeKind?: string | null}
export type ConnectionCapability = {
    nodeKind: string; tool: string; label: string
    eventChoices: ConnectionChoice[]; conditionChoices: ConnectionChoice[]; actionChoices: ConnectionChoice[]
}
export type ConnectionRun = {
    id: string; connectionId: string; ruleId: string; ruleTitle: string; event: string; source: ConnectionNodeRef
    occurredAtUtc: string; status: string; detail?: string | null
    steps: {actionId: string; label: string; status: string; detail?: string | null}[]
}
export type ConnectionValidation = {rules: {
    ruleId: string; status: "ready" | "conditions-unmet" | "condition-unavailable"
    conditions: {node: ConnectionNodeRef; kind: string; passed: boolean | null; detail?: string | null}[]
}[]}

function path({organizationId, projectId}: ConnectionScope) {
    return `/organizations/${organizationId}/projects/${projectId}/connections`
}

const connectionsTag = (scope: ConnectionScope) => ({type: "Connections" as const, id: path(scope)})
const draftBody = ({title, revision, rules, nodes}: ConnectionDraft) => ({title, revision, rules, nodes: nodes.map(node => node.reference)})

export const connectionsApi = api.enhanceEndpoints({addTagTypes: ["Connections"]}).injectEndpoints({endpoints: builder => ({
    listConnections: builder.query<ConnectionDefinition[], ConnectionScope>({
        query: path,
        providesTags: (_data, _error, scope) => [connectionsTag(scope)],
    }),
    connectionAccess: builder.query<{canManage: boolean}, ConnectionScope>({query: scope => `${path(scope)}/access`}),
    connectionCatalog: builder.query<ConnectionCapability[], ConnectionScope>({query: scope => `${path(scope)}/catalog`}),
    connectionNodes: builder.query<ConnectionNode[], ConnectionScope & {q?: string; kind?: string; page?: number; id?: string; parentId?: string}>({
        query: ({q, kind, page, id, parentId, ...scope}) => ({url: `${path(scope)}/nodes`, params: {q, kind, page, id, parentId}}),
    }),
    connectionRuns: builder.query<ConnectionRun[], ConnectionScope & {connectionId?: string; page?: number}>({
        query: ({connectionId, page, ...scope}) => ({url: `${path(scope)}/runs`, params: {connectionId, page}}),
    }),
    saveConnection: builder.mutation<ConnectionDefinition, ConnectionScope & {draft: ConnectionDraft}>({
        query: ({draft, ...scope}) => ({
            url: draft.id ? `${path(scope)}/${draft.id}` : path(scope), method: draft.id ? "PUT" : "POST", body: draftBody(draft),
        }),
        async onQueryStarted({organizationId, projectId}, {dispatch, queryFulfilled}) {
            const saved = await queryFulfilled.then(({data}) => data, () => null)
            if (!saved) return
            dispatch(connectionsApi.util.updateQueryData("listConnections", {organizationId, projectId}, connections => {
                const index = connections.findIndex(item => item.id === saved.id)
                if (index === -1) connections.unshift(saved)
                else if (connections[index].revision < saved.revision) connections[index] = saved
            }))
        },
        invalidatesTags: (_data, error, scope) => error ? [] : [connectionsTag(scope)],
    }),
    validateConnection: builder.mutation<ConnectionValidation, ConnectionScope & {draft: ConnectionDraft}>({
        query: ({draft, ...scope}) => ({url: `${path(scope)}/validate`, method: "POST", params: {id: draft.id}, body: draftBody(draft)}),
    }),
    deleteConnection: builder.mutation<void, ConnectionScope & {id: string; revision: number}>({
        query: ({id, revision, ...scope}) => ({url: `${path(scope)}/${id}`, method: "DELETE", params: {revision}}),
        invalidatesTags: (_data, error, scope) => error ? [] : [connectionsTag(scope)],
    }),
})})

export const {
    useListConnectionsQuery, useConnectionAccessQuery, useConnectionCatalogQuery, useConnectionNodesQuery,
    useConnectionRunsQuery, useSaveConnectionMutation, useValidateConnectionMutation, useDeleteConnectionMutation,
} = connectionsApi
