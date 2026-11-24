import {api} from "@/services/api"
import type {SdlcModel} from "./sdlc-models"
import type {DocumentTool, ToolDocumentMap} from "./tool-documents"

export type ToolKey = {organizationId: string; projectId: string; tool: DocumentTool}
export type SavedToolDocument = {revision: number; document: ToolDocumentMap[DocumentTool] | null}
export type SdlcSetup = {model: SdlcModel; connectToTodo: boolean}
export const toolDocumentStorageKey = ({organizationId, projectId, tool}: ToolKey, userId: string) =>
    `devhub.tool-document:${userId}:${organizationId}:${projectId}:${tool}`
type ProjectScope = Omit<ToolKey, "tool">
const toolPath = ({organizationId, projectId, tool}: ToolKey) => `/organizations/${organizationId}/projects/${projectId}/tools/${tool}`
const roadmapTag = (scope: ProjectScope) => ({type: "SdlcRoadmap" as const, id: toolPath({...scope, tool: "sdlc"})})

export const toolDocumentsApi = api.enhanceEndpoints({addTagTypes: ["SdlcRoadmap"]}).injectEndpoints({endpoints: builder => ({
    getToolDocument: builder.query<SavedToolDocument, ToolKey>({
        query: toolPath,
        providesTags: (_data, _error, key) => key.tool === "sdlc" ? [roadmapTag(key)] : [],
    }),
    saveToolDocument: builder.mutation<SavedToolDocument, ToolKey & SavedToolDocument>({
        query: ({organizationId, projectId, tool, ...body}) => ({
            url: toolPath({organizationId, projectId, tool}), method: "PUT", body,
        }),
        invalidatesTags: (saved, _error, key) => saved && key.tool === "sdlc" ? [roadmapTag(key)] : [],
    }),
    initializeSdlc: builder.mutation<SavedToolDocument, ProjectScope & SdlcSetup & {revision: number}>({
        query: ({organizationId, projectId, ...body}) => ({
            url: `${toolPath({organizationId, projectId, tool: "sdlc"})}/initialize`, method: "PUT", body,
        }),
        invalidatesTags: (saved, _error, key) => saved ? [roadmapTag(key)] : [],
    }),
})})

export const {useGetToolDocumentQuery} = toolDocumentsApi
