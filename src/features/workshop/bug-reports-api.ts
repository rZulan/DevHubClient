import {api} from "@/services/api"
import type {BugCategory, BugDetail, BugInbox, BugPortal, BugReceipt} from "./bug-reports"

export type BugScope = {organizationId: string; projectId: string}
export const bugReportsPath = ({organizationId, projectId}: BugScope) => `/organizations/${organizationId}/projects/${projectId}/bug-reports`
export const bugReportsApi = api.enhanceEndpoints({addTagTypes: ["BugReports", "BugPortal"]}).injectEndpoints({endpoints: builder => ({
    listBugReports: builder.query<BugInbox, BugScope & {status: string; categoryId: string; search: string; page: number}>({
        query: ({status, categoryId, search, page, ...scope}) => ({url: bugReportsPath(scope), params: {page, ...(status ? {status} : {}), ...(categoryId ? {categoryId} : {}), ...(search ? {search} : {})}}),
        providesTags: (_data, _error, scope) => [{type: "BugReports", id: scope.projectId}],
    }),
    getBugReport: builder.query<BugDetail, BugScope & {reportId: string}>({query: ({reportId, ...scope}) => `${bugReportsPath(scope)}/${reportId}`, providesTags: (_data, _error, scope) => [{type: "BugReports", id: scope.projectId}]}),
    triageBugReport: builder.mutation<BugDetail, BugScope & {reportId: string; revision: number; status: string; priority: string; categoryId: string | null; internalNotes: string}>({
        query: ({reportId, organizationId, projectId, ...body}) => ({url: `${bugReportsPath({organizationId, projectId})}/${reportId}`, method: "PUT", body}),
        invalidatesTags: (data, _error, scope) => data ? [{type: "BugReports", id: scope.projectId}] : [],
    }),
    getBugPortal: builder.query<BugPortal, BugScope>({query: scope => `${bugReportsPath(scope)}/portal`, providesTags: (_data, _error, scope) => [{type: "BugPortal", id: scope.projectId}]}),
    saveBugPortal: builder.mutation<BugPortal, BugScope & {enabled: boolean; rotate: boolean; revision: number}>({
        query: ({organizationId, projectId, ...body}) => ({url: `${bugReportsPath({organizationId, projectId})}/portal`, method: "PUT", body}), invalidatesTags: (_data, _error, scope) => [{type: "BugPortal", id: scope.projectId}],
    }),
    saveBugCategory: builder.mutation<BugCategory, BugScope & {id?: string; name: string; archived: boolean}>({
        query: ({id, name, archived, ...scope}) => ({url: `${bugReportsPath(scope)}/categories${id ? `/${id}` : ""}`, method: id ? "PUT" : "POST", body: {name, archived}}), invalidatesTags: (_data, _error, scope) => [{type: "BugReports", id: scope.projectId}],
    }),
    submitTeamBug: builder.mutation<BugReceipt, BugScope & {form: FormData}>({query: ({form, ...scope}) => ({url: bugReportsPath(scope), method: "POST", body: form}), invalidatesTags: (_data, _error, scope) => [{type: "BugReports", id: scope.projectId}]}),
})})
export const {useListBugReportsQuery, useGetBugReportQuery, useTriageBugReportMutation, useGetBugPortalQuery, useSaveBugPortalMutation, useSaveBugCategoryMutation, useSubmitTeamBugMutation} = bugReportsApi
