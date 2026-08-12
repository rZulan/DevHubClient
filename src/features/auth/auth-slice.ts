import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type {
  AuthenticationResponse,
  AuthUser,
  UserResponse,
} from "@/features/auth/auth-types"

type AuthState = {
  accessToken: string | null
  accessTokenExpiresAtUtc: string | null
  user: AuthUser | null
}

const initialState: AuthState = {
  accessToken: null,
  accessTokenExpiresAtUtc: null,
  user: null,
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearSession: () => initialState,
    setCredentials: (state, action: PayloadAction<AuthenticationResponse>) => {
      const response = action.payload

      state.accessToken = response.accessToken
      state.accessTokenExpiresAtUtc = response.accessTokenExpiresAtUtc
      state.user = {
        id: response.userId,
        email: response.email,
        firstName: response.firstName,
        lastName: response.lastName,
        username: response.username,
        dateOfBirth: response.dateOfBirth,
        avatarUrl: response.avatarUrl,
        connectedAccounts: response.connectedAccounts,
      }
    },
    setUser: (state, action: PayloadAction<UserResponse>) => {
      state.user = action.payload
    },
  },
})

export const { clearSession, setCredentials, setUser } = authSlice.actions
export default authSlice.reducer
