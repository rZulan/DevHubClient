import { configureStore } from "@reduxjs/toolkit"

import authReducer from "@/features/auth/auth-slice"
import counterReducer from "@/features/counter/counter-slice"
import { api } from "@/services/api"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    counter: counterReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
