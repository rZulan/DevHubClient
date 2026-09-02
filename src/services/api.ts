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
  ApiOrganizationInvite,
  ApiOrganizationMember,
  ApiOrganizationRole,
  ApiProject,
  ApiTeam,
  SaveProjectInput,
  SaveOrganizationRoleInput,
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
    "OrganizationRoles",
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
    updateOrganization: builder.mutation<
      ApiOrganization,
      { organizationId: string; name: string; description?: string }
    >({
      query: ({ organizationId, ...organization }) => ({
        url: `/organizations/${organizationId}`,
        method: "PUT",
        body: organization,
      }),
      invalidatesTags: ["Organizations"],
    }),
    createOrganizationInvite: builder.mutation<ApiOrganizationInvite, string>({
      query: (organizationId) => ({
        url: `/organizations/${organizationId}/invites`,
        method: "POST",
      }),
    }),
    acceptOrganizationInvite: builder.mutation<ApiOrganization, string>({
      query: (token) => ({
        url: `/organizations/invites/${encodeURIComponent(token)}/accept`,
        method: "POST",
      }),
      invalidatesTags: ["Organizations"],
    }),
    listOrganizationMembers: builder.query<ApiOrganizationMember[], string>({
      query: (organizationId) => `/organizations/${organizationId}/members`,
      providesTags: (_result, _error, organizationId) => [
        { type: "OrganizationMembers", id: organizationId },
      ],
    }),
    removeOrganizationMember: builder.mutation<void, { organizationId: string; userId: string }>({
      query: ({ organizationId, userId }) => ({
        url: `/organizations/${organizationId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        "Organizations",
        { type: "OrganizationMembers", id: organizationId },
        { type: "OrganizationRoles", id: organizationId },
        { type: "Teams", id: organizationId },
      ],
    }),
    listOrganizationRoles: builder.query<ApiOrganizationRole[], string>({
      query: (organizationId) => `/organizations/${organizationId}/roles`,
      providesTags: (_result, _error, organizationId) => [
        { type: "OrganizationRoles", id: organizationId },
      ],
    }),
    createOrganizationRole: builder.mutation<
      ApiOrganizationRole,
      { organizationId: string; role: Omit<SaveOrganizationRoleInput, "position"> }
    >({
      query: ({ organizationId, role }) => ({
        url: `/organizations/${organizationId}/roles`,
        method: "POST",
        body: role,
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "OrganizationRoles", id: organizationId },
      ],
    }),
    updateOrganizationRole: builder.mutation<
      ApiOrganizationRole,
      { organizationId: string; roleId: string; role: SaveOrganizationRoleInput }
    >({
      query: ({ organizationId, roleId, role }) => ({
        url: `/organizations/${organizationId}/roles/${roleId}`,
        method: "PUT",
        body: role,
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "OrganizationRoles", id: organizationId },
        { type: "OrganizationMembers", id: organizationId },
      ],
    }),
    deleteOrganizationRole: builder.mutation<void, { organizationId: string; roleId: string }>({
      query: ({ organizationId, roleId }) => ({
        url: `/organizations/${organizationId}/roles/${roleId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "OrganizationRoles", id: organizationId },
        { type: "OrganizationMembers", id: organizationId },
      ],
    }),
    assignOrganizationRole: builder.mutation<
      void,
      { organizationId: string; roleId: string; userId: string; assigned: boolean }
    >({
      query: ({ organizationId, roleId, userId, assigned }) => ({
        url: `/organizations/${organizationId}/roles/${roleId}/members/${userId}`,
        method: assigned ? "PUT" : "DELETE",
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "OrganizationRoles", id: organizationId },
        { type: "OrganizationMembers", id: organizationId },
      ],
    }),
    promoteOrganizationOwner: builder.mutation<void, { organizationId: string; userId: string }>({
      query: ({ organizationId, userId }) => ({
        url: `/organizations/${organizationId}/owners/${userId}`,
        method: "PUT",
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        "Organizations",
        { type: "OrganizationRoles", id: organizationId },
        { type: "OrganizationMembers", id: organizationId },
      ],
    }),
    leaveOrganization: builder.mutation<void, string>({
      query: (organizationId) => ({
        url: `/organizations/${organizationId}/members/me`,
        method: "DELETE",
      }),
      invalidatesTags: ["Organizations"],
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
    updateTeam: builder.mutation<
      ApiTeam,
      { organizationId: string; teamId: string; name: string; description?: string; leaderUserId: string }
    >({
      query: ({ organizationId, teamId, ...team }) => ({
        url: `/organizations/${organizationId}/teams/${teamId}`,
        method: "PUT",
        body: team,
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "Teams", id: organizationId },
      ],
    }),
    deleteTeam: builder.mutation<void, { organizationId: string; teamId: string }>({
      query: ({ organizationId, teamId }) => ({
        url: `/organizations/${organizationId}/teams/${teamId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        { type: "Teams", id: organizationId },
        { type: "Projects", id: organizationId },
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
    removeTeamMember: builder.mutation<
      void,
      { organizationId: string; teamId: string; userId: string }
    >({
      query: ({ organizationId, teamId, userId }) => ({
        url: `/organizations/${organizationId}/teams/${teamId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { organizationId, teamId }) => [
        { type: "Teams", id: organizationId },
        { type: "TeamMembers", id: teamId },
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
  useUpdateOrganizationMutation,
  useCreateOrganizationInviteMutation,
  useAcceptOrganizationInviteMutation,
  useListOrganizationMembersQuery,
  useRemoveOrganizationMemberMutation,
  useListOrganizationRolesQuery,
  useCreateOrganizationRoleMutation,
  useUpdateOrganizationRoleMutation,
  useDeleteOrganizationRoleMutation,
  useAssignOrganizationRoleMutation,
  usePromoteOrganizationOwnerMutation,
  useLeaveOrganizationMutation,
  useListTeamsQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useListTeamMembersQuery,
  useListProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
} = api
