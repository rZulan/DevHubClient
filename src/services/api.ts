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
  tagTypes: ["CurrentUser"],
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
  }),
})

export const {
  useGetCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useUpdateCurrentUserMutation,
  useDisconnectExternalAccountMutation,
} = api
