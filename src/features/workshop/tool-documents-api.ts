import {api} from "@/services/api"
import type {DocumentTool, ToolDocumentMap} from "./tool-documents"

export type ToolKey = {organizationId: string; projectId: string; tool: DocumentTool}
export type SavedToolDocument = {revision: number; document: ToolDocumentMap[DocumentTool] | null}
export const toolDocumentsApi = api.injectEndpoints({endpoints: builder => ({
    getToolDocument: builder.query<SavedToolDocument, ToolKey>({query: ({organizationId, projectId, tool}) => `/organizations/${organizationId}/projects/${projectId}/tools/${tool}`}),
    saveToolDocument: builder.mutation<SavedToolDocument, ToolKey & SavedToolDocument>({query: ({organizationId, projectId, tool, ...body}) => ({url: `/organizations/${organizationId}/projects/${projectId}/tools/${tool}`, method: "PUT", body})}),
})})
