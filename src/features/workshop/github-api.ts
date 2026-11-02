import {api} from "@/services/api"

export type GitHubRepository = {installationId: number; repositoryId: number; label: string; fullName: string; url: string; defaultBranch: string; private: boolean}
export type GitHubSelection = Pick<GitHubRepository, "installationId" | "repositoryId" | "label">
export const githubApi = api.injectEndpoints({endpoints: builder => ({
    githubStatus: builder.query<{configured: boolean; connected: boolean; login?: string; installUrl?: string}, string>({query: () => "/integrations/github/status"}),
    githubInstallations: builder.query<{id: number; account: string; settingsUrl?: string}[], string>({query: () => "/integrations/github/installations"}),
    githubRepositories: builder.query<{repositories: GitHubRepository[]; hasMore: boolean}, {userId: string; installationId: number; page: number}>({
        query: ({installationId, page}) => `/integrations/github/installations/${installationId}/repositories?page=${page}`,
    }),
    authorizeGitHub: builder.mutation<{url: string}, boolean>({query: install => ({url: `/integrations/github/authorize?install=${install}`, method: "POST"})}),
    disconnectGitHub: builder.mutation<void, void>({query: () => ({url: "/integrations/github/connection", method: "DELETE"})}),
})})
export const {useGithubStatusQuery, useGithubInstallationsQuery, useGithubRepositoriesQuery, useAuthorizeGitHubMutation, useDisconnectGitHubMutation} = githubApi
