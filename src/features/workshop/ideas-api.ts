import { api } from "@/services/api"
import type { CanvasItem } from "./shape-clipboard"

export type IdeasDocument = { revision: number; items: CanvasItem[] }
export type IdeasKey = { organizationId: string; projectId: string }
export const ideasApi = api.injectEndpoints({ endpoints: (builder) => ({
  getIdeas: builder.query<IdeasDocument, IdeasKey>({
    query: ({ organizationId, projectId }) => `/organizations/${organizationId}/projects/${projectId}/ideas`,
  }),
  saveIdeas: builder.mutation<IdeasDocument, IdeasKey & IdeasDocument>({
    query: ({ organizationId, projectId, ...body }) => ({ url: `/organizations/${organizationId}/projects/${projectId}/ideas`, method: "PUT", body }),
  }),
}) })
