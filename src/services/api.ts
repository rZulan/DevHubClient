import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react"

import { clearSession, setCredentials } from "@/features/auth/auth-slice"
import {
  clearStoredRefreshToken,
} from "@/features/auth/auth-storage"
import type {
  AuthenticationResponse,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UserResponse,
} from "@/features/auth/auth-types"
import type {
  ApiOrganization,
  ApiProject,
  ApiTeam,
  SaveProjectInput,
} from "@/features/workshop/workshop-types"

type AuthRootState = {
  auth: {
    accessToken: string | null
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api"

const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiBaseUrl,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const accessToken = (getState() as AuthRootState).auth.accessToken

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`)
    }

    return headers
  },
})

const refreshBaseQuery = fetchBaseQuery({
  baseUrl: apiBaseUrl,
  credentials: "include",
})

let refreshRequest: Promise<AuthenticationResponse | null> | null = null

const baseQueryWithReauthentication: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiContext, extraOptions) => {
  let result = await rawBaseQuery(args, apiContext, extraOptions)

  if (result.error?.status !== 401 || isAuthenticationRequest(args)) {
    return result
  }

  refreshRequest ??= (async () => {
    const refreshResult = await refreshBaseQuery(
      {
        url: "/auth/refresh",
        method: "POST",
      },
      apiContext,
      extraOptions,
    )

    if (refreshResult.data) {
      const response = refreshResult.data as AuthenticationResponse
      clearStoredRefreshToken()
      apiContext.dispatch(setCredentials(response))
      return response
    }

    clearStoredRefreshToken()
    apiContext.dispatch(clearSession())
    return null
  })().finally(() => {
    refreshRequest = null
  })

  const refreshedSession = await refreshRequest

  if (refreshedSession) {
    result = await rawBaseQuery(args, apiContext, extraOptions)
  }

  return result
}

function isAuthenticationRequest(args: string | FetchArgs) {
  const url = typeof args === "string" ? args : args.url
  return url.startsWith("/auth/")
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauthentication,
  tagTypes: [
    "CurrentUser",
    "Organizations",
    "Teams",
    "TeamMembers",
    "OrganizationMembers",
    "Projects",
  ],
  endpoints: (builder) => ({
    login: builder.mutation<AuthenticationResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["CurrentUser"],
    }),
    register: builder.mutation<AuthenticationResponse, RegisterRequest>({
      query: (registration) => ({
        url: "/auth/register",
        method: "POST",
        body: registration,
      }),
      invalidatesTags: ["CurrentUser"],
    }),
    refresh: builder.mutation<AuthenticationResponse, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),
      invalidatesTags: ["CurrentUser"],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["CurrentUser"],
    }),
    getCurrentUser: builder.query<UserResponse, void>({
      query: () => "/users/me",
      providesTags: ["CurrentUser"],
    }),
    updateCurrentUser: builder.mutation<UserResponse, UpdateProfileRequest>({
      query: (profile) => ({
        url: "/users/me",
        method: "PATCH",
        body: profile,
      }),
      invalidatesTags: ["CurrentUser"],
    }),
    disconnectExternalAccount: builder.mutation<void, "google" | "github">({
      query: (provider) => ({
        url: `/users/me/connections/${provider}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CurrentUser"],
    }),
    listOrganizations: builder.query<ApiOrganization[], void>({
      query: () => "/organizations",
      providesTags: ["Organizations"],
    }),
    createOrganization: builder.mutation<
      ApiOrganization,
      { name: string; description?: string }
    >({
      query: (organization) => ({
        url: "/organizations",
        method: "POST",
        body: organization,
      }),
      invalidatesTags: ["Organizations"],
    }),
    listOrganizationMembers: builder.query<UserResponse[], string>({
      query: (organizationId) => `/organizations/${organizationId}/members`,
      providesTags: (_result, _error, organizationId) => [
        { type: "OrganizationMembers", id: organizationId },
      ],
    }),
    listTeams: builder.query<ApiTeam[], string>({
      query: (organizationId) => `/organizations/${organizationId}/teams`,
      providesTags: (_result, _error, organizationId) => [
        { type: "Teams", id: organizationId },
      ],
    }),
    createTeam: builder.mutation<
      ApiTeam,
      { organizationId: string; name: string; description?: string; leaderUserId: string }
    >({
      query: ({ organizationId, ...team }) => ({
        url: `/organizations/${organizationId}/teams`,
        method: "POST",
        body: team,
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "Teams", id: organizationId },
        "Organizations",
      ],
    }),
    addTeamMember: builder.mutation<
      void,
      { organizationId: string; teamId: string; userId: string }
    >({
      query: ({ organizationId, teamId, userId }) => ({
        url: `/organizations/${organizationId}/teams/${teamId}/members/${userId}`,
        method: "PUT",
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "Teams", id: organizationId },
      ],
    }),
    listTeamMembers: builder.query<
      UserResponse[],
      { organizationId: string; teamId: string }
    >({
      query: ({ organizationId, teamId }) =>
        `/organizations/${organizationId}/teams/${teamId}/members`,
      providesTags: (_result, _error, { teamId }) => [
        { type: "TeamMembers", id: teamId },
      ],
    }),
    listProjects: builder.query<ApiProject[], string>({
      query: (organizationId) => `/organizations/${organizationId}/projects`,
      providesTags: (_result, _error, organizationId) => [
        { type: "Projects", id: organizationId },
      ],
    }),
    createProject: builder.mutation<
      ApiProject,
      { organizationId: string; project: SaveProjectInput }
    >({
      query: ({ organizationId, project }) => ({
        url: `/organizations/${organizationId}/projects`,
        method: "POST",
        body: project,
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "Projects", id: organizationId },
      ],
    }),
    updateProject: builder.mutation<
      ApiProject,
      { organizationId: string; projectId: string; project: SaveProjectInput }
    >({
      query: ({ organizationId, projectId, project }) => ({
        url: `/organizations/${organizationId}/projects/${projectId}`,
        method: "PUT",
        body: project,
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "Projects", id: organizationId },
      ],
    }),
  }),
})

export const {
  useGetCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useUpdateCurrentUserMutation,
  useDisconnectExternalAccountMutation,
  useListOrganizationsQuery,
  useCreateOrganizationMutation,
  useListOrganizationMembersQuery,
  useListTeamsQuery,
  useCreateTeamMutation,
  useAddTeamMemberMutation,
  useListTeamMembersQuery,
  useListProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
} = api
